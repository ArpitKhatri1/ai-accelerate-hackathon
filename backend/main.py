import asyncio
import datetime
import decimal
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional, cast

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from google.genai import types
from dotenv import load_dotenv
import google.generativeai as genai
import google.auth
from google.auth.credentials import Credentials as GoogleCredentials
from google.cloud import bigquery
from google.oauth2 import service_account

load_dotenv()

# Configure the Google AI API key
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# BigQuery configuration
_DEFAULT_SERVICE_ACCOUNT_FILE = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "../agents/docusign-arpit.json",
    )
)
SERVICE_ACCOUNT_FILE = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", _DEFAULT_SERVICE_ACCOUNT_FILE)

DOCUSIGN_DATASET = "docusign-475113.customdocusignconnector"
ENVELOPES_TABLE = f"`{DOCUSIGN_DATASET}.envelopes`"
DOCUMENTS_TABLE = f"`{DOCUSIGN_DATASET}.documents`"
CUSTOM_FIELDS_TABLE = f"`{DOCUSIGN_DATASET}.custom_fields`"
RECIPIENTS_TABLE = f"`{DOCUSIGN_DATASET}.recipients`"


def _create_bigquery_client() -> Optional[bigquery.Client]:
    credentials: Optional[GoogleCredentials] = None
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")

    if SERVICE_ACCOUNT_FILE and os.path.exists(SERVICE_ACCOUNT_FILE):
        try:
            svc_credentials = service_account.Credentials.from_service_account_file(
                SERVICE_ACCOUNT_FILE,
                scopes=["https://www.googleapis.com/auth/cloud-platform"],
            )
            credentials = cast(GoogleCredentials, svc_credentials)
            if svc_credentials.project_id:
                project_id = svc_credentials.project_id
        except Exception as exc:  # pragma: no cover - logging path
            print(f"[analytics] Failed to load service account credentials: {exc}")
            credentials = None

    if credentials is None:
        try:
            default_credentials, project_id = google.auth.default(
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            credentials = cast(GoogleCredentials, default_credentials)
        except Exception as exc:  # pragma: no cover - logging path
            print(f"[analytics] Default credentials not available: {exc}")
            return None

    try:
        return bigquery.Client(credentials=credentials, project=project_id)
    except Exception as exc:  # pragma: no cover - logging path
        print(f"[analytics] BigQuery client creation failed: {exc}")
        return None


bigquery_client = _create_bigquery_client()

# Add the parent directory to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from agents.root_agent.agent import root_agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Session and Runner setup
APP_NAME = "ai_accelerate_hackathon"
USER_ID = "user1234"
SESSION_ID = "1234"

session_service = InMemorySessionService()
runner = Runner(agent=root_agent, app_name=APP_NAME, session_service=session_service)

async def setup_session():
    return await session_service.create_session(
        app_name=APP_NAME, user_id=USER_ID, session_id=SESSION_ID
    )


@app.get("/analytics/kpis")
async def get_dashboard_kpis():
    query = f"""
    SELECT
      SAFE_DIVIDE(
        AVG(IF(sent_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY), contract_cycle_time_hours, NULL)),
        24.0
      ) AS avg_cycle_days,
      COUNTIF(status = 'completed' AND completed_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)) AS completed_last_30,
      COUNTIF(status NOT IN ('completed', 'voided', 'declined') AND last_modified_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)) AS pending_envelopes
    FROM {ENVELOPES_TABLE}
    """

    try:
        rows = await run_bigquery_query(query)
    except Exception as exc:
        print(f"[analytics] Failed to fetch KPI data: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch analytics KPIs")

    record = rows[0] if rows else {}
    avg_cycle_days = float(record.get("avg_cycle_days") or 0.0)
    completed_last_30 = int(record.get("completed_last_30") or 0)
    pending_envelopes = int(record.get("pending_envelopes") or 0)

    return {
        "average_contract_cycle_days": round(avg_cycle_days, 2),
        "average_contract_cycle_hours": round(avg_cycle_days * 24.0, 2),
        "agreements_completed_last_30_days": completed_last_30,
        "pending_envelopes_last_90_days": pending_envelopes,
    }


@app.get("/analytics/envelopes/cycle-time-by-document")
async def get_cycle_time_by_document(limit: int = 6):
    limit = max(1, min(limit, 25))
    query = f"""
        SELECT
            COALESCE(NULLIF(cf.value, ''), 'Unknown') AS envelope_type,
            AVG(envelope.contract_cycle_time_hours) AS avg_cycle_hours
        FROM {CUSTOM_FIELDS_TABLE} AS cf
        LEFT JOIN {ENVELOPES_TABLE} AS envelope
            ON cf.envelope_id = envelope.envelope_id
        WHERE envelope.contract_cycle_time_hours IS NOT NULL
          AND cf.value IS NOT NULL
          AND TRIM(cf.value) != ''
        GROUP BY cf.value
        HAVING avg_cycle_hours IS NOT NULL
        ORDER BY avg_cycle_hours DESC
        LIMIT @limit
    """

    params = [bigquery.ScalarQueryParameter("limit", "INT64", limit)]

    try:
        rows = await run_bigquery_query(query, params)
    except Exception as exc:
        print(f"[analytics] Failed to fetch cycle time data: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch cycle time analytics")

    items = []
    for row in rows:
        envelope_type = (row.get("envelope_type") or "").strip()
        if not envelope_type:
            envelope_type = "Unknown"
        avg_hours_val = row.get("avg_cycle_hours")
        if avg_hours_val is None:
            continue
        items.append({
            "type": envelope_type.title(),
            "avgHours": round(float(avg_hours_val), 2),
        })

    return {"items": items}


@app.get("/analytics/envelopes/daily-sent-vs-completed")
async def get_daily_sent_vs_completed(days: int = 10):
    window_days = max(1, min(days, 30))
    query = f"""
    WITH offsets AS (
      SELECT value AS offset
      FROM UNNEST(GENERATE_ARRAY(0, @window_days - 1)) AS value
    ),
    calendar AS (
      SELECT DATE_SUB(CURRENT_DATE(), INTERVAL offset DAY) AS event_date
      FROM offsets
    ),
    sent AS (
      SELECT DATE(sent_timestamp) AS event_date, COUNT(*) AS sent_count
      FROM {ENVELOPES_TABLE}
      WHERE sent_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @window_days DAY)
      GROUP BY event_date
    ),
    completed AS (
      SELECT DATE(completed_timestamp) AS event_date, COUNT(*) AS completed_count
      FROM {ENVELOPES_TABLE}
      WHERE completed_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @window_days DAY)
      GROUP BY event_date
    )
    SELECT
      calendar.event_date AS event_date,
      COALESCE(sent.sent_count, 0) AS sent,
      COALESCE(completed.completed_count, 0) AS completed
    FROM calendar
    LEFT JOIN sent USING (event_date)
    LEFT JOIN completed USING (event_date)
    ORDER BY event_date
    """

    params = [bigquery.ScalarQueryParameter("window_days", "INT64", window_days)]

    try:
        rows = await run_bigquery_query(query, params)
    except Exception as exc:
        print(f"[analytics] Failed to fetch daily envelope metrics: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch envelope trend analytics")

    items = [
        {
            "date": row.get("event_date"),
            "sent": int(row.get("sent") or 0),
            "completed": int(row.get("completed") or 0),
        }
        for row in rows
    ]

    return {"items": items}


@app.get("/analytics/envelopes/status-distribution")
async def get_status_distribution(limit: int = 6):
    limit = max(1, min(limit, 20))
    query = f"""
    SELECT
      status,
      COUNT(*) AS total
    FROM {ENVELOPES_TABLE}
    GROUP BY status
    ORDER BY total DESC
    LIMIT @limit
    """

    params = [bigquery.ScalarQueryParameter("limit", "INT64", limit)]

    try:
        rows = await run_bigquery_query(query, params)
    except Exception as exc:
        print(f"[analytics] Failed to fetch status distribution: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch envelope status distribution")

    items = [
        {
            "status": (row.get("status") or "unknown").title(),
            "count": int(row.get("total") or 0),
        }
        for row in rows
    ]

    return {"items": items}


@app.get("/analytics/envelopes/table")
async def get_envelopes_table(limit: int = 12, page: int = 1, q: Optional[str] = None, status: Optional[str] = None):
    """Return tabular envelope data for dashboard table with recipients list.

    Columns: envelope_id, subject (name), recipients (comma-separated), sent_date, completed_date, status
    """
    limit = max(1, min(limit, 100))
    page = max(1, page)
    offset = (page - 1) * limit

    search_clause = ""
    status_clause = ""
    # allow mixing scalar and array params
    params: List[Any] = [
        bigquery.ScalarQueryParameter("limit", "INT64", limit),
        bigquery.ScalarQueryParameter("offset", "INT64", offset),
    ]

    if q:
        search_clause = f"""
            AND (
                LOWER(envelope.envelope_id) LIKE LOWER(CONCAT('%', @q, '%')) OR
                LOWER(envelope.subject) LIKE LOWER(CONCAT('%', @q, '%')) OR
                EXISTS (
                    SELECT 1 FROM {RECIPIENTS_TABLE} r
                    WHERE r.envelope_id = envelope.envelope_id
                        AND (LOWER(r.name) LIKE LOWER(CONCAT('%', @q, '%')) OR LOWER(r.email) LIKE LOWER(CONCAT('%', @q, '%')))
                )
            )
        """
        params.append(bigquery.ScalarQueryParameter("q", "STRING", q))

    # status filter: accepts comma-separated values, case-insensitive
    if status:
        status_values = [s.strip().lower() for s in status.split(",") if s.strip()]
        if status_values:
            status_clause = """
                AND LOWER(envelope.status) IN UNNEST(@status_list)
            """
            params.append(bigquery.ArrayQueryParameter("status_list", "STRING", status_values))

    query = f"""
    WITH recipients_agg AS (
        SELECT envelope_id, STRING_AGG(name, ', ' ORDER BY name) AS recipients
        FROM {RECIPIENTS_TABLE}
        GROUP BY envelope_id
    ), filtered AS (
        SELECT
            envelope.envelope_id,
            envelope.subject AS name,
            recipients_agg.recipients AS recipients,
            DATE(envelope.sent_timestamp) AS sent_date,
            DATE(envelope.completed_timestamp) AS completed_date,
            envelope.status
        FROM {ENVELOPES_TABLE} envelope
        LEFT JOIN recipients_agg USING (envelope_id)
    WHERE 1=1
    {search_clause}
    {status_clause}
    ), ordered AS (
        SELECT *, COUNT(*) OVER() AS total_count
        FROM filtered
        ORDER BY sent_date DESC NULLS LAST, envelope_id DESC
    )
    SELECT * FROM ordered
    LIMIT @limit OFFSET @offset
    """

    try:
        rows = await run_bigquery_query(query, params)
    except Exception as exc:
        print(f"[analytics] Failed to fetch envelopes table: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch envelopes table")

    def _fmt_date(value: Any) -> Optional[str]:
        if not value:
            return None
        if isinstance(value, str):
            return value
        if isinstance(value, (datetime.datetime, datetime.date)):
            return value.isoformat()
        return str(value)

    items: List[Dict[str, Any]] = [
        {
            "envelopeId": row.get("envelope_id"),
            "name": row.get("name") or "—",
            "recipients": row.get("recipients") or "—",
            "sentDate": _fmt_date(row.get("sent_date")),
            "completedDate": _fmt_date(row.get("completed_date")),
            "status": (row.get("status") or "unknown").lower(),
        }
        for row in rows
    ]
    total = 0
    if rows:
        try:
            total = int(rows[0].get("total_count") or 0)
        except Exception:
            total = 0

    return {"items": items, "page": page, "limit": limit, "total": total}


def _serialize_value(value: Any) -> Any:
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, datetime.datetime):
        return value.isoformat()
    if isinstance(value, datetime.date):
        return value.isoformat()
    return value


def _serialize_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {column: _serialize_value(value) for column, value in row.items()}
        for row in rows
    ]


async def run_bigquery_query(
    query: str, query_parameters: Optional[List[bigquery.ScalarQueryParameter]] = None
) -> List[Dict[str, Any]]:
    client = bigquery_client
    if client is None:
        raise RuntimeError("BigQuery client is not configured")

    def _execute() -> List[Dict[str, Any]]:
        job_config = bigquery.QueryJobConfig(query_parameters=query_parameters or [])
        job = client.query(query, job_config=job_config)
        results = job.result()
        return [dict(row.items()) for row in results]

    loop = asyncio.get_running_loop()
    raw_rows = await loop.run_in_executor(None, _execute)
    return _serialize_rows(raw_rows)

ALLOWED_CHART_TYPES = {"bar", "double-bar", "line", "pie"}


def extract_structured_payload(raw: str) -> Optional[Any]:
    """Return parsed JSON object from a markdown code fence or raw JSON string."""
    if not raw:
        return None

    fence_match = re.search(r"```json\s*([\s\S]*?)```", raw)
    candidate = fence_match.group(1).strip() if fence_match else raw.strip()
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        return None


def is_chart_payload(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    chart_id = value.get("id")
    chart_type = value.get("type")
    data = value.get("data")
    if not isinstance(chart_id, str):
        return False
    if not isinstance(chart_type, str) or chart_type not in ALLOWED_CHART_TYPES:
        return False
    if not isinstance(data, list):
        return False
    return True


def normalize_message_content(value: Any) -> Dict[str, Any]:
    if not isinstance(value, dict):
        return {}

    result: Dict[str, Any] = {}

    text_candidate = value.get("text") or value.get("message")
    if isinstance(text_candidate, str) and text_candidate.strip():
        result["text"] = text_candidate

    charts_candidate = value.get("charts")
    if isinstance(charts_candidate, list):
        charts = [chart for chart in charts_candidate if is_chart_payload(chart)]
        if charts:
            result["charts"] = charts
    else:
        chart_candidate = value.get("chart")
        if is_chart_payload(chart_candidate):
            result["charts"] = [chart_candidate]

    return result


def extract_json_candidate(raw: str) -> Optional[str]:
    if not raw:
        return None
    match = re.search(r"```json\s*([\s\S]*?)```", raw)
    if match and match.group(1):
        return match.group(1)
    trimmed = raw.strip()
    return trimmed or None


def merge_content(base: Dict[str, Any], addition: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(base)
    for key, value in addition.items():
        if value is None:
            continue
        if key == "charts" and value:
            merged[key] = value
        elif key == "text" and isinstance(value, str):
            merged[key] = value
    return merged


def build_widget_prompt(prompt: str, kind: str, chart_type: Optional[str]) -> str:
    base_prompt = prompt.strip()
    if kind == "text-insight":
        return (
            "You are an analytics insights agent. Craft concise, decision-ready written insights "
            "based on the data instructions. When possible, respond with JSON containing a \"text\" field.\n\n"
            f"{base_prompt}"
        )

    chart_label = chart_type or "bar"
    return (
        "You are an analytics chart-building agent. Produce a {chart_type} chart using the user's instructions. "
        "Respond with JSON that includes an array of charts when possible.\n\n"
    ).format(chart_type=chart_label) + base_prompt

@app.post("/chat")
async def chat(request: Request):
    body = await request.json()
    message = body.get("message")
    history = body.get("history", [])  # Add history from frontend

    print("[chat] Incoming request", json.dumps({
        "message": message,
        "history": history,
    }, indent=2))

    if not message:
        return {"error": "Message not found"}

    await setup_session()

    transcript_segments = []
    for msg in history:
        role = msg.get("role", "user")
        text_value = msg.get("text", "")
        if isinstance(text_value, dict):
            text_value = json.dumps(text_value)
        transcript_segments.append(f"{role}: {text_value}")

    transcript_segments.append(f"user: {message}")

    content = types.Content(
        role="user",
        parts=[types.Part(text="\n\n".join(transcript_segments))],
    )

    async def event_stream():
        try:
            async for event in runner.run_async(
                user_id=USER_ID, session_id=SESSION_ID, new_message=content
            ):
                if event.is_final_response() and event.content and event.content.parts:
                    text_parts = [str(getattr(part, "text", "") or "") for part in event.content.parts]
                    combined_text = "".join(text_parts)
                    structured = extract_structured_payload(combined_text)
                    payload = {"raw": combined_text}
                    print("structured is", payload)
                    if structured is not None:
                        payload["structured"] = structured
                    print("[chat] Final event payload", json.dumps({
                        "parts": text_parts,
                        "combined": combined_text,
                        "structured": structured,
                    }, indent=2))
                    yield f"data: {json.dumps(payload)}\n\n"
                else:
                    print("[chat] Non-final event encountered", repr(event))
        except Exception as e:
            print(f"An error occurred: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/analytics/resolve-widget")
async def resolve_widget(request: Request):
    body = await request.json()
    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        return {"error": "Prompt is required"}

    kind = body.get("kind", "chart")
    if kind not in {"chart", "text-insight"}:
        kind = "chart"

    chart_type_value: Optional[str] = None
    if kind == "chart":
        candidate = body.get("chartType")
        if isinstance(candidate, str) and candidate in ALLOWED_CHART_TYPES:
            chart_type_value = candidate
        else:
            chart_type_value = "bar"

    agent_prompt = build_widget_prompt(prompt, kind, chart_type_value)

    await setup_session()

    content = types.Content(
        role="user",
        parts=[types.Part(text=agent_prompt)],
    )

    raw_text = ""
    structured_payload: Optional[Any] = None

    try:
        async for event in runner.run_async(
            user_id=USER_ID, session_id=SESSION_ID, new_message=content
        ):
            if event.is_final_response() and event.content and event.content.parts:
                text_parts = [
                    str(getattr(part, "text", "") or "") for part in event.content.parts
                ]
                combined_text = "".join(text_parts)
                raw_text = combined_text
                candidate_structured = extract_structured_payload(combined_text)
                if candidate_structured is not None:
                    structured_payload = candidate_structured
    except Exception as exc:
        print("[resolve-widget] Agent run failed", exc)
        return {"error": str(exc)}

    message_content: Dict[str, Any] = {"raw": raw_text}
    message_content = merge_content(
        message_content,
        normalize_message_content(structured_payload) if structured_payload else {},
    )

    needs_additional_parsing = False
    if kind == "chart" and not message_content.get("charts"):
        needs_additional_parsing = True
    if not message_content.get("text"):
        needs_additional_parsing = True

    if needs_additional_parsing and raw_text:
        candidate_json = extract_json_candidate(raw_text)
        if candidate_json:
            try:
                parsed = json.loads(candidate_json)
                message_content = merge_content(
                    message_content, normalize_message_content(parsed)
                )
            except json.JSONDecodeError:
                pass

    if kind == "text-insight" and not message_content.get("text"):
        message_content["text"] = raw_text

    charts_payload = message_content.get("charts")
    if not isinstance(charts_payload, list):
        charts_payload = []

    return {
        "content": {
            "raw": message_content.get("raw", raw_text),
            "text": message_content.get("text"),
            "charts": charts_payload,
        }
    }


@app.get("/")
def read_root():
    return {"Hello": "World"}


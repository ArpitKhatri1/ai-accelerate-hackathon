import asyncio
import json
import re
import sys
import os
from typing import Any, Dict, Optional

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from google.genai import types
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

# Configure the Google AI API key
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

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


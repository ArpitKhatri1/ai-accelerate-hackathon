from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from google.cloud import bigquery

from .config import (
    CUSTOM_FIELDS_TABLE,
    ENVELOPES_TABLE,
    RECIPIENTS_TABLE,
)
from .database import run_bigquery_query
from .utils import format_date

async def get_dashboard_kpis():
    """Get key performance indicators for the dashboard."""
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

async def get_cycle_time_by_document(limit: int = 6):
    """Get cycle time analytics grouped by document type."""
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
          AND LOWER(TRIM(cf.value)) NOT IN ('docusignit', 'docusignweb')
          AND (
              envelope.sent_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 60 DAY)
              OR envelope.completed_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 60 DAY)
          )
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

async def get_daily_sent_vs_completed(days: int = 60):
    """Get daily envelope sent vs completed metrics."""
    window_days = max(1, 60)
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
    WHERE COALESCE(sent.sent_count, 0) > 0 OR COALESCE(completed.completed_count, 0) > 0
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

async def get_status_distribution(limit: int = 6):
    """Get envelope status distribution."""
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

async def get_envelopes_table(limit: int = 12, page: int = 1, q: Optional[str] = None, status: Optional[str] = None):
    """Return tabular envelope data for dashboard table with recipients list."""
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

    items: List[Dict[str, Any]] = [
        {
            "envelopeId": row.get("envelope_id"),
            "name": row.get("name") or "—",
            "recipients": row.get("recipients") or "—",
            "sentDate": format_date(row.get("sent_date")),
            "completedDate": format_date(row.get("completed_date")),
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


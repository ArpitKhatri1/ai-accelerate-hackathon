import datetime
import json
import re
from typing import Any, Dict, List, Optional

ALLOWED_CHART_TYPES = {"bar", "double-bar", "line", "pie"}

def format_date(value: Any) -> Optional[str]:
    """Format date values for API responses."""
    if not value:
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, (datetime.datetime, datetime.date)):
        return value.isoformat()
    return str(value)

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
    """Check if a value represents a valid chart payload."""
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
    """Normalize message content from various formats."""
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
    """Extract JSON content from markdown code fences or raw strings."""
    if not raw:
        return None
    match = re.search(r"```json\s*([\s\S]*?)```", raw)
    if match and match.group(1):
        return match.group(1)
    trimmed = raw.strip()
    return trimmed or None

def merge_content(base: Dict[str, Any], addition: Dict[str, Any]) -> Dict[str, Any]:
    """Merge content dictionaries, handling special cases for charts and text."""
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
    """Build a prompt for widget generation based on kind and chart type."""
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


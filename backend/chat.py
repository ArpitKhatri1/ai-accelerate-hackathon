import json
import os
from typing import Any, Dict, Optional

from fastapi import HTTPException, Request
from fastapi.responses import StreamingResponse
from google.genai import types

from .agents.root_agent.agent import root_agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

from .config import APP_NAME, USER_ID, SESSION_ID
from .utils import (
    ALLOWED_CHART_TYPES,
    build_widget_prompt,
    extract_json_candidate,
    extract_structured_payload,
    merge_content,
    normalize_message_content,
)

# Session and Runner setup
session_service = InMemorySessionService()
runner = Runner(agent=root_agent, app_name=APP_NAME, session_service=session_service)

async def setup_session():
    """Initialize the session for the agent runner."""
    return await session_service.create_session(
        app_name=APP_NAME, user_id=USER_ID, session_id=SESSION_ID
    )

async def chat(request: Request):
    """Handle chat requests with streaming responses."""
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

async def resolve_widget(request: Request):
    """Resolve widget requests for analytics charts and insights."""
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


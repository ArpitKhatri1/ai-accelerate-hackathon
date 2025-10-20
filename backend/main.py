import asyncio
import json
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from google.genai import types
import sys
import os
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

@app.post("/chat")
async def chat(request: Request):
    body = await request.json()
    message = body.get("message")
    history = body.get("history", [])  # Add history from frontend

    if not message:
        return {"error": "Message not found"}

    await setup_session()

    # Build content with history
    content_parts = []
    for msg in history:
        content_parts.append(types.Part(text=msg["text"]))
    content_parts.append(types.Part(text=message))  # Current message

    content = types.Content(role="user", parts=content_parts)

    async def event_stream():
        try:
            async for event in runner.run_async(
                user_id=USER_ID, session_id=SESSION_ID, new_message=content
            ):
                if event.is_final_response() and event.content and event.content.parts:
                    text = event.content.parts[0].text
                    if text:
                        yield f"data: {json.dumps({'text': text})}\n\n"
        except Exception as e:
            print(f"An error occurred: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/")
def read_root():
    return {"Hello": "World"}


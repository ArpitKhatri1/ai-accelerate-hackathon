from typing import Optional

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .config import CORS_ORIGINS
from .analytics import (
    get_dashboard_kpis,
    get_cycle_time_by_document,
    get_daily_sent_vs_completed,
    get_status_distribution,
    get_envelopes_table,
)
from .chat import chat, resolve_widget

# Load environment variables from .env for local development
load_dotenv()

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Analytics routes (delegating to analytics module)
@app.get("/analytics/kpis")
async def analytics_kpis():
    return await get_dashboard_kpis()

@app.get("/analytics/envelopes/cycle-time-by-document")
async def analytics_cycle_time(limit: int = 6):
    return await get_cycle_time_by_document(limit)

@app.get("/analytics/envelopes/daily-sent-vs-completed")
async def analytics_daily_sent_vs_completed(days: int = 60):
    return await get_daily_sent_vs_completed(days)

@app.get("/analytics/envelopes/status-distribution")
async def analytics_status_distribution(limit: int = 6):
    return await get_status_distribution(limit)

@app.get("/analytics/envelopes/table")
async def analytics_envelopes_table(
    limit: int = 12,
    page: int = 1,
    q: Optional[str] = None,
    status: Optional[str] = None,
):
    return await get_envelopes_table(limit, page, q, status)

# Chat routes (delegating to chat module)
@app.post("/chat")
async def chat_endpoint(request: Request):
    return await chat(request)

@app.post("/analytics/resolve-widget")
async def resolve_widget_endpoint(request: Request):
    return await resolve_widget(request)

@app.get("/")
def read_root():
    return {"Hello": "World"}


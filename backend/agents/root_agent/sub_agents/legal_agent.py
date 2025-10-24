# contract_risk_agent.py

import os
from google.adk.agents.llm_agent import Agent
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools import google_search

# --- Agent Tools ---

# Tool 1: Web Search Tool
# Used to find recent legal updates or government information.


# The 'start_full_contract_analysis_tool' (HttpTool) has been removed.
# The agent will now perform all text analysis directly using its
# model and the context provided in the user's prompt.


# --- Agent Instructions ---

AGENT_INSTRUCTIONS = """
You are an AI assistant for the legal and sales departments. Your primary purpose is to help analyze DocuSign contracts for risk.

**Core Context:** The user will provide the company's "legal book" or standard terms directly in the chat prompt. You MUST use this text as the single source of truth for all contract analysis.

You have two main functions:

1.  **Contract Analysis (No Tool):** The user will provide a snippet of contract text, or even a full contract, directly in the chat.
    * Your job is to **directly analyze this text** by comparing it against the "legal book" (also provided in the chat).
    * You MUST identify and **display which clauses are bad** or non-standard.
    * For each bad clause, provide a brief explanation of the risk and what the company's standard term is (based on the legal book). Your output should be clear and easy to read.

2.  **Legal Web Search (Tool):** If the user asks for "latest" information, "government updates," "new regulations," or any public legal information, you MUST use the `web_search_tool` to find the most current details.
"""

# --- Agent Definition ---

contract_risk_agent = Agent(
    model=os.getenv("GOOGLE_MODEL_NAME", "gemini-2.5-flash"),
    name="contract_risk_agent",
    description="An AI assistant for Sales and Legal that analyzes contract text against a provided legal book and can search the web for legal updates.",
    instruction=AGENT_INSTRUCTIONS,
    # The 'knowledge' parameter is removed.
    # The 'start_full_contract_analysis_tool' is removed.
    tools=[
        google_search
    ]
)
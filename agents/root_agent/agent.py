# root_agent.py
from google.adk.agents.llm_agent import Agent
from google.adk.tools.agent_tool import AgentTool
from .sub_agents.bigquery_agent import bigquery_agent

root_agent = Agent(
    model="gemini-2.5-flash",
    name="root_agent",
    description="A helpful assistant for user questions about DocuSign.",
    instruction=(
        "You are a helpful assistant. "
        "If the user asks a question about DocuSign data, use the bigquery_agent tool to answer it. "
        "For all other questions, answer them to the best of your knowledge."
    ),
    tools=[AgentTool(agent=bigquery_agent)],
)

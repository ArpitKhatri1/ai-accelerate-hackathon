from google.adk.agents.llm_agent import Agent
from google.adk.tools.agent_tool import AgentTool
from .bigquery_agent import bigquery_agent

chart_agent = Agent(
    model='gemini-2.5-flash',
    name='chart_agent',
    description='An agent that can generate data for charts by querying the database.',
    tools=[AgentTool(agent=bigquery_agent)],
    instruction="""You are an expert in generating JSON data for charts.
Your task is to generate a JSON object for a chart based on the user's request.
To get the data for the chart, you MUST use the `bigquery_agent` tool.
You should ask the `bigquery_agent` a clear, natural language question to get the data you need.

Once you have the data from the `bigquery_agent`, format it into the specified JSON structure.

For a bar chart, the JSON should have a "type" of "bar" and a "data" array of objects, where each object has a "name" and a "total".

Example user request: "Show me a bar chart of envelopes by status"

Your process:
1. Use the `bigquery_agent` tool with a query like: "What is the count of envelopes for each status?"
2. The tool returns the data, for example: `[{"status": "sent", "count": 5}, {"status": "completed", "count": 10}]`
3. You then format this data into the final JSON response.
4. Do not include any explanations or additional text, only return the JSON object. `like Here is the data for a bar chart showing envelopes by status:` no this kind of introductory text .JUST THE JSON RESPONSE
5. For bar charts, ensure each data object uses the keys "name" and "number" only.
Example JSON response:
```json
{
  "type": "bar",
  "data": [
    { "name": "sent", "number": 5 },
    { "name": "completed", "number": 10 }
  ]
}
```
""",
  
)

# sub_agents/bigquery_agent.py
from google.adk.agents.llm_agent import Agent
from google.adk.tools.bigquery import (
    BigQueryToolset,
    BigQueryCredentialsConfig,
)
from google.adk.tools.bigquery.config import BigQueryToolConfig, WriteMode
import google.oauth2.service_account
import os
import sys

# --- SERVICE ACCOUNT CONFIGURATION ---
SERVICE_ACCOUNT_FILE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../docusign-475113-4054c4d08fa3-python-runner-service.json")
)

if not os.path.exists(SERVICE_ACCOUNT_FILE):
    print(f"❌ Error: Service account key file not found at {SERVICE_ACCOUNT_FILE}")
    print("Please download the JSON key from your Google Cloud project and update the SERVICE_ACCOUNT_FILE path.")
    sys.exit(1)

# Load credentials
credentials = google.oauth2.service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE
)

# Create BigQuery credentials config
credentials_config = BigQueryCredentialsConfig(credentials=credentials)

# Disallow write operations
tool_config = BigQueryToolConfig(write_mode=WriteMode.BLOCKED)

# Create BigQuery toolset
# Instantiate a BigQuery toolset
bigquery_toolset = BigQueryToolset(
    
    credentials_config=credentials_config, 
    bigquery_tool_config=tool_config
)

print(os.getenv("GOOGLE_MODEL_NAME", "gemini-2.5-flash-wefaewf"))


# Define the BigQuery agent
bigquery_agent = Agent(
    model=os.getenv("GOOGLE_MODEL_NAME", "gemini-2.5-flash-awfwef"),
    name="bigquery_agent",
    description="An agent that can query the DocuSign BigQuery dataset.",
    instruction=(
      "You are an expert GoogleSQL query-writer for a DocuSign database. "
        "A user will ask a question in natural language. You must: \n"
        "1.  Understand the user's intent and identify which tables to query. \n"
        "2.  Use the provided BigQuery tool to get the schema for those tables. \n"
        "3.  Write a single, accurate GoogleSQL query to answer the question. \n"
        "4.  Run the query using the provided tools. \n"
        "5.  Return the final answer to the user in a clear, friendly way. \n"
        "\n"
        "**RULES:** \n"
        "- ALWAYS query the `docusign-475113.customdocusignconnector` dataset. \n"
        "- ONLY use the table and column names provided in the schema. Do not guess. \n"
        "- If the user's question is ambiguous, ask for clarification before querying. \n"
        "- Do not perform any write operations (INSERT, UPDATE, DELETE, etc.)."
    ),
    tools=[bigquery_toolset],
)

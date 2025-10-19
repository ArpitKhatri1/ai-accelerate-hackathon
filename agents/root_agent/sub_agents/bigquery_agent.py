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



# Define the BigQuery agent
bigquery_agent = Agent(
    model="gemini-2.5-flash",
    name="bigquery_agent",
    description="An agent that can query the DocuSign BigQuery dataset.",
    instruction=(
        "You are an expert in BigQuery SQL. "
        "Always use the docusign-475113 project and customdocusignconnector dataset to answer user questions"
        "Given a user question, generate and run a SQL query against the DocuSign database to answer the question. "
        "Always use the provided tools to execute queries safely."
    ),
    tools=[bigquery_toolset],
)

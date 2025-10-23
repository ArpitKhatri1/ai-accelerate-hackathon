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

DOCUSIGN_SCHEMA_REFERENCE = """
SCHEMA REFERENCE — DocuSign Analytics
Dataset: `docusign-475113.customdocusignconnector`

Table `envelopes` — Contract lifecycle summary for each DocuSign envelope.
Columns:
- `envelope_id` (STRING, PK): Unique envelope identifier.
- `status` (STRING): Current DocuSign status (e.g., sent, completed, voided).
- `sent_timestamp` (TIMESTAMP): Date/time the envelope was sent to recipients.
- `completed_timestamp` (TIMESTAMP): Date/time the envelope reached a completed state.
- `created_timestamp` (TIMESTAMP): Date/time the envelope was created.
- `last_modified_timestamp` (TIMESTAMP): Most recent status change timestamp.
- `expire_after` (INTEGER): No of Days after which the envelope expires. Use this + created_timestamp to calculate expiration date.
- `subject` (STRING): Email subject line associated with the envelope.
- `contract_cycle_time_hours` (FLOAT): Hours between sent and completed timestamps.
- `conversion_status` (STRING): Mirrors DocuSign status for downstream analytics.

Table `recipients` — Primary recipient roster summarizing signer, carbon copy, and in-person roles with the latest routing order, status, and contact information per envelope.
Columns:
- `envelope_id` (STRING, FK): Parent envelope identifier.
- `recipient_id` (STRING, PK segment): DocuSign recipient identifier.
- `name` (STRING): Recipient full name as captured in DocuSign.
- `email` (STRING): Recipient email address.
- `status` (STRING): Recipient-level status (delivered, completed, declined, etc.).
- `type` (STRING): Recipient role (signer, carbon copy, certified delivery, in-person signer).
- `routing_order` (INTEGER): Recipient order in the routing workflow.

Table `enhanced_recipients` — Extended recipient history capturing reminder activity, decline reasons, and key milestone timestamps to support SLA and escalation tracking.
Columns:
- `envelope_id` (STRING, FK): Parent envelope identifier.
- `recipient_id` (STRING, PK segment): DocuSign recipient identifier.
- `name` (STRING): Recipient full name as captured in DocuSign.
- `email` (STRING): Recipient email address.
- `status` (STRING): Recipient-level status (delivered, completed, declined, etc.).
- `type` (STRING): Recipient role (signer, carbon copy, certified delivery, in-person signer).
- `routing_order` (INTEGER): Recipient order in the routing workflow.
- `declined_reason` (STRING): Reason provided when a recipient declines.
- `sent_timestamp` (TIMESTAMP): Time the envelope was sent to the recipient.
- `signed_timestamp` (TIMESTAMP): Time the recipient completed their action.

Table `audit_events` — Flattened DocuSign audit trail activity.
Columns:
- `envelope_id` (STRING, FK): Parent envelope identifier.
- `event_id` (STRING, PK): Synthetic ID built from `envelope_id` and event `logtime`.
- Additional columns appear dynamically for each event, mirroring DocuSign audit field
    names in lowercase (e.g., `logtime`, `activity`, `eventdescription`, `useremail`,
    `authenticationmethod`). Treat these as STRING/TIMESTAMP fields depending on context.

Table `documents` — Envelope document catalog metadata.
Columns:
- `envelope_id` (STRING, FK): Parent envelope identifier.
- `document_id` (STRING, PK segment): DocuSign document identifier within the envelope.
- `name` (STRING): Document display name.
- `type` (STRING): DocuSign document classification (content, certificate, etc.).
- `pages` (INTEGER): Page count reported by DocuSign.

Table `document_contents` — Base64-encoded document payloads.
Columns:
- `envelope_id` (STRING, FK): Parent envelope identifier.
- `document_id` (STRING, PK segment): Document identifier.
- `content_text` (STRING): Contains plain-text content of entire document for search and analysis.

Table `templates` — Reusable DocuSign template registry.
Columns:
- `template_id` (STRING, PK): Template identifier.
- `name` (STRING): Template display name.
- `description` (STRING): Template description text.
- `created_timestamp` (TIMESTAMP): When the template was created.
- `last_modified_timestamp` (TIMESTAMP): Last modification timestamp.
- `shared` (BOOL/STRING): Indicates whether the template is shared across the account.

Table `custom_fields` — Envelope-level custom metadata captured in DocuSign.
Columns:
- `envelope_id` (STRING, FK): Parent envelope identifier.
- `field_name` (STRING, PK segment): Custom field key.
- `value` (STRING): Captured custom field value.
- `type` (STRING): DocuSign custom field type (text, list, etc.).
"""

# --- SERVICE ACCOUNT CONFIGURATION ---
SERVICE_ACCOUNT_FILE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "./../../docusign-arpit.json")
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

print(os.getenv("GOOGLE_MODEL_NAME", "gemini-2.5-flash"))


BASE_INSTRUCTION = (
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
)


# Define the BigQuery agent
bigquery_agent = Agent(
    model=os.getenv("GOOGLE_MODEL_NAME", "gemini-2.5-flash"),
    name="bigquery_agent",
    description="An agent that can query the DocuSign BigQuery dataset.",
    instruction=BASE_INSTRUCTION + "\n\n" + DOCUSIGN_SCHEMA_REFERENCE,
    tools=[bigquery_toolset],
)

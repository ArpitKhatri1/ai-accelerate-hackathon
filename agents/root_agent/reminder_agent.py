import os 
from dotenv import load_dotenv
import json

from docusign_esign import ApiClient, EnvelopesApi
from docusign_esign.client.api_exception import ApiException
from docusign_esign.models import Recipients, Signer

from google.adk.agents import Agent
from google.adk.tools import Tool

from .sub_agents.bigquery_agent import bigquery_agent


load_dotenv()

# --- Helper Functions (Internal Logic) ---

def _find_expiring_envelope_ids(expiration_time_days: int) -> list[dict]:
    """Internal function to query BigQuery for expiring envelope IDs."""
    prompt = (
        "Find all envelopes that are 'sent' and will expire between now and "
        f"{expiration_time_days} DAY from now. The expiration date is `sent_timestamp` "
        "plus `expire_after` days. **CRITICAL:** Return only a valid JSON array of objects, "
        'each with one key: "envelope_id". Example: [{"envelope_id": "id-123"}]'
    )
    try:
        raw_response = bigquery_agent.query(prompt)
        return json.loads(raw_response)
    except (json.JSONDecodeError, Exception) as e:
        print(f"Error finding envelopes: {e}")
        return []

def _get_envelope_recipients(envelope_id: str, api_client: ApiClient) -> list[Signer]:
    """Internal function to get recipient details for one envelope."""
    account_id = os.getenv("DOCUSIGN_ACCOUNT_ID")
    envelopes_api = EnvelopesApi(api_client)
    try:
        recipients = envelopes_api.list_recipients(account_id=account_id, envelope_id=envelope_id)
        # We only care about signers who haven't completed their action
        return [signer for signer in recipients.signers if signer.status != 'completed']
    except ApiException as e:
        print(f"Could not get recipients for {envelope_id}: {e}")
        return []

def _send_reminder_to_recipient(envelope_id: str, recipient: Signer, api_client: ApiClient):
    """Internal function to send a reminder to one recipient."""
    account_id = os.getenv("DOCUSIGN_ACCOUNT_ID")
    envelopes_api = EnvelopesApi(api_client)
    recipients_to_update = Recipients(signers=[recipient])
    try:
        envelopes_api.update_recipients(
            account_id=account_id,
            envelope_id=envelope_id,
            recipients=recipients_to_update,
            resend_envelope='true'
        )
        print(f"✅ Successfully sent reminder to {recipient.name} for envelope {envelope_id}.")
    except ApiException as e:
        print(f"❌ Failed to send reminder to {recipient.name}: {e}")

# --- Main Workflow Tool ---

def send_reminders_workflow(expiration_threshold_days: int) -> str:
    """
    Finds all DocuSign envelopes expiring within a given number of days
    and sends a reminder notification to each pending recipient.
    """
    print(f"🚀 Starting reminder workflow for envelopes expiring in the next {expiration_threshold_days} days.")
    
    # Configure a single API client for the entire workflow
    access_token = os.getenv("DOCUSIGN_ACCESS_TOKEN")
    if not access_token or not os.getenv("DOCUSIGN_ACCOUNT_ID"):
        return "Error: DocuSign environment variables are not properly set."
        
    api_client = ApiClient()
    api_client.host = 'https://demo.docusign.net/restapi'
    api_client.set_default_header('Authorization', f'Bearer {access_token}')

    envelopes = _find_expiring_envelope_ids(expiration_threshold_days)
    if not envelopes:
        return "No envelopes were found nearing their expiration date."

    sent_count = 0
    for envelope in envelopes:
        envelope_id = envelope['envelope_id']
        recipients = _get_envelope_recipients(envelope_id, api_client)
        for recipient in recipients:
            _send_reminder_to_recipient(envelope_id, recipient, api_client)
            sent_count += 1
    
    summary = f"Workflow complete. Attempted to send {sent_count} reminders across {len(envelopes)} envelopes."
    print(summary)
    return summary


send_reminders_tool = Tool(
    name="send_reminders_for_expiring_envelopes",
    description="Initiates the complete workflow to find expiring envelopes and send reminder notifications to all pending recipients.",
    func=send_reminders_workflow,
)


rem_agent = Agent(
    name="reminder_agent",
    model="gemini-1.5-flash-001",
    description="An agent that sends reminders for expiring DocuSign contracts by running an automated workflow.",
    instruction=(
        """You are a helpful assistant that automates sending DocuSign reminders.
        A user will tell you the expiration threshold in days.
        Your ONLY task is to call the `send_reminders_for_expiring_envelopes` tool with that number.
        Report the final summary from the tool back to the user.
        """
    ),
    tools=[send_reminders_tool],
)
import os 
from dotenv import load_dotenv
import json

from docusign_esign import ApiClient, EnvelopesApi
from docusign_esign.client.api_exception import ApiException
from docusign_esign.models import Recipients, Signer

from google.adk.agents import Agent
from google.adk.tools import AgentTool
from google.adk.tools import FunctionTool

from .bigquery_agent import bigquery_agent


load_dotenv()

# --- Helper Functions (Internal Logic) ---

def _send_reminder_to_recipient(envelope_id: str, recipient_id: str, api_client: ApiClient):
    """Internal function to send a reminder to one recipient using their ID."""
    account_id = os.getenv("DOCUSIGN_ACCOUNT_ID")
    envelopes_api = EnvelopesApi(api_client)
    
    # Construct the minimal Signer object needed for the update
    signer = Signer(recipient_id=recipient_id)
    recipients_to_update = Recipients(signers=[signer])
    
    try:
        envelopes_api.update_recipients(
            account_id=account_id,
            envelope_id=envelope_id,
            recipients=recipients_to_update,
            resend_envelope='true' # This is the key parameter to trigger the reminder
        )
        print(f"✅ Successfully sent reminder to recipient {recipient_id} for envelope {envelope_id}.")
    except ApiException as e:
        print(f"❌ Failed to send reminder to recipient {recipient_id}: {e}")

# --- Main Workflow Tool ---

def send_reminders_workflow(recipients_to_remind: list[dict]) -> str:
    """
    Sends a reminder to each recipient specified in the input list.
    
    Args:
        recipients_to_remind: A list of dictionaries, where each dict
                                contains 'envelope_id' and 'recipient_id'.
    """
    count = len(recipients_to_remind)
    print(f"🚀 Starting reminder workflow for {count} recipients.")
    
    # Configure a single API client for the entire workflow
    access_token = os.getenv("DOCUSIGN_ACCESS_TOKEN")
    if not access_token or not os.getenv("DOCUSIGN_ACCOUNT_ID"):
        return "Error: DocuSign environment variables are not properly set."
        
    api_client = ApiClient()
    api_client.host = 'https://demo.docusign.net/restapi'
    api_client.set_default_header('Authorization', f'Bearer {access_token}')

    sent_count = 0
    for recipient_data in recipients_to_remind:
        try:
            envelope_id = recipient_data['envelope_id']
            recipient_id = recipient_data['recipient_id']
            _send_reminder_to_recipient(envelope_id, recipient_id, api_client)
            sent_count += 1
        except KeyError:
            print(f"❌ Skipping invalid recipient data: {recipient_data}")
        except Exception as e:
            print(f"❌ Failed during reminder for {recipient_data}: {e}")
    
    summary = f"Workflow complete. Attempted to send {sent_count} reminders."
    print(summary)
    return summary

# --- Tool & Agent Definitions ---

send_reminders_tool = FunctionTool(
    func=send_reminders_workflow,
)

rem_agent = Agent(
    name="reminder_agent",
    model=os.getenv("GOOGLE_MODEL_NAME", "gemini-2.5-flash"),
    description="An agent that sends reminders for expiring DocuSign contracts by running an automated workflow.",
    instruction=(
        """You are a helpful assistant that automates sending DocuSign reminders.
        A user will tell you the expiration threshold in days (e.g., "in the next 7 days").
        
        First, use `bigquery_agent` to query for expiring envelopes. Your query must be:
        "Find all envelopes that are 'sent' and will expire between now and X DAY from now (use the user's day count for X). The expiration date is `sent_timestamp` plus `expire_after` days. Return only a valid JSON array of objects, each with 'envelope_id' and 'recipient_id' keys."
        
        Second, parse the returned JSON to get the list of recipient objects.
        
        Third, call the `send_reminders_workflow` tool with the *entire list* of recipient objects you received from BigQuery.

        Finally, report the summary from the `send_reminders_workflow` tool back to the user. You should return the list of envelopes reminded (with recipient names) .
        """
    ),
    tools=[send_reminders_tool, AgentTool(agent=bigquery_agent)],
)
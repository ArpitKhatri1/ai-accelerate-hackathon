"""
DocuSign eSignature API Connector for Fivetran

This connector extracts data from DocuSign eSignature API to enable analytics
for Sales, Legal, HR, and Real Estate departments.

Key data sources:
- Envelopes: Contract cycle time, conversion rates, status tracking
- Recipients: Bottleneck identification, individual signer analytics
- Documents: Contract risk analysis, renewal management
- Templates: Standard template usage tracking
- Custom Fields: Real estate transaction tracking
"""

from fivetran_connector_sdk import Connector, Operations as op,Logging as logger
import json
import requests
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional
import time
import base64



def schema(configuration: dict):
    """
    Define the schema for DocuSign data tables.
    Each table represents a key entity from the DocuSign eSignature API.
    """
    return [
        {"table": "envelopes", "primary_key": ["envelope_id"]},
        {"table": "recipients", "primary_key": ["envelope_id", "recipient_id"]},
        {"table": "enhanced_recipients", "primary_key": ["envelope_id", "recipient_id"]},
        {"table": "audit_events", "primary_key": ["envelope_id", "event_id"]},
        {"table": "envelope_notifications", "primary_key": ["envelope_id", "notification_id"]},
        {"table": "documents", "primary_key": ["envelope_id", "document_id"]},
        {"table": "document_contents", "primary_key": ["envelope_id", "document_id"]},
        {"table": "document_tabs", "primary_key": ["envelope_id", "document_id", "tab_id"]},
        {"table": "templates", "primary_key": ["template_id"]},
        {"table": "custom_fields", "primary_key": ["envelope_id", "field_name"]},
    ]


def get_docusign_headers(configuration: dict) -> Dict[str, str]:
    """
    Generate authentication headers for DocuSign API.
    Uses OAuth2 authentication with access token.
    """
    return {
        "Authorization": f"Bearer {configuration['access_token']}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }


def get_base_url(configuration: dict) -> str:
    """
    Construct the base URL for DocuSign API calls.
    Uses the account ID and base URL from configuration.
    """
    return f"{configuration['base_url']}/v2.1/accounts/{configuration['account_id']}"


def make_api_request_for_content(url: str, headers: Dict[str, str]) -> Optional[bytes]:
    """
    Make authenticated API request to DocuSign for binary file content.
    """
    try:
        response = requests.get(url, headers=headers, timeout=60) # Increased timeout for larger files
        response.raise_for_status()
        return response.content
    except requests.exceptions.RequestException as e:
        logger.warning(f"Failed to download document content from {url}: {e}")
        return None

def make_api_request(url: str, headers: Dict[str, str], params: Optional[Dict] = None) -> Dict[str, Any]:
    """
    Make authenticated API request to DocuSign with error handling.
    Implements retry logic for rate limiting and temporary failures.
    """
    max_retries = 3
    retry_delay = 1
    last_error = None
    
    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=headers, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            last_error = e
            if e.response.status_code == 429:  # Rate limited
                if attempt < max_retries - 1:
                    logger.info(f"Rate limited, retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    
                    
                    retry_delay *= 2
                    continue
            elif e.response.status_code == 401:
                logger.severe("Authentication failed. Please check your access token.")
                
                raise
            elif e.response.status_code >= 500:
                if attempt < max_retries - 1:
                    logger.warning(f"Server error {e.response.status_code}, retrying...")
                    time.sleep(retry_delay)
                    retry_delay *= 2
                    continue
            logger.severe(f"API request failed: {str(e)}")
            raise
        except requests.exceptions.RequestException as e:
            last_error = e
            if attempt < max_retries - 1:
                logger.warning(f"Request failed, retrying in {retry_delay} seconds: {str(e)}")
                time.sleep(retry_delay)
                retry_delay *= 2
                continue
            logger.severe(f"Request failed after {attempt + 1} attempts: {str(e)}")
            raise
    
    error_msg = str(last_error) if last_error else "Maximum retries exceeded"
    logger.severe(f"API request failed after {max_retries} attempts: {error_msg}")
    raise Exception(error_msg)

def fetch_document_content(configuration: dict, envelope_id: str, document_id: str) -> Optional[bytes]:
    """
    Fetch the binary content of a specific document.
    """
    base_url = get_base_url(configuration)
    # Use a modified header that doesn't demand JSON in response
    headers = { "Authorization": f"Bearer {configuration['access_token']}" }
    url = f"{base_url}/envelopes/{envelope_id}/documents/{document_id}"
    
    try:
        content = make_api_request_for_content(url, headers)
        return content
    except Exception as e:
        logger.warning(f"Could not fetch content for document {document_id} in envelope {envelope_id}: {e}")
        return None
    
    
def fetch_envelopes(configuration: dict, state: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Fetch envelopes data with incremental sync support.
    Uses the last_modified_date from state for incremental updates.
    """
    base_url = get_base_url(configuration)
    headers = get_docusign_headers(configuration)
    
    params = {
        "from_date": state.get("last_envelope_sync", "2020-01-01T00:00:00.000Z"),
        "count": 100
    }
    
    all_envelopes = []
    start_position = 0
    
    while True:
        params["start_position"] = start_position
        url = f"{base_url}/envelopes"
        
        try:
            data = make_api_request(url, headers, params)
            envelopes = data.get("envelopes", [])
            
            if not envelopes:
                break
                
            all_envelopes.extend(envelopes)
            start_position += len(envelopes)
            
            if len(envelopes) < params["count"]:
                break
                
        except Exception as e:
            logger.severe(f"Failed to fetch envelopes: {e}")
            break
    
    logger.info(f"Fetched {len(all_envelopes)} envelopes")
    return all_envelopes

def fetch_audit_events(configuration: dict, envelope_id: str) -> List[Dict[str, Any]]:
    """
    Fetch envelope audit events for SLA, deviation, and workflow tracking.
    """
    base_url = get_base_url(configuration)
    headers = get_docusign_headers(configuration)
    url = f"{base_url}/envelopes/{envelope_id}/audit_events"

    try:
        data = make_api_request(url, headers)
        events = data.get("auditEvents", [])
        for event in events:
            event["envelope_id"] = envelope_id
        return events
    except Exception as e:
        logger.warning(f"Could not fetch audit events for envelope {envelope_id}: {e}")
        return []

def fetch_envelope_notifications(configuration: dict, envelope_id: str) -> List[Dict[str, Any]]:
    """
    Fetch envelope notifications like reminders and expirations.
    """
    base_url = get_base_url(configuration)
    headers = get_docusign_headers(configuration)
    url = f"{base_url}/envelopes/{envelope_id}/notification"

    try:
        data = make_api_request(url, headers)
        notifications = data.get("notifications", [])
        for n in notifications:
            n["envelope_id"] = envelope_id
        return notifications
    except Exception as e:
        logger.warning(f"Could not fetch notifications for envelope {envelope_id}: {e}")
        return []

def fetch_enhanced_recipients(configuration: dict, envelope_id: str) -> List[Dict[str, Any]]:
    """
    Fetch recipients with full status history, reminders, declines.
    """
    base_url = get_base_url(configuration)
    headers = get_docusign_headers(configuration)
    url = f"{base_url}/envelopes/{envelope_id}/recipients"
    
    try:
        data = make_api_request(url, headers)
        recipients = []
        for recipient_type in ["signers", "carbon_copies", "certified_deliveries", "in_person_signers"]:
            type_recipients = data.get(recipient_type, [])
            for r in type_recipients:
                r["recipient_type"] = recipient_type
                r["envelope_id"] = envelope_id
                recipients.append(r)
        return recipients
    except Exception as e:
        logger.warning(f"Could not fetch enhanced recipients for envelope {envelope_id}: {e}")
        return []


def fetch_recipients_for_envelope(configuration: dict, envelope_id: str) -> List[Dict[str, Any]]:
    """
    Fetch recipients data for a specific envelope.
    """
    base_url = get_base_url(configuration)
    headers = get_docusign_headers(configuration)
    url = f"{base_url}/envelopes/{envelope_id}/recipients"
    
    try:
        data = make_api_request(url, headers)
        recipients = []
        
        for recipient_type in ["signers", "carbon_copies", "certified_deliveries", "in_person_signers"]:
            type_recipients = data.get(recipient_type, [])
            for recipient in type_recipients:
                recipient["recipient_type"] = recipient_type
                recipient["envelope_id"] = envelope_id
                recipients.append(recipient)
        
        return recipients
    except Exception as e:
        logger.warning(f"Could not fetch recipients for envelope {envelope_id}: {e}")
        return []


def fetch_documents_for_envelope(configuration: dict, envelope_id: str) -> List[Dict[str, Any]]:
    """
    Fetch documents data for a specific envelope.
    """
    base_url = get_base_url(configuration)
    headers = get_docusign_headers(configuration)
    url = f"{base_url}/envelopes/{envelope_id}/documents"
    
    try:
        data = make_api_request(url, headers)
        documents = data.get("envelopeDocuments", [])
        
        for document in documents:
            document["envelope_id"] = envelope_id
        
        return documents
    except Exception as e:
        logger.warning(f"Could not fetch documents for envelope {envelope_id}: {e}")
        return []


def fetch_templates(configuration: dict, state: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Fetch templates data for standard template usage tracking.
    """
    base_url = get_base_url(configuration)
    headers = get_docusign_headers(configuration)
    url = f"{base_url}/templates"
    params = {"count": 100}
    
    all_templates = []
    start_position = 0
    
    while True:
        params["start_position"] = start_position
        
        try:
            data = make_api_request(url, headers, params)
            templates = data.get("envelopeTemplates", [])
            
            if not templates:
                break
                
            all_templates.extend(templates)
            start_position += len(templates)
            
            if len(templates) < params["count"]:
                break
                
        except Exception as e:
            logger.severe(f"Failed to fetch templates: {e}")
            break
    
    return all_templates


def fetch_custom_fields_for_envelope(configuration: dict, envelope_id: str) -> List[Dict[str, Any]]:
    """
    Fetch custom fields for a specific envelope.
    """
    base_url = get_base_url(configuration)
    headers = get_docusign_headers(configuration)
    url = f"{base_url}/envelopes/{envelope_id}/custom_fields"
    
    try:
        data = make_api_request(url, headers)
        custom_fields = data.get("textCustomFields", []) + data.get("listCustomFields", [])
        
        for field in custom_fields:
            field["envelope_id"] = envelope_id
        
        return custom_fields
    except Exception as e:
        logger.warning(f"Could not fetch custom fields for envelope {envelope_id}: {e}")
        return []

## FIX: Corrected API endpoint and processing logic for fetching tabs.
def fetch_document_tabs_for_envelope(configuration: dict, envelope_id: str) -> List[Dict[str, Any]]:
    """
    Fetch document tabs for a specific envelope.
    """
    base_url = get_base_url(configuration)
    headers = get_docusign_headers(configuration)
    url = f"{base_url}/envelopes/{envelope_id}/tabs"
    
    try:
        data = make_api_request(url, headers)
        tabs = []
        
        for tab_type, tab_list in data.items():
            if isinstance(tab_list, list):
                for tab in tab_list:
                    tab["envelope_id"] = envelope_id
                    tab["tab_type"] = tab_type
                    tabs.append(tab)
        
        return tabs
    except Exception as e:
        logger.warning(f"Could not fetch tabs for envelope {envelope_id}: {e}")
        return []


def update(configuration: dict, state: Dict[str, Any]):
    """
    Main update function that orchestrates data extraction from DocuSign API.
    """
    logger.info("Starting DocuSign connector update")
    
    
    access_token = configuration.get("access_token")
    if not access_token:
        raise Exception("Fatal: Could not obtain access token. Halting sync.")
    else:
        logger.info("Access token obtained successfully"+ access_token)
    
    if not state:
        state = {
            "last_envelope_sync": "2020-01-01T00:00:00.000Z",
            "last_template_sync": "2020-01-01T00:00:00.000Z"
        }
    
    current_time = datetime.now(timezone.utc).isoformat()
    
    # --- Process Envelopes and Related Data ---
    logger.info("Fetching envelopes data..."+ current_time)
    envelopes = fetch_envelopes(configuration, state)
    
    for envelope in envelopes:
        ## FIX: Added a guard clause to skip records with a missing primary key.
        ## This prevents the "Primary key with unknown data type" error.
        envelope_id = envelope.get("envelopeId")
        if not envelope_id:
            logger.warning("Skipping an envelope record due to missing envelopeId.")
            continue
            
        processed_envelope = {
            "envelope_id": str(envelope_id),
            "status": str(envelope.get("status", "")),
            "sent_timestamp": str(envelope.get("sentDateTime", "")),
            "completed_timestamp": str(envelope.get("completedDateTime", "")),
            "created_timestamp": str(envelope.get("createdDateTime", "")),
            "last_modified_timestamp": str(envelope.get("statusChangedDateTime", "")),
            "subject": str(envelope.get("emailSubject", "")),
            "contract_cycle_time_hours": "",
            "conversion_status": str(envelope.get("status", ""))
        }
        
        if envelope.get("status") == "completed":
            sent_time = envelope.get("sentDateTime")
            completed_time = envelope.get("completedDateTime")
            if sent_time and completed_time:
                try:
                    sent_dt = datetime.fromisoformat(sent_time.replace('Z', '+00:00'))
                    completed_dt = datetime.fromisoformat(completed_time.replace('Z', '+00:00'))
                    cycle_time = (completed_dt - sent_dt).total_seconds() / 3600
                    processed_envelope["contract_cycle_time_hours"] = str(cycle_time)
                except Exception as e:
                    logger.warning(f"Could not calculate cycle time for envelope {envelope_id}: {e}")
        
        op.upsert("envelopes", processed_envelope)

        # --- Fetch and Process Child Tables ---
        
        # Recipients
        recipients = fetch_recipients_for_envelope(configuration, envelope_id)
        for r in recipients:
            if r.get("recipientId"): # Guard clause for primary key
                op.upsert("recipients", {
                    "envelope_id": str(envelope_id),
                    "recipient_id": str(r["recipientId"]),
                    "name": str(r.get("name", "")),
                    "email": str(r.get("email", "")),
                    "status": str(r.get("status", "")),
                    "type": str(r.get("recipient_type", "")),
                    "routing_order": str(r.get("routingOrder", "0"))
                })
        enhanced_recipients = fetch_enhanced_recipients(configuration, envelope_id)
        for er in enhanced_recipients:
          if er.get("recipientId"):
            op.upsert("enhanced_recipients", {
                "envelope_id": str(envelope_id),
                "recipient_id": str(er["recipientId"]),
                "name": str(er.get("name", "")),
                "email": str(er.get("email", "")),
                "status": str(er.get("status", "")),
                "type": str(er.get("recipient_type", "")),
                "routing_order": str(er.get("routingOrder", 0)),
                "declined_reason": str(er.get("declinedReason", "")),
                "sent_timestamp": str(er.get("sentDateTime", "")),
                "signed_timestamp": str(er.get("signedDateTime", "")),
            })
        audit_events = fetch_audit_events(configuration, envelope_id)
      
        for event in audit_events:
            event_id = event.get("eventFields", [{}])[0].get("value")  # fallback if needed
            # Flatten eventFields into a dict
            flat_event = {field["name"].lower(): str(field.get("value", "")) for field in event.get("eventFields", [])}
            flat_event["envelope_id"] = envelope_id
            # Use a combination of envelope_id + logTime as a surrogate primary key
            flat_event["event_id"] = f"{envelope_id}_{flat_event.get('logtime', '')}"
         
            op.upsert("audit_events", flat_event)

        # Notifications
        notifications = fetch_envelope_notifications(configuration, envelope_id)
       
        for n in notifications:
            if n.get("notificationId"):
                op.upsert("envelope_notifications", {
                    "envelope_id": str(envelope_id),
                    "notification_id": str(n.get("notificationId")),
                    "notification_type": str(n.get("notificationType", "")),
                    "scheduled_date": str(n.get("scheduledDate", "")),
                    "sent_date": str(n.get("sentDate", "")),
                })

        
        # Documents
        documents = fetch_documents_for_envelope(configuration, envelope_id)
        for d in documents:
            document_id = d.get("documentId")
            if document_id: # Guard clause for primary key
                op.upsert("documents", {
                    "envelope_id": str(envelope_id),
                    "document_id": str(document_id),
                    "name": str(d.get("name", "")),
                    "type": str(d.get("type", "")),
                    "pages": str(d.get("pages", "0"))
                })

                # NEW: Fetch and upsert the full document content.
                logger.info(f"Fetching content for document {document_id} in envelope {envelope_id}")
                content = fetch_document_content(configuration, envelope_id, document_id)
                if content:
                    # Content is stored as a Base64 encoded string to handle binary data safely.
                    encoded_content = base64.b64encode(content).decode('utf-8')
                    op.upsert("document_contents", {
                        "envelope_id": str(envelope_id),
                        "document_id": str(document_id),
                        "content_base64": encoded_content
                    })
       
        # Custom Fields
        custom_fields = fetch_custom_fields_for_envelope(configuration, envelope_id)
        for f in custom_fields:
            if f.get("name"): # Guard clause for primary key
                op.upsert("custom_fields", {
                    "envelope_id": str(envelope_id),
                    "field_name": str(f["name"]),
                    "value": str(f.get("value", "")),
                    "type": str(f.get("fieldType", ""))
                })

    logger.info(f"Processed {len(envelopes)} envelopes and their related data.")
    
    # --- Process Templates ---
    logger.info("Fetching templates data...")
    templates = fetch_templates(configuration, state)
    for t in templates:
        if t.get("templateId"): # Guard clause for primary key
            op.upsert("templates", {
                "template_id": str(t["templateId"]),
                "name": str(t.get("name", "")),
                "description": str(t.get("description", "")),
                "created_timestamp": str(t.get("created", "")),
                "last_modified_timestamp": str(t.get("lastModified", "")),
                "shared": str(t.get("shared", "false")).lower()
            })
    logger.info(f"Upserted {len(templates)} templates")

    ## FIX: Moved checkpoint before the return statement to ensure state is saved.
    new_state = {
        "last_envelope_sync": str(current_time),
        "last_template_sync": str(current_time)
    }
    op.checkpoint(state=new_state)
    logger.info("DocuSign connector update completed successfully")


## FIX: Added a sanitize_config function to make the script self-contained.
def sanitize_config(config: dict) -> dict:
    """Recursively converts all values in a dictionary to strings."""
    return {k: str(v) for k, v in config.items()}


# Initialize the connector
connector = Connector(update=update, schema=schema)

if __name__ == "__main__":
    with open("configuration.json", 'r') as f:
        configuration = json.load(f)
        # Ensure all config values are strings for the SDK
        configuration = sanitize_config(configuration)
    connector.debug(configuration=configuration)
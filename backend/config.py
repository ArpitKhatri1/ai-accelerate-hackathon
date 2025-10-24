import os
from typing import Optional, cast

from google.auth.credentials import Credentials as GoogleCredentials
from google.cloud import bigquery
from google.oauth2 import service_account
import google.auth

# Environment variables
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# BigQuery configuration
_DEFAULT_SERVICE_ACCOUNT_FILE = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "agents/docusign-arpit.json",
    )
)
SERVICE_ACCOUNT_FILE = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", _DEFAULT_SERVICE_ACCOUNT_FILE)

# Dataset and table names
DOCUSIGN_DATASET = "docusign-475113.customdocusignconnector"
ENVELOPES_TABLE = f"`{DOCUSIGN_DATASET}.envelopes`"
DOCUMENTS_TABLE = f"`{DOCUSIGN_DATASET}.documents`"
CUSTOM_FIELDS_TABLE = f"`{DOCUSIGN_DATASET}.custom_fields`"
RECIPIENTS_TABLE = f"`{DOCUSIGN_DATASET}.recipients`"

# App configuration
APP_NAME = "ai_accelerate_hackathon"
USER_ID = "user1234"
SESSION_ID = "1234"

# CORS origins
CORS_ORIGINS = [
    "https://ai-accelerate-hackathon.vercel.app",
    "http://localhost:3000",
    "*"
]

def create_bigquery_client() -> Optional[bigquery.Client]:
    """Create and return a BigQuery client with appropriate credentials."""
    credentials: Optional[GoogleCredentials] = None
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")

    if SERVICE_ACCOUNT_FILE and os.path.exists(SERVICE_ACCOUNT_FILE):
        try:
            svc_credentials = service_account.Credentials.from_service_account_file(
                SERVICE_ACCOUNT_FILE,
                scopes=["https://www.googleapis.com/auth/cloud-platform"],
            )
            credentials = cast(GoogleCredentials, svc_credentials)
            if svc_credentials.project_id:
                project_id = svc_credentials.project_id
        except Exception as exc:  # pragma: no cover - logging path
            print(f"[analytics] Failed to load service account credentials: {exc}")
            credentials = None

    if credentials is None:
        try:
            default_credentials, project_id = google.auth.default(
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            credentials = cast(GoogleCredentials, default_credentials)
        except Exception as exc:  # pragma: no cover - logging path
            print(f"[analytics] Default credentials not available: {exc}")
            return None

    try:
        return bigquery.Client(credentials=credentials, project=project_id)
    except Exception as exc:  # pragma: no cover - logging path
        print(f"[analytics] BigQuery client creation failed: {exc}")
        return None

# Global BigQuery client instance
bigquery_client = create_bigquery_client()


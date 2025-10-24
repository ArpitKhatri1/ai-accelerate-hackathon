import os
import base64
import binascii
import fitz  # PyMuPDF
from google.cloud import bigquery
from dotenv import load_dotenv

# Optional: load environment variables if needed
load_dotenv()

# --- Helper Functions ---

def extract_text_from_binary(pdf_binary_data: bytes) -> str:
    """Extracts all text content from a PDF opened from in-memory bytes."""
    try:
        with fitz.open(stream=pdf_binary_data, filetype="pdf") as doc:
            text_parts: list[str] = []
            for page in doc:
                # Use explicit 'text' mode and guard against non-string results per type stubs
                raw = page.get_text("text")
                page_text = raw if isinstance(raw, str) else ""
                text_parts.append(page_text.replace('\n', ' '))
            return "".join(text_parts)
    except Exception as e:
        return f"Error processing PDF data: {e}"

def ensure_content_text_column(client: bigquery.Client, table_id: str) -> None:
    """Adds content_text STRING column if it does not exist."""
    ddl = f"""
        ALTER TABLE `{table_id}`
        ADD COLUMN IF NOT EXISTS content_text STRING
    """
    client.query(ddl).result()
    print(f"Ensured content_text column exists on {table_id}")

def get_base64_column_name(client: bigquery.Client, table_id: str) -> str | None:
    """Detect whether the table uses content_base64 or content_base_64; return the name found."""
    try:
        table = client.get_table(table_id)
        names = {field.name for field in table.schema}
        if "content_base64" in names:
            return "content_base64"
        if "content_base_64" in names:
            return "content_base_64"
        return None
    except Exception as e:
        print(f"\n⚠️ Could not fetch schema for {table_id}: {e}")
        return None

def is_document_processed(
    client: bigquery.Client,
    table_id: str,
    envelope_id: str,
    document_id: str,
) -> bool:
    """Returns True if content_text for the (envelope_id, document_id) is already populated and non-empty."""
    sql = f"""
        SELECT content_text
        FROM `{table_id}`
        WHERE envelope_id = @envelope_id AND document_id = @document_id
        LIMIT 1
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("envelope_id", "STRING", envelope_id),
            bigquery.ScalarQueryParameter("document_id", "STRING", document_id),
        ]
    )
    try:
        rows = list(client.query(sql, job_config=job_config).result())
        if not rows:
            return False
        val = rows[0].get("content_text") if hasattr(rows[0], "get") else rows[0]["content_text"]
        return bool(val and str(val).strip())
    except Exception as e:
        print(f"   ⚠️ Warning: could not check processed state: {e}")
        return False

def update_document_text_and_clear_base64(
    client: bigquery.Client,
    table_id: str,
    envelope_id: str,
    document_id: str,
    content_text: str,
    base64_col: str,
) -> None:
    """Update row with extracted text and clear the base64 column in a single DML statement."""
    sql = f"""
        UPDATE `{table_id}`
        SET content_text = @content_text,
            {base64_col} = ''
        WHERE envelope_id = @envelope_id AND document_id = @document_id
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("content_text", "STRING", content_text),
            bigquery.ScalarQueryParameter("envelope_id", "STRING", envelope_id),
            bigquery.ScalarQueryParameter("document_id", "STRING", document_id),
        ]
    )
    client.query(sql, job_config=job_config).result()

def push_embeddings_to_bigquery(client, project_id, dataset_id, table_name, data_to_insert):
    """Pushes a list of row data (as dicts) to the specified BigQuery table."""
    if not data_to_insert:
        print("No data to insert into BigQuery.")
        return
    
    table_id = f"{project_id}.{dataset_id}.{table_name}"
    print(f"\n--- Pushing Embeddings to BigQuery Table: {table_id} ---")
    
    # Define the schema for the destination table
    schema = [
        bigquery.SchemaField("envelope_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("document_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("chunk_id", "INTEGER", mode="REQUIRED"),
        bigquery.SchemaField("text_chunk", "STRING"),
        bigquery.SchemaField("embedding", "FLOAT64", mode="REPEATED"),
    ]
    
    table = bigquery.Table(table_id, schema=schema)
    # Use exists_ok=True to avoid an error if the table already exists
    client.create_table(table, exists_ok=True) 
    print(f"Ensured table '{table_id}' exists.")
    
    # Insert the rows
    errors = client.insert_rows_json(table_id, data_to_insert)
    if not errors:
        print(f"✅ Successfully pushed {len(data_to_insert)} embedding chunks to BigQuery.")
    else:
        print("❌ Encountered errors while inserting rows:")
        for error in errors:
            print(error)

def check_if_doc_exists_in_embeddings(
    client: bigquery.Client,
    dest_table_id: str,
    envelope_id: str,
    document_id: str
) -> bool:
    """
    Uses the BigQuery client to run a simple SQL query to check if a document ID exists.
    """
    sql_to_check = f"""
        SELECT COUNT(*) as count
        FROM `{dest_table_id}`
        WHERE envelope_id = @envelope_id AND document_id = @document_id
    """
    
    # Use query parameters for safety and correctness
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("envelope_id", "STRING", envelope_id),
            bigquery.ScalarQueryParameter("document_id", "STRING", document_id),
        ]
    )
    
    try:
        query_job = client.query(sql_to_check, job_config=job_config)
        results = query_job.result()
        for row in results:
            if row.count > 0:
                return True
        return False
    except Exception as e:
        print(f"   ⚠️ Warning: Could not execute check query: {e}")
        # Default to False to be safe, though this may cause reprocessing
        return False

# --- Main Script Logic ---

if __name__ == "__main__":
    # 1) Construct a BigQuery client object
    try:
        client = bigquery.Client.from_service_account_json(
            os.path.join(os.path.dirname(__file__), "docusign-arpit.json")
        )
    except FileNotFoundError:
        print("Error: Service account key file 'docusign-arpit.json' not found. Please check the file path.")
        raise SystemExit(1)
    except Exception as e:
        print(f"Error initializing BigQuery client: {e}")
        raise SystemExit(1)

    # 2) Define table IDs
    project_id = "docusign-475113"
    dataset_id = "customdocusignconnector"
    table_name = "document_contents"
    table_id = f"{project_id}.{dataset_id}.{table_name}"

    # 3) Ensure schema has content_text column
    ensure_content_text_column(client, table_id)

    # 4) Determine the correct base64 column name (content_base64 vs content_base_64)
    base64_col = get_base64_column_name(client, table_id)
    if not base64_col:
        print(f"❌ Neither 'content_base64' nor 'content_base_64' column found on {table_id}. Exiting.")
        raise SystemExit(1)

    # 5) Fetch only rows that still need processing
    query = f"""
        SELECT envelope_id, document_id, {base64_col} AS content_base64
        FROM `{table_id}`
        WHERE (content_text IS NULL OR content_text = '')
          AND {base64_col} IS NOT NULL
          AND {base64_col} != ''
    """

    print(f"Running query to fetch documents needing text extraction from: {table_id} (base64 column: {base64_col})")

    try:
        query_job = client.query(query)

        # Loop through documents that need processing
        for row in query_job:
            env_id = row["envelope_id"]
            doc_id = row["document_id"]
            encoded_field = row["content_base64"]

            print(f"\nProcessing document: {env_id} / {doc_id}")

            # Extra safety: skip if already processed
            if is_document_processed(client, table_id, env_id, doc_id):
                print("   -> Already processed. Skipping.")
                continue

            if not encoded_field:
                print("   -> Skipping: No content_base64 data found.")
                continue

            # Decode to raw PDF bytes; handle BYTES column as already-bytes
            try:
                if isinstance(encoded_field, (bytes, bytearray)):
                    pdf_bytes = bytes(encoded_field)
                else:
                    pdf_bytes = base64.b64decode(encoded_field, validate=False)
            except (binascii.Error, Exception) as e:
                print(f"   -> Skipping: base64 decode failed: {e}")
                continue

            # Extract text
            text = extract_text_from_binary(pdf_bytes)
            if text.startswith("Error processing PDF data:"):
                print(f"   -> Skipping: {text}")
                continue

            if not text.strip():
                print("   -> Skipping: No text extracted from document.")
                continue

            # Update row: set content_text and clear base64
            try:
                update_document_text_and_clear_base64(
                    client,
                    table_id,
                    env_id,
                    doc_id,
                    text,
                    base64_col,
                )
                print("   -> Updated content_text and cleared base64 bytes.")
            except Exception as e:
                print(f"   -> Failed to update row: {e}")

    except Exception as e:
        print(f"An error occurred while querying BigQuery: {e}")

    print("\n--- Text extraction pipeline execution complete. ---")

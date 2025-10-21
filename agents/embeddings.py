import os
import base64
import binascii
import json
import fitz  # PyMuPDF
from google.cloud import bigquery
import google.generativeai as genai
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Your API key from Google AI Studio
load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# --- Helper Functions ---

def extract_text_from_binary(pdf_binary_data):
    """Opens a PDF from binary data in memory and extracts all text content."""
    try:
        with fitz.open(stream=pdf_binary_data, filetype="pdf") as doc:
            full_text = ""
            for page in doc:
                full_text += page.get_text()
        return full_text
    except Exception as e:
        return f"Error processing PDF data: {e}"

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
    # 1. Construct a BigQuery client object
    try:
        client = bigquery.Client.from_service_account_json('a.json')
    except FileNotFoundError:
        print("Error: Service account key file 'a.json' not found. Please check the file path.")
        exit()
    except Exception as e:
        print(f"Error initializing BigQuery client: {e}")
        exit()

    # 2. Define project and table IDs
    project_id = "docusign-475113"
    dataset_id = "customdocusignconnector"
    
    source_table_id = f"{project_id}.{dataset_id}.document_contents"
    dest_table_name = "document_embeddings_test" # Just the table name
    dest_table_id = f"{project_id}.{dataset_id}.{dest_table_name}" # Full ID
    
    # 3. Define the query to fetch all documents
    #    REMOVED 'LIMIT 1' TO PROCESS ALL DOCUMENTS
    query = f"""
        SELECT envelope_id, document_id, content_base_64 
        FROM `{source_table_id}` 
        WHERE content_base_64 IS NOT NULL
    """
    
    print(f"Running query to fetch documents from: {source_table_id}")
    
    # 4. Initialize the text splitter ONCE
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=300,  # Increased size slightly, 200 is very small
        chunk_overlap=30,
        length_function=len,
    )

    try:
        query_job = client.query(query)
        
        # Loop through ALL documents in the source table
        for row in query_job:
            doc_info = {"envelope_id": row["envelope_id"], "document_id": row["document_id"]}
            print(f"\nProcessing document: {doc_info['envelope_id']} / {doc_info['document_id']}")

            # **FIXED LOGIC**: Check if doc exists in the DESTINATION table
            exists = check_if_doc_exists_in_embeddings(
                client, 
                dest_table_id, 
                doc_info["envelope_id"], 
                doc_info["document_id"]
            )
            
            if exists:
                print("   -> Document already processed. Skipping.")
                continue
            
            # --- This is the main "Transform" and "Load" block ---
            print("   -> New document. Processing...")
            document_text = ""
            encoded_string = row["content_base_64"]
            
            if not encoded_string:
                print("   -> Skipping: No content_base_64 data found.")
                continue

            try:
                pdf_bytes = base64.b64decode(encoded_string)
                document_text = extract_text_from_binary(pdf_bytes)
                if "Error" in document_text:
                    print(f"   -> Skipping: Error during text extraction: {document_text}")
                    continue
                print("   -> Text extracted successfully.")
            except (binascii.Error, Exception) as e:
                print(f"   -> Skipping: Error during base64 decode or text extraction: {e}")
                continue

            # 5. Chunk the text
            chunks = text_splitter.split_text(document_text) 
            if not chunks:
                print("   -> Skipping: No text chunks found after splitting.")
                continue
            
            print(f"   -> Document split into {len(chunks)} chunks. Generating embeddings...")

            # 6. Generate embeddings
            try:
                result = genai.embed_content(
                    model="models/embedding-001",
                    content=chunks,
                    task_type="RETRIEVAL_DOCUMENT"
                )
                
                # Map chunks to their embeddings
                word_embeddings = {chunk: embedding for chunk, embedding in zip(chunks, result['embedding'])}
                print("   -> Embeddings generated.")

                # 7. Prepare and load data into BigQuery
                rows_to_insert = []
                for i, (chunk, embedding) in enumerate(word_embeddings.items()):
                    rows_to_insert.append({
                        "envelope_id": doc_info["envelope_id"],
                        "document_id": doc_info["document_id"],
                        "chunk_id": i,
                        "text_chunk": chunk,
                        "embedding": embedding
                    })
                
                push_embeddings_to_bigquery(
                    client, 
                    project_id, 
                    dataset_id, 
                    dest_table_name, 
                    rows_to_insert
                )
            except Exception as e:
                print(f"   -> Skipping: Failed to generate or push embeddings: {e}")

    except Exception as e:
        print(f"An error occurred while querying BigQuery: {e}")

    print("\n--- Pipeline execution complete. ---")
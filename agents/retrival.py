from google.cloud import bigquery
from google.oauth2 import service_account

# 1. --- Configuration ---
PROJECT_ID = "docusign-475113"
DATASET_ID = "customdocusignconnector"
MODEL_NAME = "document_embedding_model"
TABLE_NAME = "document_embeddings"

# !!! IMPORTANT: Update this path to point to your service account JSON file
SERVICE_ACCOUNT_JSON_PATH = "./docusign-arpit.json"

# This is your natural language search query
search_query = "What is the my performance sheet grade in general biology?"
# -------------------------


def search_documents(project_id, dataset_id, model_name, table_name, query_text):
    """
    Performs a vector search on a BigQuery table using a service account.
    """
    
    # --- Authentication Change (Fix) ---
    # Create credentials from your service account file
    # We remove the 'scopes' parameter to let the library use the correct defaults.
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_JSON_PATH
    )
    
    # Pass the credentials to the client
    client = bigquery.Client(project=project_id, credentials=credentials)
    # -----------------------------

    model_path = f"`{project_id}.{dataset_id}.{model_name}`"
    table_path = f"`{project_id}.{dataset_id}.{table_name}`"

    sql = f"""
    -- 1. Create a CTE to embed the user's search query
    WITH query_embedding AS (
      SELECT
        ml_generate_embedding_result AS embedding
      FROM
        ML.GENERATE_EMBEDDING(
          MODEL {model_path},
          (SELECT @query_text AS content)
        )
    )
    
    -- 2. Find the closest matches from the document chunks
    SELECT
      T.content AS chunk_content, -- This is the original text chunk
      ML.DISTANCE(
        Q.embedding,
        T.embedding,
        'COSINE'
      ) AS distance
    FROM
      {table_path} AS T,
      query_embedding AS Q
    ORDER BY
      distance ASC -- Order by distance (lowest is best)
    LIMIT 5;       -- Show the top 5 matches
    """

    # 3. Use QueryJobConfig to set the @query_text parameter
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("query_text", "STRING", query_text)
        ]
    )

    print(f"Searching for: '{query_text}'\n...")

    # 4. Run the query
    try:
        query_job = client.query(sql, job_config=job_config)

        # 5. Print the results
        for row in query_job.result():
            print("--- MATCH FOUND ---")
            print(f"Similarity (Distance): {row.distance:.4f}")
            print(f"Content Chunk: \n{row.chunk_content}\n")
            
    except Exception as e:
        print(f"An error occurred: {e}")


if __name__ == "__main__":
    search_documents(
        PROJECT_ID,
        DATASET_ID,
        MODEL_NAME,
        TABLE_NAME,
        search_query
    )
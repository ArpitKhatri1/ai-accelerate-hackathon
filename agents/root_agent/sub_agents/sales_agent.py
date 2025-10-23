import os
import json
from google.adk.agents.llm_agent import Agent
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools import FunctionTool
from google.cloud import bigquery
from google.oauth2 import service_account
from .bigquery_agent import bigquery_agent

# Document retrieval configuration
PROJECT_ID = "docusign-475113"
DATASET_ID = "customdocusignconnector"
MODEL_NAME = "document_embedding_model"
TABLE_NAME = "document_embeddings"
SERVICE_ACCOUNT_JSON_PATH = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", os.path.join(os.path.dirname(__file__), "../../docusign-arpit.json"))


def retrieve_documents(query_text: str) -> str:
    """
    Performs a vector search on a BigQuery table using a service account.

    Args:
        query_text: The natural language search query

    Returns:
        A JSON string containing the search results with content chunks and similarity scores
    """
    try:
        # --- Authentication ---
        credentials = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_JSON_PATH
        )

        client = bigquery.Client(project=PROJECT_ID, credentials=credentials)

        model_path = f"`{PROJECT_ID}.{DATASET_ID}.{MODEL_NAME}`"
        table_path = f"`{PROJECT_ID}.{DATASET_ID}.{TABLE_NAME}`"

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

        # 4. Run the query
        query_job = client.query(sql, job_config=job_config)

        # 5. Collect results
        results = []
        for row in query_job.result():
            results.append({
                "content": row.chunk_content,
                "similarity_score": float(row.distance)
            })

        # Return as JSON string
        return json.dumps(results, indent=2)

    except Exception as e:
        error_msg = f"An error occurred during document retrieval: {str(e)}"
        print(error_msg)
        return json.dumps({"error": error_msg})


# Create the retrieval tool
document_retrieval_tool = FunctionTool(
    func=retrieve_documents,
)

# This is the system prompt you'll use in your Cloud Function or Workflow

sales_agent = Agent(
    name="sales_agent",
    model=os.getenv("GOOGLE_MODEL_NAME", "gemini-1.5-flash"),
    description="An agent that analyzes sales data, contract information, and provides insights using document retrieval capabilities.",
    instruction=(
        """You are a helpful sales operations analyst that can analyze contract data and retrieve relevant document information.

        You have access to:
        1. BigQuery data through the bigquery_agent for structured data queries
        2. Document retrieval through the retrieve_documents tool for searching embedded documents

        When analyzing customer data or providing insights:
        - Use bigquery_agent for structured queries on envelopes, contracts, and customer data
        - Use retrieve_documents to search through document embeddings for relevant context, performance data, or contract details
        - Combine both tools when needed to provide comprehensive analysis

        You have the following responsibilities:
        - Analyze high upsell potential customers based on their contract history and engagement or simple renewal customers.
        - Provide recommendations for sales strategies based on your analysis.
        - Return comprehensive reasons for your choices and insights.
        
        Always provide actionable insights based on the data you retrieve.
        """
    ),
    tools=[AgentTool(agent=bigquery_agent), document_retrieval_tool],
)
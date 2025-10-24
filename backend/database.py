import asyncio
from typing import Any, Dict, List, Optional

from google.cloud import bigquery

from .config import bigquery_client

def serialize_value(value: Any) -> Any:
    """Serialize BigQuery values for JSON response."""
    import datetime
    import decimal

    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, datetime.datetime):
        return value.isoformat()
    if isinstance(value, datetime.date):
        return value.isoformat()
    return value

def serialize_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Serialize a list of BigQuery rows for JSON response."""
    return [
        {column: serialize_value(value) for column, value in row.items()}
        for row in rows
    ]

async def run_bigquery_query(
    query: str,
    query_parameters: Optional[List[bigquery.ScalarQueryParameter]] = None
) -> List[Dict[str, Any]]:
    """Execute a BigQuery query asynchronously and return serialized results."""
    client = bigquery_client
    if client is None:
        raise RuntimeError("BigQuery client is not configured")

    def _execute() -> List[Dict[str, Any]]:
        job_config = bigquery.QueryJobConfig(query_parameters=query_parameters or [])
        job = client.query(query, job_config=job_config)
        results = job.result()
        return [dict(row.items()) for row in results]

    loop = asyncio.get_running_loop()
    raw_rows = await loop.run_in_executor(None, _execute)
    return serialize_rows(raw_rows)


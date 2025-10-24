# syntax=docker/dockerfile:1

# Use an official Python 3.11 slim image
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1

# Install CA certificates for outbound HTTPS (oauth2.googleapis.com, BigQuery, etc.)
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

# Keep backend as a package under /app/backend so imports like `backend.main:app` work
WORKDIR /app/backend

# Copy requirements first for better layer caching
COPY requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . /app/backend

# Cloud Run provides PORT env; run.py reads it with default 8000
EXPOSE 8000

# Start the app via the dev runner which launches uvicorn
CMD ["python", "run.py"]


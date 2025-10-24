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

# Start the production server (Gunicorn + Uvicorn workers)
# Use shell form so $PORT is expanded by the shell in Cloud Run.
# Keep parent /app on PYTHONPATH so 'backend.main:app' imports correctly.
CMD ["sh", "-c", "exec gunicorn -w ${WORKERS:-2} -k uvicorn.workers.UvicornWorker --pythonpath /app -b 0.0.0.0:${PORT:-8080} backend.main:app"]


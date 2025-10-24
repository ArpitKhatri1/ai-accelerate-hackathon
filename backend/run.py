#!/usr/bin/env python3
"""
Dev runner to start the FastAPI app from inside the backend/ folder.

Usage:
  python run.py            # starts uvicorn on 0.0.0.0:8000 with reload
  python run.py --port 9000
  python run.py --no-reload

This ensures the package is imported as `backend.main:app` even when
executed from the backend directory, so relative imports work.
"""

import argparse
import os
import sys
from typing import Sequence

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None  # python-dotenv not installed; proceed without it

def main() -> None:
    # Ensure repo root (parent of this file's directory) is on sys.path
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(backend_dir)
    if repo_root not in sys.path:
        sys.path.insert(0, repo_root)

    # Load env from backend/.env and backend/agents/.env (if available) so agents
    # can read the same environment without their own loader.
    if load_dotenv:
        backend_env = os.path.join(backend_dir, ".env")
        agents_env = os.path.join(backend_dir, "agents", ".env")
        root_env = os.path.join(repo_root, ".env")

        # Highest precedence first; later files won't override existing keys
        for env_file in (backend_env, agents_env, root_env):
            if os.path.exists(env_file):
                load_dotenv(env_file, override=False)

    # Parse simple CLI flags
    parser = argparse.ArgumentParser(description="Run the FastAPI server")
    parser.add_argument("--host", default=os.getenv("HOST", "0.0.0.0"), help="Bind host")
    parser.add_argument(
        "--port", type=int, default=int(os.getenv("PORT", "8000")), help="Bind port"
    )
    parser.add_argument(
        "--reload",
        dest="reload",
        action="store_true",
        default=True,
        help="Enable auto-reload",
    )
    parser.add_argument(
        "--no-reload", dest="reload", action="store_false", help="Disable auto-reload"
    )
    args = parser.parse_args()

    # Defer imports until after sys.path is adjusted
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        factory=False,
    )

if __name__ == "__main__":
    main()


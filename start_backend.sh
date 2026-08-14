#!/bin/bash
# Script to run FastAPI backend on macOS
export PYTHONPATH=src:src/backend
export $(grep -v '^#' .env | xargs)
./venv/bin/python -m uvicorn apps.main:app --reload --host 0.0.0.0 --port 8000 --app-dir src/backend

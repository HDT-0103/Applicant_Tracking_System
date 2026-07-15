from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api import ingestion, websocket

app = FastAPI(title="SmartATS Ingestion Subsystem Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingestion.router)
app.include_router(websocket.router)
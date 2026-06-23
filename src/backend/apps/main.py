import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from modules.auth.adapters.routes import router as auth_router
from modules.ingestion.adapters.routes import router as ingestion_router
from modules.shared.infrastructure.config import get_settings

structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
)

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="4.2.1",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(ingestion_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}

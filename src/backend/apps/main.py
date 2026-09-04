import asyncio
import structlog
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# NOTE: Event loop policy is now handled by run.py (winloop).
# Do NOT call asyncio.set_event_loop_policy() here — it is deprecated
# in Python 3.14 and conflicts with winloop.

from modules.auth.adapters.routes import router as auth_router
from modules.ingestion.adapters.azure_routes import router as azure_ingestion_router
from modules.enrichment.adapters.routes import router as enrichment_router
from modules.admin.adapters.routes import router as admin_router
from modules.catalog.adapters.routes import router as catalog_router
from modules.scheduling.adapters.routes import router as scheduling_router
from modules.review.adapters.routes import router as review_router
from modules.search.adapters.routes import router as search_router
from modules.scoring.adapters.routes import router as scoring_router
from src.backend.app.agents.router import router as agents_router
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

cors_kwargs = {
    "allow_origins": settings.cors_origin_list,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}

if settings.app_env.lower() == "development":
    cors_kwargs["allow_origin_regex"] = r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+)(:\d+)?"

app.add_middleware(
    CORSMiddleware,
    **cors_kwargs,
)

app.include_router(auth_router)
app.include_router(azure_ingestion_router)
app.include_router(enrichment_router)
app.include_router(admin_router)
app.include_router(catalog_router)
app.include_router(scheduling_router)
app.include_router(review_router)
app.include_router(search_router)
app.include_router(scoring_router)
app.include_router(agents_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}

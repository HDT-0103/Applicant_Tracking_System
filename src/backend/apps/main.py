import asyncio
import structlog
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Fix for Windows asyncio subprocess (for Playwright)
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from modules.auth.adapters.routes import router as auth_router
from modules.ingestion.adapters.routes import router as ingestion_router
from modules.enrichment.adapters.routes import router as enrichment_router
from modules.scheduling.adapters.routes import router as scheduling_router
from modules.review.adapters.routes import router as review_router
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
    cors_kwargs["allow_origin_regex"] = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"

app.add_middleware(
    CORSMiddleware,
    **cors_kwargs,
)

app.include_router(auth_router)
app.include_router(ingestion_router)
app.include_router(enrichment_router)
app.include_router(scheduling_router)
app.include_router(review_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}

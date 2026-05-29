"""FastAPI application entry point."""

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as v1_router
from app.core.config import settings

log = structlog.get_logger()

app = FastAPI(
    title="Litigation Prediction & Strategy",
    description=(
        "Open-source AI platform for animal-advocacy litigation strategy. "
        "Outputs are informational risk assessments — not legal advice."
    ),
    version="0.1.0",
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url="/redoc" if settings.environment == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        ["*"] if settings.environment == "development"
        else [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix="/api/v1")


@app.on_event("startup")
async def on_startup() -> None:
    log.info("startup", environment=settings.environment)


@app.on_event("shutdown")
async def on_shutdown() -> None:
    log.info("shutdown")

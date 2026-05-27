"""GET /api/v1/health — liveness + dependency checks."""

import time

import anthropic
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db

router = APIRouter()


class HealthResponse(BaseModel):
    status: str          # "ok" | "degraded" | "down"
    postgres: str        # "ok" | "error: ..."
    anthropic: str       # "ok" | "error: ..."
    latency_ms: int


@router.get("/health", response_model=HealthResponse)
async def health(db: AsyncSession = Depends(get_db)) -> HealthResponse:
    start = time.monotonic()

    # Postgres check
    try:
        await db.execute(text("SELECT 1"))
        pg_status = "ok"
    except Exception as exc:
        pg_status = f"error: {exc}"

    # Anthropic API check (lightweight — just instantiate client, no call)
    try:
        _ = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        ant_status = "ok" if settings.anthropic_api_key else "error: no api key configured"
    except Exception as exc:
        ant_status = f"error: {exc}"

    overall = "ok" if pg_status == "ok" and ant_status == "ok" else "degraded"
    latency = int((time.monotonic() - start) * 1000)

    return HealthResponse(
        status=overall,
        postgres=pg_status,
        anthropic=ant_status,
        latency_ms=latency,
    )

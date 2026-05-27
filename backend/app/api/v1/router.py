"""Top-level v1 router — mounts all endpoint modules."""

from fastapi import APIRouter

from app.api.v1.endpoints import health, ingest, query

router = APIRouter()

router.include_router(health.router, tags=["health"])
router.include_router(query.router, tags=["query"])
router.include_router(ingest.router, tags=["admin"])
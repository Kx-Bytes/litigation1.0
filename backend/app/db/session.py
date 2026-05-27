"""Async SQLAlchemy engine + session factory (lazy initialisation)."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine, async_sessionmaker, create_async_engine

from app.core.config import settings

_engine: AsyncEngine | None = None
_AsyncSessionLocal: async_sessionmaker[AsyncSession] | None = None


def _get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.database_url,
            echo=settings.environment == "development",
            pool_pre_ping=True,
        )
    return _engine


def _get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _AsyncSessionLocal
    if _AsyncSessionLocal is None:
        _AsyncSessionLocal = async_sessionmaker(
            bind=_get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _AsyncSessionLocal


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields a DB session, auto-closes on exit."""
    async with _get_session_factory()() as session:
        yield session

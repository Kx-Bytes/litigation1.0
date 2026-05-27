"""
Load seed corpus into the database.

Usage (from backend/ directory):
    uv run python scripts/load_seed.py

Requires DATABASE_URL to be set in .env or the environment.
The script is idempotent — it skips documents that already exist (matched on source + source_id).
"""

import asyncio
import json
import sys
import uuid
from datetime import date
from pathlib import Path

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Allow running from backend/ without installing the package
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import settings
from app.models.base import Base  # noqa: F401
from app.models.document import Document
import app.models.chunk    # noqa: F401
import app.models.query    # noqa: F401
import app.models.citation  # noqa: F401

SEED_FILE = Path(__file__).parent.parent.parent / "data" / "seed" / "cases.json"

log = structlog.get_logger()


def parse_date(s: str | None) -> date | None:
    if not s:
        return None
    return date.fromisoformat(s)


async def load_seed(session: AsyncSession) -> None:
    cases = json.loads(SEED_FILE.read_text())
    log.info("seed_file_loaded", path=str(SEED_FILE), count=len(cases))

    inserted = 0
    skipped = 0

    for case in cases:
        # Idempotency check
        existing = await session.execute(
            select(Document).where(
                Document.source == case["source"],
                Document.source_id == case["source_id"],
            )
        )
        if existing.scalar_one_or_none() is not None:
            log.debug("skip_existing", source_id=case["source_id"])
            skipped += 1
            continue

        doc = Document(
            id=uuid.uuid4(),
            source=case["source"],
            source_id=case["source_id"],
            doc_type=case["doc_type"],
            jurisdiction=case["jurisdiction"],
            court=case.get("court"),
            decision_date=parse_date(case.get("decision_date")),
            title=case["title"],
            citation=case.get("citation"),
            full_text=case["full_text"],
            source_url=case.get("source_url"),
            metadata_=case.get("metadata"),
        )
        session.add(doc)
        inserted += 1
        log.info("inserted", citation=case.get("citation"), jurisdiction=case["jurisdiction"])

    await session.commit()
    log.info("seed_complete", inserted=inserted, skipped=skipped)


async def main() -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as session:
        await load_seed(session)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

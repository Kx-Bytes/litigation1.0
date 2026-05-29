"""
Process already-inserted documents through the chunk → embed pipeline.

Run this after load_seed.py to make documents searchable.

Usage (inside Docker container):
    python scripts/process_documents.py
"""

from __future__ import annotations

import asyncio
import sys
import uuid
from pathlib import Path

import structlog
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import settings
from app.models.base import Base  # noqa: F401
from app.models.document import Document
from app.models.chunk import Chunk
import app.models.query    # noqa: F401
import app.models.citation  # noqa: F401
from app.services.chunker import chunk_document
from app.services.embedder import embed_and_write_chunks

log = structlog.get_logger()


async def process_all(session: AsyncSession) -> None:
    # Load all documents
    result = await session.execute(select(Document))
    documents = result.scalars().all()
    log.info("documents_loaded", count=len(documents))

    for doc in documents:
        # Skip if already chunked
        existing = await session.execute(
            select(func.count()).where(Chunk.document_id == doc.id)
        )
        chunk_count = existing.scalar_one()
        if chunk_count > 0:
            log.info("skip_already_chunked", citation=doc.citation, chunks=chunk_count)
            continue

        if not doc.full_text or not doc.full_text.strip():
            log.warning("skip_empty_text", citation=doc.citation)
            continue

        # Chunk the document
        specs = chunk_document(doc.full_text)
        if not specs:
            log.warning("skip_no_chunks", citation=doc.citation)
            continue

        # Insert chunk rows (without embeddings yet)
        chunk_ids: list[uuid.UUID] = []
        chunk_texts: list[str] = []

        for spec in specs:
            chunk_id = uuid.uuid4()
            chunk = Chunk(
                id=chunk_id,
                document_id=doc.id,
                text=spec.text,
                section_type=spec.section_type,
                chunk_index=spec.chunk_index,
            )
            session.add(chunk)
            chunk_ids.append(chunk_id)
            chunk_texts.append(spec.text)

        await session.flush()

        # Embed and write vectors
        embedded = await embed_and_write_chunks(
            db=session,
            chunk_ids=chunk_ids,
            chunk_texts=chunk_texts,
        )
        await session.commit()

        log.info(
            "document_processed",
            citation=doc.citation,
            chunks=len(specs),
            embedded=embedded,
        )

    log.info("processing_complete")


async def main() -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as session:
        await process_all(session)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

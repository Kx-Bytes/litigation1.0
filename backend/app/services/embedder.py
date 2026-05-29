"""
C4 — Embedder.

Batch-embeds chunk texts via OpenRouter's embeddings API using
openai/text-embedding-3-small with dimensions=1024, which matches the
pgvector(1024) schema exactly — no migration needed.

Uses the openai SDK pointed at OpenRouter (OpenAI-compatible API).
"""

from __future__ import annotations

import uuid
from typing import Sequence

import structlog
from openai import AsyncOpenAI
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.chunk import Chunk

log = structlog.get_logger()

EMBED_MODEL = "openai/text-embedding-3-small"
EMBED_DIM   = 1024
BATCH_SIZE  = 100   # OpenAI supports up to 2048 inputs per call

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.openrouter_api_key,
            base_url="https://openrouter.ai/api/v1",
        )
    return _client


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Embed *texts* using openai/text-embedding-3-small via OpenRouter.
    Returns a list of 1024-dimensional float vectors in the same order as *texts*.
    """
    if not texts:
        return []

    client = _get_client()
    all_embeddings: list[list[float]] = []

    for batch_start in range(0, len(texts), BATCH_SIZE):
        batch = texts[batch_start : batch_start + BATCH_SIZE]
        log.debug("embedder_batch", batch_start=batch_start, batch_size=len(batch))

        response = await client.embeddings.create(
            model=EMBED_MODEL,
            input=batch,
            dimensions=EMBED_DIM,
        )
        # Response is sorted by index, so order is preserved
        batch_embeddings = [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
        all_embeddings.extend(batch_embeddings)

    return all_embeddings


async def embed_and_write_chunks(
    db: AsyncSession,
    chunk_ids: Sequence[uuid.UUID],
    chunk_texts: Sequence[str],
) -> int:
    """
    Embed *chunk_texts* and write the vectors back to the chunks table.
    Returns the number of chunks successfully embedded and written.
    """
    if not chunk_ids:
        return 0

    texts = list(chunk_texts)
    ids   = list(chunk_ids)

    log.info("embedder_start", total_chunks=len(texts))
    embeddings = await embed_texts(texts)

    if len(embeddings) != len(ids):
        raise RuntimeError(
            f"Embedding count mismatch: expected {len(ids)}, got {len(embeddings)}"
        )

    written = 0
    for batch_start in range(0, len(ids), BATCH_SIZE):
        batch_ids  = ids[batch_start : batch_start + BATCH_SIZE]
        batch_vecs = embeddings[batch_start : batch_start + BATCH_SIZE]

        for chunk_id, vector in zip(batch_ids, batch_vecs):
            await db.execute(
                update(Chunk)
                .where(Chunk.id == chunk_id)
                .values(embedding=vector)
            )
        await db.flush()
        written += len(batch_ids)

    log.info("embedder_complete", written=written)
    return written

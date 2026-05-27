"""
C4 — Embedder.

Batch-embeds chunk texts with voyage-3-large (input_type="document") and
writes the resulting vectors back to the chunks table in Postgres.

Voyage API limits
-----------------
- Max batch size: 128 texts per call
- Max tokens per text: 32,000
- Embedding dimension: 1024 (matches vector(1024) column in chunks table)

NOTE: The retriever (retriever.py) uses input_type="query" for user queries.
This module uses input_type="document" for indexed content. These are NOT
interchangeable — Voyage's asymmetric embedding model encodes queries and
documents into different subspaces that are designed to be compared via
cosine similarity. Mixing them produces garbage retrieval results.
"""

from __future__ import annotations

import uuid
from typing import Sequence

import structlog
import voyageai
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.chunk import Chunk

log = structlog.get_logger()

VOYAGE_MODEL    = "voyage-3-large"
VOYAGE_BATCH    = 128     # max texts per API call
INPUT_TYPE      = "document"

# Module-level client — reused across calls (same pattern as retriever.py)
_voyage_client: voyageai.AsyncClient | None = None


def _get_voyage_client() -> voyageai.AsyncClient:
    global _voyage_client
    if _voyage_client is None:
        _voyage_client = voyageai.AsyncClient(api_key=settings.voyage_api_key)
    return _voyage_client


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Embed *texts* with voyage-3-large (document mode) in batches of VOYAGE_BATCH.
    Returns a list of 1024-dimensional float vectors in the same order as *texts*.
    """
    if not texts:
        return []

    client = _get_voyage_client()
    all_embeddings: list[list[float]] = []

    for batch_start in range(0, len(texts), VOYAGE_BATCH):
        batch = texts[batch_start : batch_start + VOYAGE_BATCH]
        log.debug(
            "embedder_batch",
            batch_start=batch_start,
            batch_size=len(batch),
            total=len(texts),
        )
        result = await client.embed(
            texts=batch,
            model=VOYAGE_MODEL,
            input_type=INPUT_TYPE,
        )
        all_embeddings.extend(result.embeddings)

    return all_embeddings


async def embed_and_write_chunks(
    db: AsyncSession,
    chunk_ids: Sequence[uuid.UUID],
    chunk_texts: Sequence[str],
) -> int:
    """
    Embed *chunk_texts* and write the vectors back to the chunks table.

    *chunk_ids* and *chunk_texts* must be the same length and in the same order.
    Returns the number of chunks successfully embedded and written.
    """
    if not chunk_ids:
        return 0

    texts = list(chunk_texts)
    ids   = list(chunk_ids)

    log.info("embedder_start", total_chunks=len(texts))
    embeddings = await embed_texts(texts)

    if len(embeddings) != len(ids):
        log.error(
            "embedder_count_mismatch",
            expected=len(ids),
            got=len(embeddings),
        )
        raise RuntimeError(
            f"Embedding count mismatch: expected {len(ids)}, got {len(embeddings)}"
        )

    # Write back to DB in batches to avoid enormous single statements
    written = 0
    for batch_start in range(0, len(ids), VOYAGE_BATCH):
        batch_ids   = ids[batch_start : batch_start + VOYAGE_BATCH]
        batch_vecs  = embeddings[batch_start : batch_start + VOYAGE_BATCH]

        for chunk_id, vector in zip(batch_ids, batch_vecs):
            await db.execute(
                update(Chunk)
                .where(Chunk.id == chunk_id)
                .values(embedding=vector)
            )
        await db.flush()
        written += len(batch_ids)
        log.debug("embedder_batch_written", written=written, total=len(ids))

    log.info("embedder_complete", written=written)
    return written

"""
Retriever — jurisdiction-aware top-k vector search using pgvector.

The retriever embeds the user query with voyage-3-large and returns the
k most similar chunks whose jurisdiction matches (or is a parent of) the
query jurisdiction, along with their similarity scores.

Jurisdiction matching is hierarchical:
  - Query "US-9th-Cir" matches: "US-9th-Cir", "US" (federal)
  - Query "US-CA"        matches: "US-CA", "US"
  - Query "US"           matches: "US" only

This ensures federal precedent is always in the pool when querying a
circuit or state, while keeping irrelevant jurisdictions out.
"""

from __future__ import annotations

from datetime import date

import structlog
from openai import AsyncOpenAI
from pgvector.sqlalchemy import Vector
from sqlalchemy import Float, cast, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.chunk import Chunk
from app.models.document import Document

log = structlog.get_logger()

EMBED_MODEL = "openai/text-embedding-3-small"
EMBED_DIM   = 1024

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.openrouter_api_key,
            base_url="https://openrouter.ai/api/v1",
        )
    return _client


def _year_to_start_date(year: int) -> date:
    """Return Jan 1 of *year* — the inclusive lower bound for a year filter."""
    return date(year, 1, 1)


def _year_to_end_date(year: int) -> date:
    """Return Dec 31 of *year* — the inclusive upper bound for a year filter."""
    return date(year, 12, 31)


def validate_date_range(date_from: int | None, date_to: int | None) -> None:
    """
    Raise ValueError if the supplied year range is logically invalid.
    Does nothing if both are None.
    """
    if date_from is not None and date_to is not None and date_from > date_to:
        raise ValueError(
            f"date_from ({date_from}) must be ≤ date_to ({date_to})"
        )


def _jurisdiction_filter_list(jurisdiction: str) -> list[str]:
    """
    Return the list of jurisdictions that should be included when querying
    for `jurisdiction`.

    Corpus is federal-only (Supreme Court + circuits), so the hierarchy is
    always two levels: a specific circuit and the Supreme Court ("US").

    Examples:
        "US-9th-Cir" → ["US-9th-Cir", "US"]
        "US-1st-Cir" → ["US-1st-Cir", "US"]
        "US"          → ["US"]
    """
    if jurisdiction == "US":
        return ["US"]
    return [jurisdiction, "US"]


# ── Public interface ──────────────────────────────────────────────────────────

class RetrievedChunk:
    """A chunk returned by the retriever, with its similarity score."""

    def __init__(
        self,
        chunk_id: str,
        document_id: str,
        text: str,
        section_type: str | None,
        jurisdiction: str,
        citation: str | None,
        source_url: str | None,
        similarity: float,
        start_char: int | None,
        end_char: int | None,
    ) -> None:
        self.chunk_id = chunk_id
        self.document_id = document_id
        self.text = text
        self.section_type = section_type
        self.jurisdiction = jurisdiction
        self.citation = citation
        self.source_url = source_url
        self.similarity = similarity
        self.start_char = start_char
        self.end_char = end_char

    def __repr__(self) -> str:
        return (
            f"<RetrievedChunk citation={self.citation!r} "
            f"sim={self.similarity:.3f} section={self.section_type!r}>"
        )


async def embed_query(query_text: str) -> list[float]:
    """Embed a single query string via OpenRouter (openai/text-embedding-3-small)."""
    client = _get_client()
    response = await client.embeddings.create(
        model=EMBED_MODEL,
        input=[query_text],
        dimensions=EMBED_DIM,
    )
    return response.data[0].embedding


async def retrieve(
    db: AsyncSession,
    query_embedding: list[float],
    jurisdiction: str,
    k: int = 10,
    date_from: int | None = None,
    date_to: int | None = None,
) -> list[RetrievedChunk]:
    """
    Return the top-k chunks closest to `query_embedding` in the given jurisdiction
    (including federal/parent jurisdictions).

    Optional year filters:
      date_from — only include cases decided on or after Jan 1 of this year.
      date_to   — only include cases decided on or before Dec 31 of this year.

    Returns chunks ordered by descending similarity (most relevant first).
    """
    validate_date_range(date_from, date_to)
    jurisdiction_list = _jurisdiction_filter_list(jurisdiction)
    log.debug(
        "retrieve_start",
        jurisdiction=jurisdiction,
        jurisdiction_list=jurisdiction_list,
        k=k,
        date_from=date_from,
        date_to=date_to,
    )

    # pgvector cosine distance: 1 - cosine_similarity
    # We SELECT (1 - distance) as similarity so higher = more relevant.
    embedding_literal = f"[{','.join(str(x) for x in query_embedding)}]"

    stmt = (
        select(
            Chunk.id,
            Chunk.document_id,
            Chunk.text,
            Chunk.section_type,
            Chunk.start_char,
            Chunk.end_char,
            Document.jurisdiction,
            Document.citation,
            Document.source_url,
            (
                1
                - cast(
                    Chunk.embedding.op("<=>")(text(f"'{embedding_literal}'::vector")),
                    Float,
                )
            ).label("similarity"),
        )
        .join(Document, Chunk.document_id == Document.id)
        .where(Document.jurisdiction.in_(jurisdiction_list))
        .where(Chunk.embedding.isnot(None))
    )

    # ── Date range filters (optional) ────────────────────────────────────────
    if date_from is not None:
        stmt = stmt.where(Document.decision_date >= _year_to_start_date(date_from))
    if date_to is not None:
        stmt = stmt.where(Document.decision_date <= _year_to_end_date(date_to))

    stmt = (
        stmt
        .order_by(
            Chunk.embedding.op("<=>")(text(f"'{embedding_literal}'::vector"))
        )
        .limit(k)
    )

    rows = (await db.execute(stmt)).all()
    log.debug("retrieve_complete", returned=len(rows))

    return [
        RetrievedChunk(
            chunk_id=str(row.id),
            document_id=str(row.document_id),
            text=row.text,
            section_type=row.section_type,
            jurisdiction=row.jurisdiction,
            citation=row.citation,
            source_url=row.source_url,
            similarity=float(row.similarity),
            start_char=row.start_char,
            end_char=row.end_char,
        )
        for row in rows
    ]


def jurisdiction_match_rate(chunks: list[RetrievedChunk], target_jurisdiction: str) -> float:
    """
    Fraction of retrieved chunks whose jurisdiction exactly matches the query target.
    Used as one input to confidence band computation.
    """
    if not chunks:
        return 0.0
    exact = sum(1 for c in chunks if c.jurisdiction == target_jurisdiction)
    return exact / len(chunks)

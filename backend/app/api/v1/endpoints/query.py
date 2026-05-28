"""
POST /api/v1/query — full pipeline implementation (B6).

Pipeline per request
--------------------
  1. Persist a Query row (captures audit trail; gives us the query_id).
  2. Embed the query text (claim + facts) via voyage-3-large.
  3. Retrieve top-k chunks (jurisdiction-aware, optional date range).
  4. Generate a structured risk assessment (cite-or-refuse via tool_use).
  5. Verify every cited chunk_id (in-memory + DB round-trip).
  6. Compute the authoritative confidence band from pipeline signals.
  7. Build the QueryResponse, converting internal types to API types.
  8. Persist a QueryResult row (best-effort; DB write failure does not
     break the caller's response — the response is returned regardless).
"""

from __future__ import annotations

import time
import uuid

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.query import Query, QueryResult
from app.services.confidence import compute_confidence_band
from app.services.generator import generate
from app.services.retriever import embed_query, retrieve
from app.services.verifier import verify

log = structlog.get_logger()

router = APIRouter()


# ── Request schema ────────────────────────────────────────────────────────────


class QueryOptions(BaseModel):
    k: int = 10
    # Year-based date range filter (both optional).
    # date_from: only include cases decided on or after Jan 1 of this year.
    # date_to:   only include cases decided on or before Dec 31 of this year.
    date_from: int | None = None
    date_to: int | None = None

    @model_validator(mode="after")
    def check_date_range(self) -> "QueryOptions":
        if (
            self.date_from is not None
            and self.date_to is not None
            and self.date_from > self.date_to
        ):
            raise ValueError(
                f"date_from ({self.date_from}) must be ≤ date_to ({self.date_to})"
            )
        return self


class QueryRequest(BaseModel):
    jurisdiction: str
    claim: str
    facts: str
    options: QueryOptions = QueryOptions()


# ── Response schemas ──────────────────────────────────────────────────────────


class RiskFactor(BaseModel):
    label: str
    weight: str          # "high" | "medium" | "low"
    discussion: str
    citations: list[str]


class ComparableCase(BaseModel):
    citation: str
    summary: str
    source_url: str | None = None
    relevance: str


class RiskAssessment(BaseModel):
    summary: str
    factors: list[RiskFactor]


class QueryResponse(BaseModel):
    query_id: str
    risk_assessment: RiskAssessment | None = None
    comparable_cases: list[ComparableCase] = []
    strategic_considerations: list[str] = []
    uncertainty_notes: list[str] = []
    confidence_band: str          # "high" | "medium" | "low" | "refused"
    dropped_claims: list[str] = []
    model: str = ""
    latency_ms: int = 0
    refusal: dict | None = None
    # Echo back the active date range so the caller can confirm what was applied.
    date_from: int | None = None
    date_to: int | None = None


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.post("/query", response_model=QueryResponse)
async def submit_query(
    body: QueryRequest,
    db: AsyncSession = Depends(get_db),
) -> QueryResponse:
    """
    Submit a litigation query and receive a structured risk assessment.

    The response always includes a `confidence_band` and `query_id`.
    If the corpus is too thin or the model refuses, `refusal` is populated
    and `risk_assessment` is null.
    """
    t_start = time.monotonic()

    # ── 1. Persist Query row ──────────────────────────────────────────────────
    query_row = Query(
        jurisdiction=body.jurisdiction,
        claim=body.claim,
        facts=body.facts,
        raw_request=body.model_dump(),
        date_from_year=body.options.date_from,
        date_to_year=body.options.date_to,
    )
    db.add(query_row)
    await db.flush()          # assigns query_row.id without a full commit
    query_id = str(query_row.id)

    log.info(
        "query_start",
        query_id=query_id,
        jurisdiction=body.jurisdiction,
        k=body.options.k,
        date_from=body.options.date_from,
        date_to=body.options.date_to,
    )

    # ── 2. Embed ──────────────────────────────────────────────────────────────
    query_text = f"{body.claim}\n\n{body.facts}"
    query_embedding = await embed_query(query_text)

    # ── 3. Retrieve ───────────────────────────────────────────────────────────
    retrieved_chunks = await retrieve(
        db=db,
        query_embedding=query_embedding,
        jurisdiction=body.jurisdiction,
        k=body.options.k,
        date_from=body.options.date_from,
        date_to=body.options.date_to,
    )

    log.info("query_retrieved", query_id=query_id, n_chunks=len(retrieved_chunks))

    # ── 4. Generate ───────────────────────────────────────────────────────────
    generator_output = await generate(
        jurisdiction=body.jurisdiction,
        claim=body.claim,
        facts=body.facts,
        chunks=retrieved_chunks,
    )

    # ── 5. Verify ─────────────────────────────────────────────────────────────
    verified_output = await verify(
        db=db,
        generator_output=generator_output,
        retrieved_chunks=retrieved_chunks,
    )

    # ── 6. Confidence band ────────────────────────────────────────────────────
    band = compute_confidence_band(
        retrieved_chunks=retrieved_chunks,
        verified_output=verified_output,
        jurisdiction=body.jurisdiction,
    )

    latency_ms = int((time.monotonic() - t_start) * 1000)

    # ── 7. Build QueryResponse ────────────────────────────────────────────────
    # Lookup maps: chunk_id → citation string (from verified citations)
    retrieved_map     = {c.chunk_id: c for c in retrieved_chunks}
    verified_cite_map = {v.chunk_id: v.citation for v in verified_output.verified_citations}

    if verified_output.refused:
        response = QueryResponse(
            query_id=query_id,
            confidence_band="refused",
            model=verified_output.model,
            latency_ms=latency_ms,
            refusal={
                "reason": verified_output.refusal_reason,
                "suggestion": verified_output.refusal_suggestion,
            },
            date_from=body.options.date_from,
            date_to=body.options.date_to,
        )
    else:
        # Build risk factors — convert internal chunk_ids to citation strings
        risk_factors: list[RiskFactor] = []
        for rf in verified_output.risk_factors:
            citations = [
                verified_cite_map.get(cid, cid)   # fall back to chunk_id if lookup misses
                for cid in rf.chunk_ids
            ]
            risk_factors.append(
                RiskFactor(
                    label=rf.label,
                    weight=rf.weight,
                    discussion=rf.discussion,
                    citations=citations,
                )
            )

        # Build comparable cases — resolve citation + source_url from retrieved map
        comparable_cases: list[ComparableCase] = []
        for cc in verified_output.comparable_cases:
            chunk = retrieved_map.get(cc.chunk_id)
            comparable_cases.append(
                ComparableCase(
                    citation=chunk.citation if chunk and chunk.citation else cc.chunk_id,
                    summary=cc.summary,
                    source_url=chunk.source_url if chunk else None,
                    relevance=cc.relevance,
                )
            )

        # Build dropped_claims — resolve citation strings for audit display
        dropped_claims: list[str] = []
        for dc in verified_output.dropped_citations:
            chunk = retrieved_map.get(dc.chunk_id)
            label = (
                chunk.citation
                if chunk and chunk.citation
                else dc.chunk_id
            )
            dropped_claims.append(label)

        response = QueryResponse(
            query_id=query_id,
            risk_assessment=RiskAssessment(
                summary=verified_output.risk_summary,
                factors=risk_factors,
            ) if risk_factors else None,
            comparable_cases=comparable_cases,
            strategic_considerations=verified_output.strategic_considerations,
            uncertainty_notes=verified_output.uncertainty_notes,
            confidence_band=band,
            dropped_claims=dropped_claims,
            model=verified_output.model,
            latency_ms=latency_ms,
            date_from=body.options.date_from,
            date_to=body.options.date_to,
        )

    log.info(
        "query_complete",
        query_id=query_id,
        band=band,
        refused=verified_output.refused,
        latency_ms=latency_ms,
    )

    # ── 8. Persist QueryResult (best-effort) ──────────────────────────────────
    try:
        result_row = QueryResult(
            query_id=query_row.id,
            retrieved_chunk_ids=[uuid.UUID(c.chunk_id) for c in retrieved_chunks],
            model_id=verified_output.model or None,
            raw_model_output=verified_output.raw_model_output or None,
            verified_citations={
                v.chunk_id: v.citation
                for v in verified_output.verified_citations
            },
            dropped_citations={
                d.chunk_id: d.reason
                for d in verified_output.dropped_citations
            },
            output=response.model_dump(),
            confidence_band=band,
            latency_ms=latency_ms,
        )
        db.add(result_row)
        await db.commit()
        log.info("query_result_persisted", query_id=query_id)
    except Exception:
        log.exception("query_result_persist_failed", query_id=query_id)
        try:
            await db.rollback()
        except Exception:
            pass   # rollback failure is not actionable here

    return response

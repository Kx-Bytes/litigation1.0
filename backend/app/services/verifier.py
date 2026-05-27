"""
B4 — Citation Verifier.

Validates every chunk_id referenced in a GeneratorOutput against two checks:

  Check 1 — In-memory membership:
    The chunk_id must appear in the list of RetrievedChunks that was passed to
    the generator. The generator's tool-use enum contract prevents most misses,
    but this layer is an explicit defensive guard.

  Check 2 — DB round-trip (batched):
    A single SQL query confirms that each candidate Chunk row still exists in
    the database AND its parent Document has a non-null citation string. This
    catches race conditions (chunks deleted after retrieval) and documents that
    were ingested without a citation field.

Outcome for each chunk_id referenced in the GeneratorOutput:
  • Passes both checks → added to verified_citations.
  • Fails Check 1    → added to dropped_citations (reason: "not_in_retrieved_set").
  • Fails Check 2    → added to dropped_citations (reason: "citation_not_in_db").

Post-verification, the verifier rebuilds risk_factors and comparable_cases:
  • risk_factors:     chunk_ids lists pruned to verified-only. Factors where ALL
                      chunk_ids are dropped are removed entirely (no ungrounded
                      claims survive).
  • comparable_cases: entries whose single chunk_id failed verification are
                      removed.

If GeneratorOutput.refused is True, verification is skipped and the result is
a transparent VerifiedOutput pass-through (no DB call is made).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chunk import Chunk
from app.models.document import Document
from app.services.generator import (
    ComparableCaseOutput,
    GeneratorOutput,
    RiskFactorOutput,
)
from app.services.retriever import RetrievedChunk

log = structlog.get_logger()


# ── Output data model ─────────────────────────────────────────────────────────


@dataclass
class VerifiedCitation:
    """A chunk_id that passed both verification checks."""

    chunk_id: str
    citation: str        # Document.citation string confirmed in DB
    document_id: str     # UUID string of the parent Document


@dataclass
class DroppedCitation:
    """A chunk_id that failed at least one verification check."""

    chunk_id: str
    reason: str          # "not_in_retrieved_set" | "citation_not_in_db"


@dataclass
class VerifiedOutput:
    """
    A GeneratorOutput that has passed through the citation verifier.

    All fields mirror GeneratorOutput except:
      • risk_factors / comparable_cases — rebuilt to contain only verified
        chunk_ids. Factors and cases with no surviving citations are removed.
      • verified_citations / dropped_citations — the verifier's audit trail.
      • verification_warnings — human-readable summaries of what was dropped.
    """

    # ── Refusal pass-through ──────────────────────────────────────────────────
    refused: bool = False
    refusal_reason: str | None = None
    refusal_suggestion: str | None = None

    # ── Assessment fields (post-verification) ─────────────────────────────────
    risk_summary: str = ""
    risk_factors: list[RiskFactorOutput] = field(default_factory=list)
    comparable_cases: list[ComparableCaseOutput] = field(default_factory=list)
    strategic_considerations: list[str] = field(default_factory=list)
    uncertainty_notes: list[str] = field(default_factory=list)
    confidence_band: str = "low"

    # ── Verifier audit trail ──────────────────────────────────────────────────
    verified_citations: list[VerifiedCitation] = field(default_factory=list)
    dropped_citations: list[DroppedCitation] = field(default_factory=list)
    verification_warnings: list[str] = field(default_factory=list)

    # ── Model provenance ──────────────────────────────────────────────────────
    raw_model_output: str = ""
    model: str = ""


# ── Internal helpers ──────────────────────────────────────────────────────────


def _collect_referenced_ids(generator_output: GeneratorOutput) -> set[str]:
    """Return the union of all chunk_ids cited anywhere in the GeneratorOutput."""
    ids: set[str] = set()
    for rf in generator_output.risk_factors:
        ids.update(rf.chunk_ids)
    for cc in generator_output.comparable_cases:
        ids.add(cc.chunk_id)
    return ids


async def _db_verify(
    db: AsyncSession,
    candidate_ids: set[str],
) -> list[VerifiedCitation]:
    """
    Batched DB check: return VerifiedCitation entries for every chunk_id in
    candidate_ids whose Chunk row exists AND whose Document.citation is not null.

    Invalid UUID strings in candidate_ids are silently excluded (treated as
    DB-verification failures — the caller records them as "citation_not_in_db").
    """
    if not candidate_ids:
        return []

    # Convert str → uuid.UUID, skipping any malformed IDs
    uuids: list[uuid.UUID] = []
    for cid in candidate_ids:
        try:
            uuids.append(uuid.UUID(cid))
        except ValueError:
            log.warning("verifier_invalid_uuid", chunk_id=cid)

    if not uuids:
        return []

    stmt = (
        select(Chunk.id, Chunk.document_id, Document.citation)
        .join(Document, Chunk.document_id == Document.id)
        .where(Chunk.id.in_(uuids))
        .where(Document.citation.isnot(None))
    )
    rows = (await db.execute(stmt)).all()

    return [
        VerifiedCitation(
            chunk_id=str(row.id),
            citation=row.citation,
            document_id=str(row.document_id),
        )
        for row in rows
    ]


def _build_warnings(
    dropped: list[DroppedCitation],
    dropped_factors: list[str],
) -> list[str]:
    """Produce human-readable warning strings from the drop report."""
    warnings: list[str] = []

    if dropped:
        not_in_set = sum(1 for d in dropped if d.reason == "not_in_retrieved_set")
        not_in_db  = sum(1 for d in dropped if d.reason == "citation_not_in_db")
        parts: list[str] = []
        if not_in_set:
            parts.append(f"{not_in_set} not found in retrieved set")
        if not_in_db:
            parts.append(f"{not_in_db} not confirmed in database")
        warnings.append(
            f"{len(dropped)} citation(s) dropped during verification: "
            + ", ".join(parts)
            + "."
        )

    for label in dropped_factors:
        warnings.append(
            f"Risk factor '{label}' removed: all cited chunks failed verification."
        )

    return warnings


# ── Main entry point ──────────────────────────────────────────────────────────


async def verify(
    db: AsyncSession,
    generator_output: GeneratorOutput,
    retrieved_chunks: list[RetrievedChunk],
) -> VerifiedOutput:
    """
    Run two-check citation verification on a GeneratorOutput.

    Pipeline:
      1. Refusal pass-through — if generator_output.refused, return immediately.
      2. Collect all referenced chunk_ids from risk_factors and comparable_cases.
      3. Check 1 (in-memory): separate ids into candidates and not-in-set drops.
      4. Check 2 (DB): batch-query candidates; split into verified and db-drops.
      5. Rebuild risk_factors (prune chunk_ids; drop factors with none left).
      6. Rebuild comparable_cases (drop entries with unverified chunk_id).
      7. Build warnings and return VerifiedOutput.
    """

    # ── 1. Refusal pass-through ───────────────────────────────────────────────
    if generator_output.refused:
        log.info("verifier_skip_refused")
        return VerifiedOutput(
            refused=True,
            refusal_reason=generator_output.refusal_reason,
            refusal_suggestion=generator_output.refusal_suggestion,
            confidence_band=generator_output.confidence_band,
            raw_model_output=generator_output.raw_model_output,
            model=generator_output.model,
        )

    # ── 2. Collect referenced ids ─────────────────────────────────────────────
    referenced_ids = _collect_referenced_ids(generator_output)

    log.info(
        "verifier_start",
        total_referenced=len(referenced_ids),
        total_retrieved=len(retrieved_chunks),
    )

    # ── 3. Check 1: in-memory membership ─────────────────────────────────────
    retrieved_map: dict[str, RetrievedChunk] = {
        c.chunk_id: c for c in retrieved_chunks
    }
    not_in_set: set[str] = referenced_ids - retrieved_map.keys()
    candidates: set[str] = referenced_ids & retrieved_map.keys()

    dropped: list[DroppedCitation] = [
        DroppedCitation(chunk_id=cid, reason="not_in_retrieved_set")
        for cid in sorted(not_in_set)
    ]

    # ── 4. Check 2: DB round-trip ─────────────────────────────────────────────
    verified_list = await _db_verify(db, candidates)
    verified_ids: set[str] = {v.chunk_id for v in verified_list}

    db_dropped: set[str] = candidates - verified_ids
    dropped.extend(
        DroppedCitation(chunk_id=cid, reason="citation_not_in_db")
        for cid in sorted(db_dropped)
    )

    log.info(
        "verifier_complete",
        verified=len(verified_ids),
        dropped_check1=len(not_in_set),
        dropped_check2=len(db_dropped),
    )

    # ── 5. Rebuild risk_factors ───────────────────────────────────────────────
    filtered_risk_factors: list[RiskFactorOutput] = []
    dropped_factor_labels: list[str] = []

    for rf in generator_output.risk_factors:
        surviving = [cid for cid in rf.chunk_ids if cid in verified_ids]
        if not surviving:
            dropped_factor_labels.append(rf.label)
            continue
        filtered_risk_factors.append(
            RiskFactorOutput(
                label=rf.label,
                weight=rf.weight,
                discussion=rf.discussion,
                chunk_ids=surviving,
            )
        )

    # ── 6. Rebuild comparable_cases ───────────────────────────────────────────
    filtered_comparable_cases: list[ComparableCaseOutput] = [
        cc for cc in generator_output.comparable_cases
        if cc.chunk_id in verified_ids
    ]

    # ── 7. Build warnings and return ──────────────────────────────────────────
    warnings = _build_warnings(dropped, dropped_factor_labels)

    return VerifiedOutput(
        refused=False,
        risk_summary=generator_output.risk_summary,
        risk_factors=filtered_risk_factors,
        comparable_cases=filtered_comparable_cases,
        strategic_considerations=generator_output.strategic_considerations,
        uncertainty_notes=generator_output.uncertainty_notes,
        confidence_band=generator_output.confidence_band,
        verified_citations=verified_list,
        dropped_citations=sorted(dropped, key=lambda d: d.chunk_id),
        verification_warnings=warnings,
        raw_model_output=generator_output.raw_model_output,
        model=generator_output.model,
    )

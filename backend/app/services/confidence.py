"""
B5 — Confidence Band Computation.

Computes the authoritative confidence band for a query response from three
objective pipeline signals. The model's self-reported confidence_band (in
GeneratorOutput) is intentionally ignored — calibrated signals are more
reliable than model self-assessment.

Signals
-------
strong_chunks : int
    Count of retrieved chunks with cosine similarity ≥ MIN_SIMILARITY (0.65).
    Measures the depth of on-point precedent in the corpus.

jurisdiction_match_rate : float  [0.0, 1.0]
    Fraction of retrieved chunks whose jurisdiction exactly matches the query
    jurisdiction. Computed by retriever.jurisdiction_match_rate(). Measures
    how directly applicable the retrieved cases are (vs. cross-circuit).

verification_rate : float  [0.0, 1.0]
    Fraction of chunk_ids cited by the generator that survived the citation
    verifier. Measures the generator's grounding quality: a high rate means
    most citations resolved to real, DB-confirmed chunks.

Band rules (evaluated top-to-bottom; first match wins)
--------------------------------------------------------
  "refused"  — verified_output.refused is True.
  "high"     — strong_chunks ≥ HIGH_STRONG_CHUNKS
               AND jurisdiction_match_rate ≥ HIGH_JURISDICTION_RATE
               AND verification_rate ≥ HIGH_VERIFICATION_RATE
  "medium"   — strong_chunks ≥ MEDIUM_STRONG_CHUNKS
               AND verification_rate ≥ MEDIUM_VERIFICATION_RATE
  "low"      — everything else (a non-refused answer was produced but at
               least one signal is too weak for medium confidence).
"""

from __future__ import annotations

import structlog

from app.services.generator import MIN_SIMILARITY
from app.services.retriever import RetrievedChunk
from app.services.verifier import VerifiedOutput

log = structlog.get_logger()

# ── Tuning constants ──────────────────────────────────────────────────────────

# "high" band thresholds
HIGH_STRONG_CHUNKS      = 4    # minimum chunks at or above MIN_SIMILARITY
HIGH_JURISDICTION_RATE  = 0.5  # at least half the chunks match the query jurisdiction
HIGH_VERIFICATION_RATE  = 0.75 # at least 75 % of cited chunk_ids survived verification

# "medium" band thresholds
MEDIUM_STRONG_CHUNKS     = 2    # minimum chunks at or above MIN_SIMILARITY
MEDIUM_VERIFICATION_RATE = 0.5  # at least 50 % of cited chunk_ids survived verification


# ── Signal helpers ────────────────────────────────────────────────────────────


def count_strong_chunks(retrieved_chunks: list[RetrievedChunk]) -> int:
    """Return the number of retrieved chunks with similarity ≥ MIN_SIMILARITY."""
    return sum(1 for c in retrieved_chunks if c.similarity >= MIN_SIMILARITY)


def compute_jurisdiction_match_rate(
    retrieved_chunks: list[RetrievedChunk],
    jurisdiction: str,
) -> float:
    """
    Fraction of retrieved chunks whose jurisdiction exactly matches the query.
    Returns 0.0 for an empty chunk list.
    """
    if not retrieved_chunks:
        return 0.0
    exact = sum(1 for c in retrieved_chunks if c.jurisdiction == jurisdiction)
    return exact / len(retrieved_chunks)


def compute_verification_rate(verified_output: VerifiedOutput) -> float:
    """
    Fraction of total referenced chunk_ids that survived both verification
    checks (verified / (verified + dropped)).

    Returns 1.0 when nothing was cited (no citations to fail means the
    generator produced no references — treated as a perfect pass-rate so this
    signal does not artificially drag down the band for refusals or
    reference-free outputs).
    """
    total = len(verified_output.verified_citations) + len(verified_output.dropped_citations)
    if total == 0:
        return 1.0
    return len(verified_output.verified_citations) / total


# ── Main entry point ──────────────────────────────────────────────────────────


def compute_confidence_band(
    retrieved_chunks: list[RetrievedChunk],
    verified_output: VerifiedOutput,
    jurisdiction: str,
) -> str:
    """
    Compute the authoritative confidence band for a query response.

    Parameters
    ----------
    retrieved_chunks:
        The chunks returned by the retriever for this query.
    verified_output:
        The VerifiedOutput produced by the citation verifier (B4).
    jurisdiction:
        The query jurisdiction string (e.g. "US-9th-Cir", "US").

    Returns
    -------
    "refused" | "high" | "medium" | "low"
    """
    # ── Refusal fast-path ─────────────────────────────────────────────────────
    if verified_output.refused:
        log.info("confidence_band_refused")
        return "refused"

    # ── Compute signals ───────────────────────────────────────────────────────
    strong          = count_strong_chunks(retrieved_chunks)
    jur_rate        = compute_jurisdiction_match_rate(retrieved_chunks, jurisdiction)
    verif_rate      = compute_verification_rate(verified_output)

    log.info(
        "confidence_band_signals",
        strong_chunks=strong,
        jurisdiction_match_rate=round(jur_rate, 3),
        verification_rate=round(verif_rate, 3),
    )

    # ── Apply threshold rules ─────────────────────────────────────────────────
    if (
        strong     >= HIGH_STRONG_CHUNKS
        and jur_rate   >= HIGH_JURISDICTION_RATE
        and verif_rate >= HIGH_VERIFICATION_RATE
    ):
        band = "high"
    elif strong >= MEDIUM_STRONG_CHUNKS and verif_rate >= MEDIUM_VERIFICATION_RATE:
        band = "medium"
    else:
        band = "low"

    log.info("confidence_band_result", band=band)
    return band

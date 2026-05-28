"""
Unit tests for confidence.py — all pure functions, no I/O, no DB.

Covers:
  - count_strong_chunks: all above, none above, mixed, empty, exact boundary
  - compute_jurisdiction_match_rate: all match, none match, partial, empty
  - compute_verification_rate: all verified, all dropped, mixed, zero-citation
  - compute_confidence_band:
      - refused passthrough
      - "high" band: meets all three thresholds
      - "high" falls to "medium": each high-threshold individually violated
      - "medium" band: meets two thresholds
      - "medium" falls to "low": each medium-threshold individually violated
      - "low" band: no thresholds met
      - exact boundary values (≥ vs. <)
      - empty retrieved_chunks → "low"
      - no citations referenced → verification_rate=1.0 (neutral signal)
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

import pytest

from app.services.confidence import (
    HIGH_JURISDICTION_RATE,
    HIGH_STRONG_CHUNKS,
    HIGH_VERIFICATION_RATE,
    MEDIUM_STRONG_CHUNKS,
    MEDIUM_VERIFICATION_RATE,
    compute_confidence_band,
    compute_jurisdiction_match_rate,
    compute_verification_rate,
    count_strong_chunks,
)
from app.services.generator import MIN_SIMILARITY
from app.services.retriever import RetrievedChunk
from app.services.verifier import DroppedCitation, VerifiedCitation, VerifiedOutput


# ── Helpers ───────────────────────────────────────────────────────────────────

_JUR = "US-9th-Cir"


def _chunk(similarity: float, jurisdiction: str = _JUR) -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=str(uuid.uuid4()),
        document_id=str(uuid.uuid4()),
        text="Sample text.",
        section_type="analysis",
        jurisdiction=jurisdiction,
        citation="Test v. Case, 1 F.3d 1",
        source_url=None,
        similarity=similarity,
        start_char=0,
        end_char=100,
    )


def _strong(n: int, jurisdiction: str = _JUR) -> list[RetrievedChunk]:
    """Return n chunks at similarity=0.80 (above MIN_SIMILARITY)."""
    return [_chunk(0.80, jurisdiction) for _ in range(n)]


def _weak(n: int) -> list[RetrievedChunk]:
    """Return n chunks at similarity=0.50 (below MIN_SIMILARITY)."""
    return [_chunk(0.50) for _ in range(n)]


def _verified_output(
    *,
    refused: bool = False,
    n_verified: int = 0,
    n_dropped: int = 0,
) -> VerifiedOutput:
    """Build a minimal VerifiedOutput with n_verified and n_dropped citations."""
    verified = [
        VerifiedCitation(
            chunk_id=str(uuid.uuid4()),
            citation="Test v. Case",
            document_id=str(uuid.uuid4()),
        )
        for _ in range(n_verified)
    ]
    dropped = [
        DroppedCitation(chunk_id=str(uuid.uuid4()), reason="citation_not_in_db")
        for _ in range(n_dropped)
    ]
    return VerifiedOutput(
        refused=refused,
        verified_citations=verified,
        dropped_citations=dropped,
    )


# ── count_strong_chunks ───────────────────────────────────────────────────────

def test_count_strong_all_above() -> None:
    chunks = [_chunk(0.80) for _ in range(5)]
    assert count_strong_chunks(chunks) == 5


def test_count_strong_none_above() -> None:
    chunks = [_chunk(0.50) for _ in range(4)]
    assert count_strong_chunks(chunks) == 0


def test_count_strong_mixed() -> None:
    chunks = [_chunk(0.80), _chunk(0.64), _chunk(0.65), _chunk(0.50)]
    # 0.80 ≥ 0.65, 0.64 < 0.65, 0.65 ≥ 0.65, 0.50 < 0.65 → 2
    assert count_strong_chunks(chunks) == 2


def test_count_strong_empty() -> None:
    assert count_strong_chunks([]) == 0


def test_count_strong_exact_boundary() -> None:
    # Exactly at MIN_SIMILARITY should count
    chunks = [_chunk(MIN_SIMILARITY)]
    assert count_strong_chunks(chunks) == 1


def test_count_strong_just_below_boundary() -> None:
    chunks = [_chunk(MIN_SIMILARITY - 0.001)]
    assert count_strong_chunks(chunks) == 0


# ── compute_jurisdiction_match_rate ──────────────────────────────────────────

def test_jurisdiction_rate_all_match() -> None:
    chunks = [_chunk(0.80, _JUR) for _ in range(4)]
    assert compute_jurisdiction_match_rate(chunks, _JUR) == 1.0


def test_jurisdiction_rate_none_match() -> None:
    chunks = [_chunk(0.80, "US") for _ in range(4)]
    assert compute_jurisdiction_match_rate(chunks, _JUR) == 0.0


def test_jurisdiction_rate_half_match() -> None:
    chunks = [_chunk(0.80, _JUR), _chunk(0.80, _JUR),
              _chunk(0.80, "US"),  _chunk(0.80, "US")]
    rate = compute_jurisdiction_match_rate(chunks, _JUR)
    assert rate == pytest.approx(0.5)


def test_jurisdiction_rate_empty() -> None:
    assert compute_jurisdiction_match_rate([], _JUR) == 0.0


def test_jurisdiction_rate_single_match() -> None:
    chunks = [_chunk(0.80, _JUR), _chunk(0.80, "US"), _chunk(0.80, "US-1st-Cir")]
    rate = compute_jurisdiction_match_rate(chunks, _JUR)
    assert rate == pytest.approx(1 / 3)


# ── compute_verification_rate ─────────────────────────────────────────────────

def test_verification_rate_all_verified() -> None:
    vo = _verified_output(n_verified=4, n_dropped=0)
    assert compute_verification_rate(vo) == 1.0


def test_verification_rate_all_dropped() -> None:
    vo = _verified_output(n_verified=0, n_dropped=3)
    assert compute_verification_rate(vo) == 0.0


def test_verification_rate_half() -> None:
    vo = _verified_output(n_verified=2, n_dropped=2)
    assert compute_verification_rate(vo) == pytest.approx(0.5)


def test_verification_rate_zero_total_returns_one() -> None:
    # No citations referenced → neutral signal (1.0)
    vo = _verified_output(n_verified=0, n_dropped=0)
    assert compute_verification_rate(vo) == 1.0


def test_verification_rate_three_quarters() -> None:
    vo = _verified_output(n_verified=3, n_dropped=1)
    assert compute_verification_rate(vo) == pytest.approx(0.75)


# ── compute_confidence_band — refused ────────────────────────────────────────

def test_band_refused_passthrough() -> None:
    vo = _verified_output(refused=True)
    result = compute_confidence_band(_strong(6), vo, _JUR)
    assert result == "refused"


def test_band_refused_even_with_strong_signals() -> None:
    # Refused output, strong corpus — refusal still wins
    chunks = _strong(HIGH_STRONG_CHUNKS) + _strong(2)
    vo = _verified_output(refused=True)
    assert compute_confidence_band(chunks, vo, _JUR) == "refused"


# ── compute_confidence_band — "high" band ────────────────────────────────────

def test_band_high_all_thresholds_met() -> None:
    # 4 strong, all same jurisdiction (rate=1.0), 4 verified 0 dropped (rate=1.0)
    chunks = _strong(HIGH_STRONG_CHUNKS)
    vo = _verified_output(n_verified=4, n_dropped=0)
    assert compute_confidence_band(chunks, vo, _JUR) == "high"


def test_band_high_with_extra_strong_chunks() -> None:
    chunks = _strong(8)
    vo = _verified_output(n_verified=8, n_dropped=0)
    assert compute_confidence_band(chunks, vo, _JUR) == "high"


def test_band_high_falls_to_medium_too_few_strong_chunks() -> None:
    # strong < HIGH_STRONG_CHUNKS (only 3) but meets medium thresholds
    chunks = _strong(HIGH_STRONG_CHUNKS - 1)
    vo = _verified_output(n_verified=4, n_dropped=0)
    result = compute_confidence_band(chunks, vo, _JUR)
    assert result in ("medium", "low")   # not "high"
    assert result != "high"


def test_band_high_falls_when_jurisdiction_rate_too_low() -> None:
    # 4 strong chunks, but half are "US" (rate=0.5 is the boundary — use 0.4 to fail)
    strong_jur = _strong(2, _JUR)          # 2 match
    strong_other = _strong(3, "US")        # 3 don't match → rate = 2/5 = 0.4 < 0.5
    chunks = strong_jur + strong_other
    vo = _verified_output(n_verified=5, n_dropped=0)
    result = compute_confidence_band(chunks, vo, _JUR)
    assert result != "high"


def test_band_high_falls_when_verification_rate_too_low() -> None:
    # 4 strong, good jurisdiction, but verification_rate < HIGH_VERIFICATION_RATE
    chunks = _strong(HIGH_STRONG_CHUNKS)
    # 2 verified, 2 dropped → rate = 0.5 < 0.75
    vo = _verified_output(n_verified=2, n_dropped=2)
    result = compute_confidence_band(chunks, vo, _JUR)
    assert result != "high"


# ── compute_confidence_band — "medium" band ──────────────────────────────────

def test_band_medium_exact_thresholds() -> None:
    # Exactly MEDIUM_STRONG_CHUNKS strong, all same jurisdiction, verification=0.5
    chunks = _strong(MEDIUM_STRONG_CHUNKS)
    vo = _verified_output(n_verified=1, n_dropped=1)   # rate = 0.5
    assert compute_confidence_band(chunks, vo, _JUR) == "medium"


def test_band_medium_good_chunks_low_jurisdiction_rate() -> None:
    # 4 strong chunks but poor jurisdiction rate → can't reach "high" but can reach "medium"
    strong_jur   = _strong(1, _JUR)      # 1 match
    strong_other = _strong(3, "US")      # 3 don't → rate = 0.25
    chunks = strong_jur + strong_other
    vo = _verified_output(n_verified=4, n_dropped=0)   # verif_rate = 1.0
    result = compute_confidence_band(chunks, vo, _JUR)
    assert result == "medium"


def test_band_medium_falls_to_low_too_few_strong() -> None:
    # Only 1 strong chunk → below MEDIUM_STRONG_CHUNKS
    chunks = _strong(MEDIUM_STRONG_CHUNKS - 1)
    vo = _verified_output(n_verified=4, n_dropped=0)
    assert compute_confidence_band(chunks, vo, _JUR) == "low"


def test_band_medium_falls_to_low_verification_rate_too_low() -> None:
    # 2 strong chunks but verification_rate < MEDIUM_VERIFICATION_RATE
    chunks = _strong(MEDIUM_STRONG_CHUNKS)
    # 1 verified, 3 dropped → rate = 0.25 < 0.5
    vo = _verified_output(n_verified=1, n_dropped=3)
    assert compute_confidence_band(chunks, vo, _JUR) == "low"


# ── compute_confidence_band — "low" band ─────────────────────────────────────

def test_band_low_no_strong_chunks() -> None:
    chunks = _weak(6)
    vo = _verified_output(n_verified=4, n_dropped=0)
    assert compute_confidence_band(chunks, vo, _JUR) == "low"


def test_band_low_empty_retrieved_chunks() -> None:
    vo = _verified_output(n_verified=0, n_dropped=0)
    assert compute_confidence_band([], vo, _JUR) == "low"


def test_band_low_all_dropped() -> None:
    chunks = _strong(HIGH_STRONG_CHUNKS)
    vo = _verified_output(n_verified=0, n_dropped=4)  # verif_rate = 0.0
    assert compute_confidence_band(chunks, vo, _JUR) == "low"


# ── no citations referenced (verification_rate = 1.0 neutral) ────────────────

def test_band_no_citations_referenced_does_not_drag_band_down() -> None:
    # Generator cited nothing (unusual) — verification_rate defaults to 1.0
    # With 4 strong + high jur_rate + 1.0 verif_rate → should be "high"
    chunks = _strong(HIGH_STRONG_CHUNKS)
    vo = _verified_output(n_verified=0, n_dropped=0)  # 0 referenced
    assert compute_confidence_band(chunks, vo, _JUR) == "high"


# ── exact boundary conditions ─────────────────────────────────────────────────

def test_band_high_boundary_exactly_four_strong_chunks() -> None:
    # Exactly HIGH_STRONG_CHUNKS strong (= 4), jur_rate=1.0, verif_rate=1.0
    chunks = _strong(HIGH_STRONG_CHUNKS)
    vo = _verified_output(n_verified=4, n_dropped=0)
    assert compute_confidence_band(chunks, vo, _JUR) == "high"


def test_band_high_boundary_jurisdiction_rate_exactly_half() -> None:
    # 4 strong, exactly 50% jurisdiction match (4/8), verif_rate=1.0
    half = HIGH_STRONG_CHUNKS // 2
    chunks = _strong(half, _JUR) + _strong(half, "US")
    vo = _verified_output(n_verified=len(chunks), n_dropped=0)
    assert compute_confidence_band(chunks, vo, _JUR) == "high"


def test_band_medium_boundary_exactly_two_strong_chunks() -> None:
    chunks = _strong(MEDIUM_STRONG_CHUNKS)
    vo = _verified_output(n_verified=2, n_dropped=0)  # verif_rate = 1.0
    assert compute_confidence_band(chunks, vo, _JUR) == "medium"


def test_band_medium_boundary_verification_rate_exactly_half() -> None:
    chunks = _strong(MEDIUM_STRONG_CHUNKS)
    # 1 verified, 1 dropped → rate = 0.5 = MEDIUM_VERIFICATION_RATE
    vo = _verified_output(n_verified=1, n_dropped=1)
    assert compute_confidence_band(chunks, vo, _JUR) == "medium"

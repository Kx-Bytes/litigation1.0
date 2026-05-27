"""
Unit tests for verifier.py — pure logic, no live database.

The DB session is mocked via unittest.mock so all tests are fast and offline.

Covers:
  - VerifiedOutput / VerifiedCitation / DroppedCitation dataclass defaults
  - verify() refusal pass-through (no DB call)
  - Check 1 failures: chunk_ids not in retrieved set
  - Check 2 failures: chunk_ids missing from DB
  - Mixed: some verified, some dropped from each check
  - risk_factor pruning: surviving chunk_ids kept; factor dropped when all gone
  - comparable_case filtering: cases with unverified chunk_ids removed
  - verification_warnings content and format
  - Pass-through of strategic_considerations, uncertainty_notes, model, etc.
  - Empty reference case (no risk_factors, no comparable_cases)
  - Duplicate chunk_ids across multiple risk_factors
"""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.generator import (
    ComparableCaseOutput,
    GeneratorOutput,
    RiskFactorOutput,
)
from app.services.retriever import RetrievedChunk
from app.services.verifier import (
    DroppedCitation,
    VerifiedCitation,
    VerifiedOutput,
    _build_warnings,
    _collect_referenced_ids,
    verify,
)


# ── Fixtures / helpers ────────────────────────────────────────────────────────

# Fixed UUIDs for deterministic tests
_DOC_ID  = str(uuid.uuid4())
_CHUNK_1 = str(uuid.uuid4())
_CHUNK_2 = str(uuid.uuid4())
_CHUNK_3 = str(uuid.uuid4())
_CHUNK_4 = str(uuid.uuid4())


def _make_chunk(chunk_id: str, citation: str = "Test v. Case, 1 F.3d 1") -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=chunk_id,
        document_id=_DOC_ID,
        text="Sample legal text.",
        section_type="analysis",
        jurisdiction="US-9th-Cir",
        citation=citation,
        source_url="https://example.com/case",
        similarity=0.80,
        start_char=0,
        end_char=100,
    )


def _make_db_row(chunk_id: str, doc_id: str = _DOC_ID, citation: str = "Test v. Case") -> SimpleNamespace:
    """Simulate a SQLAlchemy row returned from the DB query."""
    return SimpleNamespace(
        id=uuid.UUID(chunk_id),
        document_id=uuid.UUID(doc_id),
        citation=citation,
    )


def _make_db(rows: list) -> AsyncMock:
    """Return a mock AsyncSession whose execute() returns the given rows."""
    mock_result = MagicMock()
    mock_result.all.return_value = rows
    mock_db = AsyncMock()
    mock_db.execute.return_value = mock_result
    return mock_db


def _make_risk_factor(label: str, chunk_ids: list[str], weight: str = "medium") -> RiskFactorOutput:
    return RiskFactorOutput(
        label=label,
        weight=weight,
        discussion=f"Discussion for {label}.",
        chunk_ids=chunk_ids,
    )


def _make_comparable_case(chunk_id: str) -> ComparableCaseOutput:
    return ComparableCaseOutput(
        chunk_id=chunk_id,
        summary="Plaintiff lacked standing.",
        relevance="Same jurisdictional posture.",
    )


def _make_generator_output(
    *,
    refused: bool = False,
    refusal_reason: str | None = None,
    refusal_suggestion: str | None = None,
    risk_factors: list[RiskFactorOutput] | None = None,
    comparable_cases: list[ComparableCaseOutput] | None = None,
    strategic_considerations: list[str] | None = None,
    uncertainty_notes: list[str] | None = None,
    confidence_band: str = "medium",
    model: str = "claude-sonnet-4-6",
) -> GeneratorOutput:
    return GeneratorOutput(
        refused=refused,
        refusal_reason=refusal_reason,
        refusal_suggestion=refusal_suggestion,
        risk_summary="Overall risk is moderate.",
        risk_factors=risk_factors or [],
        comparable_cases=comparable_cases or [],
        strategic_considerations=strategic_considerations or ["Consider venue."],
        uncertainty_notes=uncertainty_notes or ["Limited precedent."],
        confidence_band=confidence_band,
        raw_model_output="<raw>",
        model=model,
    )


# ── Dataclass defaults ────────────────────────────────────────────────────────

def test_verified_output_defaults() -> None:
    out = VerifiedOutput()
    assert out.refused is False
    assert out.confidence_band == "low"
    assert out.risk_factors == []
    assert out.comparable_cases == []
    assert out.verified_citations == []
    assert out.dropped_citations == []
    assert out.verification_warnings == []
    assert out.model == ""


def test_verified_citation_fields() -> None:
    vc = VerifiedCitation(chunk_id=_CHUNK_1, citation="Foo v. Bar", document_id=_DOC_ID)
    assert vc.chunk_id == _CHUNK_1
    assert "Foo" in vc.citation
    assert vc.document_id == _DOC_ID


def test_dropped_citation_fields() -> None:
    dc = DroppedCitation(chunk_id=_CHUNK_1, reason="not_in_retrieved_set")
    assert dc.chunk_id == _CHUNK_1
    assert dc.reason == "not_in_retrieved_set"


# ── _collect_referenced_ids ───────────────────────────────────────────────────

def test_collect_referenced_ids_empty() -> None:
    out = _make_generator_output()
    assert _collect_referenced_ids(out) == set()


def test_collect_referenced_ids_from_risk_factors() -> None:
    out = _make_generator_output(
        risk_factors=[_make_risk_factor("Standing", [_CHUNK_1, _CHUNK_2])],
    )
    assert _collect_referenced_ids(out) == {_CHUNK_1, _CHUNK_2}


def test_collect_referenced_ids_from_comparable_cases() -> None:
    out = _make_generator_output(
        comparable_cases=[_make_comparable_case(_CHUNK_3)],
    )
    assert _collect_referenced_ids(out) == {_CHUNK_3}


def test_collect_referenced_ids_union() -> None:
    out = _make_generator_output(
        risk_factors=[_make_risk_factor("A", [_CHUNK_1])],
        comparable_cases=[_make_comparable_case(_CHUNK_2)],
    )
    assert _collect_referenced_ids(out) == {_CHUNK_1, _CHUNK_2}


def test_collect_referenced_ids_deduplicates() -> None:
    # Same chunk_id in two factors and in comparable_cases
    out = _make_generator_output(
        risk_factors=[
            _make_risk_factor("A", [_CHUNK_1, _CHUNK_2]),
            _make_risk_factor("B", [_CHUNK_1]),
        ],
        comparable_cases=[_make_comparable_case(_CHUNK_1)],
    )
    assert _collect_referenced_ids(out) == {_CHUNK_1, _CHUNK_2}


# ── _build_warnings ───────────────────────────────────────────────────────────

def test_build_warnings_no_drops() -> None:
    assert _build_warnings([], []) == []


def test_build_warnings_not_in_set() -> None:
    dropped = [DroppedCitation(chunk_id=_CHUNK_1, reason="not_in_retrieved_set")]
    warnings = _build_warnings(dropped, [])
    assert len(warnings) == 1
    assert "not found in retrieved set" in warnings[0]
    assert "1 citation(s) dropped" in warnings[0]


def test_build_warnings_not_in_db() -> None:
    dropped = [DroppedCitation(chunk_id=_CHUNK_1, reason="citation_not_in_db")]
    warnings = _build_warnings(dropped, [])
    assert "not confirmed in database" in warnings[0]


def test_build_warnings_dropped_factor() -> None:
    warnings = _build_warnings([], ["Standing — injury-in-fact"])
    assert len(warnings) == 1
    assert "Standing — injury-in-fact" in warnings[0]
    assert "removed" in warnings[0]


def test_build_warnings_mixed_reasons() -> None:
    dropped = [
        DroppedCitation(chunk_id=_CHUNK_1, reason="not_in_retrieved_set"),
        DroppedCitation(chunk_id=_CHUNK_2, reason="citation_not_in_db"),
    ]
    warnings = _build_warnings(dropped, [])
    assert "2 citation(s) dropped" in warnings[0]
    assert "not found in retrieved set" in warnings[0]
    assert "not confirmed in database" in warnings[0]


# ── verify() — refusal pass-through ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_refusal_passthrough() -> None:
    gen_out = _make_generator_output(
        refused=True,
        refusal_reason="Too few cases.",
        refusal_suggestion="Broaden query.",
        confidence_band="refused",
    )
    mock_db = _make_db([])  # should NOT be called

    result = await verify(mock_db, gen_out, [])

    assert result.refused is True
    assert result.refusal_reason == "Too few cases."
    assert result.refusal_suggestion == "Broaden query."
    assert result.confidence_band == "refused"
    assert result.verified_citations == []
    assert result.dropped_citations == []
    assert result.verification_warnings == []
    # DB should not have been called
    mock_db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_verify_refusal_passthrough_preserves_model() -> None:
    gen_out = _make_generator_output(refused=True, confidence_band="refused", model="claude-test")
    result = await verify(_make_db([]), gen_out, [])
    assert result.model == "claude-test"


# ── verify() — all pass ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_all_pass() -> None:
    retrieved = [_make_chunk(_CHUNK_1), _make_chunk(_CHUNK_2)]
    gen_out = _make_generator_output(
        risk_factors=[_make_risk_factor("Standing", [_CHUNK_1, _CHUNK_2])],
        comparable_cases=[_make_comparable_case(_CHUNK_1)],
    )
    db_rows = [
        _make_db_row(_CHUNK_1, citation="Case A v. B"),
        _make_db_row(_CHUNK_2, citation="Case C v. D"),
    ]
    result = await verify(_make_db(db_rows), gen_out, retrieved)

    assert result.refused is False
    assert len(result.verified_citations) == 2
    assert result.dropped_citations == []
    assert result.verification_warnings == []

    # risk_factor survives with both chunk_ids
    assert len(result.risk_factors) == 1
    assert set(result.risk_factors[0].chunk_ids) == {_CHUNK_1, _CHUNK_2}

    # comparable_case survives
    assert len(result.comparable_cases) == 1
    assert result.comparable_cases[0].chunk_id == _CHUNK_1


# ── verify() — Check 1 failures ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_check1_chunk_not_in_retrieved_set() -> None:
    retrieved = [_make_chunk(_CHUNK_1)]  # CHUNK_2 not in retrieved set
    gen_out = _make_generator_output(
        risk_factors=[_make_risk_factor("Standing", [_CHUNK_1, _CHUNK_2])],
    )
    db_rows = [_make_db_row(_CHUNK_1)]  # DB only knows about CHUNK_1
    result = await verify(_make_db(db_rows), gen_out, retrieved)

    assert len(result.dropped_citations) == 1
    assert result.dropped_citations[0].chunk_id == _CHUNK_2
    assert result.dropped_citations[0].reason == "not_in_retrieved_set"


@pytest.mark.asyncio
async def test_verify_check1_does_not_query_db_for_missing_id() -> None:
    # CHUNK_2 is NOT in retrieved set — the DB query should only be called
    # for CHUNK_1 (the candidate). We verify the dropped id is "not_in_retrieved_set".
    retrieved = [_make_chunk(_CHUNK_1)]
    gen_out = _make_generator_output(
        comparable_cases=[_make_comparable_case(_CHUNK_2)],
    )
    db_rows = [_make_db_row(_CHUNK_1)]
    result = await verify(_make_db(db_rows), gen_out, retrieved)

    dropped_reasons = {d.chunk_id: d.reason for d in result.dropped_citations}
    assert dropped_reasons[_CHUNK_2] == "not_in_retrieved_set"


# ── verify() — Check 2 failures ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_check2_chunk_missing_from_db() -> None:
    retrieved = [_make_chunk(_CHUNK_1), _make_chunk(_CHUNK_2)]
    gen_out = _make_generator_output(
        risk_factors=[_make_risk_factor("A", [_CHUNK_1, _CHUNK_2])],
    )
    # DB only returns CHUNK_1 — CHUNK_2 is missing (or has null citation)
    db_rows = [_make_db_row(_CHUNK_1)]
    result = await verify(_make_db(db_rows), gen_out, retrieved)

    assert len(result.dropped_citations) == 1
    assert result.dropped_citations[0].chunk_id == _CHUNK_2
    assert result.dropped_citations[0].reason == "citation_not_in_db"

    # CHUNK_1 verified; CHUNK_2 pruned from risk_factor chunk_ids
    assert result.risk_factors[0].chunk_ids == [_CHUNK_1]


# ── verify() — mixed case ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_mixed_drops() -> None:
    # CHUNK_1: passes both checks
    # CHUNK_2: fails Check 1 (not in retrieved set)
    # CHUNK_3: in retrieved set but DB returns nothing → fails Check 2
    retrieved = [_make_chunk(_CHUNK_1), _make_chunk(_CHUNK_3)]
    gen_out = _make_generator_output(
        risk_factors=[
            _make_risk_factor("A", [_CHUNK_1, _CHUNK_2, _CHUNK_3]),
        ],
    )
    db_rows = [_make_db_row(_CHUNK_1)]
    result = await verify(_make_db(db_rows), gen_out, retrieved)

    assert len(result.verified_citations) == 1
    assert result.verified_citations[0].chunk_id == _CHUNK_1

    drop_map = {d.chunk_id: d.reason for d in result.dropped_citations}
    assert drop_map[_CHUNK_2] == "not_in_retrieved_set"
    assert drop_map[_CHUNK_3] == "citation_not_in_db"

    # Factor survives with only CHUNK_1
    assert result.risk_factors[0].chunk_ids == [_CHUNK_1]


# ── verify() — risk_factor pruning ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_factor_removed_when_all_chunks_dropped() -> None:
    retrieved = [_make_chunk(_CHUNK_1)]
    gen_out = _make_generator_output(
        risk_factors=[
            _make_risk_factor("Doomed Factor", [_CHUNK_1]),
        ],
    )
    # DB returns nothing — all chunks fail Check 2
    result = await verify(_make_db([]), gen_out, retrieved)

    assert result.risk_factors == []
    # Warning should mention the dropped factor
    assert any("Doomed Factor" in w for w in result.verification_warnings)


@pytest.mark.asyncio
async def test_verify_factor_kept_when_some_chunks_survive() -> None:
    retrieved = [_make_chunk(_CHUNK_1), _make_chunk(_CHUNK_2)]
    gen_out = _make_generator_output(
        risk_factors=[
            _make_risk_factor("Partial Factor", [_CHUNK_1, _CHUNK_2]),
        ],
    )
    # Only CHUNK_1 in DB
    db_rows = [_make_db_row(_CHUNK_1)]
    result = await verify(_make_db(db_rows), gen_out, retrieved)

    assert len(result.risk_factors) == 1
    assert result.risk_factors[0].label == "Partial Factor"
    assert result.risk_factors[0].chunk_ids == [_CHUNK_1]


@pytest.mark.asyncio
async def test_verify_multiple_factors_partially_dropped() -> None:
    retrieved = [_make_chunk(_CHUNK_1), _make_chunk(_CHUNK_2), _make_chunk(_CHUNK_3)]
    gen_out = _make_generator_output(
        risk_factors=[
            _make_risk_factor("Factor A", [_CHUNK_1]),         # survives
            _make_risk_factor("Factor B", [_CHUNK_2, _CHUNK_3]),  # partially survives
            _make_risk_factor("Factor C", [_CHUNK_4]),         # CHUNK_4 not in retrieved → dropped
        ],
    )
    db_rows = [_make_db_row(_CHUNK_1), _make_db_row(_CHUNK_2)]  # CHUNK_3 not in DB
    result = await verify(_make_db(db_rows), gen_out, retrieved)

    surviving_labels = [rf.label for rf in result.risk_factors]
    assert "Factor A" in surviving_labels
    assert "Factor B" in surviving_labels
    assert "Factor C" not in surviving_labels

    factor_b = next(rf for rf in result.risk_factors if rf.label == "Factor B")
    assert factor_b.chunk_ids == [_CHUNK_2]   # CHUNK_3 pruned


# ── verify() — comparable_case filtering ──────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_comparable_case_dropped_when_unverified() -> None:
    retrieved = [_make_chunk(_CHUNK_1)]
    gen_out = _make_generator_output(
        comparable_cases=[_make_comparable_case(_CHUNK_2)],  # CHUNK_2 not in retrieved
    )
    result = await verify(_make_db([]), gen_out, retrieved)

    assert result.comparable_cases == []
    assert any(d.chunk_id == _CHUNK_2 for d in result.dropped_citations)


@pytest.mark.asyncio
async def test_verify_comparable_case_kept_when_verified() -> None:
    retrieved = [_make_chunk(_CHUNK_1)]
    gen_out = _make_generator_output(
        comparable_cases=[_make_comparable_case(_CHUNK_1)],
    )
    db_rows = [_make_db_row(_CHUNK_1)]
    result = await verify(_make_db(db_rows), gen_out, retrieved)

    assert len(result.comparable_cases) == 1
    assert result.comparable_cases[0].chunk_id == _CHUNK_1


# ── verify() — empty references ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_empty_references() -> None:
    retrieved = [_make_chunk(_CHUNK_1)]
    gen_out = _make_generator_output()  # no risk_factors, no comparable_cases
    result = await verify(_make_db([]), gen_out, retrieved)

    assert result.refused is False
    assert result.verified_citations == []
    assert result.dropped_citations == []
    assert result.verification_warnings == []
    assert result.risk_factors == []
    assert result.comparable_cases == []


# ── verify() — pass-through fields ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_passthrough_strategic_considerations() -> None:
    gen_out = _make_generator_output(
        strategic_considerations=["Focus on venue.", "File early."],
    )
    result = await verify(_make_db([]), gen_out, [])
    assert result.strategic_considerations == ["Focus on venue.", "File early."]


@pytest.mark.asyncio
async def test_verify_passthrough_uncertainty_notes() -> None:
    gen_out = _make_generator_output(
        uncertainty_notes=["Thin corpus.", "Unsettled doctrine."],
    )
    result = await verify(_make_db([]), gen_out, [])
    assert result.uncertainty_notes == ["Thin corpus.", "Unsettled doctrine."]


@pytest.mark.asyncio
async def test_verify_passthrough_model_and_raw_output() -> None:
    retrieved = [_make_chunk(_CHUNK_1)]
    gen_out = _make_generator_output(model="claude-sonnet-4-6")
    gen_out.raw_model_output = "<tool_use>..."
    db_rows = [_make_db_row(_CHUNK_1)]
    result = await verify(_make_db(db_rows), gen_out, retrieved)
    assert result.model == "claude-sonnet-4-6"
    assert result.raw_model_output == "<tool_use>..."


@pytest.mark.asyncio
async def test_verify_passthrough_risk_summary() -> None:
    gen_out = _make_generator_output()
    gen_out.risk_summary = "High risk of dismissal on standing grounds."
    result = await verify(_make_db([]), gen_out, [])
    assert result.risk_summary == "High risk of dismissal on standing grounds."


# ── verify() — verified_citation content ─────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_verified_citation_has_correct_citation_string() -> None:
    retrieved = [_make_chunk(_CHUNK_1)]
    gen_out = _make_generator_output(
        comparable_cases=[_make_comparable_case(_CHUNK_1)],
    )
    db_rows = [_make_db_row(_CHUNK_1, citation="Animal Legal Defense Fund v. USDA, 632 F.3d 971")]
    result = await verify(_make_db(db_rows), gen_out, retrieved)

    assert len(result.verified_citations) == 1
    vc = result.verified_citations[0]
    assert vc.chunk_id == _CHUNK_1
    assert "Animal Legal Defense Fund" in vc.citation

"""
Unit tests for generator.py — pure logic only, no live Anthropic API calls.

Covers:
  - _count_above_threshold
  - _pre_call_refusal  (both branches: refuse / pass through)
  - _build_tools       (schema structure, chunk_id enum enforcement)
  - _build_prompt      (thin_corpus warning present/absent, chunk ids in prompt)
  - GeneratorOutput parsing helpers (dataclass defaults)
"""

import pytest

from app.services.generator import (
    MIN_SIMILARITY,
    REFUSE_THRESHOLD,
    UNCERTAIN_THRESHOLD,
    GeneratorOutput,
    RiskFactorOutput,
    ComparableCaseOutput,
    _build_prompt,
    _build_tools,
    _count_above_threshold,
    _pre_call_refusal,
)
from app.services.retriever import RetrievedChunk


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_chunk(chunk_id: str, similarity: float, citation: str = "Test v. Case, 1 F.3d 1") -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=chunk_id,
        document_id="doc-1",
        text=f"Sample legal text for chunk {chunk_id}.",
        section_type="analysis",
        jurisdiction="US-9th-Cir",
        citation=citation,
        source_url="https://example.com/case",
        similarity=similarity,
        start_char=0,
        end_char=100,
    )


def _chunks_above(n: int, sim: float = 0.80) -> list[RetrievedChunk]:
    """Return n chunks with similarity=sim and 2 below-threshold chunks."""
    above = [_make_chunk(f"chunk-{i}", sim) for i in range(n)]
    below = [_make_chunk(f"chunk-low-{i}", MIN_SIMILARITY - 0.01) for i in range(2)]
    return above + below


# ── _count_above_threshold ────────────────────────────────────────────────────

def test_count_above_threshold_all_above() -> None:
    chunks = [_make_chunk(f"c{i}", 0.9) for i in range(5)]
    assert _count_above_threshold(chunks) == 5


def test_count_above_threshold_none_above() -> None:
    chunks = [_make_chunk(f"c{i}", 0.50) for i in range(4)]
    assert _count_above_threshold(chunks) == 0


def test_count_above_threshold_mixed() -> None:
    chunks = [
        _make_chunk("a", 0.70),   # above (0.70 >= 0.65)
        _make_chunk("b", 0.65),   # exactly at threshold — counts
        _make_chunk("c", 0.64),   # below
        _make_chunk("d", 0.90),   # above
    ]
    assert _count_above_threshold(chunks) == 3


def test_count_above_threshold_empty() -> None:
    assert _count_above_threshold([]) == 0


# ── _pre_call_refusal ─────────────────────────────────────────────────────────

def test_pre_call_refusal_triggers_when_too_few() -> None:
    # REFUSE_THRESHOLD - 1 chunks above threshold → should refuse
    chunks = _chunks_above(REFUSE_THRESHOLD - 1)
    result = _pre_call_refusal(chunks)
    assert result is not None
    assert result.refused is True
    assert result.confidence_band == "refused"
    assert result.refusal_reason is not None
    assert result.refusal_suggestion is not None


def test_pre_call_refusal_passes_when_enough() -> None:
    # Exactly REFUSE_THRESHOLD chunks above threshold → should pass
    chunks = _chunks_above(REFUSE_THRESHOLD)
    result = _pre_call_refusal(chunks)
    assert result is None


def test_pre_call_refusal_passes_with_many_chunks() -> None:
    chunks = _chunks_above(10)
    assert _pre_call_refusal(chunks) is None


def test_pre_call_refusal_empty_list() -> None:
    result = _pre_call_refusal([])
    assert result is not None
    assert result.refused is True


# ── _build_tools ──────────────────────────────────────────────────────────────

def test_build_tools_returns_two_tools() -> None:
    tools = _build_tools(["chunk-1", "chunk-2"])
    assert len(tools) == 2
    # OpenAI format: tool["function"]["name"]
    names = {t["function"]["name"] for t in tools}
    assert names == {"submit_risk_assessment", "refuse_query"}


def test_build_tools_chunk_ids_in_enum() -> None:
    valid_ids = ["chunk-abc", "chunk-def"]
    tools = _build_tools(valid_ids)
    assessment_tool = next(t for t in tools if t["function"]["name"] == "submit_risk_assessment")
    # OpenAI format: tool["function"]["parameters"] (not "input_schema")
    schema = assessment_tool["function"]["parameters"]

    chunk_ids_schema = schema["properties"]["risk_factors"]["items"]["properties"]["chunk_ids"]["items"]
    assert chunk_ids_schema["enum"] == valid_ids


def test_build_tools_comparable_cases_chunk_id_enum() -> None:
    valid_ids = ["x1", "x2", "x3"]
    tools = _build_tools(valid_ids)
    assessment_tool = next(t for t in tools if t["function"]["name"] == "submit_risk_assessment")
    schema = assessment_tool["function"]["parameters"]
    cc_chunk_id = schema["properties"]["comparable_cases"]["items"]["properties"]["chunk_id"]
    assert cc_chunk_id["enum"] == valid_ids


def test_build_tools_refuse_has_reason_required() -> None:
    tools = _build_tools(["c1"])
    refuse_tool = next(t for t in tools if t["function"]["name"] == "refuse_query")
    assert "reason" in refuse_tool["function"]["parameters"]["required"]


def test_build_tools_assessment_required_fields() -> None:
    tools = _build_tools(["c1"])
    at = next(t for t in tools if t["function"]["name"] == "submit_risk_assessment")
    required = set(at["function"]["parameters"]["required"])
    assert required == {
        "risk_summary",
        "risk_factors",
        "comparable_cases",
        "strategic_considerations",
        "uncertainty_notes",
        "confidence_band",
    }


def test_build_tools_confidence_band_enum() -> None:
    tools = _build_tools(["c1"])
    at = next(t for t in tools if t["function"]["name"] == "submit_risk_assessment")
    cb = at["function"]["parameters"]["properties"]["confidence_band"]
    assert set(cb["enum"]) == {"high", "medium", "low"}


# ── _build_prompt ─────────────────────────────────────────────────────────────

def test_build_prompt_contains_jurisdiction() -> None:
    chunks = [_make_chunk("c1", 0.8)]
    prompt = _build_prompt("US-9th-Cir", "ag-gag challenge", "facts here", chunks, False)
    assert "US-9th-Cir" in prompt


def test_build_prompt_contains_claim() -> None:
    chunks = [_make_chunk("c1", 0.8)]
    prompt = _build_prompt("US", "First Amendment ag-gag", "facts here", chunks, False)
    assert "First Amendment ag-gag" in prompt


def test_build_prompt_contains_chunk_id() -> None:
    chunks = [_make_chunk("unique-chunk-id-42", 0.8)]
    prompt = _build_prompt("US", "claim", "facts", chunks, False)
    assert "unique-chunk-id-42" in prompt


def test_build_prompt_thin_warning_present_when_thin() -> None:
    chunks = [_make_chunk("c1", 0.8)]
    prompt = _build_prompt("US", "claim", "facts", chunks, thin_corpus=True)
    assert "THIN CORPUS" in prompt


def test_build_prompt_thin_warning_absent_when_not_thin() -> None:
    chunks = [_make_chunk("c1", 0.8)]
    prompt = _build_prompt("US", "claim", "facts", chunks, thin_corpus=False)
    assert "THIN CORPUS" not in prompt


def test_build_prompt_contains_citation() -> None:
    chunks = [_make_chunk("c1", 0.8, citation="Animal Legal Defense Fund v. USDA, 632 F.3d 971")]
    prompt = _build_prompt("US-9th-Cir", "claim", "facts", chunks, False)
    assert "Animal Legal Defense Fund v. USDA" in prompt


# ── GeneratorOutput defaults ──────────────────────────────────────────────────

def test_generator_output_defaults() -> None:
    out = GeneratorOutput()
    assert out.refused is False
    assert out.confidence_band == "low"
    assert out.risk_factors == []
    assert out.comparable_cases == []
    assert out.uncertainty_notes == []
    assert out.strategic_considerations == []
    assert out.model == ""   # model is set at call time, not in the dataclass default


def test_generator_output_refusal_fields() -> None:
    out = GeneratorOutput(
        refused=True,
        refusal_reason="Not enough cases.",
        refusal_suggestion="Try a broader jurisdiction.",
        confidence_band="refused",
    )
    assert out.refused is True
    assert "Not enough" in out.refusal_reason
    assert out.confidence_band == "refused"


# ── RiskFactorOutput / ComparableCaseOutput ───────────────────────────────────

def test_risk_factor_output_fields() -> None:
    rf = RiskFactorOutput(
        label="Standing",
        weight="high",
        discussion="Courts have held...",
        chunk_ids=["c1", "c2"],
    )
    assert rf.weight == "high"
    assert "c1" in rf.chunk_ids


def test_comparable_case_output_fields() -> None:
    cc = ComparableCaseOutput(
        chunk_id="c3",
        summary="Plaintiff lacked standing.",
        relevance="Same jurisdictional posture.",
    )
    assert cc.chunk_id == "c3"

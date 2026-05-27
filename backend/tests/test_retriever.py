"""Unit tests for retriever — pure logic only (no DB, no Voyage API)."""

from datetime import date

import pytest

from app.services.retriever import (
    RetrievedChunk,
    _jurisdiction_filter_list,
    _year_to_end_date,
    _year_to_start_date,
    jurisdiction_match_rate,
    validate_date_range,
)


# ── Jurisdiction filter tests ─────────────────────────────────────────────────

def test_jurisdiction_filter_federal_only() -> None:
    assert _jurisdiction_filter_list("US") == ["US"]


def test_jurisdiction_filter_circuit() -> None:
    result = _jurisdiction_filter_list("US-9th-Cir")
    assert result == ["US-9th-Cir", "US"]


def test_jurisdiction_filter_other_circuit() -> None:
    result = _jurisdiction_filter_list("US-1st-Cir")
    assert result == ["US-1st-Cir", "US"]


def test_jurisdiction_filter_always_includes_input() -> None:
    j = "US-10th-Cir"
    assert j in _jurisdiction_filter_list(j)


# ── Jurisdiction match rate tests ─────────────────────────────────────────────

def _make_chunk(jurisdiction: str) -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id="abc",
        document_id="def",
        text="test",
        section_type=None,
        jurisdiction=jurisdiction,
        citation=None,
        source_url=None,
        similarity=0.9,
        start_char=None,
        end_char=None,
    )


def test_jurisdiction_match_rate_all_match() -> None:
    chunks = [_make_chunk("US-9th-Cir")] * 5
    assert jurisdiction_match_rate(chunks, "US-9th-Cir") == 1.0


def test_jurisdiction_match_rate_none_match() -> None:
    chunks = [_make_chunk("US")] * 4
    assert jurisdiction_match_rate(chunks, "US-9th-Cir") == 0.0


def test_jurisdiction_match_rate_partial() -> None:
    chunks = [_make_chunk("US-9th-Cir")] * 3 + [_make_chunk("US")] * 1
    assert jurisdiction_match_rate(chunks, "US-9th-Cir") == pytest.approx(0.75)


def test_jurisdiction_match_rate_empty() -> None:
    assert jurisdiction_match_rate([], "US-9th-Cir") == 0.0


# ── Date helper tests ─────────────────────────────────────────────────────────

def test_year_to_start_date() -> None:
    assert _year_to_start_date(2010) == date(2010, 1, 1)


def test_year_to_end_date() -> None:
    assert _year_to_end_date(2020) == date(2020, 12, 31)


def test_year_to_start_date_boundary() -> None:
    """Earliest plausible legal corpus year."""
    assert _year_to_start_date(1900) == date(1900, 1, 1)


def test_year_to_end_date_future() -> None:
    """Should handle future years without error."""
    assert _year_to_end_date(2099) == date(2099, 12, 31)


# ── validate_date_range tests ─────────────────────────────────────────────────

def test_validate_date_range_both_none() -> None:
    """No filter — always valid."""
    validate_date_range(None, None)  # should not raise


def test_validate_date_range_only_from() -> None:
    validate_date_range(2010, None)  # should not raise


def test_validate_date_range_only_to() -> None:
    validate_date_range(None, 2020)  # should not raise


def test_validate_date_range_valid() -> None:
    validate_date_range(2010, 2020)  # should not raise


def test_validate_date_range_same_year() -> None:
    """date_from == date_to is valid (single-year filter)."""
    validate_date_range(2015, 2015)  # should not raise


def test_validate_date_range_invalid() -> None:
    """date_from > date_to must raise ValueError."""
    with pytest.raises(ValueError, match="date_from"):
        validate_date_range(2020, 2010)

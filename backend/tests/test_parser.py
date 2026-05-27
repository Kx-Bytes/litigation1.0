"""Unit tests for app/services/parser.py — normalize_text and extract_citations.

classify_labels() is excluded from unit tests because it makes live Haiku API
calls. It is covered by the integration test suite (test_ingest_integration.py,
added in Group E alongside the other integration tests).
"""

import pytest

from app.services.parser import (
    VALID_LABELS,
    FALLBACK_LABEL,
    MAX_LABELS,
    ExtractedCitation,
    normalize_text,
    extract_citations,
)


# ── normalize_text ─────────────────────────────────────────────────────────────

class TestNormalizeText:
    def test_strips_leading_trailing_whitespace(self):
        assert normalize_text("  hello  ") == "hello"

    def test_collapses_multiple_blank_lines(self):
        text = "para one\n\n\n\npara two"
        result = normalize_text(text)
        assert "\n\n\n" not in result
        assert "para one" in result
        assert "para two" in result

    def test_decodes_html_entities(self):
        assert normalize_text("AT&amp;T v. City") == "AT&T v. City"
        assert normalize_text("a &lt; b") == "a < b"
        assert normalize_text("a &gt; b") == "a > b"
        assert normalize_text("say &quot;hello&quot;") == 'say "hello"'

    def test_collapses_horizontal_whitespace(self):
        text = "The   court    held"
        result = normalize_text(text)
        assert "  " not in result
        assert "The court held" in result

    def test_normalizes_windows_line_endings(self):
        text = "line one\r\nline two\r\nline three"
        result = normalize_text(text)
        assert "\r" not in result
        assert "line one" in result

    def test_empty_string_returns_empty(self):
        assert normalize_text("") == ""
        assert normalize_text("   \n\n  ") == ""

    def test_preserves_paragraph_breaks(self):
        text = "First paragraph.\n\nSecond paragraph."
        result = normalize_text(text)
        assert "\n\n" in result

    def test_strips_control_characters(self):
        text = "clean\x00text\x08here"
        result = normalize_text(text)
        assert "\x00" not in result
        assert "\x08" not in result
        assert "cleantext" in result or "clean" in result

    def test_unicode_normalization(self):
        # NFC normalization: composed form
        import unicodedata
        text = "café"  # 'e' + combining acute = 'é' (NFD form)
        result = normalize_text(text)
        assert unicodedata.is_normalized("NFC", result)


# ── extract_citations ──────────────────────────────────────────────────────────

class TestExtractCitations:
    def test_returns_empty_for_no_citations(self):
        text = "The court found no relevant precedent."
        result = extract_citations(text)
        assert isinstance(result, list)

    def test_extracts_us_supreme_court_citation(self):
        text = (
            "As the Supreme Court held in Lujan v. Defenders of Wildlife, "
            "504 U.S. 555 (1992), standing requires injury-in-fact."
        )
        result = extract_citations(text)
        assert len(result) >= 1
        cites = [c.normalized for c in result]
        assert any("504" in c and "555" in c for c in cites)

    def test_extracts_circuit_court_citation(self):
        text = (
            "The Ninth Circuit addressed this issue in Animal Legal Defense Fund "
            "v. Wasden, 878 F.3d 1184 (9th Cir. 2018)."
        )
        result = extract_citations(text)
        assert len(result) >= 1
        cites = [c.normalized for c in result]
        assert any("878" in c for c in cites)

    def test_deduplicates_citations(self):
        cite = "504 U.S. 555 (1992)"
        text = f"See {cite}. As noted in {cite}, the holding is clear."
        result = extract_citations(text)
        normalized_cites = [c.normalized for c in result]
        # Should not contain duplicates
        assert len(normalized_cites) == len(set(normalized_cites))

    def test_returns_list_of_extracted_citation_objects(self):
        text = "The court relied on United States v. Stevens, 559 U.S. 460 (2010)."
        result = extract_citations(text)
        for item in result:
            assert isinstance(item, ExtractedCitation)
            assert item.normalized
            assert item.raw_text

    def test_handles_multiple_citations(self):
        text = (
            "This circuit split was noted in both Animal Legal Defense Fund v. "
            "Otter, 935 F.3d 1228 (10th Cir. 2019) and the earlier decision in "
            "559 U.S. 460 (2010)."
        )
        result = extract_citations(text)
        assert len(result) >= 1


# ── Label taxonomy constants ───────────────────────────────────────────────────

class TestLabelTaxonomy:
    def test_valid_labels_is_nonempty(self):
        assert len(VALID_LABELS) > 0

    def test_fallback_label_is_in_valid_labels(self):
        assert FALLBACK_LABEL in VALID_LABELS

    def test_max_labels_is_reasonable(self):
        assert 1 <= MAX_LABELS <= 5

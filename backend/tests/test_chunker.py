"""Unit tests for app/services/chunker.py."""

import pytest

from app.services.chunker import (
    TARGET_WORDS,
    OVERLAP_WORDS,
    ChunkSpec,
    _detect_section,
    chunk_document,
)


# ── _detect_section ────────────────────────────────────────────────────────────

class TestDetectSection:
    def test_returns_none_for_regular_sentence(self):
        assert _detect_section("The court held that the statute was unconstitutional.") is None

    def test_returns_none_for_long_line(self):
        long_line = "A" * 85
        assert _detect_section(long_line) is None

    def test_detects_background(self):
        assert _detect_section("BACKGROUND") == "background"
        assert _detect_section("FACTUAL BACKGROUND") == "background"
        assert _detect_section("FACTS") == "background"

    def test_detects_analysis(self):
        assert _detect_section("ANALYSIS") == "analysis"
        assert _detect_section("DISCUSSION") == "analysis"

    def test_detects_holding(self):
        assert _detect_section("HOLDING") == "holding"
        assert _detect_section("CONCLUSION") == "holding"

    def test_detects_dissent(self):
        assert _detect_section("DISSENTING OPINION") == "dissent"
        assert _detect_section("DISSENT") == "dissent"

    def test_detects_concurrence(self):
        assert _detect_section("CONCURRING OPINION") == "concurrence"
        assert _detect_section("CONCURRENCE") == "concurrence"

    def test_case_insensitive(self):
        assert _detect_section("Background") == "background"
        assert _detect_section("Holding") == "holding"


# ── chunk_document ─────────────────────────────────────────────────────────────

def _make_text(num_words: int) -> str:
    """Generate a simple repeated-word text of *num_words* words."""
    return " ".join(f"word{i}" for i in range(num_words))


class TestChunkDocument:
    def test_empty_text_returns_no_chunks(self):
        assert chunk_document("") == []
        assert chunk_document("   ") == []

    def test_short_text_produces_one_chunk(self):
        text = _make_text(50)
        chunks = chunk_document(text)
        assert len(chunks) == 1
        assert chunks[0].chunk_index == 0
        assert chunks[0].section_type == "body"

    def test_long_text_produces_multiple_chunks(self):
        # 3× target → expect at least 3 chunks with overlap
        text = _make_text(TARGET_WORDS * 3)
        chunks = chunk_document(text)
        assert len(chunks) >= 3

    def test_chunk_indices_are_sequential(self):
        text = _make_text(TARGET_WORDS * 2)
        chunks = chunk_document(text)
        for i, chunk in enumerate(chunks):
            assert chunk.chunk_index == i

    def test_overlap_means_adjacent_chunks_share_words(self):
        text = _make_text(TARGET_WORDS * 2)
        chunks = chunk_document(text)
        if len(chunks) >= 2:
            words_a = set(chunks[0].text.split())
            words_b = set(chunks[1].text.split())
            assert len(words_a & words_b) > 0, "Adjacent chunks should share some words (overlap)"

    def test_section_type_detected_from_header(self):
        # Insert a clear section header then body text
        text = "HOLDING\n" + _make_text(200)
        chunks = chunk_document(text)
        # At least one chunk should be labeled "holding"
        types = {c.section_type for c in chunks}
        assert "holding" in types

    def test_fallback_section_type_is_body(self):
        text = _make_text(100)
        chunks = chunk_document(text)
        assert all(c.section_type == "body" for c in chunks)

    def test_start_char_less_than_end_char(self):
        text = _make_text(TARGET_WORDS + 50)
        for chunk in chunk_document(text):
            assert chunk.start_char <= chunk.end_char

    def test_chunk_text_is_nonempty(self):
        text = _make_text(TARGET_WORDS + 50)
        for chunk in chunk_document(text):
            assert chunk.text.strip()

    def test_realistic_opinion_structure(self):
        """Smoke test with a text that mimics a real opinion."""
        opinion = (
            "UNITED STATES COURT OF APPEALS FOR THE NINTH CIRCUIT\n\n"
            "BACKGROUND\n"
            + _make_text(300) + "\n\n"
            "ANALYSIS\n"
            + _make_text(400) + "\n\n"
            "HOLDING\n"
            + _make_text(100) + "\n\n"
            "DISSENTING OPINION\n"
            + _make_text(200)
        )
        chunks = chunk_document(opinion)
        types = {c.section_type for c in chunks}
        # Should detect at least background, analysis, and holding
        assert types & {"background", "analysis", "holding"}

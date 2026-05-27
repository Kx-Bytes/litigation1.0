"""
C3 — Legal-aware chunker.

Strategy: sliding window (800 tokens, 100-token overlap) over the full
opinion text, with best-effort legal section detection.

Each chunk is tagged with the section_type it falls inside:
  background | facts | analysis | holding | dissent | concurrence | body

"body" is the fallback when no section header is detected — it is always
safe to fall back to, and is the most common outcome for opinions that do
not use explicit section headers.

Token counting
--------------
We use a word-proxy (1 token ≈ 0.75 words → 800 tokens ≈ ~600 words).
This avoids a tiktoken/sentencepiece dependency and is accurate enough for
chunk-size estimation. Voyage-3-large supports up to 32k tokens per input;
our 800-token target chunks are well within that.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import structlog

log = structlog.get_logger()

# ── Tuning constants ──────────────────────────────────────────────────────────

TARGET_TOKENS = 800     # target chunk size in approximate tokens
OVERLAP_TOKENS = 100    # overlap between consecutive chunks
WORDS_PER_TOKEN = 0.75  # proxy: 1 token ≈ 0.75 words  →  words = tokens * 0.75

TARGET_WORDS  = int(TARGET_TOKENS * WORDS_PER_TOKEN)   # ≈ 600
OVERLAP_WORDS = int(OVERLAP_TOKENS * WORDS_PER_TOKEN)  # ≈ 75


# ── Section detection ─────────────────────────────────────────────────────────

# Ordered from most-specific to least-specific.
# Each tuple: (regex pattern, section_type label)
# Matched case-insensitively against lines that look like headings
# (short lines, often ALL-CAPS or Title-Case, possibly roman-numeral prefixed).
_SECTION_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # Dissent / concurrence — check before "opinion" to avoid wrong match
    (re.compile(r"\b(dissent(?:ing)?(?:\s+opinion)?)\b", re.I),         "dissent"),
    (re.compile(r"\b(concurr(?:ing|ence)(?:\s+opinion)?)\b", re.I),     "concurrence"),

    # Holding / conclusion
    (re.compile(r"\b(holding|conclusion|order|judgment|decree)\b", re.I), "holding"),

    # Analysis / discussion / reasoning
    (re.compile(
        r"\b(analysis|discussion|legal\s+standard|standard\s+of\s+review"
        r"|reasoning|argument|merits)\b", re.I
    ), "analysis"),

    # Background / facts
    (re.compile(
        r"\b(background|factual\s+background|facts?|procedural\s+(?:background|history)"
        r"|statement\s+of\s+(?:facts?|the\s+case)|history)\b", re.I
    ), "background"),
]

# Lines that are likely section headers: short (< 80 chars), not mid-sentence
_HEADING_LINE_RE = re.compile(r"^[A-Z\s\.\-–—:,;I|V|X|L|C|\d]{3,79}$")


def _is_heading_line(line: str) -> bool:
    """Heuristic: is this line likely a section heading?"""
    stripped = line.strip()
    if not stripped or len(stripped) > 80:
        return False
    # Must be mostly uppercase or match a known pattern
    upper_ratio = sum(1 for c in stripped if c.isupper()) / max(len(stripped), 1)
    return upper_ratio > 0.6 or _HEADING_LINE_RE.match(stripped) is not None


def _detect_section(line: str) -> str | None:
    """Return a section_type if *line* is a recognized section header, else None."""
    stripped = line.strip()
    if not stripped or len(stripped) > 80:
        return None
    # Short lines (≤ 40 chars) that match a known pattern are accepted regardless
    # of case — real opinions use both ALL CAPS ("BACKGROUND") and Title Case ("Background").
    # Longer lines still require the uppercase-ratio heuristic to avoid false positives
    # from mid-sentence uses of these words.
    if len(stripped) <= 40:
        for pattern, section_type in _SECTION_PATTERNS:
            if pattern.search(stripped):
                return section_type
        return None
    # Longer lines: require heading-like appearance first
    if not _is_heading_line(stripped):
        return None
    for pattern, section_type in _SECTION_PATTERNS:
        if pattern.search(stripped):
            return section_type
    return None


# ── Chunk spec ────────────────────────────────────────────────────────────────

@dataclass
class ChunkSpec:
    """One chunk ready to be written to the DB."""
    chunk_index: int
    text: str
    section_type: str          # e.g. "analysis", "holding", "body"
    start_char: int
    end_char: int


# ── Core chunker ──────────────────────────────────────────────────────────────

def _words_to_char_offset(words: list[str], word_index: int, text: str, start: int = 0) -> int:
    """
    Given the list of whitespace-split words and a word index, return the
    approximate character offset into *text* (starting from *start*).
    This is used to map word-window boundaries back to char offsets for
    start_char / end_char on ChunkSpec.
    """
    pos = start
    for i, word in enumerate(words):
        idx = text.find(word, pos)
        if idx == -1:
            continue
        if i == word_index:
            return idx
        pos = idx + len(word)
    return len(text)


def chunk_document(text: str) -> list[ChunkSpec]:
    """
    Split *text* into overlapping word-window chunks, each tagged with a
    best-effort section_type.

    Algorithm:
      1. Walk lines to build a section boundary map: char_offset → section_type.
      2. Split text into words.
      3. Slide a window of TARGET_WORDS words, stepping by (TARGET_WORDS - OVERLAP_WORDS).
      4. For each chunk, look up which section its midpoint char falls in.
    """
    if not text.strip():
        return []

    # ── Step 1: build section boundary map ───────────────────────────────────
    # Maps character offset of section-header line start → section_type label.
    # We'll use this to annotate chunks by their midpoint char offset.
    section_boundaries: list[tuple[int, str]] = []   # [(char_offset, section_type)]
    current_offset = 0
    for line in text.split("\n"):
        section = _detect_section(line)
        if section:
            section_boundaries.append((current_offset, section))
        current_offset += len(line) + 1  # +1 for the \n

    def section_at(char_pos: int) -> str:
        """Return the section_type active at *char_pos*."""
        current = "body"
        for offset, stype in section_boundaries:
            if offset <= char_pos:
                current = stype
            else:
                break
        return current

    # ── Step 2: split into words ──────────────────────────────────────────────
    words = text.split()
    if not words:
        return []

    # ── Step 3: sliding window ────────────────────────────────────────────────
    step = max(1, TARGET_WORDS - OVERLAP_WORDS)
    chunks: list[ChunkSpec] = []
    chunk_index = 0
    word_pos = 0

    while word_pos < len(words):
        window = words[word_pos : word_pos + TARGET_WORDS]
        chunk_text = " ".join(window)

        # Find char offsets for this chunk in the original text
        # (approximate — good enough for retrieval purposes)
        start_char = text.find(window[0]) if window else 0
        # Re-find from approximate position to avoid false matches
        search_start = max(0, start_char - 20)
        start_char = text.find(window[0], search_start)
        if start_char == -1:
            start_char = 0
        end_char = start_char + len(chunk_text)

        # Section type at midpoint of chunk
        mid_char = (start_char + end_char) // 2
        stype = section_at(mid_char)

        chunks.append(ChunkSpec(
            chunk_index=chunk_index,
            text=chunk_text,
            section_type=stype,
            start_char=start_char,
            end_char=min(end_char, len(text)),
        ))
        chunk_index += 1
        word_pos += step

    log.debug(
        "chunker_complete",
        total_chunks=len(chunks),
        total_chars=len(text),
        sections_detected=len(section_boundaries),
    )
    return chunks

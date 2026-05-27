"""
C2 — Document parser.

Three responsibilities:
  1. Text normalization — strip HTML artifacts, fix encoding, collapse whitespace.
  2. Citation extraction — eyecite pulls all FullCaseCitations from the opinion.
  3. Label classification — one Claude Haiku call assigns 1–3 topic labels from
     the fixed 13-label taxonomy (see docs/stage3-development/category-label-design.md).

All three run in sequence inside parse_document(). The result is a ParsedDoc
dataclass ready to be handed to the chunker.
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field

import structlog
from anthropic import AsyncAnthropic
from eyecite import get_citations
from eyecite.models import FullCaseCitation

from app.core.config import settings
from app.services.scraper import ScrapedDoc

log = structlog.get_logger()

# ── Label taxonomy (must match category-label-design.md exactly) ──────────────

VALID_LABELS: frozenset[str] = frozenset([
    "ag-gag",
    "standing",
    "animal-cruelty",
    "wildlife",
    "factory-farming",
    "personhood",
    "first-amendment",
    "commerce-clause",
    "preemption",
    "research-animals",
    "entertainment",
    "transport",
    "marine-mammals",
])
FALLBACK_LABEL = "animal-cruelty"
MAX_LABELS = 3

_LABEL_LIST_STR = ", ".join(sorted(VALID_LABELS))

_CLASSIFY_PROMPT = """\
You are classifying a federal animal law case for a retrieval system.

Given the case title, citation, and the excerpt below, assign 1–{max} labels \
from this fixed list ONLY:
{labels}

Rules:
- Return a JSON array of strings. Example: ["ag-gag", "first-amendment"]
- Maximum {max} labels. Minimum 1.
- Use ONLY labels from the list above — no other values.
- If genuinely unclear, return ["{fallback}"] as the safest default.

Case title: {title}
Citation: {citation}
Excerpt (first 1500 chars of opinion):
{excerpt}
"""

# ── Data model ────────────────────────────────────────────────────────────────

@dataclass
class ExtractedCitation:
    """A citation pulled out of the opinion by eyecite."""
    normalized: str
    raw_text: str


@dataclass
class ParsedDoc:
    """Normalized, citation-extracted, label-classified document."""

    # From ScrapedDoc (passed through)
    source: str
    source_id: str
    doc_type: str
    jurisdiction: str
    court: str
    decision_date: object        # date | None
    title: str
    citation: str | None
    source_url: str

    # Produced by parser
    clean_text: str              # normalized full text
    citations: list[ExtractedCitation] = field(default_factory=list)
    categories: list[str] = field(default_factory=list)


# ── Text normalization ────────────────────────────────────────────────────────

# Common HTML entities that selectolax may leave behind
_HTML_ENTITY_RE = re.compile(r"&(?:amp|lt|gt|nbsp|quot|apos|#\d+|#x[0-9a-fA-F]+);")
_ENTITY_MAP = {"&amp;": "&", "&lt;": "<", "&gt;": ">", "&nbsp;": " ", "&quot;": '"', "&apos;": "'"}

def _decode_entities(text: str) -> str:
    def replace(m: re.Match[str]) -> str:
        raw = m.group(0)
        if raw in _ENTITY_MAP:
            return _ENTITY_MAP[raw]
        # Numeric entity
        if raw.startswith("&#x"):
            return chr(int(raw[3:-1], 16))
        if raw.startswith("&#"):
            return chr(int(raw[2:-1]))
        return raw
    return _HTML_ENTITY_RE.sub(replace, text)


def normalize_text(raw: str) -> str:
    """
    Clean raw scraped text:
      - Unicode normalize (NFC)
      - Decode residual HTML entities
      - Strip zero-width / control characters
      - Collapse runs of whitespace (keep single newlines as paragraph breaks)
      - Strip leading/trailing whitespace
    """
    # Unicode normalize
    text = unicodedata.normalize("NFC", raw)

    # Decode HTML entities
    text = _decode_entities(text)

    # Remove zero-width and control chars (keep \n and \t)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f​-‏﻿]", "", text)

    # Normalize Windows line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Collapse 3+ consecutive blank lines to 2 (paragraph break)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Collapse horizontal whitespace (spaces/tabs) to a single space per line
    text = "\n".join(
        re.sub(r"[ \t]+", " ", line).strip()
        for line in text.split("\n")
    )

    return text.strip()


# ── Citation extraction ───────────────────────────────────────────────────────

def extract_citations(clean_text: str) -> list[ExtractedCitation]:
    """
    Use eyecite to extract all FullCaseCitations from the opinion text.
    Returns deduplicated ExtractedCitation objects sorted by first appearance.
    """
    try:
        raw_citations = get_citations(clean_text)
    except Exception as exc:
        log.warning("eyecite_error", error=str(exc))
        return []

    seen: set[str] = set()
    result: list[ExtractedCitation] = []

    for c in raw_citations:
        if not isinstance(c, FullCaseCitation):
            continue
        try:
            normalized = c.corrected_citation()
        except Exception:
            normalized = str(c)

        if normalized in seen:
            continue
        seen.add(normalized)

        result.append(ExtractedCitation(
            normalized=normalized,
            raw_text=c.matched_text() if hasattr(c, "matched_text") else str(c),
        ))

    log.debug("citations_extracted", count=len(result))
    return result


# ── Label classification ──────────────────────────────────────────────────────

_haiku_client: AsyncAnthropic | None = None


def _get_haiku_client() -> AsyncAnthropic:
    global _haiku_client
    if _haiku_client is None:
        _haiku_client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _haiku_client


async def classify_labels(title: str, citation: str | None, clean_text: str) -> list[str]:
    """
    Call Claude Haiku once to assign 1–3 topic labels from the fixed taxonomy.
    Returns a validated list of label strings.
    Falls back to [FALLBACK_LABEL] on any error or out-of-taxonomy response.
    """
    excerpt = clean_text[:1500]
    prompt = _CLASSIFY_PROMPT.format(
        max=MAX_LABELS,
        labels=_LABEL_LIST_STR,
        fallback=FALLBACK_LABEL,
        title=title,
        citation=citation or "unknown",
        excerpt=excerpt,
    )

    try:
        client = _get_haiku_client()
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=64,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()

        # Parse JSON array
        labels: list[str] = json.loads(raw)

        # Validate — keep only known labels, cap at MAX_LABELS
        valid = [l for l in labels if l in VALID_LABELS][:MAX_LABELS]
        if not valid:
            log.warning("classify_labels_no_valid", raw=raw, title=title)
            return [FALLBACK_LABEL]

        log.debug("classify_labels_ok", labels=valid, title=title[:60])
        return valid

    except json.JSONDecodeError:
        log.warning("classify_labels_json_error", title=title)
        return [FALLBACK_LABEL]
    except Exception as exc:
        log.warning("classify_labels_error", error=str(exc), title=title)
        return [FALLBACK_LABEL]


# ── Orchestrator ──────────────────────────────────────────────────────────────

async def parse_document(doc: ScrapedDoc) -> ParsedDoc:
    """
    Full parse pipeline for one ScrapedDoc:
      normalize → extract citations → classify labels

    Returns a ParsedDoc ready for the chunker.
    """
    log.debug("parse_start", source_id=doc.source_id)

    clean_text = normalize_text(doc.full_text)
    citations = extract_citations(clean_text)
    categories = await classify_labels(doc.title, doc.citation, clean_text)

    log.debug(
        "parse_complete",
        source_id=doc.source_id,
        chars=len(clean_text),
        citations=len(citations),
        categories=categories,
    )

    return ParsedDoc(
        source=doc.source,
        source_id=doc.source_id,
        doc_type=doc.doc_type,
        jurisdiction=doc.jurisdiction,
        court=doc.court,
        decision_date=doc.decision_date,
        title=doc.title,
        citation=doc.citation,
        source_url=doc.source_url,
        clean_text=clean_text,
        citations=citations,
        categories=categories,
    )

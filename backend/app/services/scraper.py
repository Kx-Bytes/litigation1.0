"""
C1 — animallaw.info scraper.

Scrapes federal animal-law case opinions from animallaw.info using httpx
(async HTTP) and selectolax (fast HTML parsing).

Selectors verified against live page HTML (2026-05-26).

Federal-only strategy
---------------------
The listing URL uses the site's own jurisdiction filter:
  /filters?type=case&jurisdiction=18250
where 18250 is the Drupal taxonomy term ID for "Federal". This means only
federal cases ever appear in the listing — no post-hoc court-name filtering
needed. The court name is still parsed and mapped to a jurisdiction code
(e.g. "US-9th-Cir") for retrieval purposes.

Idempotent
----------
The scraper does not touch the DB. It returns ScrapedDoc dataclasses.
Callers should check (source="animallaw", source_id=<slug>) before 
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from urllib.parse import urljoin, urlparse

import httpx
import structlog
from selectolax.parser import HTMLParser

log = structlog.get_logger()

# ── Constants ─────────────────────────────────────────────────────────────────

BASE_URL = "https://www.animallaw.info"

# Federal cases only — jurisdiction=18250 is the Drupal term ID for "Federal"
FEDERAL_LISTING_URL = f"{BASE_URL}/filters?type=case&jurisdiction=18250"

REQUEST_DELAY   = 1.0    # seconds between requests — be polite
REQUEST_TIMEOUT = 30.0   # seconds per request
MAX_PAGES       = 100    # safety cap on pagination

# ── CSS selectors (verified against live HTML 2026-05-26) ─────────────────────

# Listing page — each row in the Drupal views result
LISTING_ROW_SEL  = "div.view-content .views-row"
# Link to individual case page within a listing row
CASE_LINK_SEL    = "a[href*='/case/']"
# Pager — next page link (Drupal 7 standard)
PAGER_NEXT_SEL   = "li.pager-next a"

# Case detail page — metadata fields
TITLE_SEL        = ".field-name-field-full-case-name .field-item"
COURT_SEL        = ".field-name-field-court-name .field-item"
CITATION_SEL     = ".field-name-field-primary-citation .field-item"
DATE_SEL         = ".field-name-field-date-of-decision .date-display-single"
JURIS_LEVEL_SEL  = ".field-name-field-jurisdiction-level .field-item"
BODY_SEL         = ".field-name-body .field-item"

# ── Court → jurisdiction code mapping ────────────────────────────────────────
#
# The listing URL already filters to federal cases, so this mapping is used
# only to produce granular jurisdiction codes for retrieval (e.g. "US-9th-Cir").
# All patterns are tried case-insensitively in order.

_COURT_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # Supreme Court
    (re.compile(r"supreme court of the united states|u\.s\. supreme|scotus", re.I), "US"),
    # Circuits — named
    (re.compile(r"\bfirst circuit\b|1st cir",    re.I), "US-1st-Cir"),
    (re.compile(r"\bsecond circuit\b|2nd cir",   re.I), "US-2nd-Cir"),
    (re.compile(r"\bthird circuit\b|3rd cir",    re.I), "US-3rd-Cir"),
    (re.compile(r"\bfourth circuit\b|4th cir",   re.I), "US-4th-Cir"),
    (re.compile(r"\bfifth circuit\b|5th cir",    re.I), "US-5th-Cir"),
    (re.compile(r"\bsixth circuit\b|6th cir",    re.I), "US-6th-Cir"),
    (re.compile(r"\bseventh circuit\b|7th cir",  re.I), "US-7th-Cir"),
    (re.compile(r"\beighth circuit\b|8th cir",   re.I), "US-8th-Cir"),
    (re.compile(r"\bninth circuit\b|9th cir",    re.I), "US-9th-Cir"),
    (re.compile(r"\btenth circuit\b|10th cir",   re.I), "US-10th-Cir"),
    (re.compile(r"\beleventh circuit\b|11th cir",re.I), "US-11th-Cir"),
    (re.compile(r"d\.c\. circuit|district of columbia circuit", re.I), "US-DC-Cir"),
    (re.compile(r"\bfederal circuit\b",          re.I), "US-Fed-Cir"),
    # District courts — generic federal fallback
    (re.compile(r"united states district court|u\.s\. district", re.I), "US-District"),
    # Any remaining federal court of appeals
    (re.compile(r"court of appeals",             re.I), "US-Unknown-Cir"),
]

_DEFAULT_JURISDICTION = "US-District"   # fallback if court text doesn't match anything


def _map_court_to_jurisdiction(court_text: str) -> str:
    """Map a raw court name string to a jurisdiction code."""
    for pattern, code in _COURT_PATTERNS:
        if pattern.search(court_text):
            return code
    # The listing URL already guarantees this is a federal case; use fallback.
    log.debug("scraper_unknown_court", court=court_text)
    return _DEFAULT_JURISDICTION


# ── Data model ────────────────────────────────────────────────────────────────

@dataclass
class ScrapedDoc:
    """Raw case data scraped from one animallaw.info case page."""

    source: str         = "animallaw"
    source_id: str      = ""     # URL slug — idempotency key
    doc_type: str       = "case"
    jurisdiction: str   = ""     # e.g. "US-9th-Cir"
    court: str          = ""     # raw court name from page
    decision_date: date | None = None
    title: str          = ""
    citation: str | None = None
    full_text: str      = ""
    source_url: str     = ""


# ── Scraper ───────────────────────────────────────────────────────────────────

class AnimalLawScraper:
    """
    Async scraper for animallaw.info federal case opinions.

    Usage:
        async with AnimalLawScraper() as scraper:
            docs = await scraper.scrape_all(max_pages=10)
    """

    def __init__(
        self,
        delay: float = REQUEST_DELAY,
        timeout: float = REQUEST_TIMEOUT,
    ) -> None:
        self._delay = delay
        self._timeout = timeout
        self._headers = {
            "User-Agent": (
                "OpenPaws-LitigationBot/1.0 "
                "(open-source animal-law research; contact: support@nokasa.co)"
            ),
            "Accept": "text/html,application/xhtml+xml",
        }
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "AnimalLawScraper":
        self._client = httpx.AsyncClient(
            headers=self._headers,
            timeout=self._timeout,
            follow_redirects=True,
        )
        return self

    async def __aexit__(self, *_: object) -> None:
        if self._client:
            await self._client.aclose()

    # ── Internal helpers ──────────────────────────────────────────────────────

    async def _get(self, url: str) -> str | None:
        """Fetch *url*, return raw HTML, or None on error."""
        assert self._client is not None, "Use as async context manager"
        try:
            resp = await self._client.get(url)
            resp.raise_for_status()
            await asyncio.sleep(self._delay)
            return resp.text
        except httpx.HTTPStatusError as exc:
            log.warning("scraper_http_error", url=url, status=exc.response.status_code)
            return None
        except httpx.RequestError as exc:
            log.warning("scraper_request_error", url=url, error=str(exc))
            return None

    def _extract_case_links(self, html: str, base_url: str) -> list[str]:
        """Return deduplicated absolute case-page URLs from a listing page."""
        tree = HTMLParser(html)
        seen: set[str] = set()
        links: list[str] = []
        for row in tree.css(LISTING_ROW_SEL):
            anchor = row.css_first(CASE_LINK_SEL)
            if not anchor:
                continue
            href = anchor.attributes.get("href", "")
            if not href:
                continue
            if not href.startswith("http"):
                href = urljoin(base_url, href)
            if href not in seen:
                seen.add(href)
                links.append(href)
        return links

    def _next_page_url(self, html: str, current_url: str) -> str | None:
        """Return the next listing-page URL, or None on last page."""
        tree = HTMLParser(html)
        anchor = tree.css_first(PAGER_NEXT_SEL)
        if not anchor:
            return None
        href = anchor.attributes.get("href", "")
        if not href:
            return None
        if not href.startswith("http"):
            href = urljoin(current_url, href)
        return href

    def _parse_iso_date(self, content_attr: str) -> date | None:
        """
        Parse the ISO 8601 datetime from the `content` attribute on
        .date-display-single elements, e.g. "2017-05-31T00:00:00-04:00".
        """
        try:
            return datetime.fromisoformat(content_attr).date()
        except (ValueError, TypeError):
            return None

    def _parse_case_page(self, html: str, url: str) -> ScrapedDoc | None:
        """
        Parse a single case detail page. Returns a ScrapedDoc or None if
        the page is missing the body text (summary pages, stubs, etc.).
        """
        tree = HTMLParser(html)
        slug = urlparse(url).path.rstrip("/").split("/")[-1]

        # ── Title ─────────────────────────────────────────────────────────────
        title_node = tree.css_first(TITLE_SEL)
        title = title_node.text(strip=True) if title_node else slug

        # ── Full opinion text ──────────────────────────────────────────────────
        body_node = tree.css_first(BODY_SEL)
        if not body_node:
            log.warning("scraper_no_body", url=url)
            return None
        full_text = body_node.text(separator="\n", strip=True)
        if len(full_text) < 200:
            # Likely a stub page with only a summary — skip
            log.warning("scraper_body_too_short", url=url, chars=len(full_text))
            return None

        # ── Court name → jurisdiction code ────────────────────────────────────
        court_node = tree.css_first(COURT_SEL)
        court_text = court_node.text(strip=True) if court_node else ""
        jurisdiction = _map_court_to_jurisdiction(court_text)

        # ── Primary citation ──────────────────────────────────────────────────
        citation_node = tree.css_first(CITATION_SEL)
        citation = citation_node.text(strip=True) if citation_node else None
        if citation == "":
            citation = None

        # ── Decision date — prefer ISO content attribute ──────────────────────
        decision_date: date | None = None
        date_node = tree.css_first(DATE_SEL)
        if date_node:
            iso_str = date_node.attributes.get("content", "")
            decision_date = self._parse_iso_date(iso_str)
            if decision_date is None:
                # Fall back to display text
                display = date_node.text(strip=True)
                for fmt in ("%A, %B %d, %Y", "%B %d, %Y", "%b %d, %Y", "%Y-%m-%d"):
                    try:
                        decision_date = datetime.strptime(display, fmt).date()
                        break
                    except ValueError:
                        continue

        log.debug(
            "scraper_parsed",
            slug=slug,
            jurisdiction=jurisdiction,
            court=court_text[:60],
            date=str(decision_date),
        )

        return ScrapedDoc(
            source="animallaw",
            source_id=slug,
            doc_type="case",
            jurisdiction=jurisdiction,
            court=court_text,
            decision_date=decision_date,
            title=title,
            citation=citation,
            full_text=full_text,
            source_url=url,
        )

    # ── Public interface ──────────────────────────────────────────────────────

    async def scrape_all(
        self,
        start_url: str | None = None,
        max_pages: int = MAX_PAGES,
    ) -> list[ScrapedDoc]:
        """
        Scrape all federal cases from animallaw.info.

        Uses the site's built-in Federal filter so only federal cases appear
        in the listing. Paginates until no next-page link or *max_pages* hit.
        """
        listing_url = start_url or FEDERAL_LISTING_URL
        all_docs: list[ScrapedDoc] = []
        seen_slugs: set[str] = set()

        for page_num in range(1, max_pages + 1):
            log.info("scraper_listing_page", page=page_num, url=listing_url)
            listing_html = await self._get(listing_url)
            if not listing_html:
                break

            case_links = self._extract_case_links(listing_html, listing_url)
            log.info("scraper_found_links", count=len(case_links), page=page_num)

            for case_url in case_links:
                slug = urlparse(case_url).path.rstrip("/").split("/")[-1]
                if slug in seen_slugs:
                    continue
                seen_slugs.add(slug)

                case_html = await self._get(case_url)
                if not case_html:
                    continue

                doc = self._parse_case_page(case_html, case_url)
                if doc:
                    all_docs.append(doc)
                    log.debug(
                        "scraper_accepted",
                        title=doc.title[:60],
                        jurisdiction=doc.jurisdiction,
                    )

            next_url = self._next_page_url(listing_html, listing_url)
            if not next_url:
                log.info("scraper_no_more_pages", total_docs=len(all_docs))
                break
            listing_url = next_url

        log.info("scraper_complete", total_docs=len(all_docs))
        return all_docs

    async def scrape_urls(self, urls: list[str]) -> list[ScrapedDoc]:
        """Scrape a specific list of case URLs (for targeted re-ingestion)."""
        docs: list[ScrapedDoc] = []
        for url in urls:
            html = await self._get(url)
            if not html:
                continue
            doc = self._parse_case_page(html, url)
            if doc:
                docs.append(doc)
        return docs

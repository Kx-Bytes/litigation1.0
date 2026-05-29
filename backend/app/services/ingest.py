"""
C5 — Ingestion pipeline orchestrator.

Wires the four Group-C services into a single pipeline:
  scrape → parse → chunk → embed → write to DB

Also owns the in-memory job registry used by the /admin/ingest endpoint
to report background job status.

Job lifecycle
-------------
  queued → running → completed | failed

Jobs are stored in a module-level dict (_jobs). State is lost on restart —
acceptable for v1. If persistence is needed later, promote to a DB table.
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.chunk import Chunk
from app.models.citation import Citation
from app.models.document import Document
from app.services.chunker import chunk_document
from app.services.embedder import embed_and_write_chunks
from app.services.parser import parse_document
from app.services.scraper import AnimalLawScraper, ScrapedDoc

log = structlog.get_logger()

# ── Job registry ──────────────────────────────────────────────────────────────

JobStatus = Literal["queued", "running", "completed", "failed"]


@dataclass
class IngestJob:
    job_id: str
    status: JobStatus = "queued"
    total: int = 0           # total docs to process (0 = unknown until scrape done)
    processed: int = 0       # docs successfully written to DB
    skipped: int = 0         # docs skipped (already exist, state-court drops, etc.)
    errors: list[str] = field(default_factory=list)
    started_at: datetime | None = None
    finished_at: datetime | None = None


_jobs: dict[str, IngestJob] = {}


def get_job(job_id: str) -> IngestJob | None:
    return _jobs.get(job_id)


def list_jobs() -> list[IngestJob]:
    return list(_jobs.values())


# ── DB helpers ────────────────────────────────────────────────────────────────

async def _document_exists(db: AsyncSession, source: str, source_id: str) -> bool:
    """Return True if a document with (source, source_id) already exists."""
    result = await db.execute(
        select(Document.id).where(
            Document.source == source,
            Document.source_id == source_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def _write_document_pipeline(
    db: AsyncSession,
    scraped: ScrapedDoc,
    job: IngestJob,
) -> None:
    """
    Full pipeline for one document:
      parse → chunk → insert document + chunks + citations → embed chunks
    """
    # Skip if already ingested (idempotency)
    if await _document_exists(db, scraped.source, scraped.source_id):
        log.debug("ingest_skip_existing", source_id=scraped.source_id)
        job.skipped += 1
        return

    # ── Parse ─────────────────────────────────────────────────────────────────
    try:
        parsed = await parse_document(scraped)
    except Exception as exc:
        msg = f"parse failed for {scraped.source_id}: {exc}"
        log.warning("ingest_parse_error", source_id=scraped.source_id, error=str(exc))
        job.errors.append(msg)
        return

    # ── Insert Document ───────────────────────────────────────────────────────
    doc = Document(
        id=uuid.uuid4(),
        source=parsed.source,
        source_id=parsed.source_id,
        doc_type=parsed.doc_type,
        jurisdiction=parsed.jurisdiction,
        court=parsed.court,
        decision_date=parsed.decision_date,
        title=parsed.title,
        citation=parsed.citation,
        full_text=parsed.clean_text,
        source_url=parsed.source_url,
        categories=parsed.categories,
    )
    db.add(doc)
    await db.flush()  # get doc.id before inserting children

    # ── Insert Citations ──────────────────────────────────────────────────────
    for ec in parsed.citations:
        db.add(Citation(
            id=uuid.uuid4(),
            normalized_cite=ec.normalized,
            document_id=doc.id,
            extracted_by="eyecite",
        ))

    # ── Chunk ─────────────────────────────────────────────────────────────────
    chunk_specs = chunk_document(parsed.clean_text)
    if not chunk_specs:
        log.warning("ingest_no_chunks", source_id=parsed.source_id)
        job.errors.append(f"no chunks produced for {parsed.source_id}")
        await db.rollback()
        return

    # ── Insert Chunks (without embeddings yet) ────────────────────────────────
    chunk_objs: list[Chunk] = []
    for spec in chunk_specs:
        c = Chunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            chunk_index=spec.chunk_index,
            text=spec.text,
            section_type=spec.section_type,
            start_char=spec.start_char,
            end_char=spec.end_char,
        )
        db.add(c)
        chunk_objs.append(c)

    await db.flush()  # persist chunks so we have IDs

    # ── Embed Chunks ──────────────────────────────────────────────────────────
    try:
        await embed_and_write_chunks(
            db=db,
            chunk_ids=[c.id for c in chunk_objs],
            chunk_texts=[c.text for c in chunk_objs],
        )
    except Exception as exc:
        msg = f"embed failed for {parsed.source_id}: {exc}"
        log.warning("ingest_embed_error", source_id=parsed.source_id, error=str(exc))
        job.errors.append(msg)
        await db.rollback()
        return

    await db.commit()
    job.processed += 1
    log.info(
        "ingest_doc_complete",
        source_id=parsed.source_id,
        chunks=len(chunk_objs),
        categories=parsed.categories,
    )


# ── Pipeline entry points ─────────────────────────────────────────────────────

async def _run_pipeline(job_id: str, scraped_docs: list[ScrapedDoc]) -> None:
    """
    Background coroutine: process each ScrapedDoc through the full pipeline.
    Updates the job registry as it goes.
    """
    job = _jobs[job_id]
    job.status = "running"
    job.started_at = datetime.now(timezone.utc)
    job.total = len(scraped_docs)

    log.info("ingest_pipeline_start", job_id=job_id, total=job.total)

    try:
        async for db in get_db():
            for scraped in scraped_docs:
                try:
                    await _write_document_pipeline(db, scraped, job)
                except Exception as exc:
                    msg = f"unexpected error for {scraped.source_id}: {exc}"
                    log.error("ingest_unexpected_error", error=str(exc))
                    job.errors.append(msg)

        job.status = "completed"
    except Exception as exc:
        log.error("ingest_pipeline_fatal", job_id=job_id, error=str(exc))
        job.status = "failed"
        job.errors.append(f"fatal pipeline error: {exc}")
    finally:
        job.finished_at = datetime.now(timezone.utc)
        log.info(
            "ingest_pipeline_done",
            job_id=job_id,
            status=job.status,
            processed=job.processed,
            skipped=job.skipped,
            errors=len(job.errors),
        )


async def _scrape_and_ingest_task(job_id: str, max_pages: int, start_url: str | None) -> None:
    """Top-level task wrapper — catches and records any unhandled exception."""
    try:
        async with AnimalLawScraper() as scraper:
            scraped_docs = await scraper.scrape_all(
                start_url=start_url,
                max_pages=max_pages,
            )
        await _run_pipeline(job_id, scraped_docs)
    except Exception as exc:
        log.error("ingest_task_crashed", job_id=job_id, error=str(exc), exc_info=True)
        job = _jobs.get(job_id)
        if job:
            job.status = "failed"
            job.errors.append(f"task crashed: {exc}")
            job.finished_at = datetime.now(timezone.utc)


async def _url_ingest_task(job_id: str, urls: list[str]) -> None:
    """Top-level task wrapper for URL ingest."""
    try:
        async with AnimalLawScraper() as scraper:
            scraped_docs = await scraper.scrape_urls(urls)
        await _run_pipeline(job_id, scraped_docs)
    except Exception as exc:
        log.error("ingest_task_crashed", job_id=job_id, error=str(exc), exc_info=True)
        job = _jobs.get(job_id)
        if job:
            job.status = "failed"
            job.errors.append(f"task crashed: {exc}")
            job.finished_at = datetime.now(timezone.utc)


async def start_scrape_and_ingest(
    max_pages: int = 20,
    start_url: str | None = None,
) -> str:
    """
    Scrape animallaw.info then ingest all federal cases found.
    Returns a job_id immediately; scraping + ingestion run in the background.
    """
    job_id = str(uuid.uuid4())
    _jobs[job_id] = IngestJob(job_id=job_id)
    asyncio.create_task(_scrape_and_ingest_task(job_id, max_pages, start_url))
    return job_id


async def start_url_ingest(urls: list[str]) -> str:
    """
    Ingest a specific list of animallaw.info case URLs.
    Returns a job_id immediately; ingestion runs in the background.
    """
    job_id = str(uuid.uuid4())
    _jobs[job_id] = IngestJob(job_id=job_id)
    asyncio.create_task(_url_ingest_task(job_id, urls))
    return job_id

"""POST /admin/ingest — trigger background ingestion from animallaw.info."""

from fastapi import APIRouter
from pydantic import BaseModel, HttpUrl

from app.services.ingest import (
    IngestJob,
    get_job,
    list_jobs,
    start_scrape_and_ingest,
    start_url_ingest,
)

router = APIRouter()


# ── Request / response schemas ────────────────────────────────────────────────

class IngestURLsRequest(BaseModel):
    urls: list[str]      # specific animallaw.info case URLs to ingest


class ScrapeRequest(BaseModel):
    max_pages: int = 20  # how many listing pages to crawl


class JobStatusResponse(BaseModel):
    job_id: str
    status: str          # queued | running | completed | failed
    total: int
    processed: int
    skipped: int
    errors: list[str]
    started_at: str | None = None
    finished_at: str | None = None


def _job_to_response(job: IngestJob) -> JobStatusResponse:
    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        total=job.total,
        processed=job.processed,
        skipped=job.skipped,
        errors=job.errors,
        started_at=job.started_at.isoformat() if job.started_at else None,
        finished_at=job.finished_at.isoformat() if job.finished_at else None,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/admin/ingest/scrape", response_model=JobStatusResponse, status_code=202)
async def trigger_scrape(body: ScrapeRequest) -> JobStatusResponse:
    """
    Crawl animallaw.info listing pages and ingest all federal cases found.
    Returns immediately with a job_id; poll GET /admin/ingest/{job_id} for status.
    """
    job_id = await start_scrape_and_ingest(max_pages=body.max_pages)
    job = get_job(job_id)
    assert job is not None
    return _job_to_response(job)


@router.post("/admin/ingest/urls", response_model=JobStatusResponse, status_code=202)
async def ingest_urls(body: IngestURLsRequest) -> JobStatusResponse:
    """
    Ingest a specific list of animallaw.info case URLs.
    Useful for targeted re-ingestion or adding individual cases.
    Returns immediately with a job_id.
    """
    job_id = await start_url_ingest(urls=body.urls)
    job = get_job(job_id)
    assert job is not None
    return _job_to_response(job)


@router.get("/admin/ingest/{job_id}", response_model=JobStatusResponse)
async def get_ingest_status(job_id: str) -> JobStatusResponse:
    """Poll the status of a background ingest job."""
    from fastapi import HTTPException
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found.")
    return _job_to_response(job)


@router.get("/admin/ingest", response_model=list[JobStatusResponse])
async def list_ingest_jobs() -> list[JobStatusResponse]:
    """List all ingest jobs (completed, running, and queued)."""
    return [_job_to_response(j) for j in list_jobs()]

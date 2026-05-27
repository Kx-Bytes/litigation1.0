"""POST /api/v1/query — stub. Full implementation in B6."""

from fastapi import APIRouter
from pydantic import BaseModel, model_validator

router = APIRouter()


# ── Request schema ────────────────────────────────────────────────────────────

class QueryOptions(BaseModel):
    k: int = 10
    # Year-based date range filter (both optional).
    # date_from: only include cases decided on or after Jan 1 of this year.
    # date_to:   only include cases decided on or before Dec 31 of this year.
    date_from: int | None = None
    date_to: int | None = None

    @model_validator(mode="after")
    def check_date_range(self) -> "QueryOptions":
        if (
            self.date_from is not None
            and self.date_to is not None
            and self.date_from > self.date_to
        ):
            raise ValueError(
                f"date_from ({self.date_from}) must be ≤ date_to ({self.date_to})"
            )
        return self


class QueryRequest(BaseModel):
    jurisdiction: str
    claim: str
    facts: str
    options: QueryOptions = QueryOptions()


# ── Response schemas ──────────────────────────────────────────────────────────

class RiskFactor(BaseModel):
    label: str
    weight: str          # "high" | "medium" | "low"
    discussion: str
    citations: list[str]


class ComparableCase(BaseModel):
    citation: str
    summary: str
    source_url: str | None = None
    relevance: str


class RiskAssessment(BaseModel):
    summary: str
    factors: list[RiskFactor]


class QueryResponse(BaseModel):
    query_id: str
    risk_assessment: RiskAssessment | None = None
    comparable_cases: list[ComparableCase] = []
    strategic_considerations: list[str] = []
    uncertainty_notes: list[str] = []
    confidence_band: str          # "high" | "medium" | "low" | "refused"
    dropped_claims: list[str] = []
    model: str = ""
    latency_ms: int = 0
    refusal: dict | None = None
    # Echo back the active date range so the caller can confirm what was applied.
    date_from: int | None = None
    date_to: int | None = None


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/query", response_model=QueryResponse)
async def submit_query(body: QueryRequest) -> QueryResponse:
    """
    Submit a litigation query and receive a structured risk assessment.

    Full pipeline (retrieve → generate → verify) wired in B6.
    For now returns a 501 stub so the scaffold can start and tests can import.
    """
    from fastapi import HTTPException
    raise HTTPException(status_code=501, detail="Query pipeline not yet implemented (B6).")

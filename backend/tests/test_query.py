"""
Tests for POST /api/v1/query — B6 endpoint.

All five service calls are patched so no Anthropic / Voyage / Postgres traffic
is made. The DB dependency is overridden with an AsyncMock so Query/QueryResult
persistence is also fully mocked.

Test scenarios:
  - Successful assessment: full pipeline returns a structured response
  - Refusal: generator refuses → refusal dict populated, risk_assessment null
  - Date range echo: date_from/date_to passed through to response
  - latency_ms: always a non-negative integer
  - dropped_claims: resolved to citation strings when chunk is in retrieved set
  - confidence_band: comes from compute_confidence_band, not generator self-report
  - 501 stub is gone: endpoint returns 200 or 200+refusal, not 501
  - Validation: invalid date range returns 422
"""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.db.session import get_db
from app.main import app
from app.services.generator import (
    ComparableCaseOutput,
    GeneratorOutput,
    RiskFactorOutput,
)
from app.services.retriever import RetrievedChunk
from app.services.verifier import DroppedCitation, VerifiedCitation, VerifiedOutput


# ── Fixed test data ───────────────────────────────────────────────────────────

_CHUNK_ID_1 = str(uuid.uuid4())
_CHUNK_ID_2 = str(uuid.uuid4())
_DOC_ID     = str(uuid.uuid4())
_CITATION_1 = "Animal Legal Defense Fund v. USDA, 632 F.3d 971"
_CITATION_2 = "Humane Society v. Babbitt, 46 F.3d 93"


def _make_chunk(chunk_id: str, citation: str, source_url: str | None = None) -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=chunk_id,
        document_id=_DOC_ID,
        text="Sample legal excerpt.",
        section_type="analysis",
        jurisdiction="US-9th-Cir",
        citation=citation,
        source_url=source_url or "https://example.com/case",
        similarity=0.85,
        start_char=0,
        end_char=200,
    )


def _make_verified_output(
    *,
    refused: bool = False,
    refusal_reason: str | None = None,
    refusal_suggestion: str | None = None,
    risk_factors: list[RiskFactorOutput] | None = None,
    comparable_cases: list[ComparableCaseOutput] | None = None,
    verified_citations: list[VerifiedCitation] | None = None,
    dropped_citations: list[DroppedCitation] | None = None,
) -> VerifiedOutput:
    return VerifiedOutput(
        refused=refused,
        refusal_reason=refusal_reason,
        refusal_suggestion=refusal_suggestion,
        risk_summary="Moderate litigation risk on standing grounds.",
        risk_factors=risk_factors or [],
        comparable_cases=comparable_cases or [],
        strategic_considerations=["Consider filing in the 9th Circuit."],
        uncertainty_notes=["Limited precedent on this exact claim."],
        confidence_band="medium",   # ignored — pipeline overrides
        verified_citations=verified_citations or [],
        dropped_citations=dropped_citations or [],
        verification_warnings=[],
        raw_model_output="<tool_use>...",
        model="claude-sonnet-4-6",
    )


def _make_db_mock() -> AsyncMock:
    """Return an AsyncMock that satisfies add/flush/commit/rollback calls."""
    mock_db = AsyncMock()
    # flush() should set a UUID on the row — simulate by making it a no-op
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.rollback = AsyncMock()
    mock_db.add = MagicMock()
    return mock_db


# ── Test client factory ───────────────────────────────────────────────────────

def _make_client(db_mock: AsyncMock) -> AsyncClient:
    """Return an AsyncClient with the DB dependency overridden."""
    async def _override_get_db():
        yield db_mock

    app.dependency_overrides[get_db] = _override_get_db
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# ── Patch targets ─────────────────────────────────────────────────────────────

_EMBED   = "app.api.v1.endpoints.query.embed_query"
_RETRIEVE = "app.api.v1.endpoints.query.retrieve"
_GENERATE = "app.api.v1.endpoints.query.generate"
_VERIFY   = "app.api.v1.endpoints.query.verify"
_BAND     = "app.api.v1.endpoints.query.compute_confidence_band"


# ── Helpers to build a standard "everything succeeds" patch context ───────────

def _standard_patches(
    verified_output: VerifiedOutput | None = None,
    retrieved_chunks: list[RetrievedChunk] | None = None,
    band: str = "medium",
):
    """Return a context manager that patches all 5 service calls."""
    if retrieved_chunks is None:
        retrieved_chunks = [
            _make_chunk(_CHUNK_ID_1, _CITATION_1),
            _make_chunk(_CHUNK_ID_2, _CITATION_2),
        ]
    if verified_output is None:
        verified_output = _make_verified_output(
            risk_factors=[
                RiskFactorOutput(
                    label="Standing",
                    weight="high",
                    discussion="Courts have required injury-in-fact.",
                    chunk_ids=[_CHUNK_ID_1],
                )
            ],
            comparable_cases=[
                ComparableCaseOutput(
                    chunk_id=_CHUNK_ID_2,
                    summary="Plaintiff lacked organizational standing.",
                    relevance="Same standing doctrine applies.",
                )
            ],
            verified_citations=[
                VerifiedCitation(chunk_id=_CHUNK_ID_1, citation=_CITATION_1, document_id=_DOC_ID),
                VerifiedCitation(chunk_id=_CHUNK_ID_2, citation=_CITATION_2, document_id=_DOC_ID),
            ],
        )

    import contextlib

    @contextlib.asynccontextmanager
    async def _ctx():
        with (
            patch(_EMBED,    new=AsyncMock(return_value=[0.1] * 1024)),
            patch(_RETRIEVE, new=AsyncMock(return_value=retrieved_chunks)),
            patch(_GENERATE, new=AsyncMock(return_value=GeneratorOutput())),
            patch(_VERIFY,   new=AsyncMock(return_value=verified_output)),
            patch(_BAND,     return_value=band),
        ):
            yield

    return _ctx()


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_query_returns_200_not_501() -> None:
    """The stub 501 is gone — endpoint returns 200."""
    db_mock = _make_db_mock()
    async with _make_client(db_mock) as client:
        async with _standard_patches():
            resp = await client.post("/api/v1/query", json={
                "jurisdiction": "US-9th-Cir",
                "claim": "First Amendment ag-gag challenge",
                "facts": "Plaintiff recorded at a factory farm.",
            })
    app.dependency_overrides.clear()
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_query_response_has_query_id() -> None:
    db_mock = _make_db_mock()
    # Give the mock query row a real UUID
    fake_uuid = uuid.uuid4()
    db_mock.flush.side_effect = lambda: setattr(
        db_mock.add.call_args_list[-1][0][0], "id", fake_uuid
    )
    async with _make_client(db_mock) as client:
        async with _standard_patches():
            resp = await client.post("/api/v1/query", json={
                "jurisdiction": "US-9th-Cir",
                "claim": "ag-gag challenge",
                "facts": "Plaintiff recorded livestock.",
            })
    app.dependency_overrides.clear()
    data = resp.json()
    assert "query_id" in data
    assert isinstance(data["query_id"], str)


@pytest.mark.asyncio
async def test_query_confidence_band_comes_from_pipeline() -> None:
    """confidence_band in the response should reflect compute_confidence_band, not the model's self-report."""
    db_mock = _make_db_mock()
    verified = _make_verified_output()
    # Model self-reports "low" but pipeline returns "high"
    verified.confidence_band = "low"

    async with _make_client(db_mock) as client:
        async with _standard_patches(verified_output=verified, band="high"):
            resp = await client.post("/api/v1/query", json={
                "jurisdiction": "US",
                "claim": "FOIA exemption challenge",
                "facts": "Agency withheld records.",
            })
    app.dependency_overrides.clear()
    assert resp.json()["confidence_band"] == "high"


@pytest.mark.asyncio
async def test_query_risk_assessment_structure() -> None:
    """risk_assessment is present and correctly shaped when not refused."""
    db_mock = _make_db_mock()
    verified = _make_verified_output(
        risk_factors=[
            RiskFactorOutput(
                label="Standing",
                weight="high",
                discussion="Courts require injury-in-fact.",
                chunk_ids=[_CHUNK_ID_1],
            )
        ],
        verified_citations=[
            VerifiedCitation(chunk_id=_CHUNK_ID_1, citation=_CITATION_1, document_id=_DOC_ID),
        ],
    )
    async with _make_client(db_mock) as client:
        async with _standard_patches(verified_output=verified):
            resp = await client.post("/api/v1/query", json={
                "jurisdiction": "US-9th-Cir",
                "claim": "Standing challenge",
                "facts": "Plaintiff is an advocacy org.",
            })
    app.dependency_overrides.clear()
    data = resp.json()
    assert data["risk_assessment"] is not None
    assert data["risk_assessment"]["summary"] != ""
    factors = data["risk_assessment"]["factors"]
    assert len(factors) == 1
    assert factors[0]["label"] == "Standing"
    assert factors[0]["weight"] == "high"
    assert _CITATION_1 in factors[0]["citations"]


@pytest.mark.asyncio
async def test_query_comparable_cases_resolve_citation() -> None:
    """ComparableCase.citation should be the document citation string, not the chunk_id."""
    db_mock = _make_db_mock()
    retrieved = [_make_chunk(_CHUNK_ID_1, _CITATION_1, source_url="https://case.law/1")]
    verified = _make_verified_output(
        comparable_cases=[
            ComparableCaseOutput(
                chunk_id=_CHUNK_ID_1,
                summary="Case summary.",
                relevance="Same doctrine.",
            )
        ],
        verified_citations=[
            VerifiedCitation(chunk_id=_CHUNK_ID_1, citation=_CITATION_1, document_id=_DOC_ID),
        ],
    )
    async with _make_client(db_mock) as client:
        async with _standard_patches(verified_output=verified, retrieved_chunks=retrieved):
            resp = await client.post("/api/v1/query", json={
                "jurisdiction": "US-9th-Cir",
                "claim": "ALDF claim",
                "facts": "Federal inspection records withheld.",
            })
    app.dependency_overrides.clear()
    data = resp.json()
    cases = data["comparable_cases"]
    assert len(cases) == 1
    assert cases[0]["citation"] == _CITATION_1
    assert cases[0]["source_url"] == "https://case.law/1"


@pytest.mark.asyncio
async def test_query_refusal_path() -> None:
    """When the generator refuses, risk_assessment is null and refusal dict is populated."""
    db_mock = _make_db_mock()
    verified = _make_verified_output(
        refused=True,
        refusal_reason="Corpus too thin.",
        refusal_suggestion="Broaden jurisdiction.",
    )
    async with _make_client(db_mock) as client:
        with (
            patch(_EMBED,    new=AsyncMock(return_value=[0.1] * 1024)),
            patch(_RETRIEVE, new=AsyncMock(return_value=[])),
            patch(_GENERATE, new=AsyncMock(return_value=GeneratorOutput(refused=True))),
            patch(_VERIFY,   new=AsyncMock(return_value=verified)),
            patch(_BAND,     return_value="refused"),
        ):
            resp = await client.post("/api/v1/query", json={
                "jurisdiction": "US-9th-Cir",
                "claim": "Novel personhood claim",
                "facts": "Chimpanzee seeks habeas corpus.",
            })
    app.dependency_overrides.clear()
    data = resp.json()
    assert resp.status_code == 200
    assert data["confidence_band"] == "refused"
    assert data["risk_assessment"] is None
    assert data["refusal"] is not None
    assert "Corpus too thin" in data["refusal"]["reason"]
    assert "Broaden" in data["refusal"]["suggestion"]


@pytest.mark.asyncio
async def test_query_date_range_echoed_back() -> None:
    """date_from and date_to in the request are echoed in the response."""
    db_mock = _make_db_mock()
    async with _make_client(db_mock) as client:
        async with _standard_patches():
            resp = await client.post("/api/v1/query", json={
                "jurisdiction": "US",
                "claim": "Ag-gag challenge",
                "facts": "State law restricts farm recording.",
                "options": {"date_from": 2010, "date_to": 2023},
            })
    app.dependency_overrides.clear()
    data = resp.json()
    assert data["date_from"] == 2010
    assert data["date_to"] == 2023


@pytest.mark.asyncio
async def test_query_date_range_null_when_not_provided() -> None:
    db_mock = _make_db_mock()
    async with _make_client(db_mock) as client:
        async with _standard_patches():
            resp = await client.post("/api/v1/query", json={
                "jurisdiction": "US",
                "claim": "FOIA claim",
                "facts": "Records requested.",
            })
    app.dependency_overrides.clear()
    data = resp.json()
    assert data["date_from"] is None
    assert data["date_to"] is None


@pytest.mark.asyncio
async def test_query_latency_ms_is_non_negative_int() -> None:
    db_mock = _make_db_mock()
    async with _make_client(db_mock) as client:
        async with _standard_patches():
            resp = await client.post("/api/v1/query", json={
                "jurisdiction": "US-1st-Cir",
                "claim": "Animal cruelty statute challenge",
                "facts": "Statute criminalizes undercover recording.",
            })
    app.dependency_overrides.clear()
    data = resp.json()
    assert isinstance(data["latency_ms"], int)
    assert data["latency_ms"] >= 0


@pytest.mark.asyncio
async def test_query_dropped_claims_use_citation_strings() -> None:
    """dropped_claims should show human-readable citation strings, not raw chunk_ids."""
    db_mock = _make_db_mock()
    retrieved = [_make_chunk(_CHUNK_ID_1, _CITATION_1)]
    verified = _make_verified_output(
        dropped_citations=[
            DroppedCitation(chunk_id=_CHUNK_ID_1, reason="citation_not_in_db"),
        ],
    )
    async with _make_client(db_mock) as client:
        async with _standard_patches(verified_output=verified, retrieved_chunks=retrieved):
            resp = await client.post("/api/v1/query", json={
                "jurisdiction": "US",
                "claim": "Standing",
                "facts": "Facts here.",
            })
    app.dependency_overrides.clear()
    data = resp.json()
    assert _CITATION_1 in data["dropped_claims"]
    # raw UUID should NOT appear as the citation string
    assert _CHUNK_ID_1 not in data["dropped_claims"]


@pytest.mark.asyncio
async def test_query_strategic_considerations_passed_through() -> None:
    db_mock = _make_db_mock()
    verified = _make_verified_output()
    verified.strategic_considerations = ["File in the 9th Circuit.", "Seek a preliminary injunction."]
    async with _make_client(db_mock) as client:
        async with _standard_patches(verified_output=verified):
            resp = await client.post("/api/v1/query", json={
                "jurisdiction": "US-9th-Cir",
                "claim": "Standing",
                "facts": "Advocacy group plaintiff.",
            })
    app.dependency_overrides.clear()
    data = resp.json()
    assert "File in the 9th Circuit." in data["strategic_considerations"]


@pytest.mark.asyncio
async def test_query_model_in_response() -> None:
    db_mock = _make_db_mock()
    async with _make_client(db_mock) as client:
        async with _standard_patches():
            resp = await client.post("/api/v1/query", json={
                "jurisdiction": "US",
                "claim": "FOIA",
                "facts": "Records withheld.",
            })
    app.dependency_overrides.clear()
    data = resp.json()
    assert data["model"] == "claude-sonnet-4-6"


@pytest.mark.asyncio
async def test_query_invalid_date_range_returns_422() -> None:
    """date_from > date_to should be rejected at request validation."""
    db_mock = _make_db_mock()
    async with _make_client(db_mock) as client:
        resp = await client.post("/api/v1/query", json={
            "jurisdiction": "US",
            "claim": "FOIA",
            "facts": "Facts.",
            "options": {"date_from": 2023, "date_to": 2010},
        })
    app.dependency_overrides.clear()
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_query_risk_assessment_null_when_all_factors_dropped() -> None:
    """If all risk_factors are dropped by the verifier, risk_assessment should be null."""
    db_mock = _make_db_mock()
    verified = _make_verified_output(
        risk_factors=[],   # verifier dropped everything
        comparable_cases=[],
    )
    async with _make_client(db_mock) as client:
        async with _standard_patches(verified_output=verified):
            resp = await client.post("/api/v1/query", json={
                "jurisdiction": "US",
                "claim": "Standing",
                "facts": "Narrow facts.",
            })
    app.dependency_overrides.clear()
    assert resp.json()["risk_assessment"] is None

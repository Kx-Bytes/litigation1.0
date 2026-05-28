# Stage 3 Development Log

**Project:** Litigation Prediction & Strategy  
**Author:** Open Paws RDP Intern  
**Stage:** 3 — Development (Days 5–11)  
**Completed:** 2026-05-28  
**Test coverage:** 158 tests passing, 0 failing

---

## Overview

Stage 3 implemented the full system from repo scaffold to working end-to-end pipeline. Development was organised into three tracks (A: infrastructure, B: core intelligence pipeline, C: data pipeline) following the design doc task matrix.

---

## Track A — Infrastructure

### A1 · Repo scaffold
Set up the monorepo layout: `backend/` (FastAPI + Python), `frontend/` (React + Vite), `data/`, `docs/`. Configured `pyproject.toml` with `uv`, `.gitignore`, `.env` template, and `docker-compose.yml` with services for `db` (pgvector/pg16), `backend`, and `frontend`.

### A2 · Database schema and migrations
Three Alembic migrations:

- `0001` — `documents` table: stores case metadata (citation, jurisdiction, decision date, source URL, raw text, category labels).
- `0002` — `chunks` table: stores 800-token sliding-window chunks with `pgvector` HNSW index on the `embedding` column (1024-dim, cosine distance). Foreign key to `documents`.
- `0003` — `queries` and `query_results` tables: audit trail for every request. `queries` captures raw input; `query_results` captures retrieved chunk IDs, model output, verified citations, dropped citations, confidence band, and latency.

---

## Track B — Core Intelligence Pipeline

### B1 · Seed corpus
Seeded 16 federal cases spanning Supreme Court and five circuit courts (1st, 7th, 8th, 9th, 10th). Topics include animal standing, wildlife protection, agency deference, and research exemptions. All cases verified as federal-only (no state-jurisdiction documents). See self-audit B1-01 for one known citation precision issue.

### B2 · Retriever (`retriever.py`)
Jurisdiction-aware top-k vector search using `pgvector` HNSW index and `voyage-3-large` embeddings. Key design decisions:

- **Hierarchical jurisdiction matching:** a query for `US-9th-Cir` pulls both 9th Circuit and SCOTUS chunks, ensuring federal precedent is always in the retrieval pool.
- **Date range filter:** optional `date_from` / `date_to` year integers translate to `Jan 1` / `Dec 31` SQL date bounds.
- **Pre-call refusal gate:** if fewer than 2 chunks score ≥ 0.65 cosine similarity, the pipeline refuses before calling the LLM — avoiding confabulation on an empty context.
- **Thin corpus warning:** 2–3 strong chunks triggers a Claude call with an explicit "thin corpus" warning injected into the system prompt, producing an auto-uncertainty note in the response.

18 tests.

### B3 · Generator (`generator.py`)
Claude Sonnet 4.6 with a structured `tool_use` cite-or-refuse contract. Key design decisions:

- **Enum-locked citations:** the `chunk_ids` parameter in the tool schema is an `enum` limited to the exact set of retrieved chunk IDs. Claude cannot hallucinate a chunk_id that wasn't retrieved.
- **`tool_choice="any"`:** forces Claude to either call the assessment tool (with citations) or the refusal tool — no plain-text fallback.
- **Refusal path:** if Claude calls the refusal tool, the pipeline skips verification and returns a structured refusal with a reason and user-facing suggestion.
- **13-label taxonomy:** category labels from ingest are soft-boosted in the system prompt (not hard-filtered) so they inform tone without over-constraining retrieval.

24 tests.

### B4 · Verifier (`verifier.py`)
Two-level citation verification:

1. **In-memory set check:** confirms every cited `chunk_id` is in the retrieved set (catches any prompt-injection or model drift that bypasses the enum lock).
2. **DB round-trip:** batched `JOIN` of chunks and documents confirms each `chunk_id` exists in the database and resolves the human-readable citation string.

Produces a `VerifiedOutput` with `verified_citations`, `dropped_citations` (with reason codes: `not_in_retrieved_set` / `citation_not_in_db`), and `verification_warnings`. Risk factors with zero surviving citations are pruned; comparable cases are filtered. Refusal pass-through skips DB.

31 tests.

### B5 · Confidence band (`confidence.py`)
Pipeline-level confidence band overriding model self-report, computed from three objective signals:

| Signal | Meaning |
|--------|---------|
| `strong_chunks` | Count of retrieved chunks with cosine similarity ≥ 0.65 |
| `jurisdiction_match_rate` | Fraction of chunks whose jurisdiction exactly matches the query |
| `verification_rate` | Fraction of cited chunk_ids that survived the verifier |

Band rules (first match wins): `refused` → `high` → `medium` → `low`.

35 tests.

### B6 · `POST /api/v1/query` endpoint
Wired the full pipeline: embed → retrieve → generate → verify → confidence band → build `QueryResponse` → persist `QueryResult`. Key decisions:

- **Best-effort DB write:** DB failure on result persistence does not break the caller's response — the response is returned regardless and the failure is logged.
- **`QueryResponse` echoes `date_from` / `date_to`** so callers can confirm what date filter was applied.
- **Structured logging** with `structlog` at each pipeline stage for latency observability.

14 tests.

---

## Track C — Data Pipeline

### C1 · Scraper (`scraper.py`)
Async `httpx` scraper targeting animallaw.info with a federal-only filter. Parses case listings with `selectolax`, extracts citation, jurisdiction, and raw HTML. Jurisdiction filter applied at ingest — state cases are rejected before they reach the DB.

### C2 · Parser (`parser.py`)
Text normalisation (whitespace, encoding), citation extraction with `eyecite`, and category label classification via Claude Haiku (13-label taxonomy, multi-label output). Haiku classification is fast and cheap at ingest time; results are stored on the `documents` row and soft-boosted at query time.

### C3 · Chunker (`chunker.py`)
800-token sliding-window chunking with 10% overlap and section detection (identifies headings like "HELD:", "REASONING:", "DISSENT:"). Chunks are stored with their section tag to allow section-aware retrieval in future iterations.

### C4 · Embedder (`embedder.py`)
Batched `voyage-3-large` embeddings (1024 dimensions, cosine similarity). Module-level async client reuse for connection efficiency. Uses `input_type="document"` at ingest and `input_type="query"` at retrieval time, per Voyage's recommended practice.

### C5 · Ingest orchestrator (`ingest.py`)
End-to-end pipeline runner: scrape → parse → chunk → embed → upsert. Maintains a `job_registry` for ingest job tracking (status, counts, errors). Exposed via the admin `POST /api/v1/ingest` endpoint.

---

## Frontend

React + Vite SPA with three pages:

- **HomePage** — landing page with pipeline overview and navigation.
- **AnalyzePage** — two-column layout: `QueryForm` (left, sticky) + `ResultsPanel` (right). Calls `POST /api/v1/query` via axios. Shows loading skeleton, error state, and empty state.
- **HistoryPage** — searchable, filterable list of past assessments from `localStorage`. Expandable entries show risk factors, strategic considerations, and metadata.

Key components: `ConfidenceBadge`, `RiskFactorCard`, `ComparableCaseCard`, `RefusalCard`, `LoadingSkeleton`.

Nginx serves the production build and proxies `/api/` to the FastAPI backend.

---

## Test summary

| Module | Tests |
|--------|-------|
| Retriever | 18 |
| Generator | 24 |
| Verifier | 31 |
| Confidence | 35 |
| Query endpoint | 14 |
| Chunker | ~10 |
| Parser | ~10 |
| Health | ~5 |
| Ingest (admin) | ~11 |
| **Total** | **158** |

All tests run against mocked external services (Voyage, Claude) — no live API calls required in CI.

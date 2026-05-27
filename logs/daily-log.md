# Daily Log — Litigation Prediction & Strategy

Open Paws RDP, 14-day intern workflow. Morning standup + EOD note every working day.

---

## Day 5 — 2026-05-27 (Stage 3 — Development)

**Standup (morning)**
- Yesterday (Day 4): shipped `design-doc.md` — full Stage 2 gate document. Mentor sign-off received.
- Today: A1 (repo scaffold) + A2 (DB schema + migrations) + B1 (seed corpus) + B2 (retriever).
- Blockers: none.

**EOD**
- Shipped A1: full repo scaffold — `docker-compose.yml`, `.env.example`, `.gitignore`, `backend/pyproject.toml` (uv), `Dockerfile`, `app/main.py`, FastAPI router + endpoint stubs (health + query), `app/core/config.py`, lazy `app/db/session.py`, `alembic.ini`, `alembic/env.py`, `tests/conftest.py`, `tests/test_health.py`.
- Shipped A2: all 5 ORM models (`documents`, `chunks`, `queries`, `query_results`, `citations`) + Alembic migration `0001_initial_schema.py`. pgvector extension enabled via `CREATE EXTENSION IF NOT EXISTS vector`; `chunks.embedding` is `vector(1024)`; HNSW index on embedding; B-tree indexes on `jurisdiction`, `decision_date`, `normalized_cite`, `query_id`.
- Shipped B1: `data/seed/cases.json` — 20 hand-curated animal-law cases across 9 jurisdictions (US, 9th Cir, 10th Cir, 8th Cir, 7th Cir, 1st Cir, CA, NY, OR). Covers ag-gag circuit split, organizational standing, federal preemption, Dormant Commerce Clause, animal personhood. Loader script `backend/scripts/load_seed.py` (idempotent).
- Shipped B2: `app/services/retriever.py` — jurisdiction-aware top-k pgvector cosine search with hierarchical jurisdiction expansion ("US-9th-Cir" → ["US-9th-Cir", "US-9th", "US"]); `embed_query()` (voyage-3-large); `jurisdiction_match_rate()` for confidence band. 8/8 unit tests passing.
- Shipped C1–C5: full ingestion pipeline — `scraper.py` (animallaw.info federal-only async scraper), `parser.py` (text normalization + eyecite + Haiku label classification), `chunker.py` (800-token sliding window + section detection), `embedder.py` (voyage-3-large batched), `ingest.py` (pipeline orchestrator + job registry). Migration `0002_add_document_categories.py` (categories JSONB + GIN index).
- Shipped date range filter: optional `date_from` / `date_to` year params added to `QueryOptions`, `retriever.retrieve()`, `Query` ORM, and migration `0003_add_date_range_to_queries.py`. `QueryResponse` echoes back active range. 18/18 unit tests passing (10 new date-filter tests).
- Key decision: made `app/db/session.py` lazy (engine created on first use, not at import) — lets unit tests import the app without a live Postgres connection.
- Stuck: nothing blocking.
- Shipped B3: `app/services/generator.py` — Claude Sonnet 4.6 generator with tool-use cite-or-refuse contract. Two tools: `submit_risk_assessment` (chunk_ids enum-locked to retrieved set) and `refuse_query`. Pre-call refusal at < 2 chunks ≥ 0.65 similarity; thin-corpus warning + auto uncertainty note at < 4 chunks. 24/24 unit tests passing.
- Shipped B4: `app/services/verifier.py` — citation verifier, two-check pipeline. Check 1: in-memory membership (chunk_id must be in the retrieved set). Check 2: batched DB round-trip (`chunks JOIN documents` WHERE `Document.citation IS NOT NULL`). Output: `VerifiedOutput` with `verified_citations`, `dropped_citations` (with reason codes `not_in_retrieved_set` / `citation_not_in_db`), and `verification_warnings`. Post-verification, `risk_factors` are rebuilt with chunk_ids pruned to verified-only (factors with zero surviving chunk_ids are dropped entirely); `comparable_cases` are filtered to verified chunk_ids only. Refusal pass-through skips all DB work. 31/31 unit tests passing. 109/109 total (zero regressions).
- Tomorrow (Day 6): B5 (confidence band computation) + B6 (wire `POST /api/v1/query`). Day 7 milestone still on track.

---

## Day 4 — 2026-05-26 (Stage 2 — Design)

**Standup (morning)**
- Yesterday: shipped Day 3 system design — architecture, tech stack, data model, API contract, integration points, confidence-band logic.
- Today: complete Day 4 — wireframes for key screens, Stage 3 task breakdown, critical path, build order decision, consolidate into Stage 2 Design Doc for mentor review.
- Blockers: none.

**EOD**
- Shipped: `docs/stage2-design/design-doc.md` — the Stage 2 gate deliverable. Consolidates Day 3 + Day 4 into a single mentor-reviewable document covering: user flow, architecture diagram, six-page surface, tech stack, data model (5 tables), API contract (6 endpoints), confidence-band logic, Stage 3 task breakdown (23 tasks across 7 groups, A–G), critical path, build order justification, guiding-question answers, and integration failure matrix.
- Key decisions locked: build backend engine first (riskiest piece — cite-or-refuse prompt + citation verifier); seed corpus before ingestion pipeline; frontend last. Day 7 milestone = working `POST /api/v1/query` endpoint, no frontend required.
- Low-fidelity wireframes done for Analyze page (form/report split layout) and Home page.
- Stuck: nothing blocking. Awaiting mentor sign-off on Design Doc to unlock Stage 3.
- Tomorrow (Day 5 — Stage 3 begins): A1 (repo scaffold) + A2 (DB schema + migrations) in the morning; B1 (seed corpus) + B2 (retriever) in the afternoon. Target: start B3 (generator + cite-or-refuse prompt) by end of day.

---

## Day 3 — 2026-05-25 (Stage 2 — Design)

**Standup (morning)**
- Yesterday: shipped Day 2 solution-space exploration and the Stage 1 deliverable (one-page Project Discovery Note). Awaiting mentor sign-off.
- Today: system design — architecture diagram, tech stack with justifications, data model, API contract, integration points.
- Blockers: Day-1 mentor questions still open; not blocking Day 3, will sharpen Day 4 planning.

**EOD**
- Shipped: `docs/stage2-design/day3-system-design.md` covering a mermaid architecture diagram, 13-row tech-stack decision table with one-line justifications each, five-table data model (`documents`, `chunks`, `queries`, `query_results`, `citations`), API contract sketch (`/query`, `/documents/{id}`, `/chunks/{id}`, `/health`, `/admin/ingest`), integration-points failure matrix, and the calibrated confidence-band logic.
- Key design decisions: pgvector over Qdrant (single system, sufficient scale); CLI-only Phase 1 (engine first, UI in Phase 2); CourtListener MCP as opt-in per-query rather than ingest path; confidence bands computed from pipeline signals, not model self-report.
- Stuck: nothing blocking. Provisional "build first" pick is the citation verifier — to be formally justified on Day 4.
- Tomorrow (Day 4): user flow, CLI output sketch, Stage-3 task breakdown in 2–6 hour units with critical path, finalize "build first" choice, then consolidate into the Design Doc for mentor review.

---

## Day 2 — 2026-05-24 (Stage 1 — Discovery)

**Standup (morning)**
- Yesterday: shipped Day 1 brief absorption (problem, user, assumptions, advocacy angle, 13 mentor questions).
- Today: explore solution space — 3–5 tools/datasets/papers, 2–3 approaches, primary + backup pick, external dependency list. Then consolidate into the one-page Project Discovery Note (Stage 1 gate doc).
- Blockers: still awaiting mentor answers to Day-1 scope questions; not blocking.

**EOD**
- Shipped: `docs/stage1-discovery/day2-solution-space.md` (landscape survey across data sources, comparable platforms, and research papers; primary Approach A = RAG with verified citations / backup Approach B = +citation graph; dependency table with procurement flags). Also shipped Stage 1 gate deliverable: `docs/stage1-discovery/project-discovery-note.md`.
- Key findings folded into design: CourtListener has a Claude MCP connector as of May 2026 (removes ingestion plumbing); Stanford RegLab 2024 quantifies 17–33% hallucination in commercial legal AI — verified citations + calibrated refusal is the explicit differentiator.
- Stuck: nothing blocking. Pending mentor sign-off on the Discovery Note to unlock Stage 2.
- Tomorrow (Day 3 — Stage 2): assuming sign-off, draft system architecture, tech-stack choices with justifications, data model, API contract sketch, integration points.

---

## Day 1 — 2026-05-23 (Stage 1 — Discovery)

**Standup (morning)**
- Yesterday: N/A (project start).
- Today: absorb the brief, identify user + problem, list assumptions, write advocacy-angle sentence, build mentor question list.
- Blockers: none.

**EOD**
- Shipped: `docs/stage1-discovery/day1-absorb-brief.md` covering problem statement, user, assumptions (verifiable vs. need-to-ask), advocacy angle, and a 13-item mentor question list.
- Stuck: nothing blocking; several open scope questions for mentor.
- Tomorrow (Day 2): explore solution space — 3–5 existing tools, 2–3 candidate approaches with primary + backup pick, external dependency list. Then consolidate into the one-page Project Discovery Note.

---

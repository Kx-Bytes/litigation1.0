# Litigation Prediction & Strategy

**Open Paws RDP — open-source AI platform for animal-advocacy litigation strategy (USA)**

Helps nonprofit legal teams assess litigation risk, surface relevant federal precedent, and evaluate strategic options — grounded in verified case law, never hallucinated.

> **Disclaimer:** Outputs are informational risk assessments only. Not legal advice. All assessments are grounded in retrieved federal case law and every citation is verified before display.

---

## What it does

1. You describe a legal claim and supporting facts.
2. The pipeline embeds your query (voyage-3-large via OpenRouter), retrieves the closest federal precedent from the case database (pgvector HNSW), generates a structured risk assessment (Claude Sonnet 4.6 with cite-or-refuse tool use), verifies every cited chunk against the database, and computes a calibrated confidence band.
3. You get a structured output: risk factors with citations, comparable cases, strategic considerations, uncertainty notes, and a `high / medium / low / refused` confidence band.

Corpus scope: **federal cases only** — Supreme Court and circuit courts.

---

## Project structure

```
litigation1.0/
├── backend/                    # FastAPI + Python pipeline
│   ├── app/
│   │   ├── api/v1/endpoints/   # query, ingest, health
│   │   ├── services/           # retriever, generator, verifier, confidence,
│   │   │                       # scraper, parser, chunker, embedder, ingest
│   │   ├── models/             # SQLAlchemy ORM models
│   │   └── db/                 # session, migrations
│   ├── alembic/                # DB migrations (0001–0003)
│   └── tests/                  # 158 tests, 0 failing
├── frontend/                   # React + Vite SPA
│   └── src/
│       ├── components/         # AnalyzePage, HistoryPage, HomePage, ...
│       ├── hooks/              # useQueryHistory
│       └── lib/                # api.js (axios), jurisdictions.js
├── data/                       # case data and seed files
├── docs/
│   ├── stage1-discovery/       # Project Discovery Note (mentor sign-off ✓)
│   ├── stage2-design/          # Design Doc (mentor sign-off ✓)
│   └── stage3-development/     # Dev log, self-audit
├── docker-compose.yml
└── .env                        # local secrets — never committed
```

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker + Docker Compose v2)
- API keys for **OpenRouter** (LLM + embeddings) and optionally **Anthropic** directly (see Environment variables below)

---

## Quickstart (Docker — recommended)

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd litigation1.0

# 2. Fill in your API keys in .env (file already exists — edit it directly)
#    Required: OPENROUTER_API_KEY
#    Optional: ANTHROPIC_API_KEY (used by parser for Haiku label classification)

# 3. Start everything
docker compose up --build

# 4. Open the app
open http://localhost:5173

# API docs (FastAPI Swagger UI)
open http://localhost:8000/docs
```

The `db` service initialises automatically. On first boot the backend applies all Alembic migrations and the app is ready once the health check at `GET /api/v1/health` returns `{"status": "ok"}`.

---

## Running the backend locally (without Docker)

```bash
cd backend

# Install dependencies (requires Python 3.12+ and uv)
pip install uv
uv pip install --system .

# Start a local Postgres with pgvector (or point DATABASE_URL at an existing instance)
# Then run migrations
alembic upgrade head

# Start the API
uvicorn app.main:app --reload --port 8000
```

---

## Running the frontend locally

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
# → http://localhost:5173 (Vite proxy forwards /api to localhost:8000)
```

---

## Running tests

```bash
cd backend
pytest                        # all 158 tests
pytest tests/test_query.py    # a specific module
pytest -v --tb=short          # verbose output
```

Tests mock all external services (OpenRouter, Anthropic). No live API calls or database required.

---

## Environment variables

Edit the `.env` file in the repo root and fill in:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (asyncpg driver) |
| `POSTGRES_USER` | DB user (used by Docker Compose) |
| `POSTGRES_PASSWORD` | DB password |
| `POSTGRES_DB` | DB name |
| `OPENROUTER_API_KEY` | OpenRouter API key — used for both LLM (Claude Sonnet 4.6) and embeddings (voyage-3-large) |
| `OPENROUTER_MODEL` | Model string, default `anthropic/claude-sonnet-4-6` |
| `ANTHROPIC_API_KEY` | Optional — Anthropic direct key for Haiku label classification in the ingest parser |
| `VOYAGE_API_KEY` | Optional — kept for reference, embeddings now route via OpenRouter |
| `ENVIRONMENT` | `development` or `production` |
| `LOG_LEVEL` | `INFO`, `DEBUG`, etc. |

---

## Data sources

| Source | Status | Notes |
|--------|--------|-------|
| [animallaw.info](https://www.animallaw.info) (Michigan State University) | Active | Primary corpus — the world's largest animal law case collection. Scraper targets federal circuit + SCOTUS pages. |
| [CourtListener / RECAP](https://www.courtlistener.com) (Free Law Project) | Planned | REST API, 4M+ federal opinions, rich metadata |
| [Caselaw Access Project](https://case.law) (Harvard Law School) | Planned | 6.7M cases, 1658–2020, bulk download |

All state court cases are filtered out at ingest time. Confidence bands honestly reflect how deep the current coverage is for any given query.

---

## Key API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Health check |
| `POST` | `/api/v1/query` | Submit a litigation query (full pipeline) |
| `POST` | `/api/v1/ingest` | Trigger scrape + ingest pipeline (admin) |

Full interactive docs at `http://localhost:8000/docs` when the backend is running.

---

## Architecture overview

```
User query
    │
    ▼
[Embedder]  voyage-3-large → 1024-dim vector
    │
    ▼
[Retriever]  pgvector HNSW, jurisdiction-aware, optional date range
    │         < 2 strong chunks → pre-call refusal (no LLM call)
    ▼
[Generator]  Claude Sonnet 4.6, cite-or-refuse tool_use
    │         chunk_ids enum-locked to retrieved set
    ▼
[Verifier]   2-level check: in-memory set + DB round-trip
    │         drops unverified citations, prunes empty risk factors
    ▼
[Confidence] 3-signal pipeline band: strong_chunks, jurisdiction_match_rate,
    │         verification_rate → high / medium / low / refused
    ▼
[Response]   QueryResponse + persisted QueryResult audit row
```

---

## Documentation

- [Project Discovery Note](docs/stage1-discovery/project-discovery-note.md) — problem framing and scope
- [Design Doc](docs/stage2-design/design-doc.md) — architecture, data model, API design
- [Dev Log](docs/stage3-development/dev-log.md) — what was built and why
- [Self-Audit](docs/stage3-development/self-audit.md) — known issues and limitations

---

## Licence

Open source. Intended for research and nonprofit legal strategy use only.

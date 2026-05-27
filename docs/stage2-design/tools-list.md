# Tools List — Litigation Prediction & Strategy Platform

**Last updated: 2026-05-25**

---

## Overview

This document lists all tools, frameworks, and services used to build the Litigation Prediction & Strategy platform — an open-source, AI-powered system that helps animal-advocacy legal teams assess litigation risk, research precedent, and evaluate strategic options. Tools are organized by phase and cost.

---

## Phase 1 — Paid

| Tool | Purpose | Cost |
|---|---|---|
| **OpenRouter** | LLM access — routes queries to Claude Sonnet 4.6 for generation. Single API key covers multiple models. Uses the OpenAI-compatible request format, making it easy to swap models without changing code. | Pay-per-token |

---

## Phase 1 — Free

### Frontend

| Tool | Purpose |
|---|---|
| **Next.js (React + TypeScript)** | Frontend framework. Powers the multi-page web application with shared layout, routing, and server-side rendering. |
| **Tailwind CSS + shadcn/ui** | Styling and component library. Provides a professional, accessible design system without requiring bespoke design work. |
| **Vercel** | Frontend hosting. Native Next.js host with preview deployments per branch. Free tier is sufficient for single-user use. |
| **Vitest** | Frontend testing framework. Default for Vite-powered Next.js setups. |

### Hosting

| Tool | Purpose |
|---|---|
| **Render** | Backend hosting for FastAPI and managed Postgres. Free tier is sufficient for single-user use — the spin-down delay on inactivity is not a concern at this scale. |

### Backend

| Tool | Purpose |
|---|---|
| **FastAPI (Python 3.12)** | Backend framework. Async, typed, and auto-generates OpenAPI documentation. Well-suited to Python's AI and legal-NLP ecosystem. |
| **uv** | Python package manager. Fast and deterministic dependency resolution. |
| **pytest** | Backend testing framework. |
| **Alembic** | Database migration tool. Pairs with SQLAlchemy for schema versioning. |
| **httpx + selectolax** | Web scraping libraries. Lightweight Python tools for scraping static HTML pages — no browser automation needed. |
| **eyecite** | US legal citation parser. Extracts and normalises legal citations from case text. Maintained by the Free Law Project (the nonprofit behind CourtListener). |
| **Docker Compose** | Local development environment. One command spins up Postgres and the backend for any fresh clone of the repository. |

### Database

| Tool | Purpose |
|---|---|
| **Postgres 16 + pgvector** | Combined relational and vector database. Stores case documents, embeddings, queries, and results in a single system. Self-hosted via Docker. Sufficient scale for the corpus without needing a separate vector database. |

### AI / Embeddings

| Tool | Purpose |
|---|---|
| **bge-large-en-v1.5 (local)** | Embedding model. Open-source, runs locally with no API key or cost. Produces 1024-dimension vectors — the same dimension as the Phase 2 upgrade (voyage-3-large) — meaning the swap requires no database schema changes. |

### Data Sources

| Tool | Purpose |
|---|---|
| **animallaw.info** | Primary animal-law corpus. Covers cases, statutes, regulations, and articles relevant to animal-advocacy litigation in the USA. Free to access; scraping permission required before ingestion. |
| **Caselaw Access Project (CAP)** | Historical US case law corpus. CC0 licensed — no access restrictions. |
| **CourtListener API** | Offline corpus ingestion. Used to pull a targeted slice of animal-law cases into the local Postgres database during the ingestion pipeline. Free to use. |
| **GitHub** | Version control and open-source repository hosting. Free for public repositories. |

---

## Phase 2 — Upgrades

These tools are out of scope for the initial prototype but are the natural next steps once the Phase 1 pipeline is validated and the platform is ready to scale.

| Tool | Replaces | Purpose | Why upgrade |
|---|---|---|---|
| **Voyage AI (voyage-3-large)** | bge-large-en-v1.5 | Higher-quality embedding model for legal text retrieval. | Top-ranked retrieval performance for legal text. If retrieval quality feels insufficient during testing, swapping in voyage-3-large requires only a single config line change — no schema migration, same 1024 dimensions. |
| **CourtListener MCP** | CourtListener API (ingestion only) | Live case law fetching at query time. When enabled, Claude calls CourtListener in real time to surface recent decisions not yet in the local database. | Keeps the platform current between ingestion refresh cycles. Each query with this enabled costs slightly more in OpenRouter tokens since Claude processes the additional live results. |
| **Auth + RBAC** | No auth (Phase 1 is single-user) | User accounts, role-based access control, and workspace isolation. | Required before the platform can support multiple organizations or teams. Phase 1 is deliberately single-tenant. |
| **Document upload pipeline** | Out of scope | Allows users to upload case documents directly for analysis alongside the structured query. | High-value feature for legal teams working with their own filings. Deferred because it introduces prompt-injection risk that requires careful security design. |
| **CourtListener membership** | N/A | Financial support for the Free Law Project (nonprofit behind CourtListener). Not a technical requirement — the API has no paywall. | Worth contributing if the platform reaches high query volume in a real pilot. Not needed during development. |

---

## Notes

- **OpenRouter vs. direct Anthropic API:** OpenRouter uses the OpenAI-compatible request format. Pointing the backend at OpenRouter instead of Anthropic directly requires only a config change — model behavior is identical.
- **Embedding upgrade path:** The embedding model is abstracted behind a single config value. Upgrading from bge-large to voyage-3-large in Phase 2 requires no architectural changes and no database migration.
- **Render scaling:** Free tier is appropriate for single-user use. If the platform grows to support multiple users or organizations, upgrade to the $7/mo Starter plan for persistent Postgres and no spin-down on inactivity.
- **animallaw.info scraping permission:** Explicit permission is required before running the ingestion pipeline against animallaw.info. Do not scrape until confirmed.

# Stage 4 Retrospective

**Project:** Litigation Prediction & Strategy  
**Author:** Open Paws RDP Intern  
**Date:** 2026-05-28  
**Duration:** 14-day RDP (2026-05-23 → 2026-05-28, accelerated)

---

## What we built

An end-to-end, open-source AI platform for animal-advocacy litigation strategy. The system takes a legal claim and facts, retrieves relevant federal precedent from a pgvector database, generates a structured risk assessment via Claude Sonnet with a cite-or-refuse contract, verifies every citation, computes a calibrated confidence band, and surfaces the result in a React UI. 158 tests pass. The full pipeline runs in Docker with a single `docker compose up`.

---

## What went well

**The cite-or-refuse architecture held up.** Using `tool_use` with an enum-locked `chunk_ids` parameter turned out to be a strong design. It made hallucinated citations structurally impossible — Claude physically cannot reference a chunk that wasn't retrieved. The two-level verifier (in-memory set check + DB round-trip) then caught any edge cases. The combination gave us high confidence in output trustworthiness even on a small seed corpus.

**Separation of confidence from model self-report.** Early in design we considered trusting Claude's own confidence estimate. Overriding it with three objective pipeline signals (strong chunks, jurisdiction match rate, verification rate) was the right call — the model's self-report is consistent but not calibrated, while the pipeline signals are directly observable.

**Pre-call refusal gate.** Building the "< 2 strong chunks → refuse without LLM call" logic early paid off. It prevents the worst failure mode (confidently wrong assessment on empty context) and is cheap to enforce.

**Stage gates slowed us down at first but saved time overall.** Spending two full days on Discovery and two on Design before writing a line of production code felt slow. But having a locked design doc meant zero architectural pivots during development. Every service was built to spec.

**Test-first for the pipeline services.** Writing tests alongside each service (not after) made integration much smoother. When `B6` wired all services together, the endpoint tests caught one type mismatch immediately rather than it surfacing at runtime.

---

## What didn't go well

**Seed corpus is small.** 16 cases is enough to demonstrate the pipeline end-to-end, but most real queries will return a "low" or "medium" confidence band until the scraper runs and the corpus grows. The scraper (C1) is built and working but hasn't been run at scale yet. This is the single biggest gap between "impressive demo" and "useful tool."

**Frontend history uses localStorage, not the DB.** The backend persists a `QueryResult` row for every query (full audit trail). The frontend ignores this and uses `localStorage` instead. This was a pragmatic choice to avoid building a `GET /api/v1/history` endpoint under time pressure, but it means history is silently lost if the user clears their browser. The fix is straightforward but was cut for time.

**Confidence threshold tuning was guesswork.** The `HIGH_STRONG_CHUNKS = 4`, `MEDIUM_STRONG_CHUNKS = 2`, etc. constants were set based on intuition against a 16-case corpus. Without a labelled evaluation set these numbers are unvalidated. On a larger corpus they may over- or under-estimate confidence.

**No auth layer.** The security design called for JWT + RBAC. It's explicitly out of scope for the prototype but it's a large gap if this were ever deployed to real users. Every query hits two expensive external APIs with no rate limiting.

---

## What I'd do differently

**Run the scraper earlier and build the corpus in parallel with the pipeline.** C1–C5 (scraper through embedder) were built after the core pipeline (B2–B5). In hindsight, kicking off a corpus build earlier would have given real retrieval data to test against, making confidence threshold tuning empirical rather than guesswork.

**Design the history endpoint (GET /api/v1/history) alongside the query endpoint.** The DB already stores everything needed. Adding the endpoint would have taken a few hours and made the frontend history feature durable. Doing `localStorage` first was faster but created a gap I didn't have time to close.

**Add an eval harness from the start.** The cite-or-refuse contract and verifier were tested with mocks, but there's no end-to-end eval that measures output quality against labelled ground truth (e.g., "this query should surface *Tilikum v. SeaWorld* as a comparable case"). An eval harness would have let us tune thresholds empirically and catch regressions as the corpus grows.

---

## Key learnings

**Hallucination prevention is an architecture problem, not a prompt problem.** The real fix for citation hallucination wasn't a better system prompt — it was structuring the tool schema so the model couldn't physically produce an unverifiable citation. Structural constraints beat instructional constraints every time.

**Small corpus + high-quality pipeline > large corpus + weak pipeline.** 16 verified, jurisdiction-tagged federal cases with proper embeddings and a citation verifier produces more trustworthy output than a larger corpus with weaker retrieval and no verification. Quality of the pipeline matters more than quantity of data, especially early.

**Async all the way through pays off.** Using `asyncpg`, async SQLAlchemy, and async Voyage/Anthropic clients throughout meant the backend handles concurrent requests without blocking. This cost some extra complexity (session management, async fixtures in tests) but the architecture is correct for a web service from day one.

---

## Remaining work (if time were unlimited)

1. Run the scraper at scale and build a 500+ case corpus
2. Add `GET /api/v1/history` and wire frontend to DB history
3. Add JWT auth + RBAC
4. Build a labelled eval set and tune confidence thresholds empirically
5. Add scraper retry logic (tenacity backoff on 429/503)
6. Pin Docker image tags for reproducibility
7. Add rate limiting middleware to the query endpoint
8. Resolve the Tilikum district-court citation precision issue (self-audit B1-01)

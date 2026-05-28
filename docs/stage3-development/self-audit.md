# Stage 3 Self-Audit — Known Issues & Limitations

**Project:** Litigation Prediction & Strategy  
**Author:** Open Paws RDP Intern  
**Date:** 2026-05-28  
**Audit scope:** All code shipped in Stage 3 (A1–B6, C1–C5, frontend)

---

## Severity key

| Level | Meaning |
|-------|---------|
| **P1 — Must-fix** | Breaks correctness or trust guarantees |
| **P2 — Should-fix** | Degrades quality but system still functions |
| **P3 — Nice-to-have** | Minor polish; safe to defer |

---

## P1 — Must-fix

None identified. The core cite-or-refuse contract, citation verifier, and confidence band all behave as specified. All 158 tests pass.

---

## P2 — Should-fix

### B1-01 · Tilikum case tagged as circuit court, citation is district court
**File:** `data/seed/cases.json`  
**Detail:** `842 F. Supp. 2d 1259 (S.D. Cal. 2012)` (the *Tilikum v. SeaWorld* case) is tagged `jurisdiction: "US-9th-Cir"` but the citation is a district court (S.D. Cal.) opinion, not a Ninth Circuit panel opinion. The retriever will still surface it for 9th Circuit queries — the jurisdiction tag is within scope — but it will be cited as circuit-level authority when it is actually district-level, which is weaker precedent.  
**Fix:** Add a `court_level` field (`"district"` | `"circuit"` | `"supreme"`) to the document schema and filter or weight accordingly in the generator prompt.

### B1-02 · Docket-number-only citation for No. 21-16956
**File:** `data/seed/cases.json`  
**Detail:** One case uses `No. 21-16956 (9th Cir. 2022)` as its citation string rather than a proper reporter citation (e.g., `F.4th`). The case was likely decided but not yet published in the Federal Reporter at time of seeding. The verifier will match it by `chunk_id` correctly, but the citation string surfaced to users is not a standard legal citation.  
**Fix:** Update once the official F.4th citation is available, or add a `"citation_type": "slip"` flag and surface a disclaimer in the UI when slip opinions are cited.

### B3-01 · Confidence thresholds are hand-tuned, not empirically calibrated
**File:** `backend/app/services/confidence.py`  
**Detail:** `HIGH_STRONG_CHUNKS = 4`, `MEDIUM_STRONG_CHUNKS = 2`, `HIGH_VERIFICATION_RATE = 0.75`, etc. were set based on engineering judgment against the 16-case seed corpus. They have not been validated against a labeled evaluation set. On a larger corpus these thresholds may need adjustment.  
**Fix:** Build a labelled eval set of 50+ queries with human-rated confidence levels and tune thresholds against it once the scraper has populated a larger corpus.

### C1-01 · Scraper has no retry budget for transient HTTP errors
**File:** `backend/app/services/scraper.py`  
**Detail:** The async scraper uses `httpx` with a single attempt per URL. Transient 429/503 responses from animallaw.info will silently fail the batch rather than backing off and retrying.  
**Fix:** Wrap fetch calls in a retry loop with exponential backoff (e.g., `tenacity`).

---

## P3 — Nice-to-have

### FE-01 · Query history is browser-local only (no server-side persistence)
**File:** `frontend/src/hooks/useQueryHistory.js`  
**Detail:** History is stored in `localStorage` (max 20 entries). The database does persist a `QueryResult` row for every query via the best-effort write in `POST /api/v1/query`, but there is no `GET /api/v1/history` endpoint. Users lose history if they clear their browser or switch devices.  
**Fix:** Add a `GET /api/v1/history` endpoint that returns the user's persisted `QueryResult` rows and wire the frontend to it instead of (or alongside) `localStorage`.

### FE-02 · Risk factor display uses `f.factor_text || f.factor` fallback
**File:** `frontend/src/components/HistoryPage.jsx`, line ~95  
**Detail:** The history panel renders `{f.factor_text || f.factor}` to handle two possible field names. The API response schema uses `label` and `discussion` (per `RiskFactor` in `query.py`). The fallback means the history panel will silently show nothing for risk factors if neither `factor_text` nor `factor` is present.  
**Fix:** Update the history panel to use `f.label` and `f.discussion` consistently with the API schema.

### INF-01 · Docker image tags are not pinned
**File:** `docker-compose.yml`  
**Detail:** `pgvector/pgvector:pg16` is a floating tag and will pick up upstream changes on next pull. For a reproducible demo environment the tag should be pinned to a specific digest or minor version.  
**Fix:** Pin to a specific version, e.g., `pgvector/pgvector:0.7.0-pg16`.

### INF-02 · No rate limiting on `POST /api/v1/query`
**File:** `backend/app/api/v1/endpoints/query.py`  
**Detail:** The query endpoint makes two external API calls (Voyage embed + Claude generate) per request. There is no per-IP or per-user rate limit, so a single client can exhaust API quotas.  
**Fix:** Add a rate-limiting middleware (e.g., `slowapi`) before production deployment.

### INF-03 · No authentication or RBAC
**Detail:** The API has no auth layer. This is by design for the prototype scope (noted as out-of-scope in the design doc), but must be addressed before any real-user deployment. The design doc specifies JWT + RBAC as the intended production approach.

---

## Out-of-scope items (not bugs)

The following items were explicitly scoped out in the design doc and are listed here only for completeness:

- Autonomous legal advice or guaranteed outcome predictions
- Automated court filings
- State-jurisdiction case law (corpus is federal-only by design)
- Consumer-facing legal guidance
- Model drift monitoring (post-deployment concern)
- Prompt-injection hardening beyond the current tool_use contract (production hardening item)

# Day 2 — Explore the Solution Space

**Project:** Litigation Prediction and Strategy (Open Paws RDP)
**Stage:** 1 — Discovery & Problem Framing
**Date:** 2026-05-24

---

## 1. Landscape survey

### Data sources

**Caselaw Access Project (CAP) — Harvard LIL**
- 6.7M US cases from 360 years of legal history; full state + federal coverage; CC0 license; bulk data + API; mirrored on Hugging Face, Kaggle, Harvard Dataverse.
- *Strength:* Permissive license, deep historical coverage, available in pre-processed forms.
- *Weakness:* Coverage stops at 2020 — five years stale by 2026. No native citation graph.

**CourtListener / Free Law Project**
- 9M+ federal and state decisions, RECAP/PACER docket archive, oral arguments, judge metadata, citation graph. REST API v4.4, bulk quarterly dumps. As of **May 2026**, full API access is included with membership *and* a CourtListener MCP connector is natively available inside Claude.
- *Strength:* Current data, citation graph, judge/court metadata, MCP connector removes most ingestion plumbing for the prototype.
- *Weakness:* Rate limits without membership (cheap to upgrade); some PACER data has per-page costs.

**Animal Legal & Historical Center (animallaw.info)**
- Michigan State University College of Law project. 1,200+ animal-law cases, 1,400+ US statutes, 60+ topic explainers, international collection, editorial annotations by Prof. David Favre and Rebecca Wisch.
- *Strength:* Domain-curated, professionally edited, the closest thing to an "animal law canon." Small enough to ingest fully in Phase 1.
- *Weakness:* No public API. Scraping needs permission. Editorial commentary mixed with primary sources requires careful chunking.

**Animal Legal Defense Fund (ALDF) materials**
- Litigation case database, state animal-protection law rankings, legal resources.
- *Strength:* Domain-current; direct line into actual advocacy litigation.
- *Weakness:* Copyright posture unclear. Ideal to have Open Paws broker the relationship before ingesting anything.

### Comparable platforms

**Lexis+ AI & Westlaw AI-Assisted Research (commercial, closed)**
- Hallucinated on **17%** (Lexis+) and **33%** (Westlaw) of queries in the Stanford RegLab 2024 evaluation — despite Lexis claiming "100% hallucination-free linked citations" and Thomson Reuters claiming reliance on "trusted content." Both inaccessible to small nonprofits on price alone.
- *Lesson:* Even the leaders ship with high hallucination rates. The bar to clear is *transparency* (surfacing uncertainty + verifiable citations), not matching closed-source feature checklists.

**Harvey & CoCounsel (commercial, closed)**
- Built for AmLaw 100 firms. Closed-source, expensive, not designed for advocacy nonprofits.

**LawGlance (open-source)**
- Free OSS RAG legal assistant; community project; expanding jurisdictions.
- *Strength:* Proves an OSS RAG legal stack is viable today.
- *Weakness:* Generalist, not US-focused, not litigation-strategy-shaped.

**Mike (mikeoss.com, open-source)**
- Self-hostable, positioned as an OSS alternative to Harvey/Legora.
- *Strength:* Demonstrates production-grade OSS legal AI is achievable.
- *Weakness:* Law-firm workflow framing, not nonprofit advocacy strategy.

### Research papers (Stanford RegLab)

**Magesh, Surani, Dahl, Suzgun, Manning, Ho (2024) — "Hallucination-Free? Assessing the Reliability of Leading AI Legal Research Tools."**
- First preregistered empirical evaluation of commercial legal AI. 202 queries, hand-scored by legal experts. Key implication for us: **calibrated refusal beats confident wrong answers**, and verification of citations against retrieved corpus is non-negotiable.

**Dahl, Magesh, Suzgun, Ho (2024) — "Hallucinating Law: Legal Mistakes with Large Language Models Are Pervasive."**
- Characterizes legal-LLM failure modes: fabricated citations, misapplied holdings, jurisdictional confusion, anchoring on dicta. Maps directly to risks we already flagged in the brief.

---

## 2. Candidate solution approaches

### Approach A — RAG over curated open datasets, with strict citation grounding *(primary)*

Ingest the **animallaw.info curated corpus** as the starting layer (small, high-signal, animal-law-canonical), plus **CourtListener** via its API/MCP for current breadth, plus **CAP** as a permissive historical backbone. Chunk semantically. Embed and store in pgvector. Retrieve top-k passages per query, filtered by jurisdiction. Generate structured outputs (risk factors, comparable cases, strategic considerations) using Claude with a *cite-or-refuse* prompt contract. Every generated citation is verified against the retrieved corpus before being shown to the user; unverifiable claims are dropped or labelled "uncited assertion."

Underlying technical problems:
- Legal-aware chunking (preserve case captions, holdings, headnote/text boundaries).
- Citation extraction & Bluebook normalization (eyecite is the standard OSS lib).
- Jurisdiction-aware retrieval filtering (court → circuit → state).
- Citation verification (each cite generated must round-trip to a retrieved chunk; otherwise drop).
- Calibrated confidence scoring (not the model's own self-rating; ideally retrieval-quality + agreement signals).
- Animal-law topical filtering (do we ingest all of CAP and filter, or stay narrow with animallaw.info + targeted CourtListener queries?).

### Approach B — Hybrid RAG + citation/precedent graph

Everything in A, plus a structured graph layer: court hierarchy, citation network (which cases cite which, with sign of treatment), and overruled/negative-treatment signals. Used for **precedential weighting** in retrieval and output (binding vs persuasive, fresh vs superseded).

Underlying technical problems:
- All of A.
- Building or licensing a court-hierarchy graph (CourtListener exposes some of this).
- Detecting overruled or negatively-treated cases (no free "KeyCite/Shepard's" equivalent at full quality).
- Meaningful added engineering for what may be marginal Phase-1 value.

### Approach C — Fine-tuned legal model + RAG

Fine-tune a strong open-source LLM (Llama 3.1, Mistral) on US case law before layering RAG.

Underlying technical problems:
- Compute cost outside intern budget envelope.
- Dataset licensing complications (CAP CC0 is fine; CourtListener terms may restrict training).
- Slow iteration (one fine-tune kills 3+ days of a 14-day window).
- Empirically, RAG + a frontier model already beats fine-tuned smaller models on legal QA.

---

## 3. Primary + backup choice (with justification)

**Primary: Approach A — RAG over curated open datasets with strict citation grounding.**

This is the de-risk-fastest path. Approach A gets us to a runnable vertical slice (retrieve → cite → structured output) inside Days 5–7. It exploits the May-2026 CourtListener MCP connector to remove most ingestion plumbing, uses animallaw.info as a small, high-signal starting corpus, and leans on a frontier model (Claude) rather than committing scarce time to model training. Most importantly, the Stanford RegLab evidence tells us the *failure mode* commercial tools share is exactly what Approach A is engineered to fix: confident-but-wrong citations. So our differentiating engineering — citation verification, calibrated refusal, jurisdiction-aware filtering — lands on the part of the problem that actually moves the trust needle.

**Backup: Approach B — hybrid RAG + citation graph.**

If, by Day 8 self-audit, retrieval quality or precedential weighting is too weak to produce trustworthy outputs, we layer in a citation-graph re-ranker on top of Approach A rather than rebuilding. Most of Approach A's code is reused; we add a graph signal, not a new architecture.

**Approach C is parked as future work** outside the 14-day window.

---

## 4. External dependencies

| Dependency | Type | Cost | Procurement risk | Notes |
|---|---|---|---|---|
| Anthropic API (Claude Sonnet 4.6 / Opus 4.6) | Paid API | $$ | Low | API key + budget. Confirm with mentor (Day-1 Q4). |
| CourtListener API + MCP connector | Free + paid membership | $ | Low | Free tier sufficient for prototype; ~$10/mo membership unlocks higher limits + PACER. |
| Caselaw Access Project bulk | Dataset (CC0) | Free | Low | Available on Hugging Face / Harvard Dataverse. Optional for Phase 1 (use CourtListener first). |
| animallaw.info content | Web scrape or partnership | Free | **Medium** | No API. Need to check ToS; ideally email Prof. Favre / Wisch for an explicit permission before scraping. |
| ALDF litigation database | Partnership | Free | **High** | Copyright unclear. Open Paws should broker the intro. |
| pgvector (Postgres extension) | OSS | Free | Low | Pragmatic default for <50M vectors. |
| Embedding model | Paid API | $ | Low | voyage-3-large (or Anthropic-compatible) for the prototype; swap to OSS later if self-hosting required. |
| eyecite (citation parsing) | OSS (Python) | Free | Low | Standard for legal-citation extraction; maintained by Free Law Project. |
| OCR (Tesseract / docling) | OSS | Free | Low | Only needed in Phase 2 for uploaded PDFs. |

Items flagged for early action with mentor:
1. **Anthropic API budget** (Day-1 Q4).
2. **CourtListener membership** — cheap; can self-fund if needed.
3. **animallaw.info scraping permission** — email this week.
4. **ALDF data access** — request Open Paws make the introduction.

---

## EOD note — Day 2

- **Shipped:** Day 2 solution-space exploration, primary (A) + backup (B) selection with justification, full external-dependency list with procurement flags. Companion deliverable — the one-page Project Discovery Note — produced separately as the Stage 1 gate document.
- **Stuck:** Still waiting on mentor answers to several Day-1 questions (scope of "USA," budget envelope, dataset-licensing posture, pilot-partner identity). None of these block Day 2; they will sharpen Stage 2.
- **Tomorrow (Day 3 — Stage 2):** Pending mentor sign-off on the Discovery Note. Then: system architecture (components + data flow), tech-stack decisions with one-line justifications each, data model, API contract sketch, integration points.

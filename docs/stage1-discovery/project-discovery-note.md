# Project Discovery Note — Litigation Prediction and Strategy

**Stage 1 deliverable · Open Paws RDP · 14-day intern workflow**
**Author:** intern · **Date:** 2026-05-24 · **Status:** awaiting mentor sign-off

---

## Problem

Small animal-advocacy legal teams in the USA make high-stakes litigation decisions — where to file, what to claim, when to settle — from a position of severe resource constraint. They can't match the research bandwidth of large firms, and existing commercial legal AI tools (Lexis+ AI, Westlaw AI) are priced out of reach and ship with documented 17–33% hallucination rates (Stanford RegLab, 2024).

## User

**Primary:** litigation counsel and policy/legal researchers at animal-advocacy nonprofits and clinics. Legal-literate (JD or equivalent). They need analytical leverage, not legal explanations.
**Secondary:** campaign strategists and advocacy directors making cross-portfolio prioritization decisions.

## What we're building

An open-source, AI-powered platform that takes a jurisdiction + legal claims + facts (+ optionally an uploaded document) and produces a **structured risk assessment, comparable precedents, strategic considerations, and confidence indicators — every claim cited and every citation verifiable against retrieved source material.** Outputs are framed as informational analysis, not legal advice.

## Approach

**Primary (Approach A):** RAG over a curated open-data corpus (animallaw.info → CourtListener → CAP), embedded in pgvector, retrieved with jurisdiction-aware filtering, generated with Claude under a *cite-or-refuse* contract, with **per-citation verification against the retrieved corpus** before output. Differentiator vs. commercial tools: calibrated refusal and verified citations, addressing the exact failure mode the Stanford study identified.

**Backup (Approach B):** Add a citation/precedent-graph re-ranker on top of A if retrieval quality is insufficient by Day-8 self-audit. No architectural redesign — additive layer.

**Out of scope for the 14-day window:** fine-tuned legal models (Approach C), automated court filings, document-upload pipelines (Phase 2), multi-tenant workspaces (Phase 2).

## Risks (and how we address them)

| Risk | Mitigation |
|---|---|
| Hallucinated citations (Stanford-documented #1 trust-killer) | Cite-or-refuse prompt contract + post-generation citation verification against retrieved chunks; unverifiable claims dropped or labelled. |
| Scope creep across research / analytics / docs | Phase 1 strictly = retrieval + cited risk output. Document upload, workspaces, exports = Phase 2+. |
| Weak explainability | Surface retrieved sources, retrieval scores, jurisdictional match, and a single calibrated confidence band per output. |
| Prompt injection via documents | Out of scope this stage (no document upload yet). Designed-in for Phase 2. |
| UPL exposure / liability framing | Mentor question pending — disclaimer language must be lawyer-reviewed before any external pilot. |
| Dataset licensing | CAP is CC0 ✓; CourtListener terms verified ✓; animallaw.info needs explicit permission (action item this week); ALDF needs Open Paws intro. |

## External dependencies (procurement flags)

- **Anthropic API budget** — confirm with mentor.
- **CourtListener membership** — cheap (~$10/mo); proceed.
- **animallaw.info scraping permission** — email Prof. Favre / Wisch this week.
- **ALDF data access** — request Open Paws make the introduction.
- All other dependencies (pgvector, eyecite, embedding API) are commodity and procurement-free.

## "Done" (best current guess, pending mentor confirmation)

A runnable Phase-1 prototype demoed end-to-end to mentor on Day 14: ingests animallaw.info + a CourtListener slice, accepts a jurisdiction + claim + facts query, returns retrieved cases + a structured risk assessment + verified citations + a calibrated confidence band. No accounts, no doc upload, no multi-tenancy — those are Phase 2.

## Open questions blocking sharpened scope (for mentor)

1. "USA" — federal + 50 states, or federal-only for the prototype?
2. Phase 1 only inside the 14-day window, or further?
3. LLM/API budget envelope?
4. Pilot partner org identified?
5. UPL/disclaimer legal posture cleared?

Full 13-question list in `day1-absorb-brief.md`.

---

*Mentor sign-off below unlocks Stage 2 (Design & Architecture, Days 3–4).*

**Mentor sign-off:** ☐ approved ☐ revise — see comments
**Comments:**

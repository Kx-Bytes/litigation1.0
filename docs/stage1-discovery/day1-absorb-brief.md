# Day 1 — Absorb the Brief

**Project:** Litigation Prediction and Strategy (Open Paws RDP)
**Stage:** 1 — Discovery & Problem Framing
**Date:** 2026-05-23

---

## 1. Problem statement (in my own words)

Animal-advocacy nonprofits and legal clinics in the USA routinely make high-stakes decisions about whether and how to litigate, but they do it from a position of severe resource constraint. A small advocacy legal team might be weighing whether to file in California state court or the Ninth Circuit, deciding between settlement and trial, or hunting for the strongest precedents for a novel claim — all without the research budget or staff that a large law firm would bring to the same question.

This project builds an open-source, AI-powered platform that helps those teams turn case law, statutes, regulations, and their own uploaded documents into structured **risk assessments** and **strategic scenario analyses**. It is explicitly not legal advice, not a guaranteed outcome predictor, and not a replacement for a licensed attorney. It is a faster, more rigorous way to surface relevant precedent, score the difficulty of a claim, and compare strategic options against historical patterns.

**One-sentence framing:** Help small animal-advocacy legal teams decide where, when, and how to litigate by giving them traceable, jurisdiction-aware risk and precedent analysis grounded in real legal sources.

---

## 2. Who the user is

**Primary user:** Litigation counsel or policy/legal researcher at an animal-advocacy nonprofit (e.g., Animal Legal Defense Fund, smaller mission-driven legal clinics). They hold a JD or equivalent legal training. They are already comfortable reading case law and statutes; they do not need the tool to explain what a motion to dismiss is. They need it to find the five most analogous cases in their circuit, score the difficulty of a claim, and tell them honestly how confident the system is in its answer.

**Secondary users:** Campaign strategists and advocacy directors who care about prioritization across a portfolio of potential cases rather than the legal weeds of any single one.

**Explicitly not the user:** A self-represented party, a layperson seeking legal information, or a paralegal looking for document automation.

---

## 3. Assumptions in the brief

### Verifiable during Stage 1
- Users have baseline legal expertise → check via sample personas / 1–2 conversations with advocacy orgs.
- CourtListener and Caselaw Access Project are usable as primary data sources → check APIs, terms of service, and dataset licensing.
- Open-source vector DBs (pgvector, Weaviate) can carry the retrieval workload → check docs and estimate corpus size.
- RAG is the right architectural pattern → review published descriptions of Harvey, CoCounsel, Casetext, and recent legal-RAG papers.

### Need to ask mentor / stakeholders
- "USA" — federal only, or federal + 50 states? (Order-of-magnitude difference in data scope.)
- Is animal law a hard scope filter, or do we ingest broader US case law and filter at query time?
- Is "open-source deployment architecture" a hard requirement (must self-host end-to-end on day one) or a goal for eventual release?
- What is the development budget for paid APIs (LLM tokens, OCR, any paid legal databases)?
- Is there a pilot partner org already lined up for Stage 3 / Phase 3 testing?
- What hallucination rate is acceptable at launch — zero? Below a human-researcher baseline? Something else?
- Inside the 14-day intern window, are we scoping to Phase 1 (Research & Prototype) only, or pushing further into MVP?
- Security tier "High" — implement RBAC/audit logging in the prototype, or document the design for later?

### Unstated but worth raising
- **Unauthorized practice of law (UPL):** Even "informational" framing can trigger UPL concerns in some jurisdictions. Has Open Paws taken legal advice on disclaimer language?
- **Dataset licensing position:** The brief flags "Training on copyrighted or restricted legal databases" as a risk. Has Open Paws decided which datasets are permitted?
- **Liability posture:** If a user relies on a flawed output and loses a case, what's Open Paws' exposure as the platform provider?

---

## 4. Animal advocacy angle (one sentence)

By cutting research overhead and surfacing the strongest precedents for under-resourced legal teams, this platform lets animal-advocacy organizations file more of the *right* cases in the *right* venues — converting constrained legal capacity into more wins, more deterrence, and stronger legal protection for animals.

---

## 5. Question list for mentor (Day 1 EOD / next standup)

**Tactical scope**
1. "USA" — federal + 50 states, or federal-only for the prototype?
2. Animal-law focus — filter on a broader corpus, or curate a narrower animal-law corpus?
3. Is the open-source deployment requirement *hard* (self-hostable day one) or *eventual*?
4. Budget envelope for LLM/API costs during development?
5. Is there a target pilot partner org for Phase 3?

**Strategic / done-criteria**
6. Within the 14-day window, are we scoping to Phase 1 only, or aiming further?
7. Who is the "user" of the Week-2 deliverable — Open Paws leadership, a partner org, both?
8. What does "done" look like at end of Week 2 — mentor demo, runnable prototype, publishable artifact?
9. Who signs off — mentor only, or is there external review?
10. What is the smallest version of this that would still be useful (the MVP-of-the-MVP)?

**Risk and policy**
11. Has Open Paws cleared a legal/UPL position on disclaimers and output framing?
12. Which datasets are we cleared to ingest? (Caselaw Access Project is bulk-licensed; CourtListener has its own terms; ALDF materials may carry copyright constraints.)
13. If pilot testing surfaces a fabricated citation, what's the escalation path?

---

## Guiding questions answered

- **What does "done" look like?** Best current guess: a runnable Phase-1 prototype that can ingest a small slice of case law, do semantic retrieval over it, return cited results to a user query, produce a basic risk assessment for a scenario, and be demoed end-to-end to a mentor. Needs confirmation (Q8).
- **Who decides if it's done?** Mentor. Possibly an external Open Paws reviewer (Q9).
- **What's the smallest useful version?** A single jurisdiction (one circuit or one state), a curated subset of animal-law case law, semantic retrieval with verifiable citations, and a structured "risk factors" output. No user accounts, no multi-tenancy, no document upload yet — those land in Phase 2.

---

## EOD note — Day 1

- **Shipped:** Day 1 outputs above (problem, user, assumptions, advocacy angle, questions).
- **Stuck:** Nothing blocking. Several scope questions for mentor that, if answered before Day 2, will sharpen the solution-space exploration.
- **Tomorrow (Day 2):** Research 3–5 existing tools / papers / datasets in legal AI. Map 2–3 candidate solution approaches. Pick a primary + backup with written justification. List external dependencies (datasets, APIs, services) and flag anything that needs procurement. Roll Day 1 + Day 2 outputs into the one-page Project Discovery Note for mentor sign-off.

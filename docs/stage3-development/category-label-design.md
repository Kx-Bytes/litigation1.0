# Category Label System — Design Note

**Date:** 2026-05-26  
**Status:** Approved — implement during Group C  
**Scope:** Ingestion pipeline (C2) + Retrieval re-ranking (retriever.py addendum)

---

## Problem

The corpus is federal animal law cases only (SCOTUS + circuits). Even within that scope, a user asking about ag-gag laws shouldn't have their retrieval pool diluted by wildlife trafficking cases. Jurisdiction alone is not a sufficient filter — we need a second dimension: **topic category**.

---

## Decision: Soft Boost, Not Hard Filter

Two options were considered:

| Approach | How it works | Problem |
|---|---|---|
| Hard filter | `WHERE categories @> '["ag-gag"]'` — exclude non-matching docs | A mislabeled doc or wrong auto-detection = empty result set. Silent failure. |
| Soft boost | Retrieve full jurisdiction pool as usual, then re-rank — label-matching chunks float to the top | Wrong detection degrades ranking slightly; never breaks retrieval entirely. |

**Soft boost is the correct choice.** Labels are best-effort metadata. Making them a hard gate introduces a failure mode that's invisible to the user and worse than no filtering at all. Soft boost means the system always returns results, with the most topically relevant ones ranked highest.

---

## Taxonomy

13 labels covering the federal animal law space. Fixed at ingest time — do not expand without a migration and re-classification pass.

| Label | Covers |
|---|---|
| `ag-gag` | Ag-gag statutes, agricultural facility recording bans, whistleblower suppression |
| `standing` | Organizational/associational standing, injury-in-fact in animal cases, zone-of-interests |
| `animal-cruelty` | Federal cruelty statutes, crush video laws, AWA anti-cruelty provisions |
| `wildlife` | ESA, Migratory Bird Treaty Act, CITES, hunting/trapping on federal land |
| `factory-farming` | CAFO regulations, USDA/FSIS oversight, slaughter practices, Farm Bill |
| `personhood` | Animal legal personhood, habeas corpus petitions for animals |
| `first-amendment` | First Amendment challenges to ag-gag laws, expressive conduct, undercover investigations |
| `commerce-clause` | Dormant Commerce Clause challenges to state animal protection laws |
| `preemption` | Federal preemption of state animal protection statutes |
| `research-animals` | Animal Welfare Act lab provisions, IACUC, NIH-funded research animals |
| `entertainment` | Circuses, zoos, rodeos, AWA entertainment provisions, captive animal display |
| `transport` | Twenty-Eight Hour Law, USDA transport regulations, live animal shipping |
| `marine-mammals` | MMPA, dolphin/whale protection, captive display, Navy sonar cases |

A document can carry **1–3 labels** (JSONB array). Assigning more than 3 is a sign the case is genuinely cross-cutting — cap at 3 and pick the most prominent.

---

## Schema Change

Add one column to the `documents` table:

```sql
ALTER TABLE documents ADD COLUMN categories JSONB NOT NULL DEFAULT '[]';
CREATE INDEX idx_documents_categories ON documents USING GIN (categories);
```

This requires a new Alembic migration: `0002_add_document_categories.py`.

The `Document` ORM model gets:

```python
from sqlalchemy.dialects.postgresql import JSONB
categories: Mapped[list[str]] = mapped_column(JSONB, nullable=False, server_default="[]")
```

---

## Label Assignment at Ingest (C2 — parser.py)

During ingestion, after text normalization and eyecite extraction, make a single **Claude Haiku** call per document to assign labels.

### Prompt contract

```
You are classifying a federal animal law case for a retrieval system.

Given the case title, citation, and first 1500 characters of the opinion, 
assign 1–3 labels from this fixed list ONLY:
ag-gag, standing, animal-cruelty, wildlife, factory-farming, personhood,
first-amendment, commerce-clause, preemption, research-animals,
entertainment, transport, marine-mammals

Rules:
- Return a JSON array of strings. Example: ["ag-gag", "first-amendment"]
- Maximum 3 labels. Minimum 1.
- Use ONLY labels from the list above. No other values.
- If genuinely unclear, return ["animal-cruelty"] as the safest fallback.
```

Store the result in `Document.categories`. Log any response that fails JSON parsing or contains out-of-taxonomy labels — fall back to `["animal-cruelty"]` rather than crashing the pipeline.

### Cost note

Claude Haiku at ~$0.25/1M input tokens. A 1500-char excerpt ≈ 375 tokens. At 5,000 documents that's ~1.9M tokens ≈ **$0.47 total**. Negligible.

---

## Query-Time Flow

### Step 1 — Label detection

Before retrieval, call Haiku once on the user's query to detect likely labels:

```
Given this litigation query, which 1–2 labels from the list best describe it?
[same fixed taxonomy]
Query: "{claim} {facts[:300]}"
Return a JSON array. If uncertain, return [].
```

An empty array means "no label detected" — skip the boost entirely and return pure vector results.

### Step 2 — Retrieve (unchanged)

`retriever.retrieve()` runs as-is: jurisdiction-scoped top-k pgvector cosine search. No changes to this function.

### Step 3 — Re-rank by label overlap

After retrieval, apply a label boost to the similarity scores before returning to the generator:

```python
LABEL_BOOST = 0.05  # additive boost per matching label

def rerank_by_labels(
    chunks: list[RetrievedChunk],
    query_labels: list[str],
) -> list[RetrievedChunk]:
    if not query_labels:
        return chunks
    for chunk in chunks:
        doc_categories = chunk.categories  # list[str] from JOIN
        overlap = len(set(query_labels) & set(doc_categories))
        chunk.similarity += overlap * LABEL_BOOST
    return sorted(chunks, key=lambda c: c.similarity, reverse=True)
```

`LABEL_BOOST = 0.05` is a starting value — tunable. At top-1 similarity scores typically in the 0.75–0.92 range, a 0.05 boost per matching label is meaningful without overwhelming the vector signal.

### Step 4 — Surface detected labels to user (frontend, Group F)

The `QueryResponse` schema should include a `detected_labels` field so the frontend can show the user what the system inferred and offer an override dropdown. This keeps the system transparent and lets users correct misfires.

---

## What Changes in Each Group C Task

| Task | Change |
|---|---|
| C2 (parser.py) | Add `classify_document_labels()` — one Haiku call, returns `list[str]` |
| C2 (parser.py) | `ParsedDoc` dataclass gains a `categories: list[str]` field |
| C4 (embedder/ingest) | Write `categories` when inserting `Document` row |
| New migration | `0002_add_document_categories.py` — adds column + GIN index |

Retriever re-ranking (`rerank_by_labels`) is a small addendum to `retriever.py` — implemented alongside B5/B6 since it feeds into the generator pipeline, not during Group C.

---

## What Does NOT Change

- `retriever.retrieve()` — untouched. Jurisdiction-scoped pgvector search stays as-is.
- The confidence band logic — labels don't affect it.
- The cite-or-refuse prompt (B3) — labels are pre-retrieval metadata, invisible to the generator.
- The `chunks` table — labels live at document level only. Individual chunks inherit their document's categories via JOIN.

---

## Open Questions

- **Taxonomy drift**: if new doctrine areas emerge, re-labeling the corpus requires a Haiku re-classification pass + migration. Accept this cost — the taxonomy is small enough to be stable for v1.
- **Chunk-level labels**: future consideration. Some cases have a dissent in a different doctrine area than the majority. For v1, document-level labels are sufficient.
- **User override UX**: exact dropdown design is a Group F decision. This doc just requires `detected_labels: list[str]` in the `QueryResponse` schema.

"""
B3 — Generator.

Takes retrieved chunks + the user query and calls a Claude model via
OpenRouter under a strict cite-or-refuse contract enforced by function calling.

Cite-or-refuse contract
-----------------------
Claude is given two functions:
  submit_risk_assessment — requires every citation to be a chunk_id drawn from
    the retrieved set. The JSON schema enumerates valid chunk_ids at call time,
    so Claude CANNOT reference a chunk that wasn't retrieved.
  refuse_query — used when Claude (or the pre-call check) determines the corpus
    is too thin to answer reliably.

tool_choice="required" forces Claude to call exactly one of the two functions —
it cannot respond in free text and sneak in an unverified citation.

Refusal thresholds (pre-call, no LLM cost)
-------------------------------------------
  REFUSE_THRESHOLD    = 2   — refuse immediately if fewer than 2 chunks score
                              >= MIN_SIMILARITY. No LLM call made.
  UNCERTAIN_THRESHOLD = 4   — if 2–3 chunks score >= MIN_SIMILARITY, call Claude
                              but inject a thin-corpus warning into the prompt and
                              append an automatic uncertainty note to the output.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

import structlog
from openai import AsyncOpenAI

from app.core.config import settings
from app.services.retriever import RetrievedChunk

log = structlog.get_logger()

# ── Tuning constants ──────────────────────────────────────────────────────────

MIN_SIMILARITY      = 0.65   # cosine similarity floor for "on-point" chunk
REFUSE_THRESHOLD    = 2      # refuse if fewer than this many chunks meet MIN_SIMILARITY
UNCERTAIN_THRESHOLD = 4      # add uncertainty warning if fewer than this many chunks meet it

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


# ── Output data model ─────────────────────────────────────────────────────────

@dataclass
class RiskFactorOutput:
    label: str
    weight: str          # "high" | "medium" | "low"
    discussion: str
    chunk_ids: list[str] = field(default_factory=list)


@dataclass
class ComparableCaseOutput:
    chunk_id: str
    summary: str
    relevance: str


@dataclass
class GeneratorOutput:
    """
    Structured result from the generator, pre-citation-verification.

    If refused=True, only refusal_reason / refusal_suggestion are populated.
    The citation verifier (B4) operates on the chunk_ids in risk_factors and
    comparable_cases to produce the final verified / dropped split.
    """

    refused: bool = False
    refusal_reason: str | None = None
    refusal_suggestion: str | None = None

    risk_summary: str = ""
    risk_factors: list[RiskFactorOutput] = field(default_factory=list)
    comparable_cases: list[ComparableCaseOutput] = field(default_factory=list)
    strategic_considerations: list[str] = field(default_factory=list)
    uncertainty_notes: list[str] = field(default_factory=list)
    confidence_band: str = "low"   # "high" | "medium" | "low" | "refused"

    raw_model_output: str = ""
    model: str = ""


# ── Tool schema builder ───────────────────────────────────────────────────────

def _build_tools(valid_chunk_ids: list[str]) -> list[dict]:
    """
    Build the two OpenAI-format function schemas with valid_chunk_ids baked
    into the enum constraints. Called at query time so the enumeration is
    always current.
    """
    return [
        {
            "type": "function",
            "function": {
                "name": "submit_risk_assessment",
                "description": (
                    "Submit a structured litigation risk assessment grounded exclusively "
                    "in the retrieved case excerpts. Every chunk_id you reference MUST "
                    "appear in the provided valid_chunk_ids — do not invent or recall "
                    "any case not in that list."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "risk_summary": {
                            "type": "string",
                            "description": (
                                "Plain-language 2–4 sentence overview of overall litigation "
                                "risk, grounded in the retrieved cases."
                            ),
                        },
                        "risk_factors": {
                            "type": "array",
                            "description": (
                                "Individual risk factors. Each must be grounded in at least "
                                "one retrieved chunk."
                            ),
                            "items": {
                                "type": "object",
                                "properties": {
                                    "label": {
                                        "type": "string",
                                        "description": "Short factor name (e.g. 'Standing — injury-in-fact').",
                                    },
                                    "weight": {
                                        "type": "string",
                                        "enum": ["high", "medium", "low"],
                                        "description": "Severity of this risk factor.",
                                    },
                                    "discussion": {
                                        "type": "string",
                                        "description": (
                                            "1–3 sentence explanation drawn from the retrieved "
                                            "cases. Do not assert facts not in the excerpts."
                                        ),
                                    },
                                    "chunk_ids": {
                                        "type": "array",
                                        "items": {
                                            "type": "string",
                                            "enum": valid_chunk_ids,
                                        },
                                        "description": (
                                            "IDs of the retrieved chunks that support this "
                                            "factor. Must be non-empty."
                                        ),
                                        "minItems": 1,
                                    },
                                },
                                "required": ["label", "weight", "discussion", "chunk_ids"],
                            },
                        },
                        "comparable_cases": {
                            "type": "array",
                            "description": "Up to 5 most directly comparable cases from the retrieved chunks.",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "chunk_id": {
                                        "type": "string",
                                        "enum": valid_chunk_ids,
                                        "description": "ID of the retrieved chunk for this case.",
                                    },
                                    "summary": {
                                        "type": "string",
                                        "description": "1–2 sentence summary of the case and its outcome.",
                                    },
                                    "relevance": {
                                        "type": "string",
                                        "description": "One sentence: why this case is directly relevant to the query.",
                                    },
                                },
                                "required": ["chunk_id", "summary", "relevance"],
                            },
                            "maxItems": 5,
                        },
                        "strategic_considerations": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": (
                                "2–4 actionable observations for litigation counsel "
                                "(e.g. venue selection, framing, timing). Each grounded "
                                "in the retrieved precedent."
                            ),
                        },
                        "uncertainty_notes": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": (
                                "Honest caveats the user should know: corpus gaps, thin "
                                "precedent, unsettled doctrine, jurisdictional limits of "
                                "the retrieved cases."
                            ),
                        },
                        "confidence_band": {
                            "type": "string",
                            "enum": ["high", "medium", "low"],
                            "description": (
                                "Overall assessment confidence. "
                                "high = 4+ strong on-point precedents; "
                                "medium = 2–3 relevant cases with some indirection; "
                                "low = thin or only tangentially relevant precedent."
                            ),
                        },
                    },
                    "required": [
                        "risk_summary",
                        "risk_factors",
                        "comparable_cases",
                        "strategic_considerations",
                        "uncertainty_notes",
                        "confidence_band",
                    ],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "refuse_query",
                "description": (
                    "Refuse to produce an assessment if the retrieved corpus is too thin, "
                    "too indirect, or otherwise insufficient for a reliable answer. "
                    "Use this instead of guessing or hallucinating cases."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reason": {
                            "type": "string",
                            "description": (
                                "Plain-language explanation of why the query cannot be "
                                "answered reliably from the retrieved corpus."
                            ),
                        },
                        "suggestion": {
                            "type": "string",
                            "description": (
                                "Optional: what the user could try instead — e.g. broaden "
                                "jurisdiction, rephrase the claim, enable CourtListener."
                            ),
                        },
                    },
                    "required": ["reason"],
                },
            },
        },
    ]


# ── Prompt builder ────────────────────────────────────────────────────────────

def _build_prompt(
    jurisdiction: str,
    claim: str,
    facts: str,
    chunks: list[RetrievedChunk],
    thin_corpus: bool,
    procedural_posture: str | None = None,
) -> str:
    """
    Build the user-turn message with retrieved chunks embedded.
    """
    corpus_parts: list[str] = []
    for chunk in chunks:
        citation = chunk.citation or "citation unknown"
        corpus_parts.append(
            f"[chunk_id: {chunk.chunk_id}]\n"
            f"Citation:     {citation}\n"
            f"Jurisdiction: {chunk.jurisdiction}\n"
            f"Section:      {chunk.section_type or 'body'}\n"
            f"Similarity:   {chunk.similarity:.3f}\n"
            f"---\n"
            f"{chunk.text}"
        )

    corpus_block = "\n\n".join(corpus_parts)
    valid_ids_str = ", ".join(c.chunk_id for c in chunks)

    thin_warning = (
        "\n⚠️  THIN CORPUS WARNING: Fewer than 4 chunks meet the relevance threshold "
        "for this query. You MUST populate uncertainty_notes to reflect this limitation. "
        "If the corpus is insufficient even for a low-confidence assessment, call "
        "refuse_query instead.\n"
        if thin_corpus
        else ""
    )

    # Procedural posture line — only included when provided. It shapes which
    # legal standard applies (e.g. plausibility at MTD vs. no-genuine-dispute at SJ)
    # and should drive the framing of risk factors and strategic considerations.
    posture_line = (
        f"Procedural posture: {procedural_posture}\n"
        f"  (Tailor the risk analysis and strategic considerations to the legal standard "
        f"that applies at this stage — e.g. plausibility for MTD, no-genuine-dispute for "
        f"summary judgment, likelihood-of-success for preliminary injunction.)\n"
        if procedural_posture
        else ""
    )

    return (
        "You are a legal research assistant helping litigation counsel assess strategic risk.\n"
        "You are NOT providing legal advice. You are producing an informational risk "
        "assessment grounded ONLY in the case excerpts retrieved below.\n"
        "You must NOT invent, hallucinate, or recall any case not present in the "
        "retrieved corpus. Every chunk_id you reference must be from this list:\n"
        f"  {valid_ids_str}\n"
        f"{thin_warning}\n"
        "## Query\n\n"
        f"Jurisdiction: {jurisdiction}\n"
        f"Legal claim:  {claim}\n"
        f"{posture_line}"
        f"Facts:        {facts}\n\n"
        "## Retrieved case excerpts\n\n"
        f"{corpus_block}\n\n"
        "## Instructions\n\n"
        "Analyze the query against the retrieved excerpts above.\n"
        "Call `submit_risk_assessment` with your structured assessment, "
        "or `refuse_query` if the corpus is insufficient to answer reliably.\n"
        "Do not reference any case not in the retrieved excerpts above."
    )


# ── Pre-call refusal helpers ──────────────────────────────────────────────────

def _count_above_threshold(chunks: list[RetrievedChunk]) -> int:
    """Return the number of chunks whose similarity meets MIN_SIMILARITY."""
    return sum(1 for c in chunks if c.similarity >= MIN_SIMILARITY)


def _pre_call_refusal(chunks: list[RetrievedChunk]) -> GeneratorOutput | None:
    """
    Check thresholds before spending an LLM call.
    Returns a refusal GeneratorOutput if the corpus is too thin, else None.
    """
    above = _count_above_threshold(chunks)
    if above < REFUSE_THRESHOLD:
        log.info(
            "generator_pre_call_refusal",
            above_threshold=above,
            refuse_threshold=REFUSE_THRESHOLD,
        )
        return GeneratorOutput(
            refused=True,
            refusal_reason=(
                f"The local corpus contains only {above} case(s) with similarity "
                f"≥ {MIN_SIMILARITY} for this query — below the minimum of "
                f"{REFUSE_THRESHOLD} needed for a reliable assessment."
            ),
            refusal_suggestion=(
                "Try broadening the jurisdiction (e.g. query 'US' to include all "
                "federal circuits), rephrasing the legal claim, or enabling the "
                "CourtListener gap-fill toggle to pull recent cases."
            ),
            confidence_band="refused",
        )
    return None


# ── OpenAI client (module-level, lazy) ───────────────────────────────────────

_openai_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(
            api_key=settings.openrouter_api_key,
            base_url=OPENROUTER_BASE_URL,
        )
    return _openai_client


# ── Main entry point ──────────────────────────────────────────────────────────

async def generate(
    jurisdiction: str,
    claim: str,
    facts: str,
    chunks: list[RetrievedChunk],
    procedural_posture: str | None = None,
) -> GeneratorOutput:
    """
    Generate a structured risk assessment from retrieved chunks.

    Pipeline:
      1. Pre-call refusal check (avoids LLM cost on thin corpus).
      2. Build function schemas with chunk_ids locked to retrieved set.
      3. Build prompt with embedded chunk context.
      4. Call model via OpenRouter with tool_choice="required".
      5. Parse the function call result into GeneratorOutput.
    """
    model = settings.openrouter_model

    # ── 1. Pre-call refusal ───────────────────────────────────────────────────
    early_refusal = _pre_call_refusal(chunks)
    if early_refusal:
        early_refusal.model = model
        return early_refusal

    above = _count_above_threshold(chunks)
    thin_corpus = above < UNCERTAIN_THRESHOLD

    valid_chunk_ids = [c.chunk_id for c in chunks]
    tools  = _build_tools(valid_chunk_ids)
    prompt = _build_prompt(jurisdiction, claim, facts, chunks, thin_corpus, procedural_posture)

    log.info(
        "generator_call_start",
        model=model,
        total_chunks=len(chunks),
        above_threshold=above,
        thin_corpus=thin_corpus,
    )

    # ── 2. Call model via OpenRouter ──────────────────────────────────────────
    client = _get_client()
    response = await client.chat.completions.create(
        model=model,
        max_tokens=4096,
        tools=tools,
        tool_choice="required",   # must call one of the two functions
        messages=[{"role": "user", "content": prompt}],
    )

    message = response.choices[0].message
    raw_output = str(message)

    # ── 3. Extract function call ──────────────────────────────────────────────
    tool_call = (
        message.tool_calls[0]
        if message.tool_calls
        else None
    )

    if tool_call is None:
        log.error("generator_no_function_call", raw=raw_output[:300])
        return GeneratorOutput(
            refused=True,
            refusal_reason="Generator did not return a structured function response.",
            confidence_band="refused",
            raw_model_output=raw_output,
            model=model,
        )

    tool_name  = tool_call.function.name
    tool_input = json.loads(tool_call.function.arguments)

    log.info("generator_function_called", function=tool_name)

    # ── 4. Refusal path ───────────────────────────────────────────────────────
    if tool_name == "refuse_query":
        return GeneratorOutput(
            refused=True,
            refusal_reason=tool_input.get("reason", "Model declined to produce an assessment."),
            refusal_suggestion=tool_input.get("suggestion"),
            confidence_band="refused",
            raw_model_output=raw_output,
            model=model,
        )

    # ── 5. Assessment path ────────────────────────────────────────────────────
    risk_factors: list[RiskFactorOutput] = [
        RiskFactorOutput(
            label=f["label"],
            weight=f["weight"],
            discussion=f["discussion"],
            chunk_ids=f.get("chunk_ids", []),
        )
        for f in tool_input.get("risk_factors", [])
    ]

    comparable_cases: list[ComparableCaseOutput] = [
        ComparableCaseOutput(
            chunk_id=c["chunk_id"],
            summary=c["summary"],
            relevance=c["relevance"],
        )
        for c in tool_input.get("comparable_cases", [])
    ]

    auto_notes: list[str] = []
    if thin_corpus:
        auto_notes.append(
            f"Only {above} case(s) with similarity ≥ {MIN_SIMILARITY} were found in "
            "the local corpus for this query. Assessment confidence is limited — "
            "consider enabling CourtListener for broader coverage."
        )
    uncertainty_notes = auto_notes + tool_input.get("uncertainty_notes", [])

    log.info(
        "generator_complete",
        risk_factors=len(risk_factors),
        comparable_cases=len(comparable_cases),
        confidence_band=tool_input.get("confidence_band"),
        uncertainty_notes=len(uncertainty_notes),
    )

    return GeneratorOutput(
        refused=False,
        risk_summary=tool_input.get("risk_summary", ""),
        risk_factors=risk_factors,
        comparable_cases=comparable_cases,
        strategic_considerations=tool_input.get("strategic_considerations", []),
        uncertainty_notes=uncertainty_notes,
        confidence_band=tool_input.get("confidence_band", "low"),
        raw_model_output=raw_output,
        model=model,
    )

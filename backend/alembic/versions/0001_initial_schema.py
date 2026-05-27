"""Initial schema — all 5 tables + pgvector extension.

Revision ID: 0001
Revises: —
Create Date: 2026-05-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension (idempotent)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ── documents ──────────────────────────────────────────────────────────────
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source", sa.String(64), nullable=False),
        sa.Column("source_id", sa.Text, nullable=False),
        sa.Column("doc_type", sa.String(32), nullable=False),
        sa.Column("jurisdiction", sa.String(64), nullable=False),
        sa.Column("court", sa.Text, nullable=True),
        sa.Column("decision_date", sa.Date, nullable=True),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("citation", sa.Text, nullable=True),
        sa.Column("full_text", sa.Text, nullable=False),
        sa.Column("source_url", sa.Text, nullable=True),
        sa.Column("metadata", postgresql.JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("source", "source_id", name="uq_documents_source_source_id"),
    )
    op.create_index("ix_documents_jurisdiction", "documents", ["jurisdiction"])
    op.create_index("ix_documents_decision_date", "documents", ["decision_date"])

    # ── chunks ─────────────────────────────────────────────────────────────────
    op.create_table(
        "chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chunk_index", sa.Integer, nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        # vector(1024) — voyage-3-large output dimension
        sa.Column("embedding", sa.Text, nullable=True),   # placeholder; overridden below
        sa.Column("section_type", sa.String(32), nullable=True),
        sa.Column("start_char", sa.Integer, nullable=True),
        sa.Column("end_char", sa.Integer, nullable=True),
        sa.Column("metadata", postgresql.JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    # Replace Text placeholder with real vector column
    op.execute("ALTER TABLE chunks DROP COLUMN embedding")
    op.execute("ALTER TABLE chunks ADD COLUMN embedding vector(1024)")

    op.create_index("ix_chunks_document_id", "chunks", ["document_id"])
    # HNSW index for fast ANN search on embeddings
    op.execute(
        "CREATE INDEX ix_chunks_embedding_hnsw ON chunks "
        "USING hnsw (embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )

    # ── queries ────────────────────────────────────────────────────────────────
    op.create_table(
        "queries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("jurisdiction", sa.String(64), nullable=False),
        sa.Column("claim", sa.Text, nullable=False),
        sa.Column("facts", sa.Text, nullable=False),
        sa.Column("raw_request", postgresql.JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # ── query_results ──────────────────────────────────────────────────────────
    op.create_table(
        "query_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "query_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("queries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "retrieved_chunk_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=True,
        ),
        sa.Column("model_id", sa.String(128), nullable=True),
        sa.Column("raw_model_output", sa.Text, nullable=True),
        sa.Column("verified_citations", postgresql.JSONB, nullable=True),
        sa.Column("dropped_citations", postgresql.JSONB, nullable=True),
        sa.Column("output", postgresql.JSONB, nullable=True),
        sa.Column("confidence_band", sa.String(16), nullable=True),
        sa.Column("latency_ms", sa.Integer, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_query_results_query_id", "query_results", ["query_id"])

    # ── citations ──────────────────────────────────────────────────────────────
    op.create_table(
        "citations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("normalized_cite", sa.Text, nullable=False),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("extracted_by", sa.String(64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_citations_normalized_cite", "citations", ["normalized_cite"])
    op.create_index("ix_citations_document_id", "citations", ["document_id"])


def downgrade() -> None:
    op.drop_table("citations")
    op.drop_table("query_results")
    op.drop_table("queries")
    op.drop_table("chunks")
    op.drop_table("documents")
    op.execute("DROP EXTENSION IF EXISTS vector")

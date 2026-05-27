"""ORM models: queries and query_results tables."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Query(Base):
    __tablename__ = "queries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    jurisdiction: Mapped[str] = mapped_column(String(64), nullable=False)
    claim: Mapped[str] = mapped_column(Text, nullable=False)
    facts: Mapped[str] = mapped_column(Text, nullable=False)
    raw_request: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Year-based date range requested by the user (both nullable = no filter).
    date_from_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    date_to_year: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    results: Mapped[list["QueryResult"]] = relationship(
        "QueryResult", back_populates="query", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Query {self.id} jurisdiction={self.jurisdiction!r}>"


class QueryResult(Base):
    __tablename__ = "query_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    query_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("queries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    retrieved_chunk_ids: Mapped[list[uuid.UUID] | None] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=True
    )
    model_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    raw_model_output: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified_citations: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    dropped_citations: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    output: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    confidence_band: Mapped[str | None] = mapped_column(String(16), nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    query: Mapped["Query"] = relationship("Query", back_populates="results")

    def __repr__(self) -> str:
        return f"<QueryResult {self.id} band={self.confidence_band!r}>"

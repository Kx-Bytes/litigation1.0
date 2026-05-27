"""ORM model: documents table."""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    source_id: Mapped[str] = mapped_column(Text, nullable=False)
    doc_type: Mapped[str] = mapped_column(String(32), nullable=False)
    jurisdiction: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    court: Mapped[str | None] = mapped_column(Text, nullable=True)
    decision_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    citation: Mapped[str | None] = mapped_column(Text, nullable=True)
    full_text: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    # Topic labels assigned by Claude Haiku at ingest (soft-boost retrieval).
    # Values come from the fixed 13-label taxonomy in category-label-design.md.
    categories: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # relationships
    chunks: Mapped[list["Chunk"]] = relationship(  # noqa: F821
        "Chunk", back_populates="document", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Document {self.citation or self.title!r}>"

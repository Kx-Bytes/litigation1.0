"""Add categories JSONB column to documents table.

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add categories as a JSONB array, defaulting to empty array.
    # GIN index enables fast containment queries (@>) if ever needed.
    op.add_column(
        "documents",
        sa.Column(
            "categories",
            postgresql.JSONB,
            nullable=False,
            server_default="[]",
        ),
    )
    op.execute(
        "CREATE INDEX ix_documents_categories_gin ON documents USING GIN (categories)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_documents_categories_gin")
    op.drop_column("documents", "categories")

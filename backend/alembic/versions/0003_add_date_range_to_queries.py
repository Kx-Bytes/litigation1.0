"""Add date_from_year and date_to_year columns to queries table.

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Store the year range the user requested so every query is fully auditable.
    # NULL means "no filter applied" for that bound.
    op.add_column(
        "queries",
        sa.Column("date_from_year", sa.Integer, nullable=True),
    )
    op.add_column(
        "queries",
        sa.Column("date_to_year", sa.Integer, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("queries", "date_to_year")
    op.drop_column("queries", "date_from_year")

"""add parliamentary metadata to politicians

Revision ID: 0004_parliamentary_data
Revises: 0003_politician_life_fields
Create Date: 2026-02-25 22:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "0004_parliamentary_data"
down_revision: Union[str, None] = "0003_politician_life_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("politicians", sa.Column("constituency", sa.String(length=150), nullable=True))
    op.add_column("politicians", sa.Column("parliamentary_role", sa.String(length=100), nullable=True))
    op.add_column("politicians", sa.Column("parliamentary_profile_url", sa.Text(), nullable=True))
    op.add_column("politicians", sa.Column("parliamentary_profile", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.create_index("ix_politicians_constituency", "politicians", ["constituency"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_politicians_constituency", table_name="politicians")
    op.drop_column("politicians", "parliamentary_profile")
    op.drop_column("politicians", "parliamentary_profile_url")
    op.drop_column("politicians", "parliamentary_role")
    op.drop_column("politicians", "constituency")

"""add politician life status and history fields

Revision ID: 0003_politician_life_fields
Revises: 0002_case_number_non_unique
Create Date: 2026-02-25 21:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0003_politician_life_fields"
down_revision: Union[str, None] = "0002_case_number_non_unique"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("politicians", sa.Column("history", sa.Text(), nullable=True))
    op.add_column("politicians", sa.Column("date_of_death", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("politicians", "date_of_death")
    op.drop_column("politicians", "history")

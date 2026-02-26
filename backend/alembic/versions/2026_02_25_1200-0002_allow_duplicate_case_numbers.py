"""allow duplicate case numbers across politicians

Revision ID: 0002_case_number_non_unique
Revises: 0001_phase1_mvp
Create Date: 2026-02-25 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0002_case_number_non_unique"
down_revision: Union[str, None] = "0001_phase1_mvp"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE legal_cases DROP CONSTRAINT IF EXISTS legal_cases_case_number_key")
    op.execute("CREATE INDEX IF NOT EXISTS ix_legal_cases_case_number ON legal_cases (case_number)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_legal_cases_case_number")
    op.create_unique_constraint("legal_cases_case_number_key", "legal_cases", ["case_number"])

"""initial phase 1 schema

Revision ID: 0001_phase1_mvp
Revises:
Create Date: 2026-02-24 14:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "0001_phase1_mvp"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    user_role_enum = postgresql.ENUM("user", "moderator", "admin", name="userrole", create_type=False)
    case_status_enum = postgresql.ENUM(
        "pending", "ongoing", "resolved", "dismissed", "appealed", name="casestatus", create_type=False
    )
    case_severity_enum = postgresql.ENUM("low", "medium", "high", "critical", name="caseseverity", create_type=False)
    promise_status_enum = postgresql.ENUM(
        "pending",
        "in_progress",
        "fulfilled",
        "broken",
        "partially_fulfilled",
        name="promisestatus",
        create_type=False,
    )
    linked_entity_type_enum = postgresql.ENUM(
        "person",
        "company",
        "organization",
        "government_entity",
        name="linkedentitytype",
        create_type=False,
    )
    report_status_enum = postgresql.ENUM(
        "under_review",
        "investigating",
        "verified",
        "dismissed",
        "resolved",
        name="reportstatus",
        create_type=False,
    )
    report_priority_enum = postgresql.ENUM("low", "medium", "high", "critical", name="reportpriority", create_type=False)

    bind = op.get_bind()
    user_role_enum.create(bind, checkfirst=True)
    case_status_enum.create(bind, checkfirst=True)
    case_severity_enum.create(bind, checkfirst=True)
    promise_status_enum.create(bind, checkfirst=True)
    linked_entity_type_enum.create(bind, checkfirst=True)
    report_status_enum.create(bind, checkfirst=True)
    report_priority_enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("role", user_role_enum, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False),
        sa.Column("verification_token", sa.String(length=255), nullable=True),
        sa.Column("phone_number", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=False)

    op.create_table(
        "politicians",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("position", sa.String(length=255), nullable=False),
        sa.Column("party", sa.String(length=100), nullable=True),
        sa.Column("county", sa.String(length=100), nullable=True),
        sa.Column("photo_url", sa.Text(), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("education", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("contact_info", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("social_media", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("transparency_score", sa.DECIMAL(precision=5, scale=2), nullable=False),
        sa.Column("confidence_level", sa.DECIMAL(precision=5, scale=2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_politicians_name", "politicians", ["name"], unique=False)
    op.create_index("ix_politicians_party", "politicians", ["party"], unique=False)
    op.create_index("ix_politicians_county", "politicians", ["county"], unique=False)

    op.create_table(
        "legal_cases",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("politician_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("case_number", sa.String(length=100), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("court", sa.String(length=255), nullable=True),
        sa.Column("status", case_status_enum, nullable=False),
        sa.Column("date_filed", sa.Date(), nullable=True),
        sa.Column("date_resolved", sa.Date(), nullable=True),
        sa.Column("severity", case_severity_enum, nullable=True),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("outcome", sa.Text(), nullable=True),
        sa.Column("source_urls", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("impact_score", sa.DECIMAL(precision=5, scale=2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["politician_id"], ["politicians.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("case_number"),
    )
    op.create_index("ix_legal_cases_politician_id", "legal_cases", ["politician_id"], unique=False)
    op.create_index("ix_legal_cases_status", "legal_cases", ["status"], unique=False)

    op.create_table(
        "promises",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("politician_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("date_made", sa.Date(), nullable=False),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("status", promise_status_enum, nullable=False),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("evidence", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("fulfillment_percentage", sa.Integer(), nullable=False),
        sa.Column("verification_sources", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("impact_area", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["politician_id"], ["politicians.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_promises_politician_id", "promises", ["politician_id"], unique=False)
    op.create_index("ix_promises_status", "promises", ["status"], unique=False)

    op.create_table(
        "political_linkages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("politician_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("linked_entity_type", linked_entity_type_enum, nullable=False),
        sa.Column("linked_entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("linked_entity_name", sa.String(length=255), nullable=False),
        sa.Column("relationship_type", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("strength", sa.DECIMAL(precision=3, scale=2), nullable=False),
        sa.Column("evidence", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_verified", sa.Boolean(), nullable=False),
        sa.Column("date_established", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["politician_id"], ["politicians.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_political_linkages_politician_id", "political_linkages", ["politician_id"], unique=False)
    op.create_index(
        "ix_political_linkages_linked_entity_type",
        "political_linkages",
        ["linked_entity_type"],
        unique=False,
    )

    op.create_table(
        "flagged_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("politician_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reporter_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("issue_type", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", report_status_enum, nullable=False),
        sa.Column("priority", report_priority_enum, nullable=False),
        sa.Column("evidence_files", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("incident_date", sa.Date(), nullable=True),
        sa.Column("is_anonymous", sa.Boolean(), nullable=False),
        sa.Column("date_reported", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("investigation_timeline", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("resolution", sa.Text(), nullable=True),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["politician_id"], ["politicians.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_flagged_reports_politician_id", "flagged_reports", ["politician_id"], unique=False)
    op.create_index("ix_flagged_reports_status", "flagged_reports", ["status"], unique=False)
    op.create_index("ix_flagged_reports_priority", "flagged_reports", ["priority"], unique=False)
    op.create_index("ix_flagged_reports_date_reported", "flagged_reports", ["date_reported"], unique=False)

    op.create_table(
        "score_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("politician_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("transparency_score", sa.DECIMAL(precision=5, scale=2), nullable=False),
        sa.Column("score_breakdown", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("factors_analyzed", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("calculation_method", sa.String(length=50), nullable=True),
        sa.Column("calculated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["politician_id"], ["politicians.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_score_history_politician_id", "score_history", ["politician_id"], unique=False)
    op.create_index("ix_score_history_calculated_at", "score_history", ["calculated_at"], unique=False)

    op.create_table(
        "news_mentions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("politician_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("source", sa.String(length=255), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("content_summary", sa.Text(), nullable=True),
        sa.Column("sentiment", sa.DECIMAL(precision=3, scale=2), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scraped_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("relevance_score", sa.DECIMAL(precision=3, scale=2), nullable=True),
        sa.ForeignKeyConstraint(["politician_id"], ["politicians.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_news_mentions_politician_id", "news_mentions", ["politician_id"], unique=False)
    op.create_index("ix_news_mentions_published_at", "news_mentions", ["published_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_news_mentions_published_at", table_name="news_mentions")
    op.drop_index("ix_news_mentions_politician_id", table_name="news_mentions")
    op.drop_table("news_mentions")

    op.drop_index("ix_score_history_calculated_at", table_name="score_history")
    op.drop_index("ix_score_history_politician_id", table_name="score_history")
    op.drop_table("score_history")

    op.drop_index("ix_flagged_reports_date_reported", table_name="flagged_reports")
    op.drop_index("ix_flagged_reports_priority", table_name="flagged_reports")
    op.drop_index("ix_flagged_reports_status", table_name="flagged_reports")
    op.drop_index("ix_flagged_reports_politician_id", table_name="flagged_reports")
    op.drop_table("flagged_reports")

    op.drop_index("ix_political_linkages_linked_entity_type", table_name="political_linkages")
    op.drop_index("ix_political_linkages_politician_id", table_name="political_linkages")
    op.drop_table("political_linkages")

    op.drop_index("ix_promises_status", table_name="promises")
    op.drop_index("ix_promises_politician_id", table_name="promises")
    op.drop_table("promises")

    op.drop_index("ix_legal_cases_status", table_name="legal_cases")
    op.drop_index("ix_legal_cases_politician_id", table_name="legal_cases")
    op.drop_table("legal_cases")

    op.drop_index("ix_politicians_county", table_name="politicians")
    op.drop_index("ix_politicians_party", table_name="politicians")
    op.drop_index("ix_politicians_name", table_name="politicians")
    op.drop_table("politicians")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS reportpriority")
    op.execute("DROP TYPE IF EXISTS reportstatus")
    op.execute("DROP TYPE IF EXISTS linkedentitytype")
    op.execute("DROP TYPE IF EXISTS promisestatus")
    op.execute("DROP TYPE IF EXISTS caseseverity")
    op.execute("DROP TYPE IF EXISTS casestatus")
    op.execute("DROP TYPE IF EXISTS userrole")

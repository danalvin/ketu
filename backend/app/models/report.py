from sqlalchemy import Column, String, Text, Date, DateTime, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from app.database import Base


class ReportStatus(str, enum.Enum):
    """Report status enumeration."""
    UNDER_REVIEW = "under_review"
    INVESTIGATING = "investigating"
    VERIFIED = "verified"
    DISMISSED = "dismissed"
    RESOLVED = "resolved"


class ReportPriority(str, enum.Enum):
    """Report priority enumeration."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class FlaggedReport(Base):
    """Flagged report model."""

    __tablename__ = "flagged_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    politician_id = Column(UUID(as_uuid=True), ForeignKey("politicians.id", ondelete="CASCADE"), nullable=False, index=True)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    issue_type = Column(String(100), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(SQLEnum(ReportStatus), nullable=False, default=ReportStatus.UNDER_REVIEW, index=True)
    priority = Column(SQLEnum(ReportPriority), nullable=False, default=ReportPriority.MEDIUM, index=True)
    evidence_files = Column(JSONB, nullable=True)
    location = Column(String(255), nullable=True)
    incident_date = Column(Date, nullable=True)
    is_anonymous = Column(Boolean, default=False, nullable=False)
    date_reported = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    investigation_timeline = Column(JSONB, nullable=True)
    resolution = Column(Text, nullable=True)
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    politician = relationship("Politician", back_populates="reports")

    def __repr__(self):
        return f"<FlaggedReport(id={self.id}, title={self.title}, status={self.status})>"

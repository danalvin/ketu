from sqlalchemy import Column, String, Text, Date, DateTime, DECIMAL, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from app.database import Base


class CaseStatus(str, enum.Enum):
    """Legal case status enumeration."""
    PENDING = "pending"
    ONGOING = "ongoing"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"
    APPEALED = "appealed"


class CaseSeverity(str, enum.Enum):
    """Legal case severity enumeration."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class LegalCase(Base):
    """Legal case model."""

    __tablename__ = "legal_cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    politician_id = Column(UUID(as_uuid=True), ForeignKey("politicians.id", ondelete="CASCADE"), nullable=False, index=True)
    case_number = Column(String(100), unique=True, nullable=True)
    title = Column(String(500), nullable=False)
    court = Column(String(255), nullable=True)
    status = Column(SQLEnum(CaseStatus), nullable=False, default=CaseStatus.PENDING, index=True)
    date_filed = Column(Date, nullable=True)
    date_resolved = Column(Date, nullable=True)
    severity = Column(SQLEnum(CaseSeverity), nullable=True)
    category = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    outcome = Column(Text, nullable=True)
    source_urls = Column(JSONB, nullable=True)
    impact_score = Column(DECIMAL(5, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    politician = relationship("Politician", back_populates="cases")

    def __repr__(self):
        return f"<LegalCase(id={self.id}, title={self.title}, status={self.status})>"

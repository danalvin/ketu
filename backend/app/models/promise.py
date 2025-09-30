from sqlalchemy import Column, String, Text, Date, DateTime, Integer, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from app.database import Base


class PromiseStatus(str, enum.Enum):
    """Promise status enumeration."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    FULFILLED = "fulfilled"
    BROKEN = "broken"
    PARTIALLY_FULFILLED = "partially_fulfilled"


class Promise(Base):
    """Promise model."""

    __tablename__ = "promises"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    politician_id = Column(UUID(as_uuid=True), ForeignKey("politicians.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    date_made = Column(Date, nullable=False)
    deadline = Column(Date, nullable=True)
    status = Column(SQLEnum(PromiseStatus), nullable=False, default=PromiseStatus.PENDING, index=True)
    category = Column(String(100), nullable=True)
    evidence = Column(JSONB, nullable=True)
    fulfillment_percentage = Column(Integer, default=0, nullable=False)
    verification_sources = Column(JSONB, nullable=True)
    impact_area = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    politician = relationship("Politician", back_populates="promises")

    def __repr__(self):
        return f"<Promise(id={self.id}, title={self.title}, status={self.status})>"

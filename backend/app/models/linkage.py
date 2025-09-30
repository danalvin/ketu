from sqlalchemy import Column, String, Text, Date, DateTime, DECIMAL, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from app.database import Base


class LinkedEntityType(str, enum.Enum):
    """Linked entity type enumeration."""
    PERSON = "person"
    COMPANY = "company"
    ORGANIZATION = "organization"
    GOVERNMENT_ENTITY = "government_entity"


class PoliticalLinkage(Base):
    """Political linkage model."""

    __tablename__ = "political_linkages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    politician_id = Column(UUID(as_uuid=True), ForeignKey("politicians.id", ondelete="CASCADE"), nullable=False, index=True)
    linked_entity_type = Column(SQLEnum(LinkedEntityType), nullable=False, index=True)
    linked_entity_id = Column(UUID(as_uuid=True), nullable=True)
    linked_entity_name = Column(String(255), nullable=False)
    relationship_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    strength = Column(DECIMAL(3, 2), default=0.50, nullable=False)
    evidence = Column(JSONB, nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    date_established = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    politician = relationship("Politician", back_populates="linkages")

    def __repr__(self):
        return f"<PoliticalLinkage(id={self.id}, politician_id={self.politician_id}, entity={self.linked_entity_name})>"

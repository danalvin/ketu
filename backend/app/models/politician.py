from sqlalchemy import Column, String, Text, Date, Boolean, DateTime, DECIMAL
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from app.database import Base


class Politician(Base):
    """Politician model."""

    __tablename__ = "politicians"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    position = Column(String(255), nullable=False)
    party = Column(String(100), nullable=True, index=True)
    county = Column(String(100), nullable=True, index=True)
    photo_url = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    education = Column(JSONB, nullable=True)
    contact_info = Column(JSONB, nullable=True)
    social_media = Column(JSONB, nullable=True)
    transparency_score = Column(DECIMAL(5, 2), default=0.00, nullable=False)
    confidence_level = Column(DECIMAL(5, 2), default=0.00, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    cases = relationship("LegalCase", back_populates="politician", cascade="all, delete-orphan")
    promises = relationship("Promise", back_populates="politician", cascade="all, delete-orphan")
    linkages = relationship("PoliticalLinkage", back_populates="politician", cascade="all, delete-orphan")
    reports = relationship("FlaggedReport", back_populates="politician", cascade="all, delete-orphan")
    score_history = relationship("ScoreHistory", back_populates="politician", cascade="all, delete-orphan")
    news_mentions = relationship("NewsMention", back_populates="politician", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Politician(id={self.id}, name={self.name}, position={self.position})>"

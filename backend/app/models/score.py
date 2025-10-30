from sqlalchemy import Column, String, DateTime, DECIMAL, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from app.database import Base


class ScoreHistory(Base):
    """Score history model to track transparency score changes over time."""

    __tablename__ = "score_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    politician_id = Column(UUID(as_uuid=True), ForeignKey("politicians.id", ondelete="CASCADE"), nullable=False, index=True)
    transparency_score = Column(DECIMAL(5, 2), nullable=False)
    score_breakdown = Column(JSONB, nullable=False)
    factors_analyzed = Column(JSONB, nullable=True)
    calculation_method = Column(String(50), nullable=True)
    calculated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Relationships
    politician = relationship("Politician", back_populates="score_history")

    def __repr__(self):
        return f"<ScoreHistory(id={self.id}, politician_id={self.politician_id}, score={self.transparency_score})>"

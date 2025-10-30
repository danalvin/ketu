from sqlalchemy import Column, String, Text, DateTime, DECIMAL, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from app.database import Base


class NewsMention(Base):
    """News mention model to track media coverage of politicians."""

    __tablename__ = "news_mentions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    politician_id = Column(UUID(as_uuid=True), ForeignKey("politicians.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    source = Column(String(255), nullable=False)
    url = Column(Text, nullable=False)
    content_summary = Column(Text, nullable=True)
    sentiment = Column(DECIMAL(3, 2), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=False, index=True)
    scraped_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    relevance_score = Column(DECIMAL(3, 2), nullable=True)

    # Relationships
    politician = relationship("Politician", back_populates="news_mentions")

    def __repr__(self):
        return f"<NewsMention(id={self.id}, title={self.title}, source={self.source})>"

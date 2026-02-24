from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import date, datetime
from uuid import UUID
from app.models.promise import PromiseStatus


class PromiseBase(BaseModel):
    """Base promise schema."""
    title: str = Field(..., min_length=1, max_length=500)
    description: str = Field(..., min_length=1)
    date_made: date
    deadline: Optional[date] = None
    status: PromiseStatus
    category: Optional[str] = Field(None, max_length=100)
    evidence: Optional[Dict[str, Any]] = None
    fulfillment_percentage: int = Field(0, ge=0, le=100)
    verification_sources: Optional[List[str]] = None
    impact_area: Optional[str] = Field(None, max_length=100)


class PromiseCreate(PromiseBase):
    """Schema for creating a promise."""
    politician_id: UUID


class PromiseUpdate(BaseModel):
    """Schema for updating a promise."""
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = Field(None, min_length=1)
    date_made: Optional[date] = None
    deadline: Optional[date] = None
    status: Optional[PromiseStatus] = None
    category: Optional[str] = Field(None, max_length=100)
    evidence: Optional[Dict[str, Any]] = None
    fulfillment_percentage: Optional[int] = Field(None, ge=0, le=100)
    verification_sources: Optional[List[str]] = None
    impact_area: Optional[str] = Field(None, max_length=100)


class PromiseResponse(PromiseBase):
    """Schema for promise response."""
    id: UUID
    politician_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from app.models.case import CaseStatus, CaseSeverity


class LegalCaseBase(BaseModel):
    """Base legal case schema."""
    case_number: Optional[str] = Field(None, max_length=100)
    title: str = Field(..., min_length=1, max_length=500)
    court: Optional[str] = Field(None, max_length=255)
    status: CaseStatus
    date_filed: Optional[date] = None
    date_resolved: Optional[date] = None
    severity: Optional[CaseSeverity] = None
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    outcome: Optional[str] = None
    source_urls: Optional[List[str]] = None
    impact_score: Optional[Decimal] = Field(None, ge=0, le=100)


class LegalCaseCreate(LegalCaseBase):
    """Schema for creating a legal case."""
    politician_id: UUID


class LegalCaseUpdate(BaseModel):
    """Schema for updating a legal case."""
    case_number: Optional[str] = Field(None, max_length=100)
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    court: Optional[str] = Field(None, max_length=255)
    status: Optional[CaseStatus] = None
    date_filed: Optional[date] = None
    date_resolved: Optional[date] = None
    severity: Optional[CaseSeverity] = None
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    outcome: Optional[str] = None
    source_urls: Optional[List[str]] = None
    impact_score: Optional[Decimal] = Field(None, ge=0, le=100)


class LegalCaseResponse(LegalCaseBase):
    """Schema for legal case response."""
    id: UUID
    politician_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

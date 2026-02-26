from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, Dict, Any
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID


class PoliticianBase(BaseModel):
    """Base politician schema."""
    name: str = Field(..., min_length=1, max_length=255)
    position: str = Field(..., min_length=1, max_length=255)
    party: Optional[str] = Field(None, max_length=100)
    county: Optional[str] = Field(None, max_length=100)
    constituency: Optional[str] = Field(None, max_length=150)
    parliamentary_role: Optional[str] = Field(None, max_length=100)
    parliamentary_profile_url: Optional[str] = None
    parliamentary_profile: Optional[Dict[str, Any]] = None
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    history: Optional[str] = None
    date_of_birth: Optional[date] = None
    date_of_death: Optional[date] = None
    education: Optional[Dict[str, Any]] = None
    contact_info: Optional[Dict[str, Any]] = None
    social_media: Optional[Dict[str, Any]] = None


class PoliticianCreate(PoliticianBase):
    """Schema for creating a politician."""
    pass


class PoliticianUpdate(BaseModel):
    """Schema for updating a politician."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    position: Optional[str] = Field(None, min_length=1, max_length=255)
    party: Optional[str] = Field(None, max_length=100)
    county: Optional[str] = Field(None, max_length=100)
    constituency: Optional[str] = Field(None, max_length=150)
    parliamentary_role: Optional[str] = Field(None, max_length=100)
    parliamentary_profile_url: Optional[str] = None
    parliamentary_profile: Optional[Dict[str, Any]] = None
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    history: Optional[str] = None
    date_of_birth: Optional[date] = None
    date_of_death: Optional[date] = None
    education: Optional[Dict[str, Any]] = None
    contact_info: Optional[Dict[str, Any]] = None
    social_media: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class ScoreBreakdown(BaseModel):
    """Schema for score breakdown."""
    legal_record: Decimal = Field(..., ge=0, le=100)
    promise_fulfillment: Decimal = Field(..., ge=0, le=100)
    public_sentiment: Decimal = Field(..., ge=0, le=100)
    credential_verification: Decimal = Field(..., ge=0, le=100)


class PoliticianResponse(PoliticianBase):
    """Schema for politician response."""
    id: UUID
    transparency_score: Decimal
    confidence_level: Decimal
    is_active: bool
    is_alive: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PoliticianDetailResponse(PoliticianResponse):
    """Schema for detailed politician response with related data."""
    cases_count: int = 0
    promises_count: int = 0
    linkages_count: int = 0
    reports_count: int = 0


class PoliticianListFilter(BaseModel):
    """Schema for filtering politicians."""
    search: Optional[str] = None
    party: Optional[str] = None
    county: Optional[str] = None
    constituency: Optional[str] = None
    position: Optional[str] = None
    min_score: Optional[Decimal] = Field(None, ge=0, le=100)
    max_score: Optional[Decimal] = Field(None, ge=0, le=100)
    is_active: Optional[bool] = True

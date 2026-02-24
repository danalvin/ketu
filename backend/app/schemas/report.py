from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import date, datetime
from uuid import UUID
from app.models.report import ReportStatus, ReportPriority


class FlaggedReportBase(BaseModel):
    """Base flagged report schema."""
    issue_type: str = Field(..., min_length=1, max_length=100)
    title: str = Field(..., min_length=1, max_length=500)
    description: str = Field(..., min_length=10)
    location: Optional[str] = Field(None, max_length=255)
    incident_date: Optional[date] = None
    evidence_files: Optional[List[Dict[str, Any]]] = None


class FlaggedReportCreate(FlaggedReportBase):
    """Schema for creating a flagged report."""
    politician_id: UUID
    is_anonymous: bool = False


class FlaggedReportUpdate(BaseModel):
    """Schema for updating a flagged report (moderator/admin)."""
    status: Optional[ReportStatus] = None
    priority: Optional[ReportPriority] = None
    resolution: Optional[str] = None
    admin_notes: Optional[str] = None
    investigation_timeline: Optional[List[Dict[str, Any]]] = None


class FlaggedReportResponse(FlaggedReportBase):
    """Schema for flagged report response."""
    id: UUID
    politician_id: UUID
    status: ReportStatus
    priority: ReportPriority
    is_anonymous: bool
    date_reported: datetime
    investigation_timeline: Optional[List[Dict[str, Any]]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FlaggedReportDetailResponse(FlaggedReportResponse):
    """Schema for detailed flagged report response (moderator/admin only)."""
    reporter_id: Optional[UUID] = None
    resolution: Optional[str] = None
    admin_notes: Optional[str] = None


class PublicFlaggedReportResponse(BaseModel):
    """Public-facing flagged report response with politician summary."""
    id: UUID
    politician_id: UUID
    politician_name: str
    politician_position: Optional[str] = None
    politician_photo_url: Optional[str] = None
    issue_type: str
    title: str
    description: str
    status: ReportStatus
    priority: ReportPriority
    location: Optional[str] = None
    incident_date: Optional[date] = None
    is_anonymous: bool
    date_reported: datetime
    created_at: datetime
    updated_at: datetime


class PublicFlaggedReportDetailResponse(PublicFlaggedReportResponse):
    """Public-facing detailed report response."""
    evidence_files: Optional[List[Dict[str, Any]]] = None
    investigation_timeline: Optional[List[Dict[str, Any]]] = None
    resolution: Optional[str] = None


class ReportListFilter(BaseModel):
    """Schema for filtering reports."""
    politician_id: Optional[UUID] = None
    status: Optional[ReportStatus] = None
    priority: Optional[ReportPriority] = None
    issue_type: Optional[str] = None
    from_date: Optional[date] = None
    to_date: Optional[date] = None

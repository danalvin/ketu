from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from uuid import UUID
from datetime import date
from app.database import get_db
from app.models.report import FlaggedReport, ReportStatus, ReportPriority
from app.models.politician import Politician
from app.models.user import User
from app.schemas.report import (
    FlaggedReportCreate,
    FlaggedReportUpdate,
    FlaggedReportResponse,
    FlaggedReportDetailResponse,
    PublicFlaggedReportResponse,
    PublicFlaggedReportDetailResponse,
)
from app.schemas.common import PaginatedResponse
from app.dependencies import get_optional_current_user, get_current_moderator_user

router = APIRouter()


def _to_public_report_response(
    report: FlaggedReport,
    politician: Politician
) -> PublicFlaggedReportResponse:
    return PublicFlaggedReportResponse(
        id=report.id,
        politician_id=report.politician_id,
        politician_name=politician.name,
        politician_position=politician.position,
        politician_photo_url=politician.photo_url,
        issue_type=report.issue_type,
        title=report.title,
        description=report.description,
        status=report.status,
        priority=report.priority,
        location=report.location,
        incident_date=report.incident_date,
        is_anonymous=report.is_anonymous,
        date_reported=report.date_reported,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


def _to_public_report_detail_response(
    report: FlaggedReport,
    politician: Politician
) -> PublicFlaggedReportDetailResponse:
    base = _to_public_report_response(report, politician).model_dump()
    return PublicFlaggedReportDetailResponse(
        **base,
        evidence_files=report.evidence_files,
        investigation_timeline=report.investigation_timeline,
        resolution=report.resolution,
    )


@router.post("", response_model=FlaggedReportResponse, status_code=status.HTTP_201_CREATED)
async def submit_report(
    report_data: FlaggedReportCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Submit a new flagged report.

    Supports both authenticated and anonymous reporting.
    If authenticated, the reporter_id will be stored.
    If anonymous or unauthenticated, reporter_id will be null.
    """
    # Verify politician exists
    politician = db.query(Politician).filter(Politician.id == report_data.politician_id).first()
    if not politician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Politician not found"
        )

    # Create new report
    new_report = FlaggedReport(
        politician_id=report_data.politician_id,
        reporter_id=current_user.id if current_user and not report_data.is_anonymous else None,
        issue_type=report_data.issue_type,
        title=report_data.title,
        description=report_data.description,
        location=report_data.location,
        incident_date=report_data.incident_date,
        evidence_files=report_data.evidence_files,
        is_anonymous=report_data.is_anonymous or (current_user is None),
        status=ReportStatus.UNDER_REVIEW,
        priority=ReportPriority.MEDIUM,
    )

    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    return FlaggedReportResponse.model_validate(new_report)


@router.get("", response_model=PaginatedResponse)
async def list_reports(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    politician_id: Optional[UUID] = Query(None, description="Filter by politician ID"),
    status: Optional[ReportStatus] = Query(None, description="Filter by status"),
    priority: Optional[ReportPriority] = Query(None, description="Filter by priority"),
    issue_type: Optional[str] = Query(None, description="Filter by issue type"),
    from_date: Optional[date] = Query(None, description="Filter reports from this date"),
    to_date: Optional[date] = Query(None, description="Filter reports to this date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_moderator_user)
):
    """
    List all flagged reports with filtering (moderator/admin only).

    - **politician_id**: Filter by specific politician
    - **status**: Filter by report status
    - **priority**: Filter by priority level
    - **issue_type**: Filter by issue type
    - **from_date**: Filter reports from this date
    - **to_date**: Filter reports to this date
    """
    query = db.query(FlaggedReport)

    # Apply filters
    if politician_id:
        query = query.filter(FlaggedReport.politician_id == politician_id)

    if status:
        query = query.filter(FlaggedReport.status == status)

    if priority:
        query = query.filter(FlaggedReport.priority == priority)

    if issue_type:
        query = query.filter(FlaggedReport.issue_type.ilike(f"%{issue_type}%"))

    if from_date:
        query = query.filter(FlaggedReport.date_reported >= from_date)

    if to_date:
        query = query.filter(FlaggedReport.date_reported <= to_date)

    # Get total count
    total = query.count()

    # Apply pagination
    offset = (page - 1) * page_size
    reports = query.order_by(
        FlaggedReport.priority.desc(),
        FlaggedReport.date_reported.desc()
    ).offset(offset).limit(page_size).all()

    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size

    # Return detailed responses for moderators/admins
    return PaginatedResponse(
        items=[FlaggedReportDetailResponse.model_validate(r) for r in reports],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/public", response_model=PaginatedResponse)
async def list_public_reports(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    q: Optional[str] = Query(None, description="Search by report title, issue, description, or politician"),
    politician_id: Optional[UUID] = Query(None, description="Filter by politician ID"),
    status: Optional[ReportStatus] = Query(None, description="Filter by status"),
    priority: Optional[ReportPriority] = Query(None, description="Filter by priority"),
    db: Session = Depends(get_db)
):
    """
    List public reports with politician summary.
    """
    query = db.query(FlaggedReport, Politician).join(
        Politician, FlaggedReport.politician_id == Politician.id
    )

    if politician_id:
        query = query.filter(FlaggedReport.politician_id == politician_id)

    if status:
        query = query.filter(FlaggedReport.status == status)

    if priority:
        query = query.filter(FlaggedReport.priority == priority)

    if q:
        search_filter = f"%{q}%"
        query = query.filter(
            or_(
                FlaggedReport.issue_type.ilike(search_filter),
                FlaggedReport.title.ilike(search_filter),
                FlaggedReport.description.ilike(search_filter),
                Politician.name.ilike(search_filter),
            )
        )

    total = query.count()
    offset = (page - 1) * page_size
    rows = query.order_by(FlaggedReport.date_reported.desc()).offset(offset).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size

    return PaginatedResponse(
        items=[_to_public_report_response(report, politician) for report, politician in rows],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/politician/{politician_id}", response_model=PaginatedResponse)
async def get_politician_reports(
    politician_id: UUID,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status: Optional[ReportStatus] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db)
):
    """
    Get all reports for a specific politician (public endpoint).

    Returns paginated list of reports. Only shows basic report information,
    not sensitive details like reporter_id or admin_notes.
    """
    # Verify politician exists
    politician = db.query(Politician).filter(Politician.id == politician_id).first()
    if not politician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Politician not found"
        )

    # Query reports
    query = db.query(FlaggedReport).filter(FlaggedReport.politician_id == politician_id)

    if status:
        query = query.filter(FlaggedReport.status == status)

    # Get total count
    total = query.count()

    # Apply pagination
    offset = (page - 1) * page_size
    reports = query.order_by(FlaggedReport.date_reported.desc()).offset(offset).limit(page_size).all()

    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size

    # Return basic report info (not detailed)
    return PaginatedResponse(
        items=[FlaggedReportResponse.model_validate(r) for r in reports],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/public/{report_id}", response_model=PublicFlaggedReportDetailResponse)
async def get_public_report(report_id: UUID, db: Session = Depends(get_db)):
    """
    Get detailed public information for a specific report.
    """
    row = db.query(FlaggedReport, Politician).join(
        Politician, FlaggedReport.politician_id == Politician.id
    ).filter(
        FlaggedReport.id == report_id
    ).first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )

    report, politician = row
    return _to_public_report_detail_response(report, politician)


@router.get("/{report_id}", response_model=FlaggedReportDetailResponse)
async def get_report(
    report_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_moderator_user)
):
    """
    Get detailed information about a specific report (moderator/admin only).

    Returns full report details including sensitive information.
    """
    report = db.query(FlaggedReport).filter(FlaggedReport.id == report_id).first()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )

    return FlaggedReportDetailResponse.model_validate(report)


@router.patch("/{report_id}/status", response_model=FlaggedReportDetailResponse)
async def update_report_status(
    report_id: UUID,
    report_update: FlaggedReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_moderator_user)
):
    """
    Update report status and metadata (moderator/admin only).

    Allows updating:
    - Status (under_review, investigating, verified, dismissed, resolved)
    - Priority (low, medium, high, critical)
    - Resolution notes
    - Admin notes
    - Investigation timeline
    """
    report = db.query(FlaggedReport).filter(FlaggedReport.id == report_id).first()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )

    # Update only provided fields
    update_data = report_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(report, field, value)

    db.commit()
    db.refresh(report)

    return FlaggedReportDetailResponse.model_validate(report)

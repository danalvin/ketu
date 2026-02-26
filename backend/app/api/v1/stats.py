from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.politician import Politician
from app.models.case import LegalCase, CaseStatus
from app.models.promise import Promise, PromiseStatus
from app.models.report import FlaggedReport, ReportStatus, ReportPriority
from app.models.user import User
from pydantic import BaseModel
from typing import Dict, List
from uuid import UUID

router = APIRouter()


class OverviewStats(BaseModel):
    """Schema for platform overview statistics."""
    total_politicians: int
    active_politicians: int
    inactive_politicians: int
    total_cases: int
    pending_cases: int
    resolved_cases: int
    total_promises: int
    fulfilled_promises: int
    broken_promises: int
    in_progress_promises: int
    total_reports: int
    verified_reports: int
    under_review_reports: int
    average_transparency_score: float
    highest_score: float
    lowest_score: float
    total_users: int


class PoliticianStatsItem(BaseModel):
    """Schema for individual politician statistics."""
    id: UUID
    name: str
    position: str
    party: str
    photo_url: str | None = None
    transparency_score: float
    cases_count: int
    promises_count: int
    reports_count: int


class TopPoliticians(BaseModel):
    """Schema for top/bottom politicians."""
    highest_scored: List[PoliticianStatsItem]
    lowest_scored: List[PoliticianStatsItem]


class PartyStats(BaseModel):
    """Schema for party statistics."""
    party: str
    politician_count: int
    average_score: float


class CountyStats(BaseModel):
    """Schema for county statistics."""
    county: str
    politician_count: int
    average_score: float


@router.get("/overview", response_model=OverviewStats)
async def get_platform_overview(db: Session = Depends(get_db)):
    """
    Get platform overview statistics.

    Returns comprehensive statistics including:
    - Total politicians (active/inactive)
    - Legal cases (total, pending, resolved)
    - Promises (total, fulfilled, broken, in progress)
    - Reports (total, verified, under review)
    - Transparency scores (average, highest, lowest)
    - Total users
    """
    # Politicians stats
    total_politicians = db.query(func.count(Politician.id)).scalar() or 0
    active_politicians = db.query(func.count(Politician.id)).filter(
        Politician.is_active == True
    ).scalar() or 0
    inactive_politicians = total_politicians - active_politicians

    # Cases stats
    total_cases = db.query(func.count(LegalCase.id)).scalar() or 0
    pending_cases = db.query(func.count(LegalCase.id)).filter(
        LegalCase.status.in_([CaseStatus.PENDING, CaseStatus.ONGOING])
    ).scalar() or 0
    resolved_cases = db.query(func.count(LegalCase.id)).filter(
        LegalCase.status == CaseStatus.RESOLVED
    ).scalar() or 0

    # Promises stats
    total_promises = db.query(func.count(Promise.id)).scalar() or 0
    fulfilled_promises = db.query(func.count(Promise.id)).filter(
        Promise.status == PromiseStatus.FULFILLED
    ).scalar() or 0
    broken_promises = db.query(func.count(Promise.id)).filter(
        Promise.status == PromiseStatus.BROKEN
    ).scalar() or 0
    in_progress_promises = db.query(func.count(Promise.id)).filter(
        Promise.status == PromiseStatus.IN_PROGRESS
    ).scalar() or 0

    # Reports stats
    total_reports = db.query(func.count(FlaggedReport.id)).scalar() or 0
    verified_reports = db.query(func.count(FlaggedReport.id)).filter(
        FlaggedReport.status == ReportStatus.VERIFIED
    ).scalar() or 0
    under_review_reports = db.query(func.count(FlaggedReport.id)).filter(
        FlaggedReport.status == ReportStatus.UNDER_REVIEW
    ).scalar() or 0

    # Transparency score stats
    score_stats = db.query(
        func.avg(Politician.transparency_score).label('avg_score'),
        func.max(Politician.transparency_score).label('max_score'),
        func.min(Politician.transparency_score).label('min_score')
    ).filter(Politician.is_active == True).first()

    average_score = float(score_stats.avg_score) if score_stats.avg_score else 0.0
    highest_score = float(score_stats.max_score) if score_stats.max_score else 0.0
    lowest_score = float(score_stats.min_score) if score_stats.min_score else 0.0

    # Users stats
    total_users = db.query(func.count(User.id)).scalar() or 0

    return OverviewStats(
        total_politicians=total_politicians,
        active_politicians=active_politicians,
        inactive_politicians=inactive_politicians,
        total_cases=total_cases,
        pending_cases=pending_cases,
        resolved_cases=resolved_cases,
        total_promises=total_promises,
        fulfilled_promises=fulfilled_promises,
        broken_promises=broken_promises,
        in_progress_promises=in_progress_promises,
        total_reports=total_reports,
        verified_reports=verified_reports,
        under_review_reports=under_review_reports,
        average_transparency_score=average_score,
        highest_score=highest_score,
        lowest_score=lowest_score,
        total_users=total_users
    )


@router.get("/top-politicians", response_model=TopPoliticians)
async def get_top_politicians(
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """
    Get top and bottom performing politicians by transparency score.

    Returns the highest and lowest scored politicians with their statistics.
    """
    cases_count_subquery = (
        db.query(func.count(LegalCase.id))
        .filter(LegalCase.politician_id == Politician.id)
        .correlate(Politician)
        .scalar_subquery()
    )
    promises_count_subquery = (
        db.query(func.count(Promise.id))
        .filter(Promise.politician_id == Politician.id)
        .correlate(Politician)
        .scalar_subquery()
    )
    reports_count_subquery = (
        db.query(func.count(FlaggedReport.id))
        .filter(FlaggedReport.politician_id == Politician.id)
        .correlate(Politician)
        .scalar_subquery()
    )

    base_query = db.query(
        Politician,
        cases_count_subquery.label("cases_count"),
        promises_count_subquery.label("promises_count"),
        reports_count_subquery.label("reports_count"),
    ).filter(Politician.is_active == True)

    # Get highest scored politicians
    highest = base_query.order_by(
        Politician.transparency_score.desc()
    ).limit(limit).all()

    # Get lowest scored politicians
    lowest = base_query.order_by(
        Politician.transparency_score.asc()
    ).limit(limit).all()

    def format_politician(result) -> PoliticianStatsItem:
        politician = result[0]
        return PoliticianStatsItem(
            id=politician.id,
            name=politician.name,
            position=politician.position,
            party=politician.party or "Independent",
            photo_url=politician.photo_url,
            transparency_score=float(politician.transparency_score),
            cases_count=result.cases_count or 0,
            promises_count=result.promises_count or 0,
            reports_count=result.reports_count or 0
        )

    return TopPoliticians(
        highest_scored=[format_politician(r) for r in highest],
        lowest_scored=[format_politician(r) for r in lowest]
    )


@router.get("/by-party", response_model=List[PartyStats])
async def get_stats_by_party(db: Session = Depends(get_db)):
    """
    Get statistics grouped by political party.

    Returns count and average transparency score for each party.
    """
    party_stats = db.query(
        Politician.party,
        func.count(Politician.id).label('count'),
        func.avg(Politician.transparency_score).label('avg_score')
    ).filter(
        Politician.is_active == True,
        Politician.party.isnot(None)
    ).group_by(
        Politician.party
    ).order_by(
        func.count(Politician.id).desc()
    ).all()

    return [
        PartyStats(
            party=stat.party,
            politician_count=stat.count,
            average_score=float(stat.avg_score) if stat.avg_score else 0.0
        )
        for stat in party_stats
    ]


@router.get("/by-county", response_model=List[CountyStats])
async def get_stats_by_county(db: Session = Depends(get_db)):
    """
    Get statistics grouped by county.

    Returns count and average transparency score for each county.
    """
    county_stats = db.query(
        Politician.county,
        func.count(Politician.id).label('count'),
        func.avg(Politician.transparency_score).label('avg_score')
    ).filter(
        Politician.is_active == True,
        Politician.county.isnot(None)
    ).group_by(
        Politician.county
    ).order_by(
        func.count(Politician.id).desc()
    ).all()

    return [
        CountyStats(
            county=stat.county,
            politician_count=stat.count,
            average_score=float(stat.avg_score) if stat.avg_score else 0.0
        )
        for stat in county_stats
    ]


@router.get("/reports-summary", response_model=Dict[str, int])
async def get_reports_summary(db: Session = Depends(get_db)):
    """
    Get summary of reports by status and priority.

    Returns counts grouped by status and priority.
    """
    # Count by status
    status_counts = {}
    for status in ReportStatus:
        count = db.query(func.count(FlaggedReport.id)).filter(
            FlaggedReport.status == status
        ).scalar() or 0
        status_counts[f"status_{status.value}"] = count

    # Count by priority
    priority_counts = {}
    for priority in ReportPriority:
        count = db.query(func.count(FlaggedReport.id)).filter(
            FlaggedReport.priority == priority
        ).scalar() or 0
        priority_counts[f"priority_{priority.value}"] = count

    return {**status_counts, **priority_counts}

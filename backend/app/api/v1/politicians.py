from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional, List
from uuid import UUID
from app.database import get_db
from app.models.politician import Politician
from app.models.case import LegalCase
from app.models.promise import Promise
from app.models.linkage import PoliticalLinkage
from app.models.report import FlaggedReport
from app.models.user import User
from app.schemas.politician import (
    PoliticianCreate,
    PoliticianUpdate,
    PoliticianResponse,
    PoliticianDetailResponse,
)
from app.schemas.case import LegalCaseResponse
from app.schemas.promise import PromiseResponse
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.dependencies import get_current_admin_user
from decimal import Decimal

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_politicians(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name or position"),
    party: Optional[str] = Query(None, description="Filter by party"),
    county: Optional[str] = Query(None, description="Filter by county"),
    position: Optional[str] = Query(None, description="Filter by position"),
    min_score: Optional[float] = Query(None, ge=0, le=100, description="Minimum transparency score"),
    max_score: Optional[float] = Query(None, ge=0, le=100, description="Maximum transparency score"),
    is_active: bool = Query(True, description="Filter by active status"),
    db: Session = Depends(get_db)
):
    """
    List all politicians with filtering and pagination.

    - **search**: Search by politician name or position
    - **party**: Filter by political party
    - **county**: Filter by county
    - **position**: Filter by position
    - **min_score**: Minimum transparency score
    - **max_score**: Maximum transparency score
    - **is_active**: Filter by active status
    """
    query = db.query(Politician).filter(Politician.is_active == is_active)

    # Apply filters
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Politician.name.ilike(search_filter),
                Politician.position.ilike(search_filter)
            )
        )

    if party:
        query = query.filter(Politician.party.ilike(f"%{party}%"))

    if county:
        query = query.filter(Politician.county.ilike(f"%{county}%"))

    if position:
        query = query.filter(Politician.position.ilike(f"%{position}%"))

    if min_score is not None:
        query = query.filter(Politician.transparency_score >= Decimal(str(min_score)))

    if max_score is not None:
        query = query.filter(Politician.transparency_score <= Decimal(str(max_score)))

    # Get total count
    total = query.count()

    # Apply pagination
    offset = (page - 1) * page_size
    politicians = query.order_by(Politician.transparency_score.desc()).offset(offset).limit(page_size).all()

    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size

    return PaginatedResponse(
        items=[PoliticianResponse.model_validate(p) for p in politicians],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/{politician_id}", response_model=PoliticianDetailResponse)
async def get_politician(
    politician_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get detailed information about a specific politician.

    Returns politician details along with counts of related entities.
    """
    politician = db.query(Politician).filter(Politician.id == politician_id).first()

    if not politician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Politician not found"
        )

    # Get counts of related entities
    cases_count = db.query(func.count(LegalCase.id)).filter(
        LegalCase.politician_id == politician_id
    ).scalar()

    promises_count = db.query(func.count(Promise.id)).filter(
        Promise.politician_id == politician_id
    ).scalar()

    linkages_count = db.query(func.count(PoliticalLinkage.id)).filter(
        PoliticalLinkage.politician_id == politician_id
    ).scalar()

    reports_count = db.query(func.count(FlaggedReport.id)).filter(
        FlaggedReport.politician_id == politician_id
    ).scalar()

    # Build response with counts
    politician_dict = PoliticianResponse.model_validate(politician).model_dump()
    politician_dict["cases_count"] = cases_count or 0
    politician_dict["promises_count"] = promises_count or 0
    politician_dict["linkages_count"] = linkages_count or 0
    politician_dict["reports_count"] = reports_count or 0

    return PoliticianDetailResponse(**politician_dict)


@router.get("/{politician_id}/cases", response_model=PaginatedResponse)
async def get_politician_cases(
    politician_id: UUID,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db)
):
    """
    Get all legal cases for a specific politician.

    Returns paginated list of legal cases.
    """
    # Verify politician exists
    politician = db.query(Politician).filter(Politician.id == politician_id).first()
    if not politician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Politician not found"
        )

    # Query cases
    query = db.query(LegalCase).filter(LegalCase.politician_id == politician_id)
    total = query.count()

    # Apply pagination
    offset = (page - 1) * page_size
    cases = query.order_by(LegalCase.date_filed.desc()).offset(offset).limit(page_size).all()

    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size

    return PaginatedResponse(
        items=[LegalCaseResponse.model_validate(c) for c in cases],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/{politician_id}/promises", response_model=PaginatedResponse)
async def get_politician_promises(
    politician_id: UUID,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db)
):
    """
    Get all promises for a specific politician.

    Returns paginated list of promises.
    """
    # Verify politician exists
    politician = db.query(Politician).filter(Politician.id == politician_id).first()
    if not politician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Politician not found"
        )

    # Query promises
    query = db.query(Promise).filter(Promise.politician_id == politician_id)
    total = query.count()

    # Apply pagination
    offset = (page - 1) * page_size
    promises = query.order_by(Promise.date_made.desc()).offset(offset).limit(page_size).all()

    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size

    return PaginatedResponse(
        items=[PromiseResponse.model_validate(p) for p in promises],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.post("", response_model=PoliticianResponse, status_code=status.HTTP_201_CREATED)
async def create_politician(
    politician_data: PoliticianCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Create a new politician (admin only).

    Requires admin authentication.
    """
    # Create new politician
    new_politician = Politician(
        name=politician_data.name,
        position=politician_data.position,
        party=politician_data.party,
        county=politician_data.county,
        photo_url=politician_data.photo_url,
        bio=politician_data.bio,
        date_of_birth=politician_data.date_of_birth,
        education=politician_data.education,
        contact_info=politician_data.contact_info,
        social_media=politician_data.social_media,
    )

    db.add(new_politician)
    db.commit()
    db.refresh(new_politician)

    return PoliticianResponse.model_validate(new_politician)


@router.patch("/{politician_id}", response_model=PoliticianResponse)
async def update_politician(
    politician_id: UUID,
    politician_data: PoliticianUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Update a politician (admin only).

    Requires admin authentication. Only provided fields will be updated.
    """
    politician = db.query(Politician).filter(Politician.id == politician_id).first()

    if not politician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Politician not found"
        )

    # Update only provided fields
    update_data = politician_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(politician, field, value)

    db.commit()
    db.refresh(politician)

    return PoliticianResponse.model_validate(politician)


@router.delete("/{politician_id}", response_model=SuccessResponse)
async def delete_politician(
    politician_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Delete a politician (admin only).

    Requires admin authentication. This will cascade delete all related entities.
    """
    politician = db.query(Politician).filter(Politician.id == politician_id).first()

    if not politician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Politician not found"
        )

    db.delete(politician)
    db.commit()

    return SuccessResponse(
        message=f"Politician {politician.name} deleted successfully"
    )

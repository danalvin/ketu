from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Dict, Any
from app.database import get_db
from app.models.politician import Politician
from app.models.case import LegalCase
from app.models.promise import Promise
from app.schemas.politician import PoliticianResponse
from app.schemas.case import LegalCaseResponse
from app.schemas.promise import PromiseResponse
from pydantic import BaseModel

router = APIRouter()


class SearchResults(BaseModel):
    """Schema for search results."""
    politicians: List[PoliticianResponse]
    cases: List[LegalCaseResponse]
    promises: List[PromiseResponse]
    total_results: int


@router.get("", response_model=SearchResults)
async def global_search(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results per category"),
    db: Session = Depends(get_db)
):
    """
    Global search across politicians, legal cases, and promises.

    Searches through:
    - Politicians: name, position, party, county, bio
    - Legal Cases: title, description, case_number, court
    - Promises: title, description, category

    Returns up to 'limit' results from each category.
    """
    search_filter = f"%{q}%"

    # Search politicians
    politicians_query = db.query(Politician).filter(
        Politician.is_active == True,
        or_(
            Politician.name.ilike(search_filter),
            Politician.position.ilike(search_filter),
            Politician.party.ilike(search_filter),
            Politician.county.ilike(search_filter),
            Politician.bio.ilike(search_filter)
        )
    ).order_by(Politician.transparency_score.desc()).limit(limit)

    politicians = politicians_query.all()

    # Search legal cases
    cases_query = db.query(LegalCase).filter(
        or_(
            LegalCase.title.ilike(search_filter),
            LegalCase.description.ilike(search_filter),
            LegalCase.case_number.ilike(search_filter),
            LegalCase.court.ilike(search_filter)
        )
    ).order_by(LegalCase.date_filed.desc()).limit(limit)

    cases = cases_query.all()

    # Search promises
    promises_query = db.query(Promise).filter(
        or_(
            Promise.title.ilike(search_filter),
            Promise.description.ilike(search_filter),
            Promise.category.ilike(search_filter)
        )
    ).order_by(Promise.date_made.desc()).limit(limit)

    promises = promises_query.all()

    # Calculate total results
    total_results = len(politicians) + len(cases) + len(promises)

    return SearchResults(
        politicians=[PoliticianResponse.model_validate(p) for p in politicians],
        cases=[LegalCaseResponse.model_validate(c) for c in cases],
        promises=[PromiseResponse.model_validate(p) for p in promises],
        total_results=total_results
    )


@router.get("/politicians", response_model=List[PoliticianResponse])
async def search_politicians_only(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results"),
    db: Session = Depends(get_db)
):
    """
    Search only politicians.

    Searches through name, position, party, county, and bio.
    Returns up to 'limit' results ordered by transparency score.
    """
    search_filter = f"%{q}%"

    politicians = db.query(Politician).filter(
        Politician.is_active == True,
        or_(
            Politician.name.ilike(search_filter),
            Politician.position.ilike(search_filter),
            Politician.party.ilike(search_filter),
            Politician.county.ilike(search_filter),
            Politician.bio.ilike(search_filter)
        )
    ).order_by(Politician.transparency_score.desc()).limit(limit).all()

    return [PoliticianResponse.model_validate(p) for p in politicians]


@router.get("/cases", response_model=List[LegalCaseResponse])
async def search_cases_only(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results"),
    db: Session = Depends(get_db)
):
    """
    Search only legal cases.

    Searches through title, description, case_number, and court.
    Returns up to 'limit' results ordered by date filed.
    """
    search_filter = f"%{q}%"

    cases = db.query(LegalCase).filter(
        or_(
            LegalCase.title.ilike(search_filter),
            LegalCase.description.ilike(search_filter),
            LegalCase.case_number.ilike(search_filter),
            LegalCase.court.ilike(search_filter)
        )
    ).order_by(LegalCase.date_filed.desc()).limit(limit).all()

    return [LegalCaseResponse.model_validate(c) for c in cases]


@router.get("/promises", response_model=List[PromiseResponse])
async def search_promises_only(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results"),
    db: Session = Depends(get_db)
):
    """
    Search only promises.

    Searches through title, description, and category.
    Returns up to 'limit' results ordered by date made.
    """
    search_filter = f"%{q}%"

    promises = db.query(Promise).filter(
        or_(
            Promise.title.ilike(search_filter),
            Promise.description.ilike(search_filter),
            Promise.category.ilike(search_filter)
        )
    ).order_by(Promise.date_made.desc()).limit(limit).all()

    return [PromiseResponse.model_validate(p) for p in promises]

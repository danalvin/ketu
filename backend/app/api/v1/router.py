from fastapi import APIRouter
from app.api.v1 import auth, politicians, reports, search, stats

api_router = APIRouter()

# Include sub-routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(politicians.router, prefix="/politicians", tags=["Politicians"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(search.router, prefix="/search", tags=["Search"])
api_router.include_router(stats.router, prefix="/stats", tags=["Statistics"])

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class BaseResponse(BaseModel):
    """Base response schema."""
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaginationParams(BaseModel):
    """Pagination parameters."""
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(20, ge=1, le=100, description="Items per page")


class PaginatedResponse(BaseModel):
    """Paginated response wrapper."""
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int

    class Config:
        from_attributes = True


class SuccessResponse(BaseModel):
    """Success response schema."""
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Error response schema."""
    detail: str
    success: bool = False

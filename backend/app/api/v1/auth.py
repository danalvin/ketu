from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    UserResponse,
    UserLogin,
    TokenResponse,
    TokenRefresh,
    PasswordResetRequest,
    PasswordReset,
    EmailVerification,
)
from app.schemas.common import SuccessResponse
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
    create_verification_token,
    verify_verification_token,
)
from app.core.exceptions import UnauthorizedException, ConflictException, BadRequestException
from app.dependencies import get_current_user

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise ConflictException("Email already registered")

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    verification_token = create_verification_token(user_data.email)

    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        phone_number=user_data.phone_number,
        verification_token=verification_token,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # TODO: Send verification email
    # send_verification_email(user_data.email, verification_token)

    return new_user


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Login with email and password."""
    # Find user
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise UnauthorizedException("Incorrect email or password")

    if not user.is_active:
        raise BadRequestException("Account is inactive")

    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()

    # Create tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(token_data: TokenRefresh, db: Session = Depends(get_db)):
    """Refresh access token using refresh token."""
    payload = decode_token(token_data.refresh_token)

    if payload is None or payload.get("type") != "refresh":
        raise UnauthorizedException("Invalid refresh token")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()

    if not user or not user.is_active:
        raise UnauthorizedException("Invalid user")

    # Create new tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information."""
    return current_user


@router.post("/verify-email", response_model=SuccessResponse)
async def verify_email(verification: EmailVerification, db: Session = Depends(get_db)):
    """Verify user email."""
    email = verify_verification_token(verification.token)

    if email is None:
        raise BadRequestException("Invalid or expired verification token")

    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise BadRequestException("User not found")

    if user.is_verified:
        return SuccessResponse(message="Email already verified")

    user.is_verified = True
    user.verification_token = None
    db.commit()

    return SuccessResponse(message="Email verified successfully")


@router.post("/forgot-password", response_model=SuccessResponse)
async def forgot_password(request: PasswordResetRequest, db: Session = Depends(get_db)):
    """Request password reset."""
    user = db.query(User).filter(User.email == request.email).first()

    # Always return success to prevent user enumeration
    if not user:
        return SuccessResponse(message="If the email exists, a reset link has been sent")

    # Create reset token
    reset_token = create_verification_token(user.email)

    # TODO: Send password reset email
    # send_password_reset_email(user.email, reset_token)

    return SuccessResponse(message="If the email exists, a reset link has been sent")


@router.post("/reset-password", response_model=SuccessResponse)
async def reset_password(reset_data: PasswordReset, db: Session = Depends(get_db)):
    """Reset password using reset token."""
    email = verify_verification_token(reset_data.token)

    if email is None:
        raise BadRequestException("Invalid or expired reset token")

    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise BadRequestException("User not found")

    # Update password
    user.hashed_password = get_password_hash(reset_data.new_password)
    db.commit()

    return SuccessResponse(message="Password reset successfully")


@router.post("/logout", response_model=SuccessResponse)
async def logout(current_user: User = Depends(get_current_user)):
    """Logout current user."""
    # In a stateless JWT system, logout is typically handled client-side
    # by deleting the tokens. This endpoint is here for completeness
    # and can be used for token blacklisting if implemented.
    return SuccessResponse(message="Logged out successfully")

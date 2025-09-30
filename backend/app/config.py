from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App Settings
    app_name: str = "Kenya ni Yetu API"
    app_env: str = "development"
    debug: bool = True
    api_version: str = "v1"
    secret_key: str
    allowed_origins: str = "http://localhost:3000"

    # Database
    database_url: str
    db_echo: bool = False

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Celery
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # AWS S3 (Optional)
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    s3_bucket_name: str = ""

    # OpenAI (Optional)
    openai_api_key: str = ""

    # Email
    sendgrid_api_key: str = ""
    email_from: str = "noreply@kenyaniyetu.org"
    email_from_name: str = "Kenya ni Yetu"

    # Rate Limiting
    rate_limit_per_minute: int = 60
    rate_limit_per_hour: int = 1000

    # Pagination
    default_page_size: int = 20
    max_page_size: int = 100

    # File Upload
    max_upload_size: int = 10485760  # 10MB
    allowed_extensions: str = "pdf,png,jpg,jpeg,gif,mp4,mov"

    # Sentry
    sentry_dsn: str = ""

    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse allowed origins into a list."""
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    @property
    def allowed_extensions_list(self) -> List[str]:
        """Parse allowed extensions into a list."""
        return [ext.strip() for ext in self.allowed_extensions.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

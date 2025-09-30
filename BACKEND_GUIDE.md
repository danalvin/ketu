# Backend Development Guide - Kenya ni Yetu

## Overview

This guide outlines the backend architecture, setup instructions, and development guidelines for the Kenya ni Yetu Political Transparency Platform.

## Tech Stack

### Core Technologies
- **Framework:** FastAPI (Python 3.11+)
- **Database:** PostgreSQL 15+ with pgvector extension
- **Cache:** Redis 7+
- **Task Queue:** Celery with Redis broker
- **File Storage:** AWS S3 / Vercel Blob
- **AI/ML:** OpenAI API / Hugging Face Transformers

### Key Libraries
- **SQLAlchemy 2.0** - ORM
- **Alembic** - Database migrations
- **Pydantic v2** - Data validation
- **python-jose** - JWT tokens
- **passlib** - Password hashing
- **httpx** - Async HTTP client
- **BeautifulSoup4** - Web scraping
- **scikit-learn** - ML utilities

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry point
│   ├── config.py               # Configuration settings
│   ├── database.py             # Database connection
│   ├── dependencies.py         # Common dependencies
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── router.py       # Main API router
│   │   │   ├── politicians.py  # Politician endpoints
│   │   │   ├── reports.py      # Report endpoints
│   │   │   ├── auth.py         # Authentication endpoints
│   │   │   ├── search.py       # Search endpoints
│   │   │   ├── stats.py        # Statistics endpoints
│   │   │   └── admin.py        # Admin endpoints
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── politician.py       # Politician model
│   │   ├── case.py             # Legal case model
│   │   ├── promise.py          # Promise model
│   │   ├── linkage.py          # Political linkage model
│   │   ├── report.py           # Flagged report model
│   │   ├── user.py             # User model
│   │   ├── score.py            # Score history model
│   │   └── news.py             # News mention model
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── politician.py       # Pydantic schemas
│   │   ├── case.py
│   │   ├── promise.py
│   │   ├── report.py
│   │   ├── user.py
│   │   └── common.py           # Shared schemas
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── politician_service.py
│   │   ├── report_service.py
│   │   ├── scoring_service.py   # AI transparency scoring
│   │   ├── search_service.py    # Search & filtering
│   │   ├── auth_service.py      # Authentication logic
│   │   ├── storage_service.py   # File upload/download
│   │   └── scraper_service.py   # News scraping
│   │
│   ├── tasks/
│   │   ├── __init__.py
│   │   ├── celery_app.py       # Celery configuration
│   │   ├── scoring_tasks.py    # Background scoring jobs
│   │   ├── scraping_tasks.py   # Web scraping jobs
│   │   └── notification_tasks.py # Email/alert tasks
│   │
│   ├── core/
│   │   ├── __init__.py
│   │   ├── security.py         # Auth utilities
│   │   ├── middleware.py       # Custom middleware
│   │   └── exceptions.py       # Custom exceptions
│   │
│   └── utils/
│       ├── __init__.py
│       ├── validators.py       # Custom validators
│       ├── helpers.py          # Helper functions
│       └── constants.py        # App constants
│
├── alembic/                    # Database migrations
│   ├── versions/
│   └── env.py
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py            # Pytest fixtures
│   ├── test_politicians.py
│   ├── test_reports.py
│   ├── test_auth.py
│   └── test_scoring.py
│
├── scripts/
│   ├── seed_data.py           # Seed database
│   ├── migrate.py             # Migration helpers
│   └── import_politicians.py  # Data import
│
├── .env.example
├── .env.local
├── requirements.txt
├── requirements-dev.txt
├── Dockerfile
├── docker-compose.yml
├── alembic.ini
├── pytest.ini
└── README.md
```

## Database Schema

### Core Tables

#### Politicians Table
```sql
CREATE TABLE politicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    position VARCHAR(255) NOT NULL,
    party VARCHAR(100),
    county VARCHAR(100),
    photo_url TEXT,
    bio TEXT,
    date_of_birth DATE,
    education JSONB,
    contact_info JSONB,
    social_media JSONB,
    transparency_score DECIMAL(5,2) DEFAULT 0.00,
    confidence_level DECIMAL(5,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT score_range CHECK (transparency_score BETWEEN 0 AND 100),
    CONSTRAINT confidence_range CHECK (confidence_level BETWEEN 0 AND 100)
);

CREATE INDEX idx_politicians_name ON politicians USING gin(to_tsvector('english', name));
CREATE INDEX idx_politicians_party ON politicians(party);
CREATE INDEX idx_politicians_county ON politicians(county);
CREATE INDEX idx_politicians_score ON politicians(transparency_score DESC);
```

#### Legal Cases Table
```sql
CREATE TABLE legal_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
    case_number VARCHAR(100) UNIQUE,
    title VARCHAR(500) NOT NULL,
    court VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    date_filed DATE,
    date_resolved DATE,
    severity VARCHAR(50),
    category VARCHAR(100),
    description TEXT,
    outcome TEXT,
    source_urls JSONB,
    impact_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CHECK (status IN ('pending', 'ongoing', 'resolved', 'dismissed', 'appealed'))
);

CREATE INDEX idx_cases_politician ON legal_cases(politician_id);
CREATE INDEX idx_cases_status ON legal_cases(status);
```

#### Promises Table
```sql
CREATE TABLE promises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    date_made DATE NOT NULL,
    deadline DATE,
    status VARCHAR(50) NOT NULL,
    category VARCHAR(100),
    evidence JSONB,
    fulfillment_percentage INT DEFAULT 0,
    verification_sources JSONB,
    impact_area VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CHECK (status IN ('pending', 'in_progress', 'fulfilled', 'broken', 'partially_fulfilled')),
    CHECK (fulfillment_percentage BETWEEN 0 AND 100)
);

CREATE INDEX idx_promises_politician ON promises(politician_id);
CREATE INDEX idx_promises_status ON promises(status);
```

#### Political Linkages Table
```sql
CREATE TABLE political_linkages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
    linked_entity_type VARCHAR(50) NOT NULL,
    linked_entity_id UUID,
    linked_entity_name VARCHAR(255) NOT NULL,
    relationship_type VARCHAR(100) NOT NULL,
    description TEXT,
    strength DECIMAL(3,2) DEFAULT 0.50,
    evidence JSONB,
    is_verified BOOLEAN DEFAULT FALSE,
    date_established DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    CHECK (linked_entity_type IN ('person', 'company', 'organization', 'government_entity')),
    CHECK (strength BETWEEN 0 AND 1)
);

CREATE INDEX idx_linkages_politician ON political_linkages(politician_id);
CREATE INDEX idx_linkages_entity_type ON political_linkages(linked_entity_type);
```

#### Flagged Reports Table
```sql
CREATE TABLE flagged_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    issue_type VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'under_review',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    evidence_files JSONB,
    location VARCHAR(255),
    incident_date DATE,
    is_anonymous BOOLEAN DEFAULT FALSE,
    date_reported TIMESTAMP DEFAULT NOW(),
    investigation_timeline JSONB,
    resolution TEXT,
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CHECK (status IN ('under_review', 'investigating', 'verified', 'dismissed', 'resolved')),
    CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX idx_reports_politician ON flagged_reports(politician_id);
CREATE INDEX idx_reports_status ON flagged_reports(status);
CREATE INDEX idx_reports_priority ON flagged_reports(priority);
CREATE INDEX idx_reports_date ON flagged_reports(date_reported DESC);
```

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    phone_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    CHECK (role IN ('user', 'moderator', 'admin'))
);

CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

#### Score History Table
```sql
CREATE TABLE score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
    transparency_score DECIMAL(5,2) NOT NULL,
    score_breakdown JSONB NOT NULL,
    factors_analyzed JSONB,
    calculation_method VARCHAR(50),
    calculated_at TIMESTAMP DEFAULT NOW(),
    CHECK (transparency_score BETWEEN 0 AND 100)
);

CREATE INDEX idx_score_history_politician ON score_history(politician_id);
CREATE INDEX idx_score_history_date ON score_history(calculated_at DESC);
```

#### News Mentions Table
```sql
CREATE TABLE news_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    source VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    content_summary TEXT,
    sentiment DECIMAL(3,2),
    published_at TIMESTAMP NOT NULL,
    scraped_at TIMESTAMP DEFAULT NOW(),
    relevance_score DECIMAL(3,2),
    CHECK (sentiment BETWEEN -1 AND 1),
    CHECK (relevance_score BETWEEN 0 AND 1)
);

CREATE INDEX idx_news_politician ON news_mentions(politician_id);
CREATE INDEX idx_news_published ON news_mentions(published_at DESC);
```

## API Endpoints

### Authentication Endpoints

```
POST   /api/v1/auth/register          - Register new user
POST   /api/v1/auth/login             - Login (returns JWT)
POST   /api/v1/auth/refresh           - Refresh access token
POST   /api/v1/auth/logout            - Logout
GET    /api/v1/auth/me                - Get current user
POST   /api/v1/auth/verify-email      - Verify email
POST   /api/v1/auth/forgot-password   - Request password reset
POST   /api/v1/auth/reset-password    - Reset password
```

### Politicians Endpoints

```
GET    /api/v1/politicians                   - List politicians (paginated, filterable)
GET    /api/v1/politicians/{id}              - Get politician details
GET    /api/v1/politicians/{id}/cases        - Get politician's legal cases
GET    /api/v1/politicians/{id}/promises     - Get politician's promises
GET    /api/v1/politicians/{id}/linkages     - Get political connections
GET    /api/v1/politicians/{id}/timeline     - Get activity timeline
GET    /api/v1/politicians/{id}/news         - Get news mentions
GET    /api/v1/politicians/trending          - Get trending politicians
POST   /api/v1/politicians                   - Create politician (admin)
PATCH  /api/v1/politicians/{id}              - Update politician (admin)
DELETE /api/v1/politicians/{id}              - Delete politician (admin)
```

### Reports Endpoints

```
POST   /api/v1/reports                    - Submit new report
GET    /api/v1/reports                    - List flagged reports (paginated)
GET    /api/v1/reports/{id}               - Get report details
PATCH  /api/v1/reports/{id}/status        - Update report status (moderator)
POST   /api/v1/reports/{id}/evidence      - Upload evidence files
GET    /api/v1/reports/my-reports         - Get current user's reports
```

### Search Endpoints

```
GET    /api/v1/search                     - Global search
GET    /api/v1/search/autocomplete        - Search suggestions
GET    /api/v1/search/advanced            - Advanced search with filters
```

### Statistics Endpoints

```
GET    /api/v1/stats/overview             - Platform overview stats
GET    /api/v1/stats/scores               - Score distribution
GET    /api/v1/stats/reports              - Report statistics
GET    /api/v1/stats/trends               - Trending data
```

### Alerts Endpoints

```
GET    /api/v1/alerts                     - Get recent alerts
GET    /api/v1/alerts/feed                - Real-time alerts feed
POST   /api/v1/alerts/subscribe           - Subscribe to alerts
```

### Admin Endpoints

```
POST   /api/v1/admin/politicians/{id}/recalculate-score   - Trigger score recalculation
GET    /api/v1/admin/reports/pending                      - Get pending reports queue
PATCH  /api/v1/admin/users/{id}/role                      - Update user role
GET    /api/v1/admin/users                                - List all users
POST   /api/v1/admin/data/import                          - Bulk data import
GET    /api/v1/admin/logs                                 - System logs
```

## Environment Variables

```env
# App Settings
APP_NAME=Kenya ni Yetu API
APP_ENV=development
DEBUG=True
API_VERSION=v1
SECRET_KEY=your-secret-key-here
ALLOWED_ORIGINS=http://localhost:3000,https://kenyaniyetu.org

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/kenya_ni_yetu
DB_ECHO=False

# Redis
REDIS_URL=redis://localhost:6379/0

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# JWT
JWT_SECRET_KEY=your-jwt-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=kenya-ni-yetu-storage

# OpenAI
OPENAI_API_KEY=your-openai-key

# Email (SendGrid/SMTP)
SENDGRID_API_KEY=your-sendgrid-key
EMAIL_FROM=noreply@kenyaniyetu.org

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_PER_HOUR=1000
```

## Setup Instructions

### 1. Prerequisites
```bash
# Install Python 3.11+
python --version

# Install PostgreSQL 15+
psql --version

# Install Redis
redis-cli --version
```

### 2. Clone & Setup
```bash
# Create backend directory
mkdir backend && cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies (will be created in Phase 1)
pip install -r requirements.txt
```

### 3. Database Setup
```bash
# Create database
createdb kenya_ni_yetu

# Run migrations
alembic upgrade head

# Seed data (optional)
python scripts/seed_data.py
```

### 4. Run Development Server
```bash
# Start Redis
redis-server

# Start Celery worker (separate terminal)
celery -A app.tasks.celery_app worker --loglevel=info

# Start FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Access API
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## AI Transparency Scoring Algorithm

### Score Components

```python
transparency_score = (
    legal_record_score * 0.30 +      # 30% weight
    promise_fulfillment_score * 0.30 + # 30% weight
    public_sentiment_score * 0.25 +    # 25% weight
    credential_verification_score * 0.15 # 15% weight
)
```

### Calculation Details

**1. Legal Record Score (0-100)**
```python
base_score = 100
deductions = 0

for case in politician.cases:
    if case.status == 'resolved' and case.outcome == 'guilty':
        deductions += severity_weight[case.severity]
    elif case.status == 'ongoing':
        deductions += severity_weight[case.severity] * 0.5

legal_record_score = max(0, base_score - deductions)
```

**2. Promise Fulfillment Score (0-100)**
```python
total_promises = len(politician.promises)
if total_promises == 0:
    return 50  # Neutral score

fulfilled = count(status='fulfilled')
partially = count(status='partially_fulfilled')
broken = count(status='broken')

score = (fulfilled * 100 + partially * 50) / total_promises
```

**3. Public Sentiment Score (0-100)**
```python
# Based on news mentions sentiment analysis
recent_mentions = get_news_mentions(last_90_days)
avg_sentiment = sum(m.sentiment for m in recent_mentions) / len(recent_mentions)

# Convert from [-1, 1] to [0, 100]
sentiment_score = (avg_sentiment + 1) * 50
```

**4. Credential Verification Score (0-100)**
```python
# Based on verified education, experience
verified_count = count_verified_credentials()
total_claims = count_total_credentials()

verification_score = (verified_count / total_claims) * 100
```

## Security Best Practices

### 1. Authentication
- JWT tokens with short expiration
- Refresh token rotation
- Password hashing with bcrypt
- Email verification required
- Rate limiting on auth endpoints

### 2. Authorization
- Role-based access control (RBAC)
- Resource-level permissions
- Admin actions logged

### 3. Input Validation
- Pydantic schemas for all inputs
- SQL injection prevention (SQLAlchemy)
- XSS protection
- File upload validation

### 4. API Security
- CORS configuration
- Rate limiting (per IP/user)
- Request size limits
- HTTPS only in production

## Testing Strategy

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_politicians.py

# Run with verbose output
pytest -v
```

### Test Categories
- Unit tests for services
- Integration tests for API endpoints
- Database tests with fixtures
- Authentication tests
- Background task tests

## Deployment

### Docker Deployment
```bash
# Build image
docker build -t kenya-ni-yetu-api .

# Run with docker-compose
docker-compose up -d
```

### Production Checklist
- [ ] Set DEBUG=False
- [ ] Use production database
- [ ] Configure HTTPS
- [ ] Set up monitoring (Sentry)
- [ ] Configure backups
- [ ] Set up logging
- [ ] Enable rate limiting
- [ ] Configure CDN for static files
- [ ] Set up CI/CD pipeline

## Monitoring & Logging

### Recommended Tools
- **Sentry** - Error tracking
- **Prometheus** - Metrics
- **Grafana** - Dashboards
- **ELK Stack** - Log aggregation

## Development Guidelines

### Code Style
- Follow PEP 8
- Use type hints
- Write docstrings
- Keep functions small and focused

### Commit Messages
```
feat: Add politician search endpoint
fix: Resolve scoring calculation bug
docs: Update API documentation
test: Add tests for report service
refactor: Simplify authentication logic
```

### Branch Strategy
- `main` - Production
- `develop` - Development
- `feature/*` - New features
- `fix/*` - Bug fixes

## Phase 1 Implementation Tasks

1. ✅ Project structure setup
2. ✅ Database models and migrations
3. ✅ Basic authentication
4. ✅ Politician CRUD endpoints
5. ✅ Report submission system
6. ✅ Search and filtering
7. ✅ Basic tests

## Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [Celery Documentation](https://docs.celeryproject.org/)

---

**Last Updated:** September 30, 2025
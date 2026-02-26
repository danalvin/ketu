# Kenya ni Yetu - Backend API

FastAPI backend for the Kenya ni Yetu Political Transparency Platform.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Politician Management**: Full CRUD operations for politicians with transparency scoring
- **Legal Cases & Promises**: Track legal cases and political promises
- **Report Submission**: Anonymous and authenticated report submission system
- **Search & Filtering**: Advanced search across politicians, cases, and promises
- **Statistics & Analytics**: Platform-wide statistics and insights
- **Database Migrations**: Alembic for database version control

## Tech Stack

- **FastAPI** - Modern, fast web framework
- **PostgreSQL** - Relational database
- **SQLAlchemy** - ORM
- **Alembic** - Database migrations
- **JWT** - Token-based authentication
- **Pydantic** - Data validation
- **Redis** - Caching and task queue (future)

## Project Structure

```
backend/
├── app/
│   ├── api/v1/           # API endpoints
│   ├── models/           # Database models
│   ├── schemas/          # Pydantic schemas
│   ├── services/         # Business logic
│   ├── core/             # Security, middleware
│   ├── utils/            # Helper functions
│   ├── config.py         # Configuration
│   ├── database.py       # Database setup
│   ├── dependencies.py   # FastAPI dependencies
│   └── main.py           # Application entry point
├── alembic/              # Database migrations
├── tests/                # Test files
├── requirements.txt      # Dependencies
└── .env.example          # Environment variables template
```

## Setup Instructions

### Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Redis (optional, for future features)

### Installation

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Setup environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set your configuration:
   ```env
   DATABASE_URL=postgresql://postgres:password@localhost:5432/kenya_ni_yetu
   SECRET_KEY=your-secret-key-here
   JWT_SECRET_KEY=your-jwt-secret-here
   ALLOWED_ORIGINS=http://localhost:3000
   ```

5. **Create database**
   ```bash
   createdb kenya_ni_yetu
   ```

6. **Run migrations**
   ```bash
   alembic upgrade head
   ```

## Running the Server

### Development Mode

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or using the Python script:

```bash
python -m app.main
```

### Access the API

- **API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## API Endpoints

### Authentication (`/api/v1/auth`)

- `POST /auth/register` - Register new user
- `POST /auth/login` - Login with email/password
- `POST /auth/refresh` - Refresh access token
- `GET /auth/me` - Get current user info
- `POST /auth/verify-email` - Verify email
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password
- `POST /auth/logout` - Logout

### Politicians (`/api/v1/politicians`)

- `GET /politicians` - List politicians (with filters)
- `GET /politicians/{id}` - Get politician details
- `GET /politicians/{id}/cases` - Get politician's cases
- `GET /politicians/{id}/promises` - Get politician's promises
- `POST /politicians` - Create politician (admin)
- `PATCH /politicians/{id}` - Update politician (admin)
- `DELETE /politicians/{id}` - Delete politician (admin)

### Reports (`/api/v1/reports`)

- `POST /reports` - Submit report (anonymous or authenticated)
- `GET /reports/public` - List public reports with politician summaries
- `GET /reports/public/{id}` - Get public report details
- `GET /reports` - List reports (moderator/admin)
- `GET /reports/{id}` - Get report details (moderator/admin)
- `PATCH /reports/{id}/status` - Update report status (moderator/admin)
- `GET /reports/politician/{id}` - Get reports for politician (public)

### Search (`/api/v1/search`)

- `GET /search` - Global search
- `GET /search/politicians` - Search politicians
- `GET /search/cases` - Search cases
- `GET /search/promises` - Search promises

### Statistics (`/api/v1/stats`)

- `GET /stats/overview` - Platform overview
- `GET /stats/top-politicians` - Top performing politicians
- `GET /stats/by-party` - Stats by party
- `GET /stats/by-county` - Stats by county
- `GET /stats/reports-summary` - Reports summary

## Database Management

### Create Migration

```bash
alembic revision --autogenerate -m "Description of changes"
```

### Apply Migrations

```bash
alembic upgrade head
```

### Rollback Migration

```bash
alembic downgrade -1
```

### Check Current Version

```bash
alembic current
```

## User Roles

- **user** - Default role, can view data and submit reports
- **moderator** - Can review and update reports
- **admin** - Full access, can manage all data

## Development

### Code Style

The project follows PEP 8 style guide. Format code using:

```bash
black app/
```

### Type Checking

```bash
mypy app/
```

### Linting

```bash
flake8 app/
```

## Testing

Run tests:

```bash
pytest
```

Run with coverage:

```bash
pytest --cov=app --cov-report=html
```

## Common Tasks

### Create First Admin User

After starting the server, register a user and manually update their role in the database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

### Import Real Data

Use the data ingestion script:

```bash
alembic upgrade head
alembic current
python scripts/import_real_data.py --source wikidata --limit 1500 --strict-political --include-history --export-file data/raw/wikidata_politicians.json --dry-run
python scripts/scrape_parliament_profiles.py --source both --seed-file data/curated/politicians.json --discover --output-file data/raw/parliamentary_profiles_scraped.json --failed-file data/raw/parliamentary_profiles_failed.json
python scripts/import_real_data.py --source json --politicians-file data/curated/politicians.json --parliament-profiles-file data/curated/parliamentary_profiles.json --cases-file data/curated/cases.csv --promises-file data/curated/promises.csv
python scripts/recalculate_scores.py --dry-run
python scripts/recalculate_scores.py
```

See detailed workflow in `DATA_INGESTION.md`.

### Reset Database

```bash
alembic downgrade base
alembic upgrade head
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `SECRET_KEY` | Application secret key | Yes | - |
| `JWT_SECRET_KEY` | JWT signing key | Yes | - |
| `ALLOWED_ORIGINS` | CORS allowed origins | Yes | `http://localhost:3000` |
| `DEBUG` | Debug mode | No | `True` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiration | No | `30` |
| `OPENAI_API_KEY` | OpenAI API key (for scoring) | No | - |

## Deployment

### Docker

Build image:

```bash
docker build -t kenya-ni-yetu-api .
```

Run container:

```bash
docker run -p 8000:8000 --env-file .env kenya-ni-yetu-api
```

### Production Checklist

- [ ] Set `DEBUG=False`
- [ ] Use strong `SECRET_KEY` and `JWT_SECRET_KEY`
- [ ] Configure production database
- [ ] Set up HTTPS
- [ ] Configure CORS properly
- [ ] Set up monitoring (Sentry)
- [ ] Configure logging
- [ ] Set up database backups
- [ ] Use environment-specific settings
- [ ] Enable rate limiting

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Ensure database exists

### Import Errors

- Activate virtual environment
- Reinstall dependencies: `pip install -r requirements.txt`

### Migration Issues

- Check Alembic configuration in `alembic.ini`
- Verify models are imported in `alembic/env.py`

## Contributing

1. Create a feature branch
2. Make your changes
3. Write tests
4. Run tests and linting
5. Submit a pull request

## License

MIT License

## Support

For issues and questions, please open an issue on GitHub.

---

**Phase 1 Complete** ✅

Phase 2 will include:
- AI transparency scoring
- Background tasks with Celery
- News scraping
- File upload handling
- Email notifications

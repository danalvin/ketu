# Kenya ni Yetu - Backend API Specification

## Overview

This document outlines the comprehensive API requirements for the Kenya ni Yetu political transparency platform backend. The API should be built using **FastAPI** with **PostgreSQL** as the primary database.

## 🏗️ Architecture Requirements

### Tech Stack
- **Framework**: FastAPI (Python 3.9+)
- **Database**: PostgreSQL 14+
- **Authentication**: JWT with refresh tokens
- **File Storage**: AWS S3 or Vercel Blob
- **Search Engine**: Elasticsearch (optional for advanced search)
- **Cache**: Redis for session management and caching
- **Background Tasks**: Celery with Redis broker
- **API Documentation**: Auto-generated with FastAPI/OpenAPI

### Core Principles
- **RESTful Design**: Standard HTTP methods and status codes
- **Pagination**: Cursor-based pagination for large datasets
- **Rate Limiting**: Protect against abuse
- **Data Validation**: Pydantic models for request/response validation
- **Error Handling**: Consistent error response format
- **Audit Logging**: Track all data modifications
- **GDPR Compliance**: Data privacy and user rights

---

## 🔐 Authentication & Authorization

### Endpoints

#### POST `/auth/register`
Register a new user account.

**Request Body:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "full_name": "John Doe",
  "phone_number": "+254700000000",
  "organization": "Civil Society Org", // optional
  "role": "citizen" // citizen, journalist, researcher, admin
}
\`\`\`

**Response:**
\`\`\`json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "citizen",
  "is_verified": false,
  "created_at": "2024-01-15T10:30:00Z"
}
\`\`\`

#### POST `/auth/login`
Authenticate user and return JWT tokens.

**Request Body:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
\`\`\`

**Response:**
\`\`\`json
{
  "access_token": "jwt_access_token",
  "refresh_token": "jwt_refresh_token",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "user_id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "citizen"
  }
}
\`\`\`

#### POST `/auth/refresh`
Refresh access token using refresh token.

#### POST `/auth/logout`
Invalidate user session and tokens.

#### POST `/auth/forgot-password`
Initiate password reset process.

#### POST `/auth/reset-password`
Complete password reset with token.

---

## 👥 Politicians Management

### Core Politician Model
\`\`\`json
{
  "id": "uuid",
  "name": "Hon. Margaret Kenyatta",
  "slug": "margaret-kenyatta",
  "position": "Member of Parliament for Dagoretti North",
  "party": "Democratic Party",
  "county": "Nairobi",
  "constituency": "Dagoretti North", // if applicable
  "photo_url": "https://storage.com/photos/margaret.jpg",
  "bio": "Brief biography...",
  "date_of_birth": "1975-03-15",
  "education": [
    {
      "institution": "University of Nairobi",
      "degree": "Bachelor of Laws",
      "year": 1998,
      "verified": true
    }
  ],
  "contact_info": {
    "email": "margaret@parliament.go.ke",
    "phone": "+254700000000",
    "office_address": "Parliament Buildings, Nairobi"
  },
  "social_media": {
    "twitter": "@MargaretK",
    "facebook": "MargaretKenyatta",
    "instagram": "@margaretk_official"
  },
  "transparency_score": {
    "overall_score": 82,
    "confidence_level": 85,
    "last_updated": "2024-01-15T10:30:00Z",
    "breakdown": {
      "legal_record": 90,
      "promise_fulfillment": 78,
      "public_sentiment": 80,
      "education_verification": 95
    }
  },
  "term_info": {
    "start_date": "2022-08-29",
    "end_date": "2027-08-28",
    "term_number": 2,
    "previous_positions": ["MCA Ward Rep (2017-2022)"]
  },
  "metadata": {
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "created_by": "admin_user_id",
    "verification_status": "verified",
    "data_sources": ["IEBC", "Parliament", "Public Records"]
  }
}
\`\`\`

### Endpoints

#### GET `/politicians`
Get paginated list of politicians with filtering and search.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `search`: Search query (name, position, party)
- `party`: Filter by political party
- `county`: Filter by county
- `position`: Filter by position type
- `min_score`: Minimum transparency score
- `max_score`: Maximum transparency score
- `sort_by`: Sort field (name, score, updated_at)
- `sort_order`: Sort direction (asc, desc)

**Response:**
\`\`\`json
{
  "data": [/* array of politician objects */],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_items": 2567,
    "total_pages": 129,
    "has_next": true,
    "has_previous": false
  },
  "filters_applied": {
    "search": "margaret",
    "party": "Democratic Party",
    "county": "Nairobi"
  }
}
\`\`\`

#### GET `/politicians/{politician_id}`
Get detailed politician profile.

#### POST `/politicians` (Admin only)
Create new politician profile.

#### PUT `/politicians/{politician_id}` (Admin only)
Update politician profile.

#### DELETE `/politicians/{politician_id}` (Admin only)
Soft delete politician profile.

#### GET `/politicians/{politician_id}/score-history`
Get transparency score history over time.

**Response:**
\`\`\`json
{
  "politician_id": "uuid",
  "score_history": [
    {
      "date": "2024-01-01",
      "overall_score": 78,
      "breakdown": {
        "legal_record": 85,
        "promise_fulfillment": 70,
        "public_sentiment": 75,
        "education_verification": 95
      },
      "confidence_level": 82
    }
  ]
}
\`\`\`

---

## ⚖️ Legal Cases & Investigations

### Case Model
\`\`\`json
{
  "id": "uuid",
  "politician_id": "uuid",
  "title": "Allegations of Land Irregularities",
  "case_number": "CASE-2024-001",
  "description": "Investigation into alleged irregular acquisition...",
  "category": "corruption", // corruption, misuse_of_funds, violence, electoral_malpractice
  "status": "ongoing", // ongoing, closed, dismissed, under_appeal
  "severity": "high", // low, medium, high, critical
  "date_filed": "2022-03-15",
  "date_updated": "2024-01-15T10:30:00Z",
  "court_details": {
    "court_name": "High Court of Kenya",
    "case_number": "HC-2022-001",
    "judge": "Hon. Justice Smith"
  },
  "parties_involved": [
    {
      "name": "Ethics and Anti-Corruption Commission",
      "role": "plaintiff"
    },
    {
      "name": "Hon. Margaret Kenyatta",
      "role": "defendant"
    }
  ],
  "documents": [
    {
      "id": "uuid",
      "title": "Charge Sheet",
      "file_url": "https://storage.com/docs/charge-sheet.pdf",
      "file_type": "pdf",
      "upload_date": "2022-03-15T10:00:00Z",
      "is_public": true
    }
  ],
  "timeline": [
    {
      "date": "2022-03-15",
      "event": "Case Filed",
      "description": "Initial charges filed by EACC"
    }
  ],
  "outcome": null, // populated when case is closed
  "impact_on_score": -5, // how this case affects transparency score
  "metadata": {
    "created_at": "2022-03-15T10:00:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "data_sources": ["Court Records", "EACC", "Media Reports"]
  }
}
\`\`\`

### Endpoints

#### GET `/cases`
Get paginated list of legal cases.

#### GET `/cases/{case_id}`
Get detailed case information.

#### GET `/politicians/{politician_id}/cases`
Get all cases for a specific politician.

#### POST `/cases` (Admin only)
Create new case record.

#### PUT `/cases/{case_id}` (Admin only)
Update case information.

---

## 🎯 Promises & Projects Tracking

### Promise Model
\`\`\`json
{
  "id": "uuid",
  "politician_id": "uuid",
  "title": "Construct New Health Clinic in Riruta",
  "description": "Build a modern health clinic to serve Riruta residents...",
  "category": "healthcare", // healthcare, education, infrastructure, economic
  "promise_date": "2022-08-01", // when promise was made
  "target_completion": "2024-12-31",
  "actual_completion": null,
  "status": "in_progress", // not_started, in_progress, completed, delayed, cancelled
  "progress_percentage": 75,
  "budget": {
    "allocated": 15000000, // KES
    "spent": 11250000,
    "currency": "KES"
  },
  "location": {
    "county": "Nairobi",
    "constituency": "Dagoretti North",
    "ward": "Riruta",
    "coordinates": {
      "latitude": -1.2921,
      "longitude": 36.8219
    }
  },
  "milestones": [
    {
      "id": "uuid",
      "title": "Site Preparation",
      "description": "Clear and prepare construction site",
      "target_date": "2023-01-31",
      "completion_date": "2023-01-28",
      "status": "completed",
      "progress_percentage": 100
    }
  ],
  "evidence": [
    {
      "id": "uuid",
      "type": "photo",
      "title": "Construction Progress - January 2024",
      "file_url": "https://storage.com/evidence/construction-jan-2024.jpg",
      "upload_date": "2024-01-15T10:00:00Z",
      "uploaded_by": "citizen_user_id",
      "verified": true
    }
  ],
  "impact_metrics": {
    "beneficiaries": 5000,
    "jobs_created": 25,
    "economic_impact": 2000000
  },
  "verification": {
    "last_verified": "2024-01-15T10:00:00Z",
    "verified_by": "field_officer_id",
    "verification_method": "site_visit",
    "verification_notes": "Construction is 75% complete as reported"
  },
  "metadata": {
    "created_at": "2022-08-01T10:00:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "data_sources": ["Campaign Manifesto", "Budget Documents", "Site Visits"]
  }
}
\`\`\`

### Endpoints

#### GET `/promises`
Get paginated list of political promises.

#### GET `/promises/{promise_id}`
Get detailed promise information.

#### GET `/politicians/{politician_id}/promises`
Get all promises for a specific politician.

#### POST `/promises` (Admin only)
Create new promise record.

#### PUT `/promises/{promise_id}` (Admin only)
Update promise information.

#### POST `/promises/{promise_id}/evidence`
Upload evidence for promise progress (authenticated users).

---

## 🕸️ Political Linkages & Relationships

### Relationship Model
\`\`\`json
{
  "id": "uuid",
  "type": "hyperedge", // hyperedge, direct_relationship
  "label": "Budget Committee",
  "description": "Joint committee overseeing national budget allocation",
  "relationship_type": "committee", // committee, event, funding, family, business, party
  "members": [
    {
      "politician_id": "uuid",
      "role": "chairperson",
      "start_date": "2022-09-01",
      "end_date": null,
      "influence_level": 0.9
    }
  ],
  "strength": 0.85, // relationship strength (0-1)
  "confidence": 0.92, // confidence in relationship data (0-1)
  "start_date": "2022-09-01",
  "end_date": null,
  "status": "active", // active, inactive, dissolved
  "evidence": [
    {
      "type": "document",
      "title": "Committee Appointment Letter",
      "file_url": "https://storage.com/docs/appointment.pdf",
      "date": "2022-09-01"
    }
  ],
  "impact_metrics": {
    "budget_oversight": 50000000000, // KES
    "decisions_made": 45,
    "public_meetings": 12
  },
  "metadata": {
    "created_at": "2022-09-01T10:00:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "data_sources": ["Parliament Records", "Committee Minutes", "Public Records"]
  }
}
\`\`\`

### Endpoints

#### GET `/relationships`
Get political relationships with filtering.

#### GET `/relationships/{relationship_id}`
Get detailed relationship information.

#### GET `/politicians/{politician_id}/relationships`
Get all relationships for a specific politician.

#### GET `/politicians/{politician_id}/network`
Get network graph data for hypergraph visualization.

**Response:**
\`\`\`json
{
  "nodes": [
    {
      "id": "uuid",
      "label": "Hon. Margaret Kenyatta",
      "type": "politician",
      "properties": {
        "position": "MP",
        "party": "Democratic Party",
        "score": 82
      }
    }
  ],
  "edges": [
    {
      "id": "uuid",
      "source": "politician_id",
      "target": "relationship_id",
      "type": "member_of",
      "strength": 0.85,
      "properties": {
        "role": "chairperson",
        "start_date": "2022-09-01"
      }
    }
  ],
  "hyperedges": [
    {
      "id": "uuid",
      "label": "Budget Committee",
      "type": "committee",
      "members": ["politician_id_1", "politician_id_2"],
      "strength": 0.85,
      "properties": {
        "description": "Joint committee...",
        "start_date": "2022-09-01"
      }
    }
  ]
}
\`\`\`

---

## 🚨 Flagged Updates & Incident Reporting

### Flagged Update Model
\`\`\`json
{
  "id": "uuid",
  "report_id": "ALRT-001",
  "politician_id": "uuid",
  "reporter": {
    "user_id": "uuid", // null if anonymous
    "name": "Anonymous Citizen",
    "organization": "Transparency International",
    "contact_email": "reporter@example.com", // encrypted if anonymous
    "is_anonymous": true
  },
  "incident": {
    "title": "Allegations of Misuse of Public Funds",
    "description": "Reports indicate irregular allocation...",
    "category": "financial_misconduct",
    "subcategory": "misuse_of_funds",
    "severity": "high",
    "date_occurred": "2024-07-15",
    "location": {
      "county": "Nairobi",
      "constituency": "Dagoretti North",
      "specific_location": "CDF Office",
      "coordinates": {
        "latitude": -1.2921,
        "longitude": 36.8219
      }
    }
  },
  "status": "under_review", // submitted, under_review, investigating, verified, dismissed
  "priority": "high", // low, medium, high, critical
  "investigation": {
    "assigned_to": "investigator_user_id",
    "start_date": "2024-07-29T10:00:00Z",
    "expected_completion": "2024-08-15T10:00:00Z",
    "current_stage": "evidence_collection",
    "progress_percentage": 35,
    "findings": "Preliminary investigation reveals...",
    "recommendations": []
  },
  "evidence": [
    {
      "id": "uuid",
      "type": "document", // document, photo, video, audio, witness_statement
      "title": "Procurement Records",
      "description": "Official procurement documents showing irregular processes",
      "file_url": "https://storage.com/evidence/procurement-records.pdf",
      "file_hash": "sha256_hash",
      "file_size": 2048576,
      "upload_date": "2024-07-28T15:30:00Z",
      "uploaded_by": "reporter_user_id",
      "verification_status": "verified", // pending, verified, rejected
      "verified_by": "admin_user_id",
      "verified_date": "2024-07-29T09:00:00Z"
    }
  ],
  "timeline": [
    {
      "date": "2024-07-28T14:00:00Z",
      "event": "Report Submitted",
      "description": "Initial report received from anonymous citizen",
      "actor": "system",
      "status": "completed"
    }
  ],
  "related_reports": ["uuid1", "uuid2"], // related flagged updates
  "impact_assessment": {
    "estimated_financial_loss": 15000000, // KES
    "people_affected": 5000,
    "institutions_involved": ["CDF", "County Government"],
    "media_coverage": 3, // number of media mentions
    "public_interest_score": 0.85
  },
  "resolution": {
    "outcome": null, // pending, verified, dismissed, referred_to_authorities
    "resolution_date": null,
    "resolution_notes": null,
    "actions_taken": [],
    "follow_up_required": true
  },
  "metadata": {
    "created_at": "2024-07-28T14:00:00Z",
    "updated_at": "2024-08-01T10:30:00Z",
    "ip_address": "192.168.1.1", // for audit trail
    "user_agent": "Mozilla/5.0...",
    "data_retention_date": "2029-07-28T14:00:00Z" // GDPR compliance
  }
}
\`\`\`

### Endpoints

#### GET `/flagged-updates`
Get paginated list of flagged updates with filtering.

**Query Parameters:**
- `status`: Filter by status
- `priority`: Filter by priority
- `category`: Filter by incident category
- `politician_id`: Filter by politician
- `date_from`: Filter by date range
- `date_to`: Filter by date range
- `assigned_to`: Filter by investigator

#### GET `/flagged-updates/{update_id}`
Get detailed flagged update information.

#### POST `/flagged-updates`
Submit new incident report.

**Request Body:**
\`\`\`json
{
  "politician_id": "uuid",
  "incident": {
    "title": "Incident title",
    "description": "Detailed description",
    "category": "financial_misconduct",
    "date_occurred": "2024-07-15",
    "location": {
      "county": "Nairobi",
      "specific_location": "CDF Office"
    }
  },
  "reporter": {
    "name": "John Doe", // optional if anonymous
    "organization": "NGO Name", // optional
    "contact_email": "john@example.com", // optional
    "is_anonymous": false
  },
  "evidence_files": ["file_id_1", "file_id_2"] // uploaded file IDs
}
\`\`\`

#### PUT `/flagged-updates/{update_id}` (Admin/Investigator only)
Update flagged update status and investigation details.

#### POST `/flagged-updates/{update_id}/evidence`
Add evidence to existing flagged update.

#### GET `/flagged-updates/{update_id}/timeline`
Get detailed timeline of investigation progress.

---

## 📊 Analytics & Statistics

### Dashboard Statistics
#### GET `/analytics/dashboard`
Get dashboard statistics for home page.

**Response:**
\`\`\`json
{
  "politicians": {
    "total_tracked": 2567,
    "verified_profiles": 2340,
    "average_score": 72.5,
    "score_distribution": {
      "excellent": 234, // 80-100
      "good": 1156,     // 60-79
      "fair": 890,      // 40-59
      "poor": 287       // 0-39
    }
  },
  "reports": {
    "total_submitted": 12890,
    "under_investigation": 45,
    "verified_cases": 234,
    "dismissed_cases": 156
  },
  "activity": {
    "last_update": "2024-01-15T10:30:00Z",
    "daily_new_reports": 15,
    "weekly_score_updates": 89,
    "monthly_new_politicians": 12
  },
  "trending": {
    "most_searched": [
      {
        "politician_id": "uuid",
        "name": "Hon. Margaret Kenyatta",
        "search_count": 1250
      }
    ],
    "recent_updates": [
      {
        "politician_id": "uuid",
        "name": "Hon. John Doe",
        "score_change": -5,
        "reason": "New corruption case filed"
      }
    ]
  }
}
\`\`\`

### Search Analytics
#### GET `/analytics/search`
Get search analytics and trending queries.

### Score Analytics
#### GET `/analytics/scores`
Get transparency score analytics and trends.

#### GET `/analytics/scores/distribution`
Get score distribution across different demographics.

---

## 📁 File Management

### File Upload
#### POST `/files/upload`
Upload files (evidence, documents, photos).

**Request:** Multipart form data
- `file`: File to upload
- `category`: File category (evidence, document, photo)
- `description`: File description
- `is_public`: Whether file is publicly accessible

**Response:**
\`\`\`json
{
  "file_id": "uuid",
  "filename": "evidence.pdf",
  "file_url": "https://storage.com/files/uuid.pdf",
  "file_size": 2048576,
  "file_type": "application/pdf",
  "upload_date": "2024-01-15T10:30:00Z",
  "is_public": true,
  "virus_scan_status": "clean"
}
\`\`\`

#### GET `/files/{file_id}`
Download or view file (with access control).

#### DELETE `/files/{file_id}` (Admin only)
Delete file from storage.

---

## 🔔 Notifications & Alerts

### Real-time Notifications
#### GET `/notifications`
Get user notifications.

#### POST `/notifications/mark-read`
Mark notifications as read.

#### WebSocket `/ws/notifications`
Real-time notification stream.

### Alert Subscriptions
#### POST `/alerts/subscribe`
Subscribe to alerts for specific politicians or categories.

#### GET `/alerts/subscriptions`
Get user's alert subscriptions.

#### DELETE `/alerts/subscriptions/{subscription_id}`
Unsubscribe from alerts.

---

## 🔍 Search & Discovery

### Advanced Search
#### GET `/search`
Advanced search across all content types.

**Query Parameters:**
- `q`: Search query
- `type`: Content type (politicians, cases, promises, reports)
- `filters`: JSON object with filters
- `sort`: Sort criteria
- `page`: Page number
- `limit`: Results per page

**Response:**
\`\`\`json
{
  "query": "corruption nairobi",
  "results": {
    "politicians": {
      "total": 15,
      "items": [/* politician objects */]
    },
    "cases": {
      "total": 8,
      "items": [/* case objects */]
    },
    "reports": {
      "total": 23,
      "items": [/* report objects */]
    }
  },
  "suggestions": ["corruption cases nairobi", "nairobi county corruption"],
  "filters_applied": {
    "location": "nairobi",
    "category": "corruption"
  },
  "execution_time": 0.045
}
\`\`\`

### Auto-complete
#### GET `/search/autocomplete`
Get search suggestions and auto-complete.

---

## 📈 Reporting & Export

### Data Export
#### GET `/export/politicians`
Export politician data (CSV, JSON, Excel).

#### GET `/export/reports`
Export flagged updates data.

#### GET `/export/analytics`
Export analytics data.

### Custom Reports
#### POST `/reports/generate`
Generate custom reports based on criteria.

---

## ⚙️ System Administration

### User Management (Admin only)
#### GET `/admin/users`
Get all users with filtering.

#### PUT `/admin/users/{user_id}`
Update user roles and permissions.

#### DELETE `/admin/users/{user_id}`
Deactivate user account.

### System Health
#### GET `/health`
System health check.

#### GET `/metrics`
System metrics (Prometheus format).

### Audit Logs
#### GET `/admin/audit-logs`
Get system audit logs.

---

## 🔒 Security & Privacy

### Data Protection
- **Encryption**: All sensitive data encrypted at rest and in transit
- **Anonymization**: Support for anonymous reporting with data protection
- **GDPR Compliance**: Data retention policies and user rights
- **Audit Trail**: Complete audit log of all data access and modifications

### Rate Limiting
- **Authentication**: 5 attempts per minute
- **Search**: 100 requests per minute per user
- **File Upload**: 10 uploads per minute per user
- **Report Submission**: 5 reports per hour per user

### Access Control
- **Role-based**: Admin, Investigator, Journalist, Researcher, Citizen
- **Resource-based**: Fine-grained permissions on specific resources
- **API Keys**: For programmatic access (researchers, media)

---

## 📋 Implementation Priorities

### Phase 1 (MVP)
1. **Authentication & User Management**
2. **Politician CRUD Operations**
3. **Basic Search & Filtering**
4. **Transparency Scoring System**
5. **Report Submission System**

### Phase 2 (Enhanced Features)
1. **Legal Cases Management**
2. **Promises Tracking**
3. **File Upload & Management**
4. **Advanced Analytics**
5. **Notification System**

### Phase 3 (Advanced Features)
1. **Political Linkages & Hypergraph**
2. **Real-time Updates**
3. **Advanced Search (Elasticsearch)**
4. **Custom Reports & Export**
5. **API for Third-party Integration**

---

## 🧪 Testing Requirements

### API Testing
- **Unit Tests**: 90%+ code coverage
- **Integration Tests**: All endpoint combinations
- **Load Testing**: Handle 1000+ concurrent users
- **Security Testing**: OWASP compliance

### Data Quality
- **Validation**: Comprehensive input validation
- **Sanitization**: XSS and injection prevention
- **Consistency**: Data integrity checks
- **Backup**: Automated daily backups

---

## 📚 Documentation

### API Documentation
- **OpenAPI/Swagger**: Auto-generated interactive docs
- **Postman Collection**: Complete API collection
- **SDK**: Python and JavaScript client libraries
- **Examples**: Code examples for common use cases

### Developer Resources
- **Setup Guide**: Local development setup
- **Deployment Guide**: Production deployment
- **Contributing Guide**: Code contribution guidelines
- **Architecture Guide**: System architecture overview

This comprehensive API specification provides the foundation for building a robust, scalable, and secure backend for the Kenya ni Yetu platform. The API is designed to support all frontend features while maintaining flexibility for future enhancements.

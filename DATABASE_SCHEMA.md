# Kenya ni Yetu - Database Schema Design

## Overview

This document outlines the PostgreSQL database schema for the Kenya ni Yetu platform. The schema is designed for scalability, data integrity, and efficient querying.

## 🗄️ Core Tables

### Users & Authentication

\`\`\`sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    organization VARCHAR(255),
    role user_role NOT NULL DEFAULT 'citizen',
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified_at TIMESTAMP,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User roles enum
CREATE TYPE user_role AS ENUM ('citizen', 'journalist', 'researcher', 'investigator', 'admin');

-- User sessions for JWT management
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);
\`\`\`

### Politicians & Profiles

\`\`\`sql
-- Politicians table
CREATE TABLE politicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    position VARCHAR(255) NOT NULL,
    party VARCHAR(255),
    county VARCHAR(100),
    constituency VARCHAR(255),
    ward VARCHAR(255),
    photo_url TEXT,
    bio TEXT,
    date_of_birth DATE,
    gender gender_type,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    office_address TEXT,
    social_media JSONB, -- {twitter, facebook, instagram, etc.}
    term_start_date DATE,
    term_end_date DATE,
    term_number INTEGER DEFAULT 1,
    previous_positions TEXT[],
    verification_status verification_status DEFAULT 'pending',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    data_sources TEXT[]
);

-- Enums for politicians
CREATE TYPE gender_type AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected', 'under_review');

-- Education records
CREATE TABLE politician_education (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID REFERENCES politicians(id) ON DELETE CASCADE,
    institution VARCHAR(255) NOT NULL,
    degree VARCHAR(255) NOT NULL,
    field_of_study VARCHAR(255),
    graduation_year INTEGER,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_date TIMESTAMP,
    verification_source VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transparency scores
CREATE TABLE transparency_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID REFERENCES politicians(id) ON DELETE CASCADE,
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
    confidence_level INTEGER CHECK (confidence_level >= 0 AND confidence_level <= 100),
    legal_record_score INTEGER CHECK (legal_record_score >= 0 AND legal_record_score <= 100),
    promise_fulfillment_score INTEGER CHECK (promise_fulfillment_score >= 0 AND promise_fulfillment_score <= 100),
    public_sentiment_score INTEGER CHECK (public_sentiment_score >= 0 AND public_sentiment_score <= 100),
    education_verification_score INTEGER CHECK (education_verification_score >= 0 AND education_verification_score <= 100),
    calculation_method TEXT,
    data_sources TEXT[],
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_current BOOLEAN DEFAULT TRUE
);
\`\`\`

### Legal Cases & Investigations

\`\`\`sql
-- Legal cases
CREATE TABLE legal_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID REFERENCES politicians(id) ON DELETE CASCADE,
    case_number VARCHAR(100) UNIQUE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    category case_category NOT NULL,
    status case_status NOT NULL DEFAULT 'ongoing',
    severity case_severity NOT NULL DEFAULT 'medium',
    date_filed DATE,
    date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    court_name VARCHAR(255),
    court_case_number VARCHAR(100),
    judge_name VARCHAR(255),
    outcome TEXT,
    impact_on_score INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_sources TEXT[]
);

-- Case enums
CREATE TYPE case_category AS ENUM ('corruption', 'misuse_of_funds', 'violence', 'electoral_malpractice', 'abuse_of_office', 'other');
CREATE TYPE case_status AS ENUM ('ongoing', 'closed', 'dismissed', 'under_appeal', 'settled');
CREATE TYPE case_severity AS ENUM ('low', 'medium', 'high', 'critical');

-- Case parties (plaintiffs, defendants, witnesses)
CREATE TABLE case_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES legal_cases(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role party_role NOT NULL,
    organization VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE party_role AS ENUM ('plaintiff', 'defendant', 'witness', 'lawyer', 'other');

-- Case timeline
CREATE TABLE case_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES legal_cases(id) ON DELETE CASCADE,
    event_date DATE NOT NULL,
    event_title VARCHAR(255) NOT NULL,
    event_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### Promises & Projects

\`\`\`sql
-- Political promises
CREATE TABLE promises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    politician_id UUID REFERENCES politicians(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    category promise_category NOT NULL,
    promise_date DATE NOT NULL,
    target_completion_date DATE,
    actual_completion_date DATE,
    status promise_status NOT NULL DEFAULT 'not_started',
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    budget_allocated DECIMAL(15,2),
    budget_spent DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'KES',
    location_county VARCHAR(100),
    location_constituency VARCHAR(255),
    location_ward VARCHAR(255),
    location_coordinates POINT,
    beneficiaries_count INTEGER,
    jobs_created INTEGER,
    economic_impact DECIMAL(15,2),
    last_verified_date TIMESTAMP,
    verified_by UUID REFERENCES users(id),
    verification_method VARCHAR(100),
    verification_notes TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_sources TEXT[]
);

-- Promise enums
CREATE TYPE promise_category AS ENUM ('healthcare', 'education', 'infrastructure', 'economic', 'security', 'environment', 'social', 'other');
CREATE TYPE promise_status AS ENUM ('not_started', 'in_progress', 'completed', 'delayed', 'cancelled', 'on_hold');

-- Promise milestones
CREATE TABLE promise_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promise_id UUID REFERENCES promises(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATE,
    completion_date DATE,
    status milestone_status NOT NULL DEFAULT 'pending',
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE milestone_status AS ENUM ('pending', 'in_progress', 'completed', 'delayed', 'cancelled');
\`\`\`

### Political Relationships & Networks

\`\`\`sql
-- Political relationships (hypergraph edges)
CREATE TABLE political_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label VARCHAR(255) NOT NULL,
    description TEXT,
    relationship_type relationship_type NOT NULL,
    strength DECIMAL(3,2) CHECK (strength >= 0 AND strength <= 1),
    confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    start_date DATE,
    end_date DATE,
    status relationship_status DEFAULT 'active',
    budget_oversight DECIMAL(15,2),
    decisions_made INTEGER DEFAULT 0,
    public_meetings INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_sources TEXT[]
);

-- Relationship types
CREATE TYPE relationship_type AS ENUM ('committee', 'event', 'funding', 'family', 'business', 'party', 'coalition', 'other');
CREATE TYPE relationship_status AS ENUM ('active', 'inactive', 'dissolved', 'suspended');

-- Relationship members (many-to-many)
CREATE TABLE relationship_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id UUID REFERENCES political_relationships(id) ON DELETE CASCADE,
    politician_id UUID REFERENCES politicians(id) ON DELETE CASCADE,
    role VARCHAR(100),
    influence_level DECIMAL(3,2) CHECK (influence_level >= 0 AND influence_level <= 1),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(relationship_id, politician_id)
);
\`\`\`

### Flagged Updates & Incident Reporting

\`\`\`sql
-- Flagged updates
CREATE TABLE flagged_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id VARCHAR(20) UNIQUE NOT NULL, -- ALRT-001 format
    politician_id UUID REFERENCES politicians(id) ON DELETE CASCADE,
    reporter_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reporter_name VARCHAR(255),
    reporter_organization VARCHAR(255),
    reporter_contact_email VARCHAR(255), -- encrypted if anonymous
    is_anonymous BOOLEAN DEFAULT FALSE,
    incident_title VARCHAR(500) NOT NULL,
    incident_description TEXT NOT NULL,
    incident_category incident_category NOT NULL,
    incident_subcategory VARCHAR(100),
    severity incident_severity NOT NULL DEFAULT 'medium',
    date_occurred DATE,
    location_county VARCHAR(100),
    location_constituency VARCHAR(255),
    location_specific TEXT,
    location_coordinates POINT,
    status report_status NOT NULL DEFAULT 'submitted',
    priority report_priority NOT NULL DEFAULT 'medium',
    assigned_to UUID REFERENCES users(id),
    investigation_start_date TIMESTAMP,
    investigation_expected_completion TIMESTAMP,
    investigation_stage VARCHAR(100),
    investigation_progress INTEGER DEFAULT 0 CHECK (investigation_progress >= 0 AND investigation_progress <= 100),
    investigation_findings TEXT,
    investigation_recommendations TEXT[],
    estimated_financial_loss DECIMAL(15,2),
    people_affected INTEGER,
    institutions_involved TEXT[],
    media_coverage_count INTEGER DEFAULT 0,
    public_interest_score DECIMAL(3,2) CHECK (public_interest_score >= 0 AND public_interest_score <= 1),
    resolution_outcome resolution_outcome,
    resolution_date TIMESTAMP,
    resolution_notes TEXT,
    actions_taken TEXT[],
    follow_up_required BOOLEAN DEFAULT TRUE,
    ip_address INET,
    user_agent TEXT,
    data_retention_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Flagged update enums
CREATE TYPE incident_category AS ENUM ('financial_misconduct', 'abuse_of_office', 'electoral_violations', 'service_failure', 'violence_intimidation', 'other');
CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE report_status AS ENUM ('submitted', 'under_review', 'investigating', 'verified', 'dismissed', 'closed');
CREATE TYPE report_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE resolution_outcome AS ENUM ('pending', 'verified', 'dismissed', 'referred_to_authorities', 'resolved');

-- Flagged update timeline
CREATE TABLE flagged_update_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flagged_update_id UUID REFERENCES flagged_updates(id) ON DELETE CASCADE,
    event_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    event_title VARCHAR(255) NOT NULL,
    event_description TEXT,
    actor_user_id UUID REFERENCES users(id),
    actor_name VARCHAR(255) DEFAULT 'System',
    status timeline_status NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE timeline_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Related reports (many-to-many)
CREATE TABLE related_flagged_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_update_id UUID REFERENCES flagged_updates(id) ON DELETE CASCADE,
    related_update_id UUID REFERENCES flagged_updates(id) ON DELETE CASCADE,
    relationship_type VARCHAR(100) DEFAULT 'related',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(primary_update_id, related_update_id)
);
\`\`\`

### File Management

\`\`\`sql
-- Files and documents
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64) NOT NULL, -- SHA-256 hash
    category file_category NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    virus_scan_status virus_scan_status DEFAULT 'pending',
    virus_scan_date TIMESTAMP,
    uploaded_by UUID REFERENCES users(id),
    upload_ip INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP -- for temporary files
);

-- File enums
CREATE TYPE file_category AS ENUM ('evidence', 'document', 'photo', 'video', 'audio', 'other');
CREATE TYPE virus_scan_status AS ENUM ('pending', 'clean', 'infected', 'error');

-- File associations (polymorphic)
CREATE TABLE file_associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- 'politician', 'case', 'promise', 'flagged_update'
    entity_id UUID NOT NULL,
    association_type VARCHAR(50) DEFAULT 'attachment', -- 'attachment', 'evidence', 'photo'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### Analytics & Tracking

\`\`\`sql
-- Search analytics
CREATE TABLE search_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    search_query TEXT NOT NULL,
    search_type VARCHAR(50), -- 'politicians', 'cases', 'promises', 'reports'
    filters_applied JSONB,
    results_count INTEGER,
    clicked_result_id UUID,
    clicked_result_type VARCHAR(50),
    session_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Page views and interactions
CREATE TABLE page_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    page_type VARCHAR(50) NOT NULL, -- 'politician_profile', 'case_detail', etc.
    entity_id UUID,
    session_id VARCHAR(100),
    referrer TEXT,
    ip_address INET,
    user_agent TEXT,
    view_duration INTEGER, -- seconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System metrics
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit VARCHAR(20),
    tags JSONB,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### Notifications & Alerts

\`\`\`sql
-- User notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type notification_type NOT NULL,
    entity_type VARCHAR(50), -- 'politician', 'case', 'promise', 'flagged_update'
    entity_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    priority notification_priority DEFAULT 'normal',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification enums
CREATE TYPE notification_type AS ENUM ('score_update', 'new_case', 'promise_update', 'report_status', 'system', 'other');
CREATE TYPE notification_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- Alert subscriptions
CREATE TABLE alert_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subscription_type subscription_type NOT NULL,
    entity_id UUID, -- politician_id, case_id, etc.
    filters JSONB, -- additional filters
    delivery_method delivery_method[] DEFAULT ARRAY['in_app'],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscription enums
CREATE TYPE subscription_type AS ENUM ('politician_updates', 'case_updates', 'promise_updates', 'new_reports', 'score_changes');
CREATE TYPE delivery_method AS ENUM ('in_app', 'email', 'sms', 'push');
\`\`\`

### Audit & Logging

\`\`\`sql
-- Audit log for all data changes
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action audit_action NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'SELECT');

-- API access log
CREATE TABLE api_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time INTEGER, -- milliseconds
    request_size INTEGER, -- bytes
    response_size INTEGER, -- bytes
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

## 🔍 Indexes for Performance

\`\`\`sql
-- Politicians indexes
CREATE INDEX idx_politicians_name ON politicians USING gin(to_tsvector('english', name));
CREATE INDEX idx_politicians_party ON politicians(party);
CREATE INDEX idx_politicians_county ON politicians(county);
CREATE INDEX idx_politicians_active ON politicians(is_active);
CREATE INDEX idx_politicians_verification ON politicians(verification_status);

-- Transparency scores indexes
CREATE INDEX idx_transparency_scores_politician ON transparency_scores(politician_id);
CREATE INDEX idx_transparency_scores_current ON transparency_scores(is_current);
CREATE INDEX idx_transparency_scores_overall ON transparency_scores(overall_score);

-- Legal cases indexes
CREATE INDEX idx_legal_cases_politician ON legal_cases(politician_id);
CREATE INDEX idx_legal_cases_status ON legal_cases(status);
CREATE INDEX idx_legal_cases_category ON legal_cases(category);
CREATE INDEX idx_legal_cases_date_filed ON legal_cases(date_filed);

-- Promises indexes
CREATE INDEX idx_promises_politician ON promises(politician_id);
CREATE INDEX idx_promises_status ON promises(status);
CREATE INDEX idx_promises_category ON promises(category);
CREATE INDEX idx_promises_location ON promises(location_county, location_constituency);

-- Flagged updates indexes
CREATE INDEX idx_flagged_updates_politician ON flagged_updates(politician_id);
CREATE INDEX idx_flagged_updates_status ON flagged_updates(status);
CREATE INDEX idx_flagged_updates_priority ON flagged_updates(priority);
CREATE INDEX idx_flagged_updates_category ON flagged_updates(incident_category);
CREATE INDEX idx_flagged_updates_date ON flagged_updates(created_at);
CREATE INDEX idx_flagged_updates_reporter ON flagged_updates(reporter_user_id);

-- Files indexes
CREATE INDEX idx_files_category ON files(category);
CREATE INDEX idx_files_uploaded_by ON files(uploaded_by);
CREATE INDEX idx_files_hash ON files(file_hash);

-- Analytics indexes
CREATE INDEX idx_search_analytics_query ON search_analytics USING gin(to_tsvector('english', search_query));
CREATE INDEX idx_search_analytics_date ON search_analytics(created_at);
CREATE INDEX idx_page_views_entity ON page_views(page_type, entity_id);
CREATE INDEX idx_page_views_date ON page_views(created_at);

-- Notifications indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
\`\`\`

## 🔄 Database Functions & Triggers

\`\`\`sql
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_politicians_updated_at BEFORE UPDATE ON politicians
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_legal_cases_updated_at BEFORE UPDATE ON legal_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promises_updated_at BEFORE UPDATE ON promises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flagged_updates_updated_at BEFORE UPDATE ON flagged_updates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create audit log entries
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values, user_id)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP::audit_action, row_to_json(OLD), current_setting('app.current_user_id', true)::UUID);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP::audit_action, row_to_json(OLD), row_to_json(NEW), current_setting('app.current_user_id', true)::UUID);
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, record_id, action, new_values, user_id)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP::audit_action, row_to_json(NEW), current_setting('app.current_user_id', true)::UUID);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_politicians AFTER INSERT OR UPDATE OR DELETE ON politicians
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_transparency_scores AFTER INSERT OR UPDATE OR DELETE ON transparency_scores
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_flagged_updates AFTER INSERT OR UPDATE OR DELETE ON flagged_updates
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();
\`\`\`

This comprehensive database schema provides:

1. **Scalable Design**: Proper normalization and indexing
2. **Data Integrity**: Foreign keys, constraints, and validation
3. **Audit Trail**: Complete tracking of all changes
4. **Performance**: Strategic indexes for common queries
5. **Flexibility**: JSONB fields for dynamic data
6. **Security**: Proper data types and constraints
7. **Analytics**: Built-in tracking and metrics tables

The schema supports all frontend features while maintaining data consistency and performance at scale.

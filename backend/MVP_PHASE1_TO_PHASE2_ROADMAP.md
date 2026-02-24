# MVP Phase 1 to Phase 2 Roadmap

## Phase 1 MVP (Release-Ready Baseline)

### API and Data
- [x] Core auth, politician, reports, search, stats routes implemented
- [x] Fixed report route ordering conflicts (`/reports/politician/*`, `/reports/public/*`)
- [x] Fixed inflated stats aggregation in `/stats/top-politicians`
- [x] Added real linkage/report counts on politician detail
- [x] Added public report list/detail endpoints for frontend consumption
- [x] Added initial Alembic migration for baseline schema

### Frontend Integration
- [x] Added shared API client (`lib/api.ts`)
- [x] Wired home featured politicians + quick stats to backend
- [x] Wired search page to live politician API filters
- [x] Wired explore page to live politician listings
- [x] Wired politician profile page to live detail/cases/promises
- [x] Wired report submission page to backend report creation
- [x] Wired flagged updates and alerts pages to live public report/stat data

### Remaining MVP Gaps
- [ ] Add automated tests for API routes and frontend integration paths
- [ ] Re-enable strict build gates (`next.config.mjs` currently ignores lint/type errors)
- [ ] Add CI pipeline for lint/type/test/migrations checks
- [ ] Add production seed script and admin bootstrap command
- [ ] Implement email senders for verification/reset password
- [ ] Implement file upload handling for report evidence

## Phase 2 (After MVP Release)

### Priority Track A: Reliability & Scale
- [ ] Redis caching and cache invalidation strategy
- [ ] Rate limiting middleware by auth role/IP
- [ ] Background workers (Celery) for heavy jobs
- [ ] Structured logging, monitoring, and alerting

### Priority Track B: Intelligence Features
- [ ] AI-assisted scoring service and scheduled score refresh
- [ ] News ingestion and sentiment pipeline
- [ ] Semantic search/embeddings for politicians, cases, promises

### Priority Track C: Trust & Moderation
- [ ] Source verification workflows and moderation audit trail
- [ ] Notification center (email + in-app)
- [ ] Comment and reputation subsystem

### Exit Criteria for Phase 2
- [ ] 80%+ endpoint test coverage for critical APIs
- [ ] p95 API latency target defined and met in production
- [ ] Error budget and on-call runbook in place
- [ ] Security review + penetration test completed

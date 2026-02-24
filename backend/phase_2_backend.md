class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    entity_type = Column(String(50), nullable=False)  # politician, case, promise, report
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("comments.id"))  # For nested comments
    content = Column(Text, nullable=False)
    upvotes = Column(Integer, default=0)
    downvotes = Column(Integer, default=0)
    is_edited = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    is_flagged = Column(Boolean, default=False)
    flag_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    user = relationship("User")
    parent = relationship("Comment", remote_side=[id], backref="replies")

class CommentVote(Base):
    __tablename__ = "comment_votes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    comment_id = Column(UUID(as_uuid=True), ForeignKey("comments.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    vote_type = Column(String(10), nullable=False)  # upvote, downvote
    created_at = Column(DateTime, default=func.now())
    
    __table_args__ = (
        UniqueConstraint('comment_id', 'user_id', name='unique_comment_vote'),
    )

# app/services/comment_service.py
class CommentService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_comment(
        self,
        user_id: UUID,
        entity_type: str,
        entity_id: UUID,
        content: str,
        parent_id: UUID = None
    ) -> Comment:
        """Create a new comment"""
        # Validate content
        if len(content) < 10:
            raise ValueError("Comment too short")
        if len(content) > 2000:
            raise ValueError("Comment too long")
        
        # Check for spam/profanity
        if self._is_spam(content):
            raise ValueError("Comment flagged as spam")
        
        comment = Comment(
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            content=content,
            parent_id=parent_id
        )
        
        self.db.add(comment)
        self.db.commit()
        
        return comment
    
    def get_comments(
        self,
        entity_type: str,
        entity_id: UUID,
        parent_id: UUID = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict]:
        """Get comments for an entity"""
        query = self.db.query(Comment).filter(
            Comment.entity_type == entity_type,
            Comment.entity_id == entity_id,
            Comment.is_deleted == False
        )
        
        if parent_id:
            query = query.filter(Comment.parent_id == parent_id)
        else:
            query = query.filter(Comment.parent_id.is_(None))
        
        comments = query.order_by(
            Comment.created_at.desc()
        ).offset(offset).limit(limit).all()
        
        # Format with user info and reply count
        result = []
        for comment in comments:
            reply_count = self.db.query(Comment).filter(
                Comment.parent_id == comment.id,
                Comment.is_deleted == False
            ).count()
            
            result.append({
                "id": str(comment.id),
                "user": {
                    "id": str(comment.user.id),
                    "name": comment.user.full_name,
                },
                "content": comment.content,
                "upvotes": comment.upvotes,
                "downvotes": comment.downvotes,
                "reply_count": reply_count,
                "is_edited": comment.is_edited,
                "created_at": comment.created_at.isoformat(),
                "updated_at": comment.updated_at.isoformat()
            })
        
        return result
    
    def update_comment(
        self,
        comment_id: UUID,
        user_id: UUID,
        content: str
    ) -> Comment:
        """Update a comment"""
        comment = self.db.query(Comment).filter(
            Comment.id == comment_id,
            Comment.user_id == user_id
        ).first()
        
        if not comment:
            raise ValueError("Comment not found or unauthorized")
        
        comment.content = content
        comment.is_edited = True
        comment.updated_at = datetime.utcnow()
        self.db.commit()
        
        return comment
    
    def delete_comment(self, comment_id: UUID, user_id: UUID, is_admin: bool = False):
        """Delete a comment (soft delete)"""
        query = self.db.query(Comment).filter(Comment.id == comment_id)
        
        if not is_admin:
            query = query.filter(Comment.user_id == user_id)
        
        comment = query.first()
        if not comment:
            raise ValueError("Comment not found or unauthorized")
        
        comment.is_deleted = True
        comment.content = "[deleted]"
        self.db.commit()
    
    def vote_comment(
        self,
        comment_id: UUID,
        user_id: UUID,
        vote_type: str
    ):
        """Vote on a comment"""
        # Check existing vote
        existing = self.db.query(CommentVote).filter(
            CommentVote.comment_id == comment_id,
            CommentVote.user_id == user_id
        ).first()
        
        comment = self.db.query(Comment).get(comment_id)
        if not comment:
            raise ValueError("Comment not found")
        
        if existing:
            # Update vote
            if existing.vote_type == vote_type:
                # Remove vote
                if vote_type == "upvote":
                    comment.upvotes -= 1
                else:
                    comment.downvotes -= 1
                self.db.delete(existing)
            else:
                # Change vote
                if vote_type == "upvote":
                    comment.upvotes += 1
                    comment.downvotes -= 1
                else:
                    comment.downvotes += 1
                    comment.upvotes -= 1
                existing.vote_type = vote_type
        else:
            # New vote
            vote = CommentVote(
                comment_id=comment_id,
                user_id=user_id,
                vote_type=vote_type
            )
            self.db.add(vote)
            
            if vote_type == "upvote":
                comment.upvotes += 1
            else:
                comment.downvotes += 1
        
        self.db.commit()
    
    def flag_comment(self, comment_id: UUID, user_id: UUID, reason: str):
        """Flag a comment for moderation"""
        comment = self.db.query(Comment).get(comment_id)
        if not comment:
            raise ValueError("Comment not found")
        
        comment.flag_count += 1
        
        # Auto-hide if too many flags
        if comment.flag_count >= 5:
            comment.is_flagged = True
        
        self.db.commit()
        
        # Notify moderators
        if comment.flag_count >= 3:
            # Send notification to moderators
            pass
    
    def _is_spam(self, content: str) -> bool:
        """Simple spam detection"""
        spam_indicators = [
            "click here",
            "buy now",
            "limited offer",
            "www.",
            "http"
        ]
        
        content_lower = content.lower()
        return any(indicator in content_lower for indicator in spam_indicators)

# app/api/v1/comments.py
router = APIRouter(prefix="/comments", tags=["comments"])

@router.post("")
async def create_comment(
    comment: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new comment"""
    service = CommentService(db)
    result = service.create_comment(
        current_user.id,
        comment.entity_type,
        comment.entity_id,
        comment.content,
        comment.parent_id
    )
    return result

@router.get("/{entity_type}/{entity_id}")
async def get_comments(
    entity_type: str,
    entity_id: UUID,
    parent_id: Optional[UUID] = None,
    limit: int = Query(50, le=100),
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get comments for an entity"""
    service = CommentService(db)
    return service.get_comments(entity_type, entity_id, parent_id, limit, offset)

@router.patch("/{comment_id}")
async def update_comment(
    comment_id: UUID,
    update: CommentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a comment"""
    service = CommentService(db)
    return service.update_comment(comment_id, current_user.id, update.content)

@router.delete("/{comment_id}")
async def delete_comment(
    comment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a comment"""
    service = CommentService(db)
    is_admin = current_user.role == "admin"
    service.delete_comment(comment_id, current_user.id, is_admin)
    return {"message": "Comment deleted"}

@router.post("/{comment_id}/vote")
async def vote_comment(
    comment_id: UUID,
    vote: CommentVote,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Vote on a comment"""
    service = CommentService(db)
    service.vote_comment(comment_id, current_user.id, vote.vote_type)
    return {"message": "Vote recorded"}

@router.post("/{comment_id}/flag")
async def flag_comment(
    comment_id: UUID,
    flag: CommentFlag,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Flag a comment"""
    service = CommentService(db)
    service.flag_comment(comment_id, current_user.id, flag.reason)
    return {"message": "Comment flagged"}
```

### 7.2 User Reputation System

```python
# app/models/user.py (additions)
class User(Base):
    # ... existing fields ...
    reputation_score = Column(Integer, default=0)
    reputation_level = Column(String(50), default="newcomer")

class ReputationEvent(Base):
    __tablename__ = "reputation_events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    event_type = Column(String(50), nullable=False)
    points = Column(Integer, nullable=False)
    description = Column(Text)
    related_entity_type = Column(String(50))
    related_entity_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, default=func.now())

# app/services/reputation_service.py
class ReputationService:
    # Reputation point values
    POINTS = {
        "report_submitted": 10,
        "report_verified": 50,
        "report_dismissed": -5,
        "comment_upvoted": 2,
        "comment_downvoted": -1,
        "verification_vote": 5,
        "correct_verification": 20,
        "incorrect_verification": -10,
        "daily_login": 1,
        "profile_complete": 25
    }
    
    LEVELS = {
        "newcomer": (0, 99),
        "contributor": (100, 499),
        "trusted": (500, 999),
        "expert": (1000, 4999),
        "guardian": (5000, float('inf'))
    }
    
    def __init__(self, db: Session):
        self.db = db
    
    def award_points(
        self,
        user_id: UUID,
        event_type: str,
        description: str = None,
        entity_type: str = None,
        entity_id: UUID = None
    ):
        """Award reputation points to a user"""
        points = self.POINTS.get(event_type, 0)
        
        # Create event
        event = ReputationEvent(
            user_id=user_id,
            event_type=event_type,
            points=points,
            description=description,
            related_entity_type=entity_type,
            related_entity_id=entity_id
        )
        self.db.add(event)
        
        # Update user reputation
        user = self.db.query(User).get(user_id)
        if user:
            user.reputation_score += points
            user.reputation_level = self._calculate_level(user.reputation_score)
        
        self.db.commit()
    
    def _calculate_level(self, score: int) -> str:
        """Calculate reputation level from score"""
        for level, (min_score, max_score) in self.LEVELS.items():
            if min_score <= score <= max_score:
                return level
        return "newcomer"
    
    def get_user_reputation(self, user_id: UUID) -> Dict:
        """Get user's reputation details"""
        user = self.db.query(User).get(user_id)
        if not user:
            return None
        
        # Get recent events
        recent_events = self.db.query(ReputationEvent).filter(
            ReputationEvent.user_id == user_id
        ).order_by(ReputationEvent.created_at.desc()).limit(10).all()
        
        # Calculate next level
        current_level = user.reputation_level
        next_level = None
        points_to_next = 0
        
        level_order = ["newcomer", "contributor", "trusted", "expert", "guardian"]
        current_index = level_order.index(current_level)
        
        if current_index < len(level_order) - 1:
            next_level = level_order[current_index + 1]
            points_to_next = self.LEVELS[next_level][0] - user.reputation_score
        
        return {
            "score": user.reputation_score,
            "level": user.reputation_level,
            "next_level": next_level,
            "points_to_next_level": points_to_next,
            "recent_events": [
                {
                    "type": e.event_type,
                    "points": e.points,
                    "description": e.description,
                    "date": e.created_at.isoformat()
                }
                for e in recent_events
            ]
        }
    
    def get_leaderboard(self, limit: int = 100) -> List[Dict]:
        """Get reputation leaderboard"""
        users = self.db.query(User).filter(
            User.is_active == True
        ).order_by(User.reputation_score.desc()).limit(limit).all()
        
        return [
            {
                "rank": idx + 1,
                "user_id": str(user.id),
                "name": user.full_name,
                "reputation_score": user.reputation_score,
                "reputation_level": user.reputation_level
            }
            for idx, user in enumerate(users)
        ]
```

---

## 8. Integration & APIs

### 8.1 GraphQL API

```python
# app/graphql/schema.py
import strawberry
from typing import List, Optional
from strawberry.fastapi import GraphQLRouter

@strawberry.type
class Politician:
    id: str
    name: str
    position: str
    party: Optional[str]
    county: Optional[str]
    transparency_score: float
    photo_url: Optional[str]

@strawberry.type
class LegalCase:
    id: str
    title: str
    status: str
    court: Optional[str]
    date_filed: Optional[str]

@strawberry.type
class Query:
    @strawberry.field
    def politician(self, id: str, info) -> Optional[Politician]:
        db = info.context["db"]
        politician = db.query(PoliticianModel).get(id)
        if not politician:
            return None
        
        return Politician(
            id=str(politician.id),
            name=politician.name,
            position=politician.position,
            party=politician.party,
            county=politician.county,
            transparency_score=float(politician.transparency_score),
            photo_url=politician.photo_url
        )
    
    @strawberry.field
    def politicians(
        self,
        info,
        limit: int = 10,
        offset: int = 0,
        party: Optional[str] = None,
        county: Optional[str] = None
    ) -> List[Politician]:
        db = info.context["db"]
        query = db.query(PoliticianModel)
        
        if party:
            query = query.filter(PoliticianModel.party == party)
        if county:
            query = query.filter(PoliticianModel.county == county)
        
        politicians = query.offset(offset).limit(limit).all()
        
        return [
            Politician(
                id=str(p.id),
                name=p.name,
                position=p.position,
                party=p.party,
                county=p.county,
                transparency_score=float(p.transparency_score),
                photo_url=p.photo_url
            )
            for p in politicians
        ]
    
    @strawberry.field
    def search_politicians(self, info, query: str) -> List[Politician]:
        db = info.context["db"]
        search_service = SemanticSearchService(db)
        results = search_service.search_politicians(query)
        
        return [
            Politician(
                id=r["id"],
                name=r["name"],
                position=r["position"],
                party=r["party"],
                county=r["county"],
                transparency_score=r["transparency_score"],
                photo_url=None
            )
            for r in results
        ]

schema = strawberry.Schema(query=Query)

# app/main.py
from app.graphql.schema import schema

graphql_app = GraphQLRouter(
    schema,
    context_getter=lambda: {"db": SessionLocal()}
)

app.include_router(graphql_app, prefix="/graphql")
```

### 8.2 Webhooks

```python
# app/models/webhook.py
class Webhook(Base):
    __tablename__ = "webhooks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    url = Column(String(500), nullable=False)
    events = Column(JSONB, nullable=False)  # List of event types
    secret = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    last_triggered = Column(DateTime)
    failure_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())

class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    webhook_id = Column(UUID(as_uuid=True), ForeignKey("webhooks.id"), nullable=False)
    event_type = Column(String(100), nullable=False)
    payload = Column(JSONB, nullable=False)
    status_code = Column(Integer)
    response_body = Column(Text)
    attempt = Column(Integer, default=1)
    delivered_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())

# app/services/webhook_service.py
import hmac
import hashlib

class WebhookService:
    def __init__(self, db: Session):
        self.db = db
        self.http_client = httpx.AsyncClient(timeout=10.0)
    
    def create_webhook(
        self,
        user_id: UUID,
        url: str,
        events: List[str]
    ) -> Webhook:
        """Create a new webhook"""
        # Generate secret
        secret = secrets.token_urlsafe(32)
        
        webhook = Webhook(
            user_id=user_id,
            url=url,
            events=events,
            secret=secret
        )
        
        self.db.add(webhook)
        self.db.commit()
        
        return webhook
    
    async def trigger_webhooks(
        self,
        event_type: str,
        payload: dict
    ):
        """Trigger all webhooks for an event"""
        webhooks = self.db.query(Webhook).filter(
            Webhook.is_active == True,
            Webhook.events.contains([event_type])
        ).all()
        
        for webhook in webhooks:
            await self._deliver_webhook(webhook, event_type, payload)
    
    async def _deliver_webhook(
        self,
        webhook: Webhook,
        event_type: str,
        payload: dict,
        attempt: int = 1
    ):
        """Deliver webhook to endpoint"""
        # Create signature
        signature = self._create_signature(payload, webhook.secret)
        
        # Create delivery record
        delivery = WebhookDelivery(
            webhook_id=webhook.id,
            event_type=event_type,
            payload=payload,
            attempt=attempt
        )
        self.db.add(delivery)
        self.db.commit()
        
        try:
            response = await self.http_client.post(
                webhook.url,
                json=payload,
                headers={
                    "X-Webhook-Signature": signature,
                    "X-Event-Type": event_type,
                    "User-Agent": "KenyaNiYetu-Webhook/1.0"
                }
            )
            
            delivery.status_code = response.status_code
            delivery.response_body = response.text[:1000]
            delivery.delivered_at = datetime.utcnow()
            
            webhook.last_triggered = datetime.utcnow()
            webhook.failure_count = 0
            
            self.db.commit()
        
        except Exception as e:
            delivery.response_body = str(e)
            webhook.failure_count += 1
            
            # Disable webhook after 10 consecutive failures
            if webhook.failure_count >= 10:
                webhook.is_active = False
            
            self.db.commit()
            
            # Retry with exponential backoff
            if attempt < 3:
                await asyncio.sleep(2 ** attempt)
                await self._deliver_webhook(webhook, event_type, payload, attempt + 1)
    
    def _create_signature(self, payload: dict, secret: str) -> str:
        """Create HMAC signature for webhook"""
        payload_bytes = json.dumps(payload, sort_keys=True).encode()
        signature = hmac.new(
            secret.encode(),
            payload_bytes,
            hashlib.sha256
        ).hexdigest()
        return signature

# Usage example
@shared_task
def trigger_score_update_webhook(politician_id: str, old_score: float, new_score: float):
    """Trigger webhooks for score update"""
    db = SessionLocal()
    try:
        service = WebhookService(db)
        asyncio.run(service.trigger_webhooks(
            "politician.score_updated",
            {
                "politician_id": politician_id,
                "old_score": old_score,
                "new_score": new_score,
                "timestamp": datetime.utcnow().isoformat()
            }
        ))
    finally:
        db.close()
```

---

## 9. Admin & Moderation Tools

### 9.1 Enhanced Admin Dashboard

```python
# app/api/v1/admin.py
router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/dashboard")
async def get_admin_dashboard(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get admin dashboard data"""
    analytics = AnalyticsService(db)
    
    return {
        "overview": analytics.get_platform_overview(),
        "pending_reports": db.query(FlaggedReport).filter(
            FlaggedReport.status == "under_review"
        ).count(),
        "flagged_comments": db.query(Comment).filter(
            Comment.is_flagged == True
        ).count(),
        "recent_users": db.query(User).order_by(
            User.created_at.desc()
        ).limit(10).all(),
        "system_health": {
            "database": "healthy",
            "redis": "healthy",
            "celery": "healthy"
        }
    }

@router.get("/reports/queue")
async def get_moderation_queue(
    status: str = Query("under_review"),
    priority: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get moderation queue"""
    query = db.query(FlaggedReport).filter(FlaggedReport.status == status)
    
    if priority:
        query = query.filter(FlaggedReport.priority == priority)
    
    total = query.count()
    reports = query.order_by(
        FlaggedReport.priority.desc(),
        FlaggedReport.date_reported.asc()
    ).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "reports": reports
    }

@router.post("/reports/{report_id}/review")
async def review_report(
    report_id: UUID,
    review: ReportReview,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Review a flagged report"""
    report = db.query(FlaggedReport).get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report.status = review.status
    report.admin_notes = review.notes
    
    if review.status == "verified":
        # Award reputation to reporter
        rep_service = ReputationService(db)
        if report.reporter_id:
            rep_service.award_points(
                report.reporter_id,
                "report_verified",
                f"Report {report.title} was verified"
            )
    
    # Log action
    audit_service = AuditService(db)
    audit_service.log_action(
        current_user.id,
        "review_report",
        "report",
        report_id,
        {"status": review.status, "notes": review.notes}
    )
    
    db.commit()
    
    return report

@router.post("/bulk-actions/recalculate-scores")
async def bulk_recalculate_scores(
    politician_ids: Optional[List[UUID]] = None,
    current_user: User = Depends(get_current_admin_user)
):
    """Bulk recalculate transparency scores"""
    if politician_ids:
        ids = [str(pid) for pid in politician_ids]
    else:
        db = SessionLocal()
        ids = [str(p.id) for p in db.query(Politician).all()]
        db.close()
    
    # Queue batch job
    batch_recalculate_scores.delay(ids)
    
    return {"message": f"Queued {len(ids)} score recalculations"}

@router.get("/logs/activity")
async def get_activity_logs(
    user_id: Optional[UUID] = None,
    action: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(100, le=1000),
    offset: int = 0,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get activity logs"""
    query = db.query(AuditLog)
    
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if start_date:
        query = query.filter(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.filter(AuditLog.timestamp <= end_date)
    
    total = query.count()
    logs = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "logs": logs
    }
```

---

## 10. Implementation Timeline

### Week 1-2: AI/ML Foundation
- [ ] Setup news scraping infrastructure
- [ ] Implement sentiment analysis
- [ ] Deploy entity linking system
- [ ] Setup Celery tasks for scraping
- [ ] Test with real news sources

### Week 3-4: Real-time Features
- [ ] Implement WebSocket connections
- [ ] Build notification system
- [ ] Setup Redis pub/sub
- [ ] Create WebSocket API endpoints
- [ ] Test real-time updates

### Week 5-6: Data Integrity
- [ ] Build verification system
- [ ] Implement audit trail
- [ ] Create version control
- [ ] Setup community voting
- [ ] Test data integrity features

### Week 7-8: Analytics & Performance
- [ ] Build analytics service
- [ ] Implement caching layer
- [ ] Optimize database queries
- [ ] Setup materialized views
- [ ] Performance testing

### Week 9-10: Security Enhancements
- [ ] Implement 2FA
- [ ] Build API key system
- [ ] Enhanced rate limiting
- [ ] Security audit
- [ ] Penetration testing

### Week 11-12: Community Features
- [ ] Build comment system
- [ ] Implement reputation system
- [ ] Create user leaderboard
- [ ] Moderation tools
- [ ] User testing

### Week 13-14: Integration & APIs
- [ ] Build GraphQL API
- [ ] Implement webhooks
- [ ] Create API documentation
- [ ] Developer portal
- [ ] API testing

### Week 15-16: Admin Tools & Final Testing
- [ ] Enhanced admin dashboard
- [ ] Bulk operations
- [ ] System monitoring
- [ ] Full integration testing
- [ ] Performance optimization
- [ ] Documentation finalization
- [ ] Deployment preparation

---

## 11. Testing Strategy

### 11.1 Unit Tests

```python
# tests/test_scoring_service.py
import pytest
from app.services.scoring_service import ScoringService
from app.models.politician import Politician
from app.models.case import LegalCase

@pytest.fixture
def scoring_service(db_session):
    return ScoringService(db_session)

@pytest.fixture
def sample_politician(db_session):
    politician = Politician(
        name="Test Politician",
        position="Senator",
        party="Test Party",
        transparency_score=0.0
    )
    db_session.add(politician)
    db_session.commit()
    return politician

def test_calculate_legal_record_score(scoring_service, sample_politician, db_session):
    """Test legal record score calculation"""
    # Add some cases
    case1 = LegalCase(
        politician_id=sample_politician.id,
        title="Corruption Case",
        status="resolved",
        outcome="guilty",
        severity="high"
    )
    case2 = LegalCase(
        politician_id=sample_politician.id,
        title="Minor Case",
        status="dismissed",
        severity="low"
    )
    db_session.add_all([case1, case2])
    db_session.commit()
    
    score = scoring_service._calculate_legal_record_score(sample_politician)
    
    assert score >= 0
    assert score <= 100
    assert score < 100  # Should be penalized for guilty verdict

def test_transparency_score_calculation(scoring_service, sample_politician):
    """Test full transparency score calculation"""
    result = scoring_service.calculate_transparency_score(sample_politician.id)
    
    assert "score" in result
    assert "breakdown" in result
    assert 0 <= result["score"] <= 100

# tests/test_notification_service.py
def test_create_notification(db_session, sample_user):
    """Test notification creation"""
    service = NotificationService(db_session)
    
    notification = service.create_notification(
        user_id=sample_user.id,
        type="test",
        title="Test Notification",
        message="This is a test"
    )
    
    assert notification.id is not None
    assert notification.status == "pending"

# tests/test_verification_service.py
def test_community_voting(db_session, sample_politician, sample_user):
    """Test community verification voting"""
    service = VerificationService(db_session)
    
    vote = service.vote_on_entity(
        "politician",
        sample_politician.id,
        sample_user.id,
        "upvote",
        "Verified information"
    )
    
    assert vote.vote_type == "upvote"
    
    summary = service.get_verification_summary("politician", sample_politician.id)
    assert summary["upvotes"] == 1
```

### 11.2 Integration Tests

```python
# tests/test_api_integration.py
import pytest
from fastapi.testclient import TestClient

@pytest.fixture
def auth_headers(client, sample_user):
    """Get authentication headers"""
    response = client.post("/api/v1/auth/login", json={
        "email": sample_user.email,
        "password": "testpassword"
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_politician_crud_flow(client, auth_headers):
    """Test complete politician CRUD flow"""
    # Create
    response = client.post(
        "/api/v1/politicians",
        json={
            "name": "New Politician",
            "position": "Governor",
            "party": "Test Party"
        },
        headers=auth_headers
    )
    assert response.status_code == 201
    politician_id = response.json()["id"]
    
    # Read
    response = client.get(f"/api/v1/politicians/{politician_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "New Politician"
    
    # Update
    response = client.patch(
        f"/api/v1/politicians/{politician_id}",
        json={"party": "Updated Party"},
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["party"] == "Updated Party"
    
    # Delete
    response = client.delete(
        f"/api/v1/politicians/{politician_id}",
        headers=auth_headers
    )
    assert response.status_code == 204

def test_search_functionality(client):
    """Test search endpoints"""
    # Semantic search
    response = client.get("/api/v1/search/semantic?q=corruption&type=politicians")
    assert response.status_code == 200
    assert "politicians" in response.json()
    
    # Autocomplete
    response = client.get("/api/v1/search/autocomplete?q=john")
    assert response.status_code == 200

def test_notification_flow(client, auth_headers, db_session):
    """Test notification system"""
    # Create notification preference
    response = client.put(
        "/api/v1/notifications/preferences",
        json={
            "email_enabled": True,
            "frequency": "instant"
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    
    # Get notifications
    response = client.get("/api/v1/notifications", headers=auth_headers)
    assert response.status_code == 200
```

### 11.3 Performance Tests

```python
# tests/test_performance.py
import pytest
from locust import HttpUser, task, between

class PlatformUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Login on start"""
        response = self.client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "testpassword"
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    @task(3)
    def view_politicians(self):
        """View politicians list"""
        self.client.get("/api/v1/politicians")
    
    @task(2)
    def view_politician_details(self):
        """View single politician"""
        self.client.get("/api/v1/politicians/sample-id")
    
    @task(1)
    def search(self):
        """Search politicians"""
        self.client.get("/api/v1/search?q=corruption")
    
    @task(1)
    def get_analytics(self):
        """Get analytics"""
        self.client.get("/api/v1/analytics/overview")

# Run with: locust -f tests/test_performance.py

# Database performance test
def test_query_performance(db_session):
    """Test database query performance"""
    import time
    
    # Test politician list query
    start = time.time()
    politicians = db_session.query(Politician).limit(100).all()
    duration = time.time() - start
    assert duration < 0.5  # Should complete in under 500ms
    
    # Test complex join query
    start = time.time()
    query = db_session.query(Politician).join(LegalCase).filter(
        LegalCase.status == "ongoing"
    ).limit(50).all()
    duration = time.time() - start
    assert duration < 1.0  # Should complete in under 1 second

# Cache performance test
def test_cache_performance():
    """Test caching effectiveness"""
    from app.core.cache import cache_manager
    
    # First call (cache miss)
    import time
    start = time.time()
    cache_manager.set("test_key", {"data": "test"}, ttl=60)
    set_duration = time.time() - start
    
    # Second call (cache hit)
    start = time.time()
    result = cache_manager.get("test_key")
    get_duration = time.time() - start
    
    assert result == {"data": "test"}
    assert get_duration < set_duration  # Cache hit should be faster
```

### 11.4 Security Tests

```python
# tests/test_security.py
def test_sql_injection_prevention(client):
    """Test SQL injection prevention"""
    malicious_queries = [
        "'; DROP TABLE politicians; --",
        "1' OR '1'='1",
        "admin'--"
    ]
    
    for query in malicious_queries:
        response = client.get(f"/api/v1/search?q={query}")
        # Should not cause error or return unauthorized data
        assert response.status_code in [200, 400]

def test_xss_prevention(client):
    """Test XSS prevention"""
    xss_payload = "<script>alert('XSS')</script>"
    
    response = client.post("/api/v1/comments", json={
        "entity_type": "politician",
        "entity_id": "test-id",
        "content": xss_payload
    })
    
    # Should sanitize or reject
    if response.status_code == 201:
        comment = response.json()
        assert "<script>" not in comment["content"]

def test_rate_limiting(client):
    """Test rate limiting"""
    # Make many requests quickly
    responses = []
    for _ in range(150):
        response = client.get("/api/v1/politicians")
        responses.append(response.status_code)
    
    # Should eventually hit rate limit
    assert 429 in responses

def test_authentication_required(client):
    """Test protected endpoints require auth"""
    protected_endpoints = [
        ("/api/v1/reports", "POST"),
        ("/api/v1/politicians/test-id", "PATCH"),
        ("/api/v1/notifications", "GET")
    ]
    
    for endpoint, method in protected_endpoints:
        if method == "GET":
            response = client.get(endpoint)
        elif method == "POST":
            response = client.post(endpoint, json={})
        elif method == "PATCH":
            response = client.patch(endpoint, json={})
        
        assert response.status_code == 401

def test_2fa_enforcement(client, db_session):
    """Test 2FA enforcement"""
    # Create user with 2FA enabled
    user = User(
        email="2fa@example.com",
        hashed_password=hash_password("password"),
        two_factor_enabled=True,
        two_factor_secret="test_secret"
    )
    db_session.add(user)
    db_session.commit()
    
    # Try login without 2FA token
    response = client.post("/api/v1/auth/login", json={
        "email": "2fa@example.com",
        "password": "password"
    })
    
    assert response.json()["requires_2fa"] == True
```

---

## 12. Deployment Strategy

### 12.1 Production Environment Setup

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.prod
    environment:
      - APP_ENV=production
      - DEBUG=False
    ports:
      - "8000:8000"
    depends_on:
      - db
      - redis
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 2G
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=kenya_ni_yetu
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "5432:5432"
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 4G
    restart: always

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: always

  celery_worker:
    build:
      context: .
      dockerfile: Dockerfile.prod
    command: celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
    environment:
      - APP_ENV=production
    depends_on:
      - db
      - redis
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2'
          memory: 2G
    restart: always

  celery_beat:
    build:
      context: .
      dockerfile: Dockerfile.prod
    command: celery -A app.tasks.celery_app beat --loglevel=info
    environment:
      - APP_ENV=production
    depends_on:
      - redis
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - static_files:/static
    depends_on:
      - api
    restart: always

volumes:
  postgres_data:
  redis_data:
  static_files:
```

### 12.2 Dockerfile.prod

```dockerfile
# Dockerfile.prod
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -u 1000 appuser

# Set work directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run application
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--access-logfile", "-", "--error-logfile", "-"]
```

### 12.3 Nginx Configuration

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream api_backend {
        least_conn;
        server api:8000 max_fails=3 fail_timeout=30s;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general_limit:10m rate=100r/s;

    # Caching
    proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m;

    server {
        listen 80;
        server_name kenyaniyetu.org www.kenyaniyetu.org;
        
        # Redirect to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name kenyaniyetu.org www.kenyaniyetu.org;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security Headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Static files
        location /static/ {
            alias /static/;
            expires 30d;
            add_header Cache-Control "public, immutable";
        }

        # API endpoints
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            
            proxy_pass http://api_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Caching for GET requests
            proxy_cache api_cache;
            proxy_cache_key "$scheme$request_method$host$request_uri";
            proxy_cache_valid 200 5m;
            proxy_cache_valid 404 1m;
            proxy_cache_bypass $http_cache_control;
            add_header X-Cache-Status $upstream_cache_status;
        }

        # WebSocket support
        location /ws/ {
            proxy_pass http://api_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_read_timeout 86400;
        }

        # Health check
        location /health {
            access_log off;
            proxy_pass http://api_backend/health;
        }
    }
}
```

### 12.4 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt
      
      - name: Run tests
        run: |
          pytest --cov=app --cov-report=xml
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost/test_db
          REDIS_URL: redis://localhost:6379/0
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Container Registry
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          file: ./Dockerfile.prod
          push: true
          tags: |
            kenyaniyetu/api:latest
            kenyaniyetu/api:${{ github.sha }}
          cache-from: type=registry,ref=kenyaniyetu/api:latest
          cache-to: type=inline

  deploy:
    needs: build
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to production
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/kenya-ni-yetu
            docker-compose pull
            docker-compose up -d --no-deps --build api
            docker-compose exec -T api alembic upgrade head
            docker system prune -f
      
      - name: Health check
        run: |
          sleep 30
          curl -f https://api.kenyaniyetu.org/health || exit 1
      
      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Phase 2 deployment completed!'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()
```

### 12.5 Monitoring & Logging

```python
# app/core/monitoring.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.celery import CeleryIntegration
from prometheus_client import Counter, Histogram, generate_latest
import logging

# Setup Sentry
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[
            FastApiIntegration(),
            CeleryIntegration()
        ],
        environment=settings.APP_ENV,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
    )

# Prometheus metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_DURATION = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint']
)

SCORING_DURATION = Histogram(
    'scoring_calculation_duration_seconds',
    'Transparency score calculation duration'
)

# Logging configuration
logging.config.dictConfig({
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'default': {
            'format': '[%(asctime)s] %(levelname)s in %(module)s: %(message)s',
        },
        'json': {
            '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(name)s %(levelname)s %(message)s'
        }
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'default',
            'stream': 'ext://sys.stdout'
        },
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'formatter': 'json',
            'filename': 'logs/app.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 10
        }
    },
    'root': {
        'level': 'INFO',
        'handlers': ['console', 'file']
    }
})

# Middleware for metrics
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    REQUEST_DURATION.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)
    
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    return response

# Metrics endpoint
@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type="text/plain")
```

### 12.6 Database Backup Strategy

```bash
#!/bin/bash
# scripts/backup_database.sh

# Configuration
DB_NAME="kenya_ni_yetu"
DB_USER="postgres"
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz"
S3_BUCKET="s3://kenya-ni-yetu-backups"

# Create backup directory
mkdir -p $BACKUP_DIR

# Perform backup
echo "Starting database backup..."
pg_dump -U $DB_USER -Fc $DB_NAME | gzip > $BACKUP_FILE

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Backup created successfully: $BACKUP_FILE"
    
    # Upload to S3
    aws s3 cp $BACKUP_FILE $S3_BUCKET/
    
    # Remove old local backups (keep last 7 days)
    find $BACKUP_DIR -name "${DB_NAME}_*.sql.gz" -mtime +7 -delete
    
    # Remove old S3 backups (keep last 30 days)
    aws s3 ls $S3_BUCKET/ | while read -r line; do
        createDate=$(echo $line | awk {'print $1" "$2'})
        createDate=$(date -d "$createDate" +%s)
        olderThan=$(date --date "30 days ago" +%s)
        if [[ $createDate -lt $olderThan ]]; then
            fileName=$(echo $line | awk {'print $4'})
            aws s3 rm $S3_BUCKET/$fileName
        fi
    done
    
    echo "Backup completed and uploaded to S3"
else
    echo "Backup failed!"
    exit 1
fi
```

### 12.7 Health Check Endpoint

```python
# app/api/v1/health.py
from fastapi import APIRouter, Depends
from sqlalchemy import text

router = APIRouter(tags=["health"])

@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Comprehensive health check"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {}
    }
    
    # Database check
    try:
        db.execute(text("SELECT 1"))
        health_status["checks"]["database"] = "healthy"
    except Exception as e:
        health_status["checks"]["database"] = f"unhealthy: {str(e)}"
        health_status["status"] = "unhealthy"
    
    # Redis check
    try:
        cache_manager.redis_client.ping()
        health_status["checks"]["redis"] = "healthy"
    except Exception as e:
        health_status["checks"]["redis"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"
    
    # Celery check
    try:
        from app.tasks.celery_app import app as celery_app
        inspect = celery_app.control.inspect()
        stats = inspect.stats()
        if stats:
            health_status["checks"]["celery"] = "healthy"
        else:
            health_status["checks"]["celery"] = "no workers"
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["checks"]["celery"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"
    
    status_code = 200 if health_status["status"] == "healthy" else 503
    return JSONResponse(content=health_status, status_code=status_code)
```

---

## 13. Documentation

### 13.1 API Documentation

```python
# app/main.py - Enhanced API docs
app = FastAPI(
    title="Kenya ni Yetu API",
    description="""
    ## Political Transparency Platform API
    
    This API provides access to Kenya's political transparency data including:
    
    * **Politicians**: Comprehensive profiles with transparency scores
    * **Legal Cases**: Court cases and legal proceedings
    * **Promises**: Campaign promises and their fulfillment
    * **Reports**: Community-submitted flagged reports
    * **Analytics**: Statistical insights and trends
    * **Real-time**: WebSocket connections for live updates
    
    ## Authentication
    
    Most endpoints require authentication using JWT tokens:
    
    1. Register or login to get an access token
    2. Include in requests: `Authorization: Bearer <token>`
    3. Tokens expire after 30 minutes
    4. Use refresh token to get new access token
    
    ## Rate Limiting
    
    - Anonymous: 100 requests/minute
    - Authenticated: 500 requests/minute  
    - Admin: 1000 requests/minute
    
    ## Webhooks
    
    Subscribe to events via webhooks for real-time notifications.
    """,
    version="2.0.0",
    contact={
        "name": "Kenya ni Yetu Team",
        "email": "api@kenyaniyetu.org",
        "url": "https://kenyaniyetu.org"
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT"
    },
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {"name": "auth", "description": "Authentication endpoints"},
        {"name": "politicians", "description": "Politician data and profiles"},
        {"name": "reports", "description": "Flagged reports and submissions"},
        {"name": "search", "description": "Search and filtering"},
        {"name": "analytics", "description": "Statistics and insights"},
        {"name": "notifications", "description": "User notifications"},
        {"name": "admin", "description": "Administrative functions"},
    ]
)
```

### 13.2 Developer Portal

Create comprehensive documentation at `docs/`:

- **Getting Started Guide**
- **Authentication Tutorial**
- **API Reference**
- **Webhook Guide**
- **Code Examples** (Python, JavaScript, etc.)
- **Best Practices**
- **Changelog**

---

## Phase 2 Success Metrics

### Technical Metrics
- [ ] API response time < 200ms (p95)
- [ ] Database query time < 100ms (p95)
- [ ] WebSocket latency < 50ms
- [ ] 99.9% uptime
- [ ] Cache hit ratio > 80%
- [ ] Test coverage > 85%

### Feature Metrics
- [ ] 1000+ news articles scraped daily
- [ ] 90%+ sentiment analysis accuracy
- [ ] Real-time updates delivered < 1 second
- [ ] 10,000+ active users
- [ ] 5,000+ verified data points
- [ ] 100+ webhooks configured
- [ ] 50+ API integrations

### User Engagement Metrics
- [ ] Average session duration > 5 minutes
- [ ] User retention rate > 60%
- [ ] Community verification participation > 30%
- [ ] Report submission rate increased by 200%
- [ ] Comment engagement > 1000 per day

---

## Quick Reference

### Environment Variables (Phase 2 Additions)

```bash
# AI/ML
OPENAI_API_KEY=your-openai-key
HUGGINGFACE_API_KEY=your-hf-key  # Optional alternative
EMBEDDING_MODEL=text-embedding-3-small

# Notification Services
SENDGRID_API_KEY=your-sendgrid-key
AFRICAS_TALKING_API_KEY=your-at-key  # For SMS
AFRICAS_TALKING_USERNAME=your-username

# Security
ENCRYPTION_KEY=your-32-byte-encryption-key
JWT_REFRESH_SECRET=your-refresh-secret
TOTP_ISSUER=Kenya ni Yetu

# Monitoring
SENTRY_DSN=your-sentry-dsn
PROMETHEUS_PORT=9090

# External Services
NEWS_API_KEY=your-news-api-key  # Optional
```

### Key Commands

```bash
# Start Phase 2 services
docker-compose -f docker-compose.prod.yml up -d

# Generate embeddings for existing data
python scripts/generate_embeddings.py

# Train ML scoring model
python scripts/train_scoring_model.py

# Run security audit
python scripts/security_audit.py

# Generate API documentation
python scripts/generate_api_docs.py

# Database maintenance
python scripts/vacuum_analyze.py

# Performance monitoring
docker-compose logs -f --tail=100 api

# Check system health
curl https://api.kenyaniyetu.org/health
```

### Common Troubleshooting

**WebSocket connections failing:**
```bash
# Check nginx configuration
nginx -t
# Verify WebSocket proxy settings
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8000/ws/alerts
```

**Celery workers not processing:**
```bash
# Check worker status
celery -A app.tasks.celery_app inspect active
# Restart workers
docker-compose restart celery_worker
```

**Cache not working:**
```bash
# Test Redis connection
redis-cli ping
# Clear cache
redis-cli FLUSHALL
```

**Database slow queries:**
```bash
# Check slow queries
psql -d kenya_ni_yetu -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
# Run VACUUM ANALYZE
python scripts/vacuum_analyze.py
```

---

## Phase 2 Deliverables Checklist

### Core Features
- [x] Automated news scraping system
- [x] AI sentiment analysis
- [x] Semantic search with embeddings
- [x] Real-time WebSocket notifications
- [x] Advanced notification system
- [x] Source verification system
- [x] Audit trail and version control
- [x] Comprehensive analytics dashboard
- [x] Performance optimization (caching, indexes)
- [x] Two-factor authentication
- [x] API key management
- [x] Comment system
- [x] User reputation system
- [x] GraphQL API
- [x] Webhook system
- [x] Enhanced admin tools

### Infrastructure
- [x] Production Docker setup
- [x] CI/CD pipeline
- [x] Monitoring and logging
- [x] Database backup strategy
- [x] Health check system
- [x] Load balancing
- [x] SSL/TLS configuration
- [x] Rate limiting

### Documentation
- [x] API documentation
- [x] Developer guide
- [x] Deployment guide
- [x] Testing documentation
- [x] Security guidelines
- [x] Troubleshooting guide

---

## Support & Resources

### Documentation
- **API Docs**: https://docs.kenyaniyetu.org
- **Developer Portal**: https://developers.kenyaniyetu.org
- **GitHub**: https://github.com/kenyaniyetu/backend

### Community
- **Slack**: kenya-ni-yetu.slack.com
- **Email**: developers@kenyaniyetu.org
- **Issues**: https://github.com/kenyaniyetu/backend/issues

### Team Contacts
- **Technical Lead**: tech@kenyaniyetu.org
- **DevOps**: devops@kenyaniyetu.org
- **Security**: security@kenyaniyetu.org

---

## Next Steps: Phase 3 Preview

Phase 3 (Future) will focus on:

- **Mobile Apps**: Native iOS and Android applications
- **Advanced AI**: Predictive analytics and trend forecasting
- **Blockchain**: Immutable audit trail using blockchain
- **Public API Marketplace**: Monetized API access tiers
- **Multi-language Support**: Swahili, Kikuyu, and other local languages
- **Advanced Visualizations**: Interactive data visualization tools
- **Crowdsourcing Platform**: Expanded community contributions
- **Third-party Integrations**: Integration with government systems

---

## License

MIT License - See LICENSE file for details

---

## Acknowledgments

Built with:
- FastAPI
- PostgreSQL with pgvector
- Redis
- Celery
- OpenAI
- React (frontend)
- And many other open-source tools

Special thanks to the Kenyan tech community and all contributors working towards government transparency.

---

**Last Updated**: October 2025  
**Version**: 2.0.0  
**Status**: Production Ready

For questions or support, contact: developers@kenyaniyetu.org# Phase 2 Development Guide - Kenya ni Yetu

## Overview

This document outlines Phase 2 development for the Kenya ni Yetu Political Transparency Platform. Phase 2 builds upon the foundation established in Phase 1, focusing on advanced features, scalability, AI/ML enhancements, and real-time capabilities.

**Timeline:** 12-16 weeks
**Prerequisites:** Phase 1 completion, production deployment, initial user feedback

---

## Table of Contents

1. [AI/ML Enhancements](#1-aiml-enhancements)
2. [Real-time Features](#2-real-time-features)
3. [Data Integrity & Verification](#3-data-integrity--verification)
4. [Advanced Analytics](#4-advanced-analytics)
5. [Scale & Performance](#5-scale--performance)
6. [Enhanced Security](#6-enhanced-security)
7. [Community Features](#7-community-features)
8. [Integration & APIs](#8-integration--apis)
9. [Admin & Moderation Tools](#9-admin--moderation-tools)
10. [Implementation Timeline](#10-implementation-timeline)
11. [Testing Strategy](#11-testing-strategy)
12. [Deployment Strategy](#12-deployment-strategy)

---

## 1. AI/ML Enhancements

### 1.1 Automated News Scraping & Analysis

#### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Scrapers   │────▶│  Processing  │────▶│   Storage    │
│   (Celery)   │     │   Pipeline   │     │  (Postgres)  │
└──────────────┘     └──────────────┘     └──────────────┘
       │                     │                     │
       │                     ▼                     │
       │             ┌──────────────┐              │
       └────────────▶│  AI Analysis │◀─────────────┘
                     │  (OpenAI/HF) │
                     └──────────────┘
```

#### Implementation

**New Models:**

```python
# app/models/news_source.py
class NewsSource(Base):
    __tablename__ = "news_sources"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    base_url = Column(String(500), nullable=False)
    scraper_type = Column(String(50), nullable=False)  # rss, html, api
    scraper_config = Column(JSONB)  # CSS selectors, API params
    is_active = Column(Boolean, default=True)
    reliability_score = Column(Numeric(3, 2))  # 0-1
    last_scraped_at = Column(DateTime)
    scrape_frequency = Column(Integer, default=3600)  # seconds
    created_at = Column(DateTime, default=func.now())

# app/models/scraping_job.py
class ScrapingJob(Base):
    __tablename__ = "scraping_jobs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id = Column(UUID(as_uuid=True), ForeignKey("news_sources.id"))
    status = Column(String(50), nullable=False)  # pending, running, completed, failed
    articles_found = Column(Integer, default=0)
    articles_processed = Column(Integer, default=0)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    error_message = Column(Text)
    metadata = Column(JSONB)
```

**Scraper Service:**

```python
# app/services/scraper_service.py
from bs4 import BeautifulSoup
import feedparser
import httpx
from typing import List, Dict
import re

class NewsScraperService:
    def __init__(self, db: Session):
        self.db = db
        self.http_client = httpx.AsyncClient(timeout=30.0)
    
    async def scrape_source(self, source: NewsSource) -> List[Dict]:
        """Scrape articles from a news source"""
        if source.scraper_type == "rss":
            return await self._scrape_rss(source)
        elif source.scraper_type == "html":
            return await self._scrape_html(source)
        elif source.scraper_type == "api":
            return await self._scrape_api(source)
    
    async def _scrape_rss(self, source: NewsSource) -> List[Dict]:
        """Scrape RSS feed"""
        response = await self.http_client.get(source.base_url)
        feed = feedparser.parse(response.text)
        
        articles = []
        for entry in feed.entries:
            article = {
                "title": entry.title,
                "url": entry.link,
                "published_at": entry.published_parsed,
                "content": self._clean_html(entry.get("summary", "")),
                "source_name": source.name
            }
            articles.append(article)
        
        return articles
    
    async def _scrape_html(self, source: NewsSource) -> List[Dict]:
        """Scrape HTML page"""
        config = source.scraper_config
        response = await self.http_client.get(source.base_url)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        articles = []
        article_elements = soup.select(config.get("article_selector", "article"))
        
        for element in article_elements:
            try:
                title_el = element.select_one(config.get("title_selector"))
                link_el = element.select_one(config.get("link_selector"))
                date_el = element.select_one(config.get("date_selector"))
                
                if title_el and link_el:
                    article = {
                        "title": title_el.text.strip(),
                        "url": self._make_absolute_url(link_el.get("href"), source.base_url),
                        "published_at": self._parse_date(date_el.text if date_el else None),
                        "source_name": source.name
                    }
                    articles.append(article)
            except Exception as e:
                continue
        
        return articles
    
    def _clean_html(self, html: str) -> str:
        """Remove HTML tags and clean text"""
        soup = BeautifulSoup(html, 'html.parser')
        return soup.get_text(strip=True)
    
    def _make_absolute_url(self, url: str, base_url: str) -> str:
        """Convert relative URL to absolute"""
        if url.startswith("http"):
            return url
        return urljoin(base_url, url)

# app/services/sentiment_service.py
from transformers import pipeline
import openai

class SentimentAnalysisService:
    def __init__(self):
        # Option 1: Using Hugging Face (free, local)
        self.analyzer = pipeline(
            "sentiment-analysis",
            model="nlptown/bert-base-multilingual-uncased-sentiment"
        )
        
        # Option 2: Using OpenAI (paid, more accurate)
        self.openai_client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
    
    def analyze_sentiment(self, text: str, method: str = "huggingface") -> float:
        """Analyze sentiment of text. Returns score from -1 (negative) to 1 (positive)"""
        if method == "huggingface":
            return self._analyze_huggingface(text)
        elif method == "openai":
            return self._analyze_openai(text)
    
    def _analyze_huggingface(self, text: str) -> float:
        """Use Hugging Face for sentiment analysis"""
        result = self.analyzer(text[:512])[0]  # Limit to 512 tokens
        
        # Convert 5-star rating to -1 to 1 scale
        stars = int(result['label'].split()[0])
        sentiment = (stars - 3) / 2  # Convert 1-5 to -1 to 1
        
        return sentiment
    
    def _analyze_openai(self, text: str) -> float:
        """Use OpenAI for sentiment analysis"""
        prompt = f"""Analyze the sentiment of this news article excerpt about a politician.
        Return only a number from -1 (very negative) to 1 (very positive).
        
        Text: {text[:2000]}
        
        Sentiment score:"""
        
        response = self.openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=10
        )
        
        try:
            score = float(response.choices[0].message.content.strip())
            return max(-1, min(1, score))  # Clamp between -1 and 1
        except:
            return 0.0  # Neutral if parsing fails

# app/services/entity_linking_service.py
class EntityLinkingService:
    def __init__(self, db: Session):
        self.db = db
    
    def extract_and_link_politicians(self, text: str, article_id: UUID) -> List[UUID]:
        """Extract politician names and link to database records"""
        # Get all politician names
        politicians = self.db.query(Politician).all()
        politician_names = {p.name.lower(): p.id for p in politicians}
        
        # Find mentions in text
        linked_politicians = []
        text_lower = text.lower()
        
        for name, politician_id in politician_names.items():
            if name in text_lower:
                linked_politicians.append(politician_id)
        
        return linked_politicians
    
    def calculate_relevance(self, text: str, politician_name: str) -> float:
        """Calculate how relevant the article is to the politician"""
        text_lower = text.lower()
        name_lower = politician_name.lower()
        
        # Count mentions
        mention_count = text_lower.count(name_lower)
        
        # Check if in title or first paragraph (higher weight)
        first_200_chars = text_lower[:200]
        in_opening = name_lower in first_200_chars
        
        # Calculate relevance score
        relevance = min(1.0, (mention_count * 0.2) + (0.3 if in_opening else 0))
        
        return relevance
```

**Celery Tasks:**

```python
# app/tasks/scraping_tasks.py
from celery import shared_task
from app.services.scraper_service import NewsScraperService
from app.services.sentiment_service import SentimentAnalysisService
from app.services.entity_linking_service import EntityLinkingService

@shared_task(bind=True, max_retries=3)
def scrape_news_source(self, source_id: str):
    """Scrape a single news source"""
    db = SessionLocal()
    try:
        source = db.query(NewsSource).filter(NewsSource.id == source_id).first()
        if not source or not source.is_active:
            return
        
        # Create scraping job
        job = ScrapingJob(
            source_id=source_id,
            status="running",
            started_at=datetime.utcnow()
        )
        db.add(job)
        db.commit()
        
        # Scrape articles
        scraper = NewsScraperService(db)
        articles = await scraper.scrape_source(source)
        
        job.articles_found = len(articles)
        
        # Process each article
        sentiment_service = SentimentAnalysisService()
        entity_service = EntityLinkingService(db)
        
        for article_data in articles:
            # Check if article already exists
            existing = db.query(NewsMention).filter(
                NewsMention.url == article_data["url"]
            ).first()
            
            if existing:
                continue
            
            # Analyze sentiment
            sentiment = sentiment_service.analyze_sentiment(article_data["content"])
            
            # Link to politicians
            politician_ids = entity_service.extract_and_link_politicians(
                article_data["title"] + " " + article_data["content"],
                None
            )
            
            # Create news mentions for each politician
            for politician_id in politician_ids:
                relevance = entity_service.calculate_relevance(
                    article_data["content"],
                    db.query(Politician).get(politician_id).name
                )
                
                news_mention = NewsMention(
                    politician_id=politician_id,
                    title=article_data["title"],
                    source=article_data["source_name"],
                    url=article_data["url"],
                    content_summary=article_data["content"][:500],
                    sentiment=sentiment,
                    published_at=article_data["published_at"],
                    relevance_score=relevance
                )
                db.add(news_mention)
                job.articles_processed += 1
        
        # Complete job
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        db.commit()
        
        # Update source last scraped time
        source.last_scraped_at = datetime.utcnow()
        db.commit()
        
    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = datetime.utcnow()
        db.commit()
        raise self.retry(exc=e, countdown=300)  # Retry after 5 minutes
    finally:
        db.close()

@shared_task
def schedule_all_scrapers():
    """Schedule scraping for all active news sources"""
    db = SessionLocal()
    try:
        sources = db.query(NewsSource).filter(NewsSource.is_active == True).all()
        
        for source in sources:
            # Check if enough time has passed since last scrape
            if source.last_scraped_at:
                time_since_last = (datetime.utcnow() - source.last_scraped_at).total_seconds()
                if time_since_last < source.scrape_frequency:
                    continue
            
            # Schedule scraping task
            scrape_news_source.delay(str(source.id))
    finally:
        db.close()
```

**Celery Beat Schedule:**

```python
# app/tasks/celery_app.py
from celery.schedules import crontab

app.conf.beat_schedule = {
    'scrape-news-every-hour': {
        'task': 'app.tasks.scraping_tasks.schedule_all_scrapers',
        'schedule': crontab(minute=0),  # Every hour
    },
    'recalculate-scores-daily': {
        'task': 'app.tasks.scoring_tasks.recalculate_all_scores',
        'schedule': crontab(hour=2, minute=0),  # 2 AM daily
    },
}
```

**API Endpoints:**

```python
# app/api/v1/news.py
from fastapi import APIRouter, Depends
from app.services.scraper_service import NewsScraperService

router = APIRouter(prefix="/news", tags=["news"])

@router.post("/sources", status_code=201)
async def create_news_source(
    source: NewsSourceCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new news source (Admin only)"""
    db_source = NewsSource(**source.dict())
    db.add(db_source)
    db.commit()
    return db_source

@router.post("/sources/{source_id}/scrape")
async def trigger_scrape(
    source_id: UUID,
    current_user: User = Depends(get_current_admin_user)
):
    """Manually trigger scraping for a source"""
    scrape_news_source.delay(str(source_id))
    return {"message": "Scraping job scheduled"}

@router.get("/sources/{source_id}/jobs")
async def get_scraping_jobs(
    source_id: UUID,
    db: Session = Depends(get_db)
):
    """Get scraping job history for a source"""
    jobs = db.query(ScrapingJob).filter(
        ScrapingJob.source_id == source_id
    ).order_by(ScrapingJob.started_at.desc()).limit(20).all()
    return jobs
```

### 1.2 Enhanced Scoring System

#### Machine Learning Score Predictor

```python
# app/services/ml_scoring_service.py
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
import joblib
import numpy as np

class MLScoringService:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.model_path = "models/transparency_predictor.pkl"
        self.scaler_path = "models/scaler.pkl"
        
        # Load pre-trained model if exists
        try:
            self.model = joblib.load(self.model_path)
            self.scaler = joblib.load(self.scaler_path)
        except:
            pass
    
    def extract_features(self, politician: Politician, db: Session) -> np.ndarray:
        """Extract features for ML model"""
        # Legal cases features
        cases = db.query(LegalCase).filter(
            LegalCase.politician_id == politician.id
        ).all()
        
        total_cases = len(cases)
        ongoing_cases = len([c for c in cases if c.status == "ongoing"])
        resolved_guilty = len([c for c in cases if c.status == "resolved" and "guilty" in (c.outcome or "").lower()])
        
        # Promise features
        promises = db.query(Promise).filter(
            Promise.politician_id == politician.id
        ).all()
        
        total_promises = len(promises)
        fulfilled_promises = len([p for p in promises if p.status == "fulfilled"])
        broken_promises = len([p for p in promises if p.status == "broken"])
        fulfillment_rate = fulfilled_promises / total_promises if total_promises > 0 else 0
        
        # News sentiment features
        recent_news = db.query(NewsMention).filter(
            NewsMention.politician_id == politician.id,
            NewsMention.published_at >= datetime.utcnow() - timedelta(days=90)
        ).all()
        
        avg_sentiment = np.mean([n.sentiment for n in recent_news]) if recent_news else 0
        sentiment_variance = np.var([n.sentiment for n in recent_news]) if recent_news else 0
        news_volume = len(recent_news)
        
        # Report features
        reports = db.query(FlaggedReport).filter(
            FlaggedReport.politician_id == politician.id
        ).all()
        
        total_reports = len(reports)
        verified_reports = len([r for r in reports if r.status == "verified"])
        
        # Time in office (if available)
        days_in_office = (datetime.utcnow() - politician.created_at).days
        
        # Compile feature vector
        features = np.array([
            total_cases,
            ongoing_cases,
            resolved_guilty,
            total_promises,
            fulfilled_promises,
            broken_promises,
            fulfillment_rate,
            avg_sentiment,
            sentiment_variance,
            news_volume,
            total_reports,
            verified_reports,
            days_in_office
        ])
        
        return features.reshape(1, -1)
    
    def predict_score(self, politician: Politician, db: Session) -> Dict:
        """Predict transparency score using ML model"""
        if self.model is None:
            return None
        
        features = self.extract_features(politician, db)
        features_scaled = self.scaler.transform(features)
        
        predicted_score = self.model.predict(features_scaled)[0]
        
        # Get feature importance
        feature_names = [
            "total_cases", "ongoing_cases", "resolved_guilty",
            "total_promises", "fulfilled_promises", "broken_promises",
            "fulfillment_rate", "avg_sentiment", "sentiment_variance",
            "news_volume", "total_reports", "verified_reports", "days_in_office"
        ]
        
        importances = dict(zip(feature_names, self.model.feature_importances_))
        
        return {
            "predicted_score": float(predicted_score),
            "feature_importances": importances,
            "confidence": self._calculate_confidence(features_scaled)
        }
    
    def _calculate_confidence(self, features: np.ndarray) -> float:
        """Calculate confidence in prediction"""
        # Use ensemble predictions to estimate confidence
        if hasattr(self.model, 'estimators_'):
            predictions = [tree.predict(features)[0] for tree in self.model.estimators_]
            variance = np.var(predictions)
            # Lower variance = higher confidence
            confidence = max(0, min(100, 100 - (variance * 10)))
            return confidence
        return 75.0  # Default confidence
    
    def train_model(self, db: Session):
        """Train ML model on historical data"""
        # Get all politicians with score history
        politicians = db.query(Politician).filter(
            Politician.transparency_score.isnot(None)
        ).all()
        
        X = []
        y = []
        
        for politician in politicians:
            features = self.extract_features(politician, db)
            X.append(features[0])
            y.append(politician.transparency_score)
        
        X = np.array(X)
        y = np.array(y)
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Train model
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        self.model.fit(X_scaled, y)
        
        # Save model
        joblib.dump(self.model, self.model_path)
        joblib.dump(self.scaler, self.scaler_path)
        
        return {
            "samples": len(X),
            "r2_score": self.model.score(X_scaled, y)
        }
```

#### Score Trend Analysis

```python
# app/services/trend_analysis_service.py
from scipy import stats
import pandas as pd

class TrendAnalysisService:
    def __init__(self, db: Session):
        self.db = db
    
    def analyze_score_trend(self, politician_id: UUID, days: int = 90) -> Dict:
        """Analyze transparency score trend over time"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        history = self.db.query(ScoreHistory).filter(
            ScoreHistory.politician_id == politician_id,
            ScoreHistory.calculated_at >= cutoff_date
        ).order_by(ScoreHistory.calculated_at).all()
        
        if len(history) < 2:
            return {"trend": "insufficient_data"}
        
        # Convert to pandas for analysis
        df = pd.DataFrame([
            {"date": h.calculated_at, "score": float(h.transparency_score)}
            for h in history
        ])
        
        # Calculate trend
        x = np.arange(len(df))
        y = df["score"].values
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
        
        # Determine trend direction
        if p_value < 0.05:  # Statistically significant
            if slope > 0.5:
                trend = "improving"
            elif slope < -0.5:
                trend = "declining"
            else:
                trend = "stable"
        else:
            trend = "stable"
        
        # Calculate volatility
        volatility = df["score"].std()
        
        # Detect anomalies
        anomalies = self._detect_anomalies(df)
        
        return {
            "trend": trend,
            "slope": float(slope),
            "r_squared": float(r_value ** 2),
            "volatility": float(volatility),
            "current_score": float(y[-1]),
            "score_change": float(y[-1] - y[0]),
            "anomalies": anomalies,
            "data_points": len(history)
        }
    
    def _detect_anomalies(self, df: pd.DataFrame) -> List[Dict]:
        """Detect anomalous score changes"""
        # Use Z-score method
        z_scores = np.abs(stats.zscore(df["score"]))
        anomalies = []
        
        for idx, z in enumerate(z_scores):
            if z > 2.5:  # Threshold for anomaly
                anomalies.append({
                    "date": df.iloc[idx]["date"].isoformat(),
                    "score": float(df.iloc[idx]["score"]),
                    "z_score": float(z)
                })
        
        return anomalies
    
    def compare_politicians(self, politician_ids: List[UUID]) -> Dict:
        """Compare transparency scores of multiple politicians"""
        comparison = []
        
        for politician_id in politician_ids:
            politician = self.db.query(Politician).get(politician_id)
            if not politician:
                continue
            
            trend = self.analyze_score_trend(politician_id)
            
            comparison.append({
                "politician_id": str(politician_id),
                "name": politician.name,
                "current_score": politician.transparency_score,
                "trend": trend["trend"],
                "score_change_90d": trend.get("score_change", 0)
            })
        
        return {
            "comparison": comparison,
            "average_score": np.mean([p["current_score"] for p in comparison if p["current_score"]]),
            "best_performer": max(comparison, key=lambda x: x["current_score"]) if comparison else None,
            "most_improved": max(comparison, key=lambda x: x.get("score_change_90d", 0)) if comparison else None
        }
```

### 1.3 Semantic Search with pgvector

#### Database Setup

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns
ALTER TABLE politicians ADD COLUMN embedding vector(1536);
ALTER TABLE news_mentions ADD COLUMN embedding vector(1536);
ALTER TABLE promises ADD COLUMN embedding vector(1536);

-- Create vector indexes for faster similarity search
CREATE INDEX idx_politicians_embedding ON politicians USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_news_embedding ON news_mentions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

#### Embedding Service

```python
# app/services/embedding_service.py
import openai
from typing import List

class EmbeddingService:
    def __init__(self):
        self.client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = "text-embedding-3-small"  # 1536 dimensions
    
    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for text"""
        response = self.client.embeddings.create(
            input=text,
            model=self.model
        )
        return response.data[0].embedding
    
    def generate_politician_embedding(self, politician: Politician) -> List[float]:
        """Generate comprehensive embedding for politician"""
        # Combine multiple fields for richer representation
        text_parts = [
            f"Name: {politician.name}",
            f"Position: {politician.position}",
            f"Party: {politician.party}" if politician.party else "",
            f"County: {politician.county}" if politician.county else "",
            f"Bio: {politician.bio}" if politician.bio else ""
        ]
        
        combined_text = " ".join([p for p in text_parts if p])
        return self.generate_embedding(combined_text)
    
    def batch_generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        # OpenAI allows batch processing up to 2048 texts
        batch_size = 2048
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            response = self.client.embeddings.create(
                input=batch,
                model=self.model
            )
            embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(embeddings)
        
        return all_embeddings

# app/services/semantic_search_service.py
class SemanticSearchService:
    def __init__(self, db: Session):
        self.db = db
        self.embedding_service = EmbeddingService()
    
    def search_politicians(self, query: str, limit: int = 10) -> List[Dict]:
        """Semantic search for politicians"""
        # Generate query embedding
        query_embedding = self.embedding_service.generate_embedding(query)
        
        # Perform vector similarity search
        results = self.db.execute(text("""
            SELECT 
                id, 
                name, 
                position, 
                party, 
                county, 
                transparency_score,
                1 - (embedding <=> :query_embedding) as similarity
            FROM politicians
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> :query_embedding
            LIMIT :limit
        """), {
            "query_embedding": str(query_embedding),
            "limit": limit
        }).fetchall()
        
        return [
            {
                "id": str(row.id),
                "name": row.name,
                "position": row.position,
                "party": row.party,
                "county": row.county,
                "transparency_score": float(row.transparency_score),
                "similarity": float(row.similarity),
                "reason": self._explain_similarity(politician, row)
            }
            for row in results
        ]
    
    def _explain_similarity(self, politician1: Politician, politician2_row) -> str:
        """Explain why two politicians are similar"""
        reasons = []
        
        if politician1.party == politician2_row.party:
            reasons.append(f"Same party ({politician1.party})")
        
        if politician1.county == politician2_row.county:
            reasons.append(f"Same county ({politician1.county})")
        
        score_diff = abs(politician1.transparency_score - politician2_row.transparency_score)
        if score_diff < 10:
            reasons.append("Similar transparency scores")
        
        return ", ".join(reasons) if reasons else "Similar profile"
    
    def search_news(self, query: str, politician_id: UUID = None, limit: int = 20) -> List[Dict]:
        """Semantic search for news mentions"""
        query_embedding = self.embedding_service.generate_embedding(query)
        
        sql = """
            SELECT 
                n.id,
                n.politician_id,
                n.title,
                n.source,
                n.url,
                n.content_summary,
                n.sentiment,
                n.published_at,
                p.name as politician_name,
                1 - (n.embedding <=> :query_embedding) as similarity
            FROM news_mentions n
            JOIN politicians p ON n.politician_id = p.id
            WHERE n.embedding IS NOT NULL
        """
        
        params = {"query_embedding": str(query_embedding), "limit": limit}
        
        if politician_id:
            sql += " AND n.politician_id = :politician_id"
            params["politician_id"] = politician_id
        
        sql += " ORDER BY n.embedding <=> :query_embedding LIMIT :limit"
        
        results = self.db.execute(text(sql), params).fetchall()
        
        return [
            {
                "id": str(row.id),
                "politician_id": str(row.politician_id),
                "politician_name": row.politician_name,
                "title": row.title,
                "source": row.source,
                "url": row.url,
                "content_summary": row.content_summary,
                "sentiment": float(row.sentiment),
                "published_at": row.published_at.isoformat(),
                "similarity": float(row.similarity)
            }
            for row in results
        ]

# Celery task to generate embeddings
@shared_task
def generate_all_embeddings():
    """Generate embeddings for all politicians and news"""
    db = SessionLocal()
    embedding_service = EmbeddingService()
    
    try:
        # Generate politician embeddings
        politicians = db.query(Politician).filter(
            Politician.embedding.is_(None)
        ).all()
        
        for politician in politicians:
            embedding = embedding_service.generate_politician_embedding(politician)
            politician.embedding = embedding
            db.commit()
        
        # Generate news embeddings
        news = db.query(NewsMention).filter(
            NewsMention.embedding.is_(None)
        ).limit(1000).all()  # Process in batches
        
        texts = [f"{n.title} {n.content_summary}" for n in news]
        embeddings = embedding_service.batch_generate_embeddings(texts)
        
        for i, news_item in enumerate(news):
            news_item.embedding = embeddings[i]
        
        db.commit()
        
    finally:
        db.close()
```

**API Endpoints:**

```python
# app/api/v1/search.py (Enhanced)
@router.get("/semantic")
async def semantic_search(
    q: str = Query(..., min_length=3),
    type: str = Query("all", regex="^(all|politicians|news)$"),
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db)
):
    """Semantic search across platform"""
    search_service = SemanticSearchService(db)
    
    results = {}
    
    if type in ["all", "politicians"]:
        results["politicians"] = search_service.search_politicians(q, limit)
    
    if type in ["all", "news"]:
        results["news"] = search_service.search_news(q, limit=limit)
    
    return results

@router.get("/politicians/{politician_id}/similar")
async def get_similar_politicians(
    politician_id: UUID,
    limit: int = Query(5, le=20),
    db: Session = Depends(get_db)
):
    """Find politicians similar to the given one"""
    search_service = SemanticSearchService(db)
    return search_service.find_similar_politicians(politician_id, limit)
```

---

## 2. Real-time Features

### 2.1 WebSocket Integration

#### Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Client    │◀───────▶│  FastAPI    │◀───────▶│    Redis    │
│  (Browser)  │ WebSocket│  WebSocket  │  PubSub │   Channel   │
└─────────────┘         └─────────────┘         └─────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │   Celery    │
                        │   Workers   │
                        └─────────────┘
```

#### Implementation

```python
# app/websocket/connection_manager.py
from fastapi import WebSocket
from typing import Dict, List, Set
import json
import redis.asyncio as redis

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.user_connections: Dict[str, WebSocket] = {}
        self.redis_client = None
    
    async def connect(self, websocket: WebSocket, user_id: str = None, channel: str = "general"):
        """Connect a WebSocket client"""
        await websocket.accept()
        
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        
        self.active_connections[channel].add(websocket)
        
        if user_id:
            self.user_connections[user_id] = websocket
        
        # Subscribe to Redis channel
        if not self.redis_client:
            self.redis_client = await redis.from_url(settings.REDIS_URL)
    
    def disconnect(self, websocket: WebSocket, channel: str = "general"):
        """Disconnect a WebSocket client"""
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)
        
        # Remove from user connections
        for user_id, ws in list(self.user_connections.items()):
            if ws == websocket:
                del self.user_connections[user_id]
    
    async def send_personal_message(self, message: dict, user_id: str):
        """Send message to specific user"""
        if user_id in self.user_connections:
            websocket = self.user_connections[user_id]
            await websocket.send_json(message)
    
    async def broadcast_to_channel(self, message: dict, channel: str = "general"):
        """Broadcast message to all connections in a channel"""
        if channel in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[channel]:
                try:
                    await connection.send_json(message)
                except:
                    disconnected.add(connection)
            
            # Clean up disconnected clients
            for connection in disconnected:
                self.disconnect(connection, channel)
    
    async def publish_to_redis(self, channel: str, message: dict):
        """Publish message to Redis for cross-server broadcasting"""
        if self.redis_client:
            await self.redis_client.publish(
                channel,
                json.dumps(message)
            )

manager = ConnectionManager()

# app/websocket/handlers.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from app.core.security import get_current_user_ws

ws_router = APIRouter()

@ws_router.websocket("/ws/alerts")
async def websocket_alerts(
    websocket: WebSocket,
    token: str = None
):
    """WebSocket endpoint for real-time alerts"""
    # Optional authentication
    user = None
    if token:
        try:
            user = await get_current_user_ws(token)
        except:
            await websocket.close(code=1008)  # Policy violation
            return
    
    await manager.connect(websocket, user.id if user else None, "alerts")
    
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            
            # Handle ping/pong for keep-alive
            if data == "ping":
                await websocket.send_text("pong")
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, "alerts")

@ws_router.websocket("/ws/politician/{politician_id}")
async def websocket_politician(
    websocket: WebSocket,
    politician_id: UUID
):
    """WebSocket for real-time updates on a specific politician"""
    channel = f"politician:{politician_id}"
    await manager.connect(websocket, channel=channel)
    
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)

@ws_router.websocket("/ws/admin/dashboard")
async def websocket_admin_dashboard(
    websocket: WebSocket,
    token: str
):
    """Real-time admin dashboard updates"""
    try:
        user = await get_current_user_ws(token)
        if user.role != "admin":
            await websocket.close(code=1008)
            return
    except:
        await websocket.close(code=1008)
        return
    
    await manager.connect(websocket, user.id, "admin_dashboard")
    
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, "admin_dashboard")

# Helper function to send WebSocket notifications
async def send_websocket_notification(channel: str, notification: dict):
    """Send notification through WebSocket"""
    await manager.broadcast_to_channel(notification, channel)
    await manager.publish_to_redis(channel, notification)
```

**Integration with Celery Tasks:**

```python
# app/tasks/notification_tasks.py
@shared_task
def notify_score_update(politician_id: str, old_score: float, new_score: float):
    """Notify users when a politician's score changes significantly"""
    if abs(new_score - old_score) < 5:
        return  # Only notify for significant changes
    
    notification = {
        "type": "score_update",
        "politician_id": politician_id,
        "old_score": old_score,
        "new_score": new_score,
        "change": new_score - old_score,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Send to general alerts channel
    asyncio.run(send_websocket_notification("alerts", notification))
    
    # Send to politician-specific channel
    asyncio.run(send_websocket_notification(f"politician:{politician_id}", notification))

@shared_task
def notify_new_report(report_id: str):
    """Notify admins of new flagged reports"""
    db = SessionLocal()
    try:
        report = db.query(FlaggedReport).get(report_id)
        if not report:
            return
        
        notification = {
            "type": "new_report",
            "report_id": str(report.id),
            "politician_id": str(report.politician_id),
            "politician_name": report.politician.name,
            "issue_type": report.issue_type,
            "priority": report.priority,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send to admin dashboard
        asyncio.run(send_websocket_notification("admin_dashboard", notification))
    
    finally:
        db.close()
```

### 2.2 Advanced Notification System

#### Database Schema

```sql
-- Notification preferences
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    push_enabled BOOLEAN DEFAULT TRUE,
    websocket_enabled BOOLEAN DEFAULT TRUE,
    frequency VARCHAR(50) DEFAULT 'instant',
    followed_politicians JSONB DEFAULT '[]',
    alert_types JSONB DEFAULT '["score_update", "new_report", "promise_update"]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id),
    CHECK (frequency IN ('instant', 'daily', 'weekly'))
);

-- Notification queue
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    channels VARCHAR(100)[] DEFAULT ARRAY['websocket'],
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'normal',
    scheduled_for TIMESTAMP DEFAULT NOW(),
    sent_at TIMESTAMP,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    CHECK (status IN ('pending', 'sent', 'failed', 'read')),
    CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

CREATE INDEX idx_notifications_user ON notifications(user_id, status);
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_for) WHERE status = 'pending';
```

#### Implementation

```python
# app/models/notification.py
class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    email_enabled = Column(Boolean, default=True)
    sms_enabled = Column(Boolean, default=False)
    push_enabled = Column(Boolean, default=True)
    websocket_enabled = Column(Boolean, default=True)
    frequency = Column(String(50), default="instant")
    followed_politicians = Column(JSONB, default=[])
    alert_types = Column(JSONB, default=["score_update", "new_report", "promise_update"])
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type = Column(String(100), nullable=False)
    title = Column(String(500), nullable=False)
    message = Column(Text, nullable=False)
    data = Column(JSONB)
    channels = Column(ARRAY(String), default=["websocket"])
    status = Column(String(50), default="pending")
    priority = Column(String(20), default="normal")
    scheduled_for = Column(DateTime, default=func.now())
    sent_at = Column(DateTime)
    read_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())

# app/services/notification_service.py
class NotificationService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_notification(
        self,
        user_id: UUID,
        type: str,
        title: str,
        message: str,
        data: dict = None,
        channels: List[str] = None,
        priority: str = "normal"
    ) -> Notification:
        """Create a new notification"""
        # Get user preferences
        prefs = self.db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id
        ).first()
        
        # Determine channels based on preferences
        if channels is None:
            channels = []
            if prefs:
                if prefs.websocket_enabled:
                    channels.append("websocket")
                if prefs.email_enabled:
                    channels.append("email")
                if prefs.sms_enabled:
                    channels.append("sms")
            else:
                channels = ["websocket"]
        
        notification = Notification(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            data=data,
            channels=channels,
            priority=priority
        )
        
        self.db.add(notification)
        self.db.commit()
        
        # Send immediately if instant frequency
        if not prefs or prefs.frequency == "instant":
            send_notification.delay(str(notification.id))
        
        return notification
    
    def notify_followers(
        self,
        politician_id: UUID,
        type: str,
        title: str,
        message: str,
        data: dict = None
    ):
        """Notify all users following a politician"""
        # Find users following this politician
        followers = self.db.query(NotificationPreference).filter(
            NotificationPreference.followed_politicians.contains([str(politician_id)])
        ).all()
        
        for follower_prefs in followers:
            # Check if user wants this type of alert
            if type in follower_prefs.alert_types:
                self.create_notification(
                    user_id=follower_prefs.user_id,
                    type=type,
                    title=title,
                    message=message,
                    data=data
                )
    
    def mark_as_read(self, notification_id: UUID, user_id: UUID):
        """Mark notification as read"""
        notification = self.db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()
        
        if notification:
            notification.read_at = datetime.utcnow()
            notification.status = "read"
            self.db.commit()

# app/tasks/notification_tasks.py
@shared_task
def send_notification(notification_id: str):
    """Send notification through configured channels"""
    db = SessionLocal()
    try:
        notification = db.query(Notification).get(notification_id)
        if not notification or notification.status != "pending":
            return
        
        success = True
        
        # Send through each channel
        for channel in notification.channels:
            try:
                if channel == "websocket":
                    asyncio.run(send_websocket_notification(
                        f"user:{notification.user_id}",
                        {
                            "type": notification.type,
                            "title": notification.title,
                            "message": notification.message,
                            "data": notification.data,
                            "id": str(notification.id)
                        }
                    ))
                
                elif channel == "email":
                    send_email_notification.delay(notification_id)
                
                elif channel == "sms":
                    send_sms_notification.delay(notification_id)
            
            except Exception as e:
                success = False
        
        # Update notification status
        notification.status = "sent" if success else "failed"
        notification.sent_at = datetime.utcnow()
        db.commit()
    
    finally:
        db.close()

@shared_task
def send_email_notification(notification_id: str):
    """Send email notification"""
    db = SessionLocal()
    try:
        notification = db.query(Notification).get(notification_id)
        if not notification:
            return
        
        user = db.query(User).get(notification.user_id)
        if not user or not user.email:
            return
        
        # Use SendGrid or SMTP
        send_email(
            to_email=user.email,
            subject=notification.title,
            body=notification.message,
            html_template="notification_email.html",
            context={
                "title": notification.title,
                "message": notification.message,
                "data": notification.data,
                "user_name": user.full_name
            }
        )
    
    finally:
        db.close()

@shared_task
def send_sms_notification(notification_id: str):
    """Send SMS notification (Africa's Talking or Twilio)"""
    db = SessionLocal()
    try:
        notification = db.query(Notification).get(notification_id)
        if not notification:
            return
        
        user = db.query(User).get(notification.user_id)
        if not user or not user.phone_number:
            return
        
        # Use Africa's Talking for Kenya
        # import africastalking
        # africastalking.initialize(username, api_key)
        # sms = africastalking.SMS
        # sms.send(notification.message, [user.phone_number])
        
        pass  # Implement based on chosen SMS provider
    
    finally:
        db.close()

@shared_task
def send_digest_notifications():
    """Send daily/weekly digest notifications"""
    db = SessionLocal()
    try:
        # Find users with daily/weekly frequency
        daily_users = db.query(NotificationPreference).filter(
            NotificationPreference.frequency == "daily"
        ).all()
        
        for user_prefs in daily_users:
            # Get pending notifications from last 24 hours
            notifications = db.query(Notification).filter(
                Notification.user_id == user_prefs.user_id,
                Notification.status == "pending",
                Notification.created_at >= datetime.utcnow() - timedelta(days=1)
            ).all()
            
            if notifications:
                # Create digest email
                send_digest_email.delay(
                    str(user_prefs.user_id),
                    [str(n.id) for n in notifications]
                )
    
    finally:
        db.close()
```

**API Endpoints:**

```python
# app/api/v1/notifications.py
router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("")
async def get_notifications(
    status: Optional[str] = None,
    limit: int = Query(20, le=100),
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's notifications"""
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    
    if status:
        query = query.filter(Notification.status == status)
    
    total = query.count()
    notifications = query.order_by(
        Notification.created_at.desc()
    ).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "notifications": notifications
    }

@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark notification as read"""
    service = NotificationService(db)
    service.mark_as_read(notification_id, current_user.id)
    return {"message": "Notification marked as read"}

@router.get("/preferences")
async def get_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's notification preferences"""
    prefs = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == current_user.id
    ).first()
    
    if not prefs:
        # Create default preferences
        prefs = NotificationPreference(user_id=current_user.id)
        db.add(prefs)
        db.commit()
    
    return prefs

@router.put("/preferences")
async def update_notification_preferences(
    preferences: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update notification preferences"""
    prefs = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == current_user.id
    ).first()
    
    if not prefs:
        prefs = NotificationPreference(user_id=current_user.id)
        db.add(prefs)
    
    for key, value in preferences.dict(exclude_unset=True).items():
        setattr(prefs, key, value)
    
    prefs.updated_at = datetime.utcnow()
    db.commit()
    
    return prefs

@router.post("/politicians/{politician_id}/follow")
async def follow_politician(
    politician_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Follow a politician for notifications"""
    prefs = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == current_user.id
    ).first()
    
    if not prefs:
        prefs = NotificationPreference(user_id=current_user.id)
        db.add(prefs)
    
    if str(politician_id) not in prefs.followed_politicians:
        prefs.followed_politicians.append(str(politician_id))
        db.commit()
    
    return {"message": "Now following politician"}

@router.delete("/politicians/{politician_id}/follow")
async def unfollow_politician(
    politician_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unfollow a politician"""
    prefs = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == current_user.id
    ).first()
    
    if prefs and str(politician_id) in prefs.followed_politicians:
        prefs.followed_politicians.remove(str(politician_id))
        db.commit()
    
    return {"message": "Unfollowed politician"}
```

---

## 3. Data Integrity & Verification

### 3.1 Source Verification System

```python
# app/models/source.py
class Source(Base):
    __tablename__ = "sources"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # news, government, court, social_media
    url = Column(String(500))
    credibility_score = Column(Numeric(3, 2), default=0.50)  # 0-1
    verification_status = Column(String(50), default="unverified")
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    verified_at = Column(DateTime)
    domain = Column(String(255))
    bias_rating = Column(String(50))  # left, center, right, unknown
    fact_check_rating = Column(Numeric(3, 2))  # 0-1
    metadata = Column(JSONB)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class SourceCitation(Base):
    __tablename__ = "source_citations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String(50), nullable=False)  # case, promise, linkage, news
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id"))
    url = Column(Text, nullable=False)
    citation_text = Column(Text)
    page_number = Column(Integer)
    accessed_at = Column(DateTime, default=func.now())
    is_verified = Column(Boolean, default=False)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    verified_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())

class VerificationVote(Base):
    __tablename__ = "verification_votes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    vote_type = Column(String(20), nullable=False)  # upvote, downvote, flag
    comment = Column(Text)
    created_at = Column(DateTime, default=func.now())
    
    __table_args__ = (
        UniqueConstraint('entity_type', 'entity_id', 'user_id', name='unique_user_vote'),
    )

# app/services/verification_service.py
class VerificationService:
    def __init__(self, db: Session):
        self.db = db
    
    def calculate_source_credibility(self, source_id: UUID) -> float:
        """Calculate credibility score for a source"""
        source = self.db.query(Source).get(source_id)
        if not source:
            return 0.5
        
        # Factors affecting credibility
        factors = []
        
        # 1. Verification status (40%)
        if source.verification_status == "verified":
            factors.append(1.0 * 0.4)
        elif source.verification_status == "pending":
            factors.append(0.6 * 0.4)
        else:
            factors.append(0.3 * 0.4)
        
        # 2. Type of source (30%)
        type_scores = {
            "government": 0.9,
            "court": 0.95,
            "news": 0.7,
            "social_media": 0.4,
            "other": 0.5
        }
        factors.append(type_scores.get(source.type, 0.5) * 0.3)
        
        # 3. Fact check rating (20%)
        if source.fact_check_rating:
            factors.append(float(source.fact_check_rating) * 0.2)
        else:
            factors.append(0.5 * 0.2)
        
        # 4. Community verification (10%)
        citations = self.db.query(SourceCitation).filter(
            SourceCitation.source_id == source_id
        ).all()
        
        if citations:
            verified_count = sum(1 for c in citations if c.is_verified)
            verification_rate = verified_count / len(citations)
            factors.append(verification_rate * 0.1)
        else:
            factors.append(0.5 * 0.1)
        
        credibility = sum(factors)
        
        # Update source credibility
        source.credibility_score = credibility
        self.db.commit()
        
        return credibility
    
    def add_citation(
        self,
        entity_type: str,
        entity_id: UUID,
        source_url: str,
        citation_text: str = None,
        user_id: UUID = None
    ) -> SourceCitation:
        """Add a source citation to an entity"""
        # Extract domain from URL
        from urllib.parse import urlparse
        domain = urlparse(source_url).netloc
        
        # Find or create source
        source = self.db.query(Source).filter(Source.domain == domain).first()
        if not source:
            source = Source(
                name=domain,
                type="other",
                domain=domain,
                url=source_url
            )
            self.db.add(source)
            self.db.commit()
        
        citation = SourceCitation(
            entity_type=entity_type,
            entity_id=entity_id,
            source_id=source.id,
            url=source_url,
            citation_text=citation_text
        )
        
        self.db.add(citation)
        self.db.commit()
        
        return citation
    
    def vote_on_entity(
        self,
        entity_type: str,
        entity_id: UUID,
        user_id: UUID,
        vote_type: str,
        comment: str = None
    ) -> VerificationVote:
        """User votes to verify/flag an entity"""
        # Check if user already voted
        existing = self.db.query(VerificationVote).filter(
            VerificationVote.entity_type == entity_type,
            VerificationVote.entity_id == entity_id,
            VerificationVote.user_id == user_id
        ).first()
        
        if existing:
            # Update existing vote
            existing.vote_type = vote_type
            existing.comment = comment
            self.db.commit()
            return existing
        
        vote = VerificationVote(
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user_id,
            vote_type=vote_type,
            comment=comment
        )
        
        self.db.add(vote)
        self.db.commit()
        
        # Update entity verification status based on votes
        self._update_entity_verification(entity_type, entity_id)
        
        return vote
    
    def _update_entity_verification(self, entity_type: str, entity_id: UUID):
        """Update entity verification status based on community votes"""
        votes = self.db.query(VerificationVote).filter(
            VerificationVote.entity_type == entity_type,
            VerificationVote.entity_id == entity_id
        ).all()
        
        upvotes = sum(1 for v in votes if v.vote_type == "upvote")
        downvotes = sum(1 for v in votes if v.vote_type == "downvote")
        flags = sum(1 for v in votes if v.vote_type == "flag")
        
        # Simple verification logic
        total_votes = upvotes + downvotes
        if total_votes >= 5:
            verification_score = upvotes / total_votes
            
            # Update entity based on type
            if entity_type == "case":
                case = self.db.query(LegalCase).get(entity_id)
                if case:
                    case.is_verified = verification_score >= 0.7
            elif entity_type == "promise":
                promise = self.db.query(Promise).get(entity_id)
                if promise:
                    promise.is_verified = verification_score >= 0.7
        
        # Auto-flag for review if many flags
        if flags >= 3:
            # Create admin notification
            pass  # Implement admin flagging
        
        self.db.commit()
    
    def get_verification_summary(self, entity_type: str, entity_id: UUID) -> Dict:
        """Get verification summary for an entity"""
        votes = self.db.query(VerificationVote).filter(
            VerificationVote.entity_type == entity_type,
            VerificationVote.entity_id == entity_id
        ).all()
        
        citations = self.db.query(SourceCitation).filter(
            SourceCitation.entity_type == entity_type,
            SourceCitation.entity_id == entity_id
        ).all()
        
        upvotes = sum(1 for v in votes if v.vote_type == "upvote")
        downvotes = sum(1 for v in votes if v.vote_type == "downvote")
        flags = sum(1 for v in votes if v.vote_type == "flag")
        
        return {
            "total_votes": len(votes),
            "upvotes": upvotes,
            "downvotes": downvotes,
            "flags": flags,
            "verification_score": upvotes / (upvotes + downvotes) if (upvotes + downvotes) > 0 else 0,
            "citations_count": len(citations),
            "verified_citations": sum(1 for c in citations if c.is_verified),
            "avg_source_credibility": np.mean([float(c.source.credibility_score) for c in citations]) if citations else 0
        }
```

### 3.2 Audit Trail System

```python
# app/models/audit.py
class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50))
    entity_id = Column(UUID(as_uuid=True))
    changes = Column(JSONB)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    timestamp = Column(DateTime, default=func.now(), index=True)
    
    user = relationship("User")

class DataVersion(Base):
    __tablename__ = "data_versions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    version_number = Column(Integer, nullable=False)
    data_snapshot = Column(JSONB, nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    change_reason = Column(Text)
    created_at = Column(DateTime, default=func.now())
    
    __table_args__ = (
        Index('idx_version_entity', 'entity_type', 'entity_id', 'version_number'),
    )

# app/services/audit_service.py
class AuditService:
    def __init__(self, db: Session):
        self.db = db
    
    def log_action(
        self,
        user_id: UUID,
        action: str,
        entity_type: str = None,
        entity_id: UUID = None,
        changes: dict = None,
        request: Request = None
    ):
        """Log an audit event"""
        log = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            changes=changes,
            ip_address=request.client.host if request else None,
            user_agent=request.headers.get("user-agent") if request else None
        )
        
        self.db.add(log)
        self.db.commit()
    
    def create_version(
        self,
        entity_type: str,
        entity_id: UUID,
        data: dict,
        user_id: UUID,
        reason: str = None
    ):
        """Create a version snapshot of data"""
        # Get current version number
        latest = self.db.query(DataVersion).filter(
            DataVersion.entity_type == entity_type,
            DataVersion.entity_id == entity_id
        ).order_by(DataVersion.version_number.desc()).first()
        
        version_number = (latest.version_number + 1) if latest else 1
        
        version = DataVersion(
            entity_type=entity_type,
            entity_id=entity_id,
            version_number=version_number,
            data_snapshot=data,
            changed_by=user_id,
            change_reason=reason
        )
        
        self.db.add(version)
        self.db.commit()
        
        return version
    
    def get_version_history(
        self,
        entity_type: str,
        entity_id: UUID,
        limit: int = 20
    ) -> List[DataVersion]:
        """Get version history for an entity"""
        return self.db.query(DataVersion).filter(
            DataVersion.entity_type == entity_type,
            DataVersion.entity_id == entity_id
        ).order_by(DataVersion.version_number.desc()).limit(limit).all()
    
    def compare_versions(
        self,
        entity_type: str,
        entity_id: UUID,
        version1: int,
        version2: int
    ) -> Dict:
        """Compare two versions of an entity"""
        v1 = self.db.query(DataVersion).filter(
            DataVersion.entity_type == entity_type,
            DataVersion.entity_id == entity_id,
            DataVersion.version_number == version1
        ).first()
        
        v2 = self.db.query(DataVersion).filter(
            DataVersion.entity_type == entity_type,
            DataVersion.entity_id == entity_id,
            DataVersion.version_number == version2
        ).first()
        
        if not v1 or not v2:
            return None
        
        # Find differences
        changes = {}
        all_keys = set(v1.data_snapshot.keys()) | set(v2.data_snapshot.keys())
        
        for key in all_keys:
            val1 = v1.data_snapshot.get(key)
            val2 = v2.data_snapshot.get(key)
            
            if val1 != val2:
                changes[key] = {
                    "from": val1,
                    "to": val2
                }
        
        return {
            "version1": version1,
            "version2": version2,
            "changes": changes,
            "changed_by_v1": str(v1.changed_by) if v1.changed_by else None,
            "changed_by_v2": str(v2.changed_by) if v2.changed_by else None,
            "timestamp_v1": v1.created_at.isoformat(),
            "timestamp_v2": v2.created_at.isoformat()
        }
    
    def revert_to_version(
        self,
        entity_type: str,
        entity_id: UUID,
        version_number: int,
        user_id: UUID
    ):
        """Revert entity to a previous version"""
        version = self.db.query(DataVersion).filter(
            DataVersion.entity_type == entity_type,
            DataVersion.entity_id == entity_id,
            DataVersion.version_number == version_number
        ).first()
        
        if not version:
            raise ValueError("Version not found")
        
        # Get entity and update
        if entity_type == "politician":
            entity = self.db.query(Politician).get(entity_id)
        elif entity_type == "case":
            entity = self.db.query(LegalCase).get(entity_id)
        # ... other entity types
        
        if not entity:
            raise ValueError("Entity not found")
        
        # Update entity with version data
        for key, value in version.data_snapshot.items():
            if hasattr(entity, key):
                setattr(entity, key, value)
        
        # Create new version for the revert
        current_data = {c.name: getattr(entity, c.name) for c in entity.__table__.columns}
        self.create_version(
            entity_type,
            entity_id,
            current_data,
            user_id,
            f"Reverted to version {version_number}"
        )
        
        # Log the revert action
        self.log_action(
            user_id,
            "revert_version",
            entity_type,
            entity_id,
            {"reverted_to": version_number}
        )
        
        self.db.commit()

# Middleware to auto-log changes
from sqlalchemy import event

def setup_audit_listeners():
    """Setup SQLAlchemy event listeners for automatic auditing"""
    
    @event.listens_for(Politician, 'before_update')
    def politician_before_update(mapper, connection, target):
        # Store old values
        target._old_values = {}
        for col in mapper.columns:
            target._old_values[col.name] = getattr(target, col.name)
    
    @event.listens_for(Politician, 'after_update')
    def politician_after_update(mapper, connection, target):
        # Compare old and new values
        if hasattr(target, '_old_values'):
            changes = {}
            for col in mapper.columns:
                old_val = target._old_values.get(col.name)
                new_val = getattr(target, col.name)
                if old_val != new_val:
                    changes[col.name] = {
                        "from": str(old_val),
                        "to": str(new_val)
                    }
            
            if changes:
                # Create audit log (need to pass user_id from context)
                pass  # Implement context-based user tracking
```

**API Endpoints:**

```python
# app/api/v1/verification.py
router = APIRouter(prefix="/verification", tags=["verification"])

@router.post("/entities/{entity_type}/{entity_id}/vote")
async def vote_on_entity(
    entity_type: str,
    entity_id: UUID,
    vote: VerificationVoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Vote to verify or flag an entity"""
    service = VerificationService(db)
    result = service.vote_on_entity(
        entity_type,
        entity_id,
        current_user.id,
        vote.vote_type,
        vote.comment
    )
    return result

@router.get("/entities/{entity_type}/{entity_id}/summary")
async def get_verification_summary(
    entity_type: str,
    entity_id: UUID,
    db: Session = Depends(get_db)
):
    """Get verification summary for an entity"""
    service = VerificationService(db)
    return service.get_verification_summary(entity_type, entity_id)

@router.post("/citations")
async def add_citation(
    citation: CitationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a source citation"""
    service = VerificationService(db)
    result = service.add_citation(
        citation.entity_type,
        citation.entity_id,
        citation.source_url,
        citation.citation_text,
        current_user.id
    )
    return result

# app/api/v1/audit.py
router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("/entities/{entity_type}/{entity_id}/history")
async def get_entity_history(
    entity_type: str,
    entity_id: UUID,
    limit: int = Query(20, le=100),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get version history for an entity (Admin only)"""
    service = AuditService(db)
    return service.get_version_history(entity_type, entity_id, limit)

@router.get("/entities/{entity_type}/{entity_id}/compare")
async def compare_versions(
    entity_type: str,
    entity_id: UUID,
    version1: int,
    version2: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Compare two versions of an entity (Admin only)"""
    service = AuditService(db)
    return service.compare_versions(entity_type, entity_id, version1, version2)

@router.post("/entities/{entity_type}/{entity_id}/revert")
async def revert_to_version(
    entity_type: str,
    entity_id: UUID,
    version: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Revert entity to a previous version (Admin only)"""
    service = AuditService(db)
    service.revert_to_version(entity_type, entity_id, version, current_user.id)
    return {"message": f"Reverted to version {version}"}

@router.get("/logs")
async def get_audit_logs(
    user_id: Optional[UUID] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(50, le=500),
    offset: int = 0,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get audit logs with filters (Admin only)"""
    query = db.query(AuditLog)
    
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if start_date:
        query = query.filter(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.filter(AuditLog.timestamp <= end_date)
    
    total = query.count()
    logs = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "logs": logs
    }
```

---

## 4. Advanced Analytics

### 4.1 Analytics Service

```python
# app/services/analytics_service.py
class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db
    
    def get_platform_overview(self) -> Dict:
        """Get comprehensive platform statistics"""
        return {
            "politicians": {
                "total": self.db.query(Politician).count(),
                "active": self.db.query(Politician).filter(Politician.is_active == True).count(),
                "avg_transparency_score": self.db.query(func.avg(Politician.transparency_score)).scalar()
            },
            "cases": {
                "total": self.db.query(LegalCase).count(),
                "ongoing": self.db.query(LegalCase).filter(LegalCase.status == "ongoing").count(),
                "resolved": self.db.query(LegalCase).filter(LegalCase.status == "resolved").count()
            },
            "promises": {
                "total": self.db.query(Promise).count(),
                "fulfilled": self.db.query(Promise).filter(Promise.status == "fulfilled").count(),
                "broken": self.db.query(Promise).filter(Promise.status == "broken").count(),
                "fulfillment_rate": self._calculate_promise_fulfillment_rate()
            },
            "reports": {
                "total": self.db.query(FlaggedReport).count(),
                "pending": self.db.query(FlaggedReport).filter(FlaggedReport.status == "under_review").count(),
                "verified": self.db.query(FlaggedReport).filter(FlaggedReport.status == "verified").count()
            },
            "users": {
                "total": self.db.query(User).count(),
                "active_30d": self._count_active_users(30)
            }
        }
    
    def get_score_distribution(self) -> Dict:
        """Get transparency score distribution"""
        politicians = self.db.query(Politician.transparency_score).filter(
            Politician.transparency_score.isnot(None)
        ).all()
        
        scores = [float(p.transparency_score) for p in politicians]
        
        # Create bins
        bins = [0, 20, 40, 60, 80, 100]
        distribution = {}
        
        for i in range(len(bins) - 1):
            count = sum(1 for s in scores if bins[i] <= s < bins[i+1])
            distribution[f"{bins[i]}-{bins[i+1]}"] = count
        
        return {
            "distribution": distribution,
            "mean": np.mean(scores) if scores else 0,
            "median": np.median(scores) if scores else 0,
            "std": np.std(scores) if scores else 0,
            "min": min(scores) if scores else 0,
            "max": max(scores) if scores else 0
        }
    
    def get_party_comparison(self) -> List[Dict]:
        """Compare transparency scores by party"""
        results = self.db.query(
            Politician.party,
            func.count(Politician.id).label("count"),
            func.avg(Politician.transparency_score).label("avg_score"),
            func.min(Politician.transparency_score).label("min_score"),
            func.max(Politician.transparency_score).label("max_score")
        ).filter(
            Politician.party.isnot(None),
            Politician.transparency_score.isnot(None)
        ).group_by(Politician.party).all()
        
        return [
            {
                "party": r.party,
                "politician_count": r.count,
                "avg_transparency_score": float(r.avg_score),
                "min_score": float(r.min_score),
                "max_score": float(r.max_score)
            }
            for r in results
        ]
    
    def get_county_stats(self) -> List[Dict]:
        """Get statistics by county"""
        results = self.db.query(
            Politician.county,
            func.count(Politician.id).label("count"),
            func.avg(Politician.transparency_score).label("avg_score")
        ).filter(
            Politician.county.isnot(None)
        ).group_by(Politician.county).all()
        
        # Add case and promise counts
        county_stats = []
        for r in results:
            politician_ids = [p.id for p in self.db.query(Politician.id).filter(
                Politician.county == r.county
            ).all()]
            
            case_count = self.db.query(LegalCase).filter(
                LegalCase.politician_id.in_(politician_ids)
            ).count()
            
            promise_count = self.db.query(Promise).filter(
                Promise.politician_id.in_(politician_ids)
            ).count()
            
            county_stats.append({
                "county": r.county,
                "politician_count": r.count,
                "avg_transparency_score": float(r.avg_score) if r.avg_score else 0,
                "total_cases": case_count,
                "total_promises": promise_count
            })
        
        return sorted(county_stats, key=lambda x: x["avg_transparency_score"], reverse=True)
    
    def get_trending_politicians(self, days: int = 7, limit: int = 10) -> List[Dict]:
        """Get trending politicians based on recent activity"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Calculate trending score based on:
        # - New cases
        # - News mentions
        # - Score changes
        # - Report activity
        
        subquery_cases = self.db.query(
            LegalCase.politician_id,
            func.count(LegalCase.id).label("new_cases")
        ).filter(
            LegalCase.created_at >= cutoff_date
        ).group_by(LegalCase.politician_id).subquery()
        
        subquery_news = self.db.query(
            NewsMention.politician_id,
            func.count(NewsMention.id).label("news_count")
        ).filter(
            NewsMention.published_at >= cutoff_date
        ).group_by(NewsMention.politician_id).subquery()
        
        results = self.db.query(
            Politician,
            func.coalesce(subquery_cases.c.new_cases, 0).label("new_cases"),
            func.coalesce(subquery_news.c.news_count, 0).label("news_mentions")
        ).outerjoin(
            subquery_cases, Politician.id == subquery_cases.c.politician_id
        ).outerjoin(
            subquery_news, Politician.id == subquery_news.c.politician_id
        ).filter(
            or_(
                subquery_cases.c.new_cases > 0,
                subquery_news.c.news_count > 0
            )
        ).all()
        
        # Calculate trending score
        trending = []
        for r in results:
            politician = r[0]
            new_cases = r.new_cases
            news_mentions = r.news_mentions
            
            # Simple trending score
            trending_score = (new_cases * 10) + (news_mentions * 5)
            
            trending.append({
                "politician": politician,
                "trending_score": trending_score,
                "new_cases": new_cases,
                "news_mentions": news_mentions
            })
        
        # Sort by trending score
        trending.sort(key=lambda x: x["trending_score"], reverse=True)
        
        return trending[:limit]
    
    def get_time_series_data(
        self,
        metric: str,
        start_date: datetime,
        end_date: datetime,
        interval: str = "day"
    ) -> List[Dict]:
        """Get time series data for various metrics"""
        if metric == "transparency_scores":
            return self._get_score_time_series(start_date, end_date, interval)
        elif metric == "new_reports":
            return self._get_reports_time_series(start_date, end_date, interval)
        elif metric == "case_filings":
            return self._get_cases_time_series(start_date, end_date, interval)
        else:
            return []
    
    def _get_score_time_series(
        self,
        start_date: datetime,
        end_date: datetime,
        interval: str
    ) -> List[Dict]:
        """Get average transparency score over time"""
        # Use score_history table
        if interval == "day":
            date_trunc = func.date_trunc('day', ScoreHistory.calculated_at)
        elif interval == "week":
            date_trunc = func.date_trunc('week', ScoreHistory.calculated_at)
        elif interval == "month":
            date_trunc = func.date_trunc('month', ScoreHistory.calculated_at)
        
        results = self.db.query(
            date_trunc.label("period"),
            func.avg(ScoreHistory.transparency_score).label("avg_score"),
            func.count(ScoreHistory.id).label("count")
        ).filter(
            ScoreHistory.calculated_at >= start_date,
            ScoreHistory.calculated_at <= end_date
        ).group_by("period").order_by("period").all()
        
        return [
            {
                "period": r.period.isoformat(),
                "avg_score": float(r.avg_score),
                "count": r.count
            }
            for r in results
        ]
    
    def _calculate_promise_fulfillment_rate(self) -> float:
        """Calculate overall promise fulfillment rate"""
        total = self.db.query(Promise).count()
        if total == 0:
            return 0
        
        fulfilled = self.db.query(Promise).filter(
            Promise.status == "fulfilled"
        ).count()
        
        return (fulfilled / total) * 100
    
    def _count_active_users(self, days: int) -> int:
        """Count users active in the last N days"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        return self.db.query(User).filter(
            User.last_login >= cutoff
        ).count()

# app/services/export_service.py
import csv
import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

class ExportService:
    def __init__(self, db: Session):
        self.db = db
    
    def export_to_csv(self, entity_type: str, filters: dict = None) -> io.StringIO:
        """Export data to CSV"""
        output = io.StringIO()
        writer = csv.writer(output)
        
        if entity_type == "politicians":
            writer.writerow([
                "ID", "Name", "Position", "Party", "County",
                "Transparency Score", "Date Created"
            ])
            
            query = self.db.query(Politician)
            if filters:
                # Apply filters
                pass
            
            for p in query.all():
                writer.writerow([
                    str(p.id), p.name, p.position, p.party,
                    p.county, p.transparency_score, p.created_at
                ])
        
        # Similar for other entity types
        
        output.seek(0)
        return output
    
    def generate_report_pdf(self, politician_id: UUID) -> io.BytesIO:
        """Generate PDF report for a politician"""
        politician = self.db.query(Politician).get(politician_id)
        if not politician:
            return None
        
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        
        # Title
        p.setFont("Helvetica-Bold", 20)
        p.drawString(50, 750, f"Transparency Report: {politician.name}")
        
        # Basic info
        p.setFont("Helvetica", 12)
        y = 700
        p.drawString(50, y, f"Position: {politician.position}")
        y -= 20
        p.drawString(50, y, f"Party: {politician.party}")
        y -= 20
        p.drawString(50, y, f"Transparency Score: {politician.transparency_score}/100")
        
        # Cases
        y -= 40
        p.setFont("Helvetica-Bold", 14)
        p.drawString(50, y, "Legal Cases")
        y -= 20
        p.setFont("Helvetica", 10)
        
        cases = self.db.query(LegalCase).filter(
            LegalCase.politician_id == politician_id
        ).all()
        
        for case in cases[:10]:  # Limit to 10
            p.drawString(70, y, f"• {case.title} ({case.status})")
            y -= 15
            if y < 100:
                p.showPage()
                y = 750
        
        p.save()
        buffer.seek(0)
        return buffer
```

**API Endpoints:**

```python
# app/api/v1/analytics.py
router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/overview")
async def get_platform_overview(
    db: Session = Depends(get_db)
):
    """Get comprehensive platform statistics"""
    service = AnalyticsService(db)
    return service.get_platform_overview()

@router.get("/scores/distribution")
async def get_score_distribution(
    db: Session = Depends(get_db)
):
    """Get transparency score distribution"""
    service = AnalyticsService(db)
    return service.get_score_distribution()

@router.get("/comparison/parties")
async def compare_parties(
    db: Session = Depends(get_db)
):
    """Compare transparency scores by party"""
    service = AnalyticsService(db)
    return service.get_party_comparison()

@router.get("/comparison/counties")
async def get_county_stats(
    db: Session = Depends(get_db)
):
    """Get statistics by county"""
    service = AnalyticsService(db)
    return service.get_county_stats()

@router.get("/trending")
async def get_trending_politicians(
    days: int = Query(7, ge=1, le=30),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Get trending politicians"""
    service = AnalyticsService(db)
    return service.get_trending_politicians(days, limit)

@router.get("/time-series/{metric}")
async def get_time_series(
    metric: str,
    start_date: datetime,
    end_date: datetime,
    interval: str = Query("day", regex="^(day|week|month)$"),
    db: Session = Depends(get_db)
):
    """Get time series data for metrics"""
    service = AnalyticsService(db)
    return service.get_time_series_data(metric, start_date, end_date, interval)

@router.get("/export/{entity_type}")
async def export_data(
    entity_type: str,
    format: str = Query("csv", regex="^(csv|json|xlsx)$"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Export data (Admin only)"""
    service = ExportService(db)
    
    if format == "csv":
        csv_data = service.export_to_csv(entity_type)
        return Response(
            content=csv_data.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={entity_type}.csv"}
        )
    
    # Similar for other formats

@router.get("/reports/politician/{politician_id}")
async def generate_politician_report(
    politician_id: UUID,
    format: str = Query("pdf", regex="^(pdf|html)$"),
    db: Session = Depends(get_db)
):
    """Generate comprehensive report for a politician"""
    service = ExportService(db)
    
    if format == "pdf":
        pdf_buffer = service.generate_report_pdf(politician_id)
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=politician_report.pdf"}
        )
```

---

## 5. Scale & Performance

### 5.1 Caching Strategy

```python
# app/core/cache.py
import redis
import pickle
from functools import wraps
from typing import Optional, Callable
import hashlib
import json

class CacheManager:
    def __init__(self):
        self.redis_client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=False  # We'll handle encoding
        )
    
    def generate_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate cache key from function arguments"""
        key_data = f"{prefix}:{str(args)}:{str(sorted(kwargs.items()))}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def get(self, key: str) -> Optional[any]:
        """Get value from cache"""
        try:
            data = self.redis_client.get(key)
            if data:
                return pickle.loads(data)
        except Exception as e:
            print(f"Cache get error: {e}")
        return None
    
    def set(self, key: str, value: any, ttl: int = 300):
        """Set value in cache with TTL (seconds)"""
        try:
            self.redis_client.setex(
                key,
                ttl,
                pickle.dumps(value)
            )
        except Exception as e:
            print(f"Cache set error: {e}")
    
    def delete(self, key: str):
        """Delete key from cache"""
        try:
            self.redis_client.delete(key)
        except Exception as e:
            print(f"Cache delete error: {e}")
    
    def delete_pattern(self, pattern: str):
        """Delete all keys matching pattern"""
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                self.redis_client.delete(*keys)
        except Exception as e:
            print(f"Cache delete pattern error: {e}")
    
    def invalidate_politician(self, politician_id: UUID):
        """Invalidate all cache entries for a politician"""
        patterns = [
            f"politician:{politician_id}:*",
            f"politician_list:*",
            f"search:*",
            f"stats:*"
        ]
        for pattern in patterns:
            self.delete_pattern(pattern)

cache_manager = CacheManager()

# Decorator for caching
def cached(prefix: str, ttl: int = 300, invalidate_on: list = None):
    """Cache decorator for functions"""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = cache_manager.generate_key(prefix, *args, **kwargs)
            
            # Try to get from cache
            cached_value = cache_manager.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Call function and cache result
            result = await func(*args, **kwargs)
            cache_manager.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator

# Example usage in services
class CachedPoliticianService:
    def __init__(self, db: Session):
        self.db = db
    
    @cached(prefix="politician", ttl=600)
    async def get_politician(self, politician_id: UUID) -> dict:
        """Get politician with caching"""
        politician = self.db.query(Politician).get(politician_id)
        if not politician:
            return None
        
        # Convert to dict
        return {
            "id": str(politician.id),
            "name": politician.name,
            "position": politician.position,
            "party": politician.party,
            "transparency_score": float(politician.transparency_score)
        }
    
    @cached(prefix="politician_cases", ttl=300)
    async def get_politician_cases(self, politician_id: UUID) -> list:
        """Get politician cases with caching"""
        cases = self.db.query(LegalCase).filter(
            LegalCase.politician_id == politician_id
        ).all()
        
        return [
            {
                "id": str(c.id),
                "title": c.title,
                "status": c.status,
                "court": c.court
            }
            for c in cases
        ]
```

### 5.2 Database Optimization

```sql
-- Additional indexes for performance
CREATE INDEX CONCURRENTLY idx_politicians_active_score 
ON politicians(is_active, transparency_score DESC) 
WHERE is_active = TRUE;

CREATE INDEX CONCURRENTLY idx_news_politician_published 
ON news_mentions(politician_id, published_at DESC);

CREATE INDEX CONCURRENTLY idx_cases_politician_status 
ON legal_cases(politician_id, status);

CREATE INDEX CONCURRENTLY idx_promises_politician_status 
ON promises(politician_id, status);

-- Materialized view for dashboard statistics
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM politicians WHERE is_active = TRUE) as total_politicians,
    (SELECT COUNT(*) FROM legal_cases WHERE status = 'ongoing') as ongoing_cases,
    (SELECT COUNT(*) FROM promises WHERE status = 'fulfilled') as fulfilled_promises,
    (SELECT COUNT(*) FROM flagged_reports WHERE status = 'under_review') as pending_reports,
    (SELECT AVG(transparency_score) FROM politicians WHERE transparency_score IS NOT NULL) as avg_transparency_score,
    NOW() as last_updated;

CREATE UNIQUE INDEX ON dashboard_stats (last_updated);

-- Refresh materialized view periodically
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats;
END;
$ LANGUAGE plpgsql;

-- Partitioning for large tables
CREATE TABLE score_history_partitioned (
    LIKE score_history INCLUDING ALL
) PARTITION BY RANGE (calculated_at);

-- Create monthly partitions
CREATE TABLE score_history_2024_01 PARTITION OF score_history_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE score_history_2024_02 PARTITION OF score_history_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Auto-create partitions function
CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $
DECLARE
    start_date date;
    end_date date;
    partition_name text;
BEGIN
    start_date := date_trunc('month', CURRENT_DATE);
    end_date := start_date + interval '1 month';
    partition_name := 'score_history_' || to_char(start_date, 'YYYY_MM');
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF score_history_partitioned
         FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
    );
END;
$ LANGUAGE plpgsql;
```

```python
# app/services/database_optimization_service.py
class DatabaseOptimizationService:
    def __init__(self, db: Session):
        self.db = db
    
    def refresh_materialized_views(self):
        """Refresh all materialized views"""
        self.db.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats"))
        self.db.commit()
    
    def analyze_tables(self):
        """Run ANALYZE on all tables for query optimization"""
        tables = [
            "politicians", "legal_cases", "promises",
            "news_mentions", "flagged_reports", "score_history"
        ]
        
        for table in tables:
            self.db.execute(text(f"ANALYZE {table}"))
        
        self.db.commit()
    
    def get_slow_queries(self, limit: int = 10) -> List[Dict]:
        """Get slow queries from pg_stat_statements"""
        result = self.db.execute(text("""
            SELECT 
                query,
                calls,
                total_exec_time,
                mean_exec_time,
                max_exec_time
            FROM pg_stat_statements
            WHERE query NOT LIKE '%pg_stat_statements%'
            ORDER BY mean_exec_time DESC
            LIMIT :limit
        """), {"limit": limit})
        
        return [dict(row) for row in result]
    
    def vacuum_analyze(self):
        """Run VACUUM ANALYZE on all tables"""
        # Must be run outside transaction
        self.db.execute(text("VACUUM ANALYZE"))

# Celery task for periodic optimization
@shared_task
def optimize_database():
    """Run database optimization tasks"""
    db = SessionLocal()
    try:
        service = DatabaseOptimizationService(db)
        service.refresh_materialized_views()
        service.analyze_tables()
    finally:
        db.close()

# Add to celery beat schedule
app.conf.beat_schedule['optimize-database'] = {
    'task': 'app.tasks.optimization_tasks.optimize_database',
    'schedule': crontab(hour=3, minute=0),  # 3 AM daily
}
```

### 5.3 API Rate Limiting

```python
# app/core/rate_limit.py
from fastapi import HTTPException, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute", "1000/hour"],
    storage_uri=settings.REDIS_URL
)

# Custom rate limit handler
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "message": "Too many requests. Please try again later.",
            "retry_after": exc.detail
        }
    )

# Apply to FastAPI app
# app/main.py
from app.core.rate_limit import limiter, custom_rate_limit_handler

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, custom_rate_limit_handler)

# Usage in endpoints
@router.get("/politicians")
@limiter.limit("50/minute")
async def get_politicians(request: Request, db: Session = Depends(get_db)):
    """Get politicians with rate limiting"""
    pass

# Different limits for authenticated users
def get_rate_limit(request: Request) -> str:
    """Dynamic rate limit based on user role"""
    # Check if user is authenticated
    token = request.headers.get("Authorization")
    if token:
        try:
            user = verify_token(token)
            if user.role == "admin":
                return "1000/minute"
            elif user.role == "premium":
                return "500/minute"
        except:
            pass
    
    return "100/minute"

@router.get("/search")
@limiter.limit(get_rate_limit)
async def search(request: Request, q: str, db: Session = Depends(get_db)):
    """Search with dynamic rate limiting"""
    pass
```

### 5.4 Background Job Optimization

```python
# app/tasks/celery_config.py
from celery import Celery
from kombu import Exchange, Queue

app = Celery('kenya_ni_yetu')

# Configure task routing
app.conf.task_routes = {
    'app.tasks.scraping_tasks.*': {'queue': 'scraping'},
    'app.tasks.scoring_tasks.*': {'queue': 'scoring'},
    'app.tasks.notification_tasks.*': {'queue': 'notifications'},
    'app.tasks.export_tasks.*': {'queue': 'exports'},
}

# Configure task priorities
app.conf.task_queues = (
    Queue('default', Exchange('default'), routing_key='default', priority=5),
    Queue('high_priority', Exchange('high_priority'), routing_key='high_priority', priority=10),
    Queue('low_priority', Exchange('low_priority'), routing_key='low_priority', priority=1),
    Queue('scraping', Exchange('scraping'), routing_key='scraping', priority=3),
    Queue('scoring', Exchange('scoring'), routing_key='scoring', priority=7),
    Queue('notifications', Exchange('notifications'), routing_key='notifications', priority=8),
)

# Task optimization settings
app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,  # Disable prefetching for long tasks
    task_time_limit=3600,  # 1 hour hard limit
    task_soft_time_limit=3000,  # 50 minutes soft limit
    broker_connection_retry_on_startup=True,
)

# Monitoring
app.conf.worker_send_task_events = True
app.conf.task_send_sent_event = True

# app/tasks/optimized_tasks.py
@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=300,
    priority=7
)
def recalculate_transparency_score(self, politician_id: str):
    """Optimized score calculation with retry logic"""
    db = SessionLocal()
    try:
        scoring_service = ScoringService(db)
        result = scoring_service.calculate_transparency_score(politician_id)
        
        # Invalidate cache
        cache_manager.invalidate_politician(politician_id)
        
        # Notify via WebSocket
        notify_score_update.delay(
            politician_id,
            result['old_score'],
            result['new_score']
        )
        
        return result
    
    except SoftTimeLimitExceeded:
        # Task took too long, retry with lower priority
        self.retry(priority=3)
    
    except Exception as e:
        logger.error(f"Score calculation failed: {e}")
        self.retry(exc=e, countdown=self.default_retry_delay * (self.request.retries + 1))
    
    finally:
        db.close()

# Batch processing for efficiency
@shared_task
def batch_recalculate_scores(politician_ids: List[str], batch_size: int = 10):
    """Process score calculations in batches"""
    for i in range(0, len(politician_ids), batch_size):
        batch = politician_ids[i:i + batch_size]
        group([
            recalculate_transparency_score.s(pid) for pid in batch
        ]).apply_async()
```

---

## 6. Enhanced Security

### 6.1 Two-Factor Authentication

```python
# app/models/user.py (additions)
class User(Base):
    # ... existing fields ...
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(32))
    backup_codes = Column(JSONB)  # Encrypted backup codes
    two_factor_verified_at = Column(DateTime)

# app/services/two_factor_service.py
import pyotp
import qrcode
import io
from cryptography.fernet import Fernet

class TwoFactorService:
    def __init__(self, db: Session):
        self.db = db
        self.cipher = Fernet(settings.ENCRYPTION_KEY.encode())
    
    def enable_2fa(self, user_id: UUID) -> Dict:
        """Enable 2FA for user and return QR code"""
        user = self.db.query(User).get(user_id)
        if not user:
            raise ValueError("User not found")
        
        # Generate secret
        secret = pyotp.random_base32()
        user.two_factor_secret = self._encrypt(secret)
        
        # Generate backup codes
        backup_codes = [pyotp.random_base32()[:8] for _ in range(10)]
        user.backup_codes = [self._encrypt(code) for code in backup_codes]
        
        self.db.commit()
        
        # Generate QR code
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(
            name=user.email,
            issuer_name="Kenya ni Yetu"
        )
        
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        return {
            "qr_code": buffer.getvalue(),
            "secret": secret,
            "backup_codes": backup_codes
        }
    
    def verify_2fa_setup(self, user_id: UUID, token: str) -> bool:
        """Verify 2FA token during setup"""
        user = self.db.query(User).get(user_id)
        if not user or not user.two_factor_secret:
            return False
        
        secret = self._decrypt(user.two_factor_secret)
        totp = pyotp.TOTP(secret)
        
        if totp.verify(token):
            user.two_factor_enabled = True
            user.two_factor_verified_at = datetime.utcnow()
            self.db.commit()
            return True
        
        return False
    
    def verify_2fa_token(self, user_id: UUID, token: str) -> bool:
        """Verify 2FA token during login"""
        user = self.db.query(User).get(user_id)
        if not user or not user.two_factor_enabled:
            return False
        
        # Try TOTP token
        secret = self._decrypt(user.two_factor_secret)
        totp = pyotp.TOTP(secret)
        
        if totp.verify(token):
            return True
        
        # Try backup codes
        for encrypted_code in user.backup_codes:
            backup_code = self._decrypt(encrypted_code)
            if token == backup_code:
                # Remove used backup code
                user.backup_codes.remove(encrypted_code)
                self.db.commit()
                return True
        
        return False
    
    def disable_2fa(self, user_id: UUID):
        """Disable 2FA for user"""
        user = self.db.query(User).get(user_id)
        if user:
            user.two_factor_enabled = False
            user.two_factor_secret = None
            user.backup_codes = None
            self.db.commit()
    
    def _encrypt(self, data: str) -> str:
        """Encrypt sensitive data"""
        return self.cipher.encrypt(data.encode()).decode()
    
    def _decrypt(self, data: str) -> str:
        """Decrypt sensitive data"""
        return self.cipher.decrypt(data.encode()).decode()

# app/api/v1/auth.py (additions)
@router.post("/2fa/enable")
async def enable_2fa(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Enable 2FA for current user"""
    service = TwoFactorService(db)
    result = service.enable_2fa(current_user.id)
    
    # Return QR code as base64
    import base64
    qr_base64 = base64.b64encode(result["qr_code"]).decode()
    
    return {
        "qr_code": qr_base64,
        "secret": result["secret"],
        "backup_codes": result["backup_codes"]
    }

@router.post("/2fa/verify-setup")
async def verify_2fa_setup(
    token: str = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify 2FA setup"""
    service = TwoFactorService(db)
    success = service.verify_2fa_setup(current_user.id, token)
    
    if success:
        return {"message": "2FA enabled successfully"}
    else:
        raise HTTPException(status_code=400, detail="Invalid token")

@router.post("/login")
async def login(
    credentials: LoginRequest,
    db: Session = Depends(get_db)
):
    """Login with optional 2FA"""
    user = authenticate_user(db, credentials.email, credentials.password)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if 2FA is enabled
    if user.two_factor_enabled:
        if not credentials.two_factor_token:
            return {
                "requires_2fa": True,
                "message": "2FA token required"
            }
        
        service = TwoFactorService(db)
        if not service.verify_2fa_token(user.id, credentials.two_factor_token):
            raise HTTPException(status_code=401, detail="Invalid 2FA token")
    
    # Generate tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }
```

### 6.2 API Key Management

```python
# app/models/api_key.py
class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    key_hash = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    scopes = Column(JSONB, default=[])  # Permissions
    rate_limit = Column(Integer, default=1000)  # Requests per hour
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
    
    user = relationship("User", back_populates="api_keys")

# app/services/api_key_service.py
import secrets
import hashlib

class APIKeyService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_api_key(
        self,
        user_id: UUID,
        name: str,
        scopes: List[str] = None,
        expires_in_days: int = 365
    ) -> Dict:
        """Create new API key"""
        # Generate random key
        key = f"kny_{secrets.token_urlsafe(32)}"
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        
        api_key = APIKey(
            user_id=user_id,
            key_hash=key_hash,
            name=name,
            scopes=scopes or ["read"],
            expires_at=datetime.utcnow() + timedelta(days=expires_in_days)
        )
        
        self.db.add(api_key)
        self.db.commit()
        
        return {
            "api_key": key,  # Only shown once!
            "id": str(api_key.id),
            "name": api_key.name,
            "expires_at": api_key.expires_at.isoformat()
        }
    
    def verify_api_key(self, key: str) -> Optional[APIKey]:
        """Verify API key and return associated key object"""
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        
        api_key = self.db.query(APIKey).filter(
            APIKey.key_hash == key_hash,
            APIKey.is_active == True
        ).first()
        
        if not api_key:
            return None
        
        # Check expiration
        if api_key.expires_at and api_key.expires_at < datetime.utcnow():
            return None
        
        # Update last used
        api_key.last_used_at = datetime.utcnow()
        self.db.commit()
        
        return api_key
    
    def revoke_api_key(self, key_id: UUID, user_id: UUID):
        """Revoke an API key"""
        api_key = self.db.query(APIKey).filter(
            APIKey.id == key_id,
            APIKey.user_id == user_id
        ).first()
        
        if api_key:
            api_key.is_active = False
            self.db.commit()

# Dependency for API key authentication
async def get_api_key(
    api_key: str = Header(None, alias="X-API-Key"),
    db: Session = Depends(get_db)
) -> APIKey:
    """Validate API key from header"""
    if not api_key:
        raise HTTPException(status_code=401, detail="API key required")
    
    service = APIKeyService(db)
    key_obj = service.verify_api_key(api_key)
    
    if not key_obj:
        raise HTTPException(status_code=401, detail="Invalid or expired API key")
    
    return key_obj

# Check scopes
def require_scopes(*required_scopes: str):
    """Dependency to check API key scopes"""
    def dependency(api_key: APIKey = Depends(get_api_key)):
        if not all(scope in api_key.scopes for scope in required_scopes):
            raise HTTPException(
                status_code=403,
                detail=f"Required scopes: {', '.join(required_scopes)}"
            )
        return api_key
    return dependency

# Usage in endpoints
@router.get("/politicians")
async def get_politicians(
    api_key: APIKey = Depends(require_scopes("read")),
    db: Session = Depends(get_db)
):
    """Get politicians with API key auth"""
    pass

@router.post("/reports")
async def create_report(
    report: ReportCreate,
    api_key: APIKey = Depends(require_scopes("write")),
    db: Session = Depends(get_db)
):
    """Create report with API key auth"""
    pass
```

---

## 7. Community Features

### 7.1 Comment System

```python
class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    entity_type = Column(String(50), nullable=False)  # politician, case, promise, report
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("comments.id"))  # For nested comments
    content = Column(Text, nullable=False)
    upvotes = Column(Integer, default=0)
    downvotes = Column(Integer, default=0)
    is_edited = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    is_flagged = Column(Boolean, default=False)
    flag_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    user = relationship("User")
    parent = relationship("Comment", remote_side=[id], backref="replies")

class CommentVote(Base):
    __tablename__ = "comment_votes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    comment_id = Column(UUID(as_uuid=True), ForeignKey("comments.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    vote_type = Column(String(10), nullable=False)  # upvote, downvote
    created_at = Column(DateTime, default=func.now())
    
    __table_args__ = (
        UniqueConstraint('comment_id', 'user_id', name='unique_comment_vote'),
    )

# app/services/comment_service.py
class CommentService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_comment(
        self,
        user_id: UUID,
        entity_type: str,
        entity_id: UUID,
        content: str,
        parent_id: UUID = None
    ) -> Comment:
        """Create a new comment"""
        # Validate content
        if len(content) < 10:
            raise ValueError("Comment too short")
        if len(content) > 2000:
            raise ValueError("Comment too long")
        
        # Check for spam/profanity
        if self._is_spam(content):
            raise ValueError("Comment flagged as spam")
        
        comment = Comment(
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            content=content,
            parent_id=parent_id
        )
        
        self.db.add(comment)
        self.db.commit()
        
        return comment
    
    def get_comments(
        self,
        entity_type: str,
        entity_id: UUID,
        parent_id: UUID = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict]:
        """Get comments for an entity"""
        query = self.db.query(Comment).filter(
            Comment.entity_type == entity_type,
            Comment.entity_id == entity_id,
            Comment.is_deleted == False
        )
        
        if parent_id:
            query = query.filter(Comment.parent_id == parent_id)
        else:
            query = query.filter(Comment.parent_id.is_(None))
        
        comments = query.order_by(
            Comment.created_at.desc()
        ).offset(offset).limit(limit).all()
        
        # Format with user info and reply count
        result = []
        for comment in comments:
            reply_count = self.db.query(Comment).filter(
                Comment.parent_id == comment.id,
                Comment.is_deleted == False
            ).count()
            
            result.append({
                "id": str(comment.id),
                "user": {
                    "id": str(comment.user.id),
                    "name": comment.user.full_name,
                },
                "content": comment.content,
                "upvotes": comment.upvotes,
                "downvotes": comment.downvotes,
                "reply_count": reply_count,
                "is_edited": comment.is_edited,
                "created_at": comment.created_at.isoformat(),
                "updated_at": comment.updated_at.isoformat()
            })
        
        return result
    
    def update_comment(
        self,
        comment_id: UUID,
        user_id: UUID,
        content: str
    ) -> Comment:
        """Update a comment"""
        comment = self.db.query(Comment).filter(
            Comment.id == comment_id,
            Comment.user_id == user_id
        ).first()
        
        if not comment:
            raise ValueError("Comment not found or unauthorized")
        
        comment.content = content
        comment.is_edited = True
        comment.updated_at = datetime.utcnow()
        self.db.commit()
        
        return comment
    
    def delete_comment(self, comment_id: UUID, user_id: UUID, is_admin: bool = False):
        """Delete a comment (soft delete)"""
        query = self.db.query(Comment).filter(Comment.id == comment_id)
        
        if not is_admin:
            query = query.filter(Comment.user_id == user_id)
        
        comment = query.first()
        if not comment:
            raise ValueError("Comment not found or unauthorized")
        
        comment.is_deleted = True
        comment.content = "[deleted]"
        self.db.commit()
    
    def vote_comment(
        self,
        comment_id: UUID,
        user_id: UUID,
        vote_type: str
    ):
        """Vote on a comment"""
        # Check existing vote
        existing = self.db.query(CommentVote).filter(
            CommentVote.comment_id == comment_id,
            CommentVote.user_id == user_id
        ).first()
        
        comment = self.db.query(Comment).get(comment_id)
        if not comment:
            raise ValueError("Comment not found")
        
        if existing:
            # Update vote
            if existing.vote_type == vote_type:
                # Remove vote
                if vote_type == "upvote":
                    comment.upvotes -= 1
                else:
                    comment.downvotes -= 1
                self.db.delete(existing)
            else:
                # Change vote
                if vote_type == "upvote":
                    comment.upvotes += 1
                    comment.downvotes -= 1
                else:
                    comment.downvotes += 1
                    comment.upvotes -= 1
                existing.vote_type = vote_type
        else:
            # New vote
            vote = CommentVote(
                comment_id=comment_id,
                user_id=user_id,
                vote_type=vote_type
            )
            self.db.add(vote)
            
            if vote_type == "upvote":
                comment.upvotes += 1
            else:
                comment.downvotes += 1
        
        self.db.commit()
    
    def flag_comment(self, comment_id: UUID, user_id: UUID, reason: str):
        """Flag a comment for moderation"""
        comment = self.db.query(Comment).get(comment_id)
        if not comment:
            raise ValueError("Comment not found")
        
        comment.flag_count += 1
        
        # Auto-hide if too many flags
        if comment.flag_count >= 5:
            comment.is_flagged = True
        
        self.db.commit()
        
        # Notify moderators
        if comment.flag_count >= 3:
            # Send notification to moderators
            pass
    
    def _is_spam(self, content: str) -> bool:
        """Simple spam detection"""
        spam_indicators = [
            "click here",
            "buy now",
            "limited offer",
            "www.",
            "http"
        ]
        
        content_lower = content.lower()
        return any(indicator in content_lower for indicator in spam_indicators)

# app/api/v1/comments.py
router = APIRouter(prefix="/comments", tags=["comments"])

@router.post("")
async def create_comment(
    comment: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new comment"""
    service = CommentService(db)
    result = service.create_comment(
        current_user.id,
        comment.entity_type,
        comment.entity_id,
        comment.content,
        comment.parent_id
    )
    return result

@router.get("/{entity_type}/{entity_id}")
async def get_comments(
    entity_type: str,
    entity_id: UUID,
    parent_id: Optional[UUID] = None,
    limit: int = Query(50, le=100),
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get comments for an entity"""
    service = CommentService(db)
    return service.get_comments(entity_type, entity_id, parent_id, limit, offset)

@router.patch("/{comment_id}")
async def update_comment(
    comment_id: UUID,
    update: CommentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a comment"""
    service = CommentService(db)
    return service.update_comment(comment_id, current_user.id, update.content)

@router.delete("/{comment_id}")
async def delete_comment(
    comment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a comment"""
    service = CommentService(db)
    is_admin = current_user.role == "admin"
    service.delete_comment(comment_id, current_user.id, is_admin)
    return {"message": "Comment deleted"}

@router.post("/{comment_id}/vote")
async def vote_comment(
    comment_id: UUID,
    vote: CommentVote,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Vote on a comment"""
    service = CommentService(db)
    service.vote_comment(comment_id, current_user.id, vote.vote_type)
    return {"message": "Vote recorded"}

@router.post("/{comment_id}/flag")
async def flag_comment(
    comment_id: UUID,
    flag: CommentFlag,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Flag a comment"""
    service = CommentService(db)
    service.flag_comment(comment_id, current_user.id, flag.reason)
    return {"message": "Comment flagged"}
```

### 7.2 User Reputation System

```python
# app/models/user.py (additions)
class User(Base):
    # ... existing fields ...
    reputation_score = Column(Integer, default=0)
    reputation_level = Column(String(50), default="newcomer")

class ReputationEvent(Base):
    __tablename__ = "reputation_events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    event_type = Column(String(50), nullable=False)
    points = Column(Integer, nullable=False)
    description = Column(Text)
    related_entity_type = Column(String(50))
    related_entity_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, default=func.now())

# app/services/reputation_service.py
class ReputationService:
    # Reputation point values
    POINTS = {
        "report_submitted": 10,
        "report_verified": 50,
        "report_dismissed": -5,
        "comment_upvoted": 2,
        "comment_downvoted": -1,
        "verification_vote": 5,
        "correct_verification": 20,
        "incorrect_verification": -10,
        "daily_login": 1,
        "profile_complete": 25
    }
    
    LEVELS = {
        "newcomer": (0, 99),
        "contributor": (100, 499),
        "trusted": (500, 999),
        "expert": (1000, 4999),
        "guardian": (5000, float('inf'))
    }
    
    def __init__(self, db: Session):
        self.db = db
    
    def award_points(
        self,
        user_id: UUID,
        event_type: str,
        description: str = None,
        entity_type: str = None,
        entity_id: UUID = None
    ):
        """Award reputation points to a user"""
        points = self.POINTS.get(event_type, 0)
        
        # Create event
        event = ReputationEvent(
            user_id=user_id,
            event_type=event_type,
            points=points,
            description=description,
            related_entity_type=entity_type,
            related_entity_id=entity_id
        )
        self.db.add(event)
        
        # Update user reputation
        user = self.db.query(User).get(user_id)
        if user:
            user.reputation_score += points
            user.reputation_level = self._calculate_level(user.reputation_score)
        
        self.db.commit()
    
    def _calculate_level(self, score: int) -> str:
        """Calculate reputation level from score"""
        for level, (min_score, max_score) in self.LEVELS.items():
            if min_score <= score <= max_score:
                return level
        return "newcomer"
    
    def get_user_reputation(self, user_id: UUID) -> Dict:
        """Get user's reputation details"""
        user = self.db.query(User).get(user_id)
        if not user:
            return None
        
        # Get recent events
        recent_events = self.db.query(ReputationEvent).filter(
            ReputationEvent.user_id == user_id
        ).order_by(ReputationEvent.created_at.desc()).limit(10).all()
        
        # Calculate next level
        current_level = user.reputation_level
        next_level = None
        points_to_next = 0
        
        level_order = ["newcomer", "contributor", "trusted", "expert", "guardian"]
        current_index = level_order.index(current_level)
        
        if current_index < len(level_order) - 1:
            next_level = level_order[current_index + 1]
            points_to_next = self.LEVELS[next_level][0] - user.reputation_score
        
        return {
            "score": user.reputation_score,
            "level": user.reputation_level,
            "next_level": next_level,
            "points_to_next_level": points_to_next,
            "recent_events": [
                {
                    "type": e.event_type,
                    "points": e.points,
                    "description": e.description,
                    "date": e.created_at.isoformat()
                }
                for e in recent_events
            ]
        }
    
    def get_leaderboard(self, limit: int = 100) -> List[Dict]:
        """Get reputation leaderboard"""
        users = self.db.query(User).filter(
            User.is_active == True
        ).order_by(User.reputation_score.desc()).limit(limit).all()
        
        return [
            {
                "rank": idx + 1,
                "user_id": str(user.id),
                "name": user.full_name,
                "reputation_score": user.reputation_score,
                "reputation_level": user.reputation_level
            }
            for idx, user in enumerate(users)
        ]
```

---

## 8. Integration & APIs

### 8.1 GraphQL API

```python
# app/graphql/schema.py
import strawberry
from typing import List, Optional
from strawberry.fastapi import GraphQLRouter

@strawberry.type
class Politician:
    id: str
    name: str
    position: str
    party: Optional[str]
    county: Optional[str]
    transparency_score: float
    photo_url: Optional[str]

@strawberry.type
class LegalCase:
    id: str
    title: str
    status: str
    court: Optional[str]
    date_filed: Optional[str]

@strawberry.type
class Query:
    @strawberry.field
    def politician(self, id: str, info) -> Optional[Politician]:
        db = info.context["db"]
        politician = db.query(PoliticianModel).get(id)
        if not politician:
            return None
        
        return Politician(
            id=str(politician.id),
            name=politician.name,
            position=politician.position,
            party=politician.party,
            county=politician.county,
            transparency_score=float(politician.transparency_score),
            photo_url=politician.photo_url
        )
    
    @strawberry.field
    def politicians(
        self,
        info,
        limit: int = 10,
        offset: int = 0,
        party: Optional[str] = None,
        county: Optional[str] = None
    ) -> List[Politician]:
        db = info.context["db"]
        query = db.query(PoliticianModel)
        
        if party:
            query = query.filter(PoliticianModel.party == party)
        if county:
            query = query.filter(PoliticianModel.county == county)
        
        politicians = query.offset(offset).limit(limit).all()
        
        return [
            Politician(
                id=str(p.id),
                name=p.name,
                position=p.position,
                party=p.party,
                county=p.county,
                transparency_score=float(p.transparency_score),
                photo_url=p.photo_url
            )
            for p in politicians
        ]
    
    @strawberry.field
    def search_politicians(self, info, query: str) -> List[Politician]:
        db = info.context["db"]
        search_service = SemanticSearchService(db)
        results = search_service.search_politicians(query)
        
        return [
            Politician(
                id=r["id"],
                name=r["name"],
                position=r["position"],
                party=r["party"],
                county=r["county"],
                transparency_score=r["transparency_score"],
                photo_url=None
            )
            for r in results
        ]

schema = strawberry.Schema(query=Query)

# app/main.py
from app.graphql.schema import schema

graphql_app = GraphQLRouter(
    schema,
    context_getter=lambda: {"db": SessionLocal()}
)

app.include_router(graphql_app, prefix="/graphql")
```

### 8.2 Webhooks

```python
# app/models/webhook.py
class Webhook(Base):
    __tablename__ = "webhooks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    url = Column(String(500), nullable=False)
    events = Column(JSONB, nullable=False)  # List of event types
    secret = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    last_triggered = Column(DateTime)
    failure_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())

class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    webhook_id = Column(UUID(as_uuid=True), ForeignKey("webhooks.id"), nullable=False)
    event_type = Column(String(100), nullable=False)
    payload = Column(JSONB, nullable=False)
    status_code = Column(Integer)
    response_body = Column(Text)
    attempt = Column(Integer, default=1)
    delivered_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())

# app/services/webhook_service.py
import hmac
import hashlib

class WebhookService:
    def __init__(self, db: Session):
        self.db = db
        self.http_client = httpx.AsyncClient(timeout=10.0)
    
    def create_webhook(
        self,
        user_id: UUID,
        url: str,
        events: List[str]
    ) -> Webhook:
        """Create a new webhook"""
        # Generate secret
        secret = secrets.token_urlsafe(32)
        
        webhook = Webhook(
            user_id=user_id,
            url=url,
            events=events,
            secret=secret
        )
        
        self.db.add(webhook)
        self.db.commit()
        
        return webhook
    
    async def trigger_webhooks(
        self,
        event_type: str,
        payload: dict
    ):
        """Trigger all webhooks for an event"""
        webhooks = self.db.query(Webhook).filter(
            Webhook.is_active == True,
            Webhook.events.contains([event_type])
        ).all()
        
        for webhook in webhooks:
            await self._deliver_webhook(webhook, event_type, payload)
    
    async def _deliver_webhook(
        self,
        webhook: Webhook,
        event_type: str,
        payload: dict,
        attempt: int = 1
    ):
        """Deliver webhook to endpoint"""
        # Create signature
        signature = self._create_signature(payload, webhook.secret)
        
        # Create delivery record
        delivery = WebhookDelivery(
            webhook_id=webhook.id,
            event_type=event_type,
            payload=payload,
            attempt=attempt
        )
        self.db.add(delivery)
        self.db.commit()
        
        try:
            response = await self.http_client.post(
                webhook.url,
                json=payload,
                headers={
                    "X-Webhook-Signature": signature,
                    "X-Event-Type": event_type,
                    "User-Agent": "KenyaNiYetu-Webhook/1.0"
                }
            )
            
            delivery.status_code = response.status_code
            delivery.response_body = response.text[:1000]
            delivery.delivered_at = datetime.utcnow()
            
            webhook.last_triggered = datetime.utcnow()
            webhook.failure_count = 0
            
            self.db.commit()
        
        except Exception as e:
            delivery.response_body = str(e)
            webhook.failure_count += 1
            
            # Disable webhook after 10 consecutive failures
            if webhook.failure_count >= 10:
                webhook.is_active = False
            
            self.db.commit()
            
            # Retry with exponential backoff
            if attempt < 3:
                await asyncio.sleep(2 ** attempt)
                await self._deliver_webhook(webhook, event_type, payload, attempt + 1)
    
    def _create_signature(self, payload: dict, secret: str) -> str:
        """Create HMAC signature for webhook"""
        payload_bytes = json.dumps(payload, sort_keys=True).encode()
        signature = hmac.new(
            secret.encode(),
            payload_bytes,
            hashlib.sha256
        ).hexdigest()
        return signature

# Usage example
@shared_task
def trigger_score_update_webhook(politician_id: str, old_score: float, new_score: float):
    """Trigger webhooks for score update"""
    db = SessionLocal()
    try:
        service = WebhookService(db)
        asyncio.run(service.trigger_webhooks(
            "politician.score_updated",
            {
                "politician_id": politician_id,
                "old_score": old_score,
                "new_score": new_score,
                "timestamp": datetime.utcnow().isoformat()
            }
        ))
    finally:
        db.close()
```

---

## 9. Admin & Moderation Tools

### 9.1 Enhanced Admin Dashboard

```python
# app/api/v1/admin.py
router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/dashboard")
async def get_admin_dashboard(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get admin dashboard data"""
    analytics = AnalyticsService(db)
    
    return {
        "overview": analytics.get_platform_overview(),
        "pending_reports": db.query(FlaggedReport).filter(
            FlaggedReport.status == "under_review"
        ).count(),
        "flagged_comments": db.query(Comment).filter(
            Comment.is_flagged == True
        ).count(),
        "recent_users": db.query(User).order_by(
            User.created_at.desc()
        ).limit(10).all(),
        "system_health": {
            "database": "healthy",
            "redis": "healthy",
            "celery": "healthy"
        }
    }

@router.get("/reports/queue")
async def get_moderation_queue(
    status: str = Query("under_review"),
    priority: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get moderation queue"""
    query = db.query(FlaggedReport).filter(FlaggedReport.status == status)
    
    if priority:
        query = query.filter(FlaggedReport.priority == priority)
    
    total = query.count()
    reports = query.order_by(
        FlaggedReport.priority.desc(),
        FlaggedReport.date_reported.asc()
    ).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "reports": reports
    }

@router.post("/reports/{report_id}/review")
async def review_report(
    report_id: UUID,
    review: ReportReview,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Review a flagged report"""
    report = db.query(FlaggedReport).get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report.status = review.status
    report.admin_notes = review.notes
    
    if review.status == "verified":
        # Award reputation to reporter
        rep_service = ReputationService(db)
        if report.reporter_id:
            rep_service.award_points(
                report.reporter_id,
                "report_verified",
                f"Report {report.title} was verified"
            )
    
    # Log action
    audit_service = AuditService(db)
    audit_service.log_action(
        current_user.id,
        "review_report",
        "report",
        report_id,
        {"status": review.status, "notes": review.notes}
    )
    
    db.commit()
    
    return report

@router.post("/bulk-actions/recalculate-scores")
async def bulk_recalculate_scores(
    politician_ids: Optional[List[UUID]] = None,
    current_user: User = Depends(get_current_admin_user)
):
    """Bulk recalculate transparency scores"""
    if politician_ids:
        ids = [str(pid) for pid in politician_ids]
    else:
        db = SessionLocal()
        ids = [str(p.id) for p in db.query(Politician).all()]
        db.close()
    
    # Queue batch job
    batch_recalculate_scores.delay(ids)
    
    return {"message": f"Queued {len(ids)} score recalculations"}

@router.get("/logs/activity")
async def get_activity_logs(
    user_id: Optional[UUID] = None,
    action: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(100, le=1000),
    offset: int = 0,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get activity logs"""
    query = db.query(AuditLog)
    
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if start_date:
        query = query.filter(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.filter(AuditLog.timestamp <= end_date)
    
    total = query.count()
    logs = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "logs": logs
    }
```

---

## 10. Implementation Timeline

### Week 1-2: AI/ML Foundation
- [ ] Setup news scraping infrastructure
- [ ] Implement sentiment analysis
- [ ] Deploy entity linking system
- [ ] Setup Celery tasks for scraping
- [ ] Test with real news sources

### Week 3-4: Real-time Features
- [ ] Implement WebSocket connections
- [ ] Build notification system
- [ ] Setup Redis pub/sub
- [ ] Create WebSocket API endpoints
- [ ] Test real-time updates

### Week 5-6: Data Integrity
- [ ] Build verification system
- [ ] Implement audit trail
- [ ] Create version control
- [ ] Setup community voting
- [ ] Test data integrity features

### Week 7-8: Analytics & Performance
- [ ] Build analytics service
- [ ] Implement caching layer
- [ ] Optimize database queries
- [ ] Setup materialized views
- [ ] Performance testing

### Week 9-10: Security Enhancements
- [ ] Implement 2FA
- [ ] Build API key system
- [ ] Enhanced rate limiting
- [ ] Security audit
- [ ] Penetration testing

### Week 11-12: Community Features
- [ ] Build comment system
- [ ] Implement reputation system
- [ ] Create user leaderboard
- [ ] Moderation tools
- [ ] User testing

### Week 13-14: Integration & APIs
- [ ] Build GraphQL API
- [ ] Implement webhooks
- [ ] Create API documentation
- [ ] Developer portal
- [ ] API testing

### Week 15-16: Admin Tools & Final Testing
- [ ] Enhanced admin dashboard
- [ ] Bulk operations
- [ ] System monitoring
- [ ] Full integration testing
- [ ] Performance optimization
- [ ] Documentation finalization
- [ ] Deployment preparation

---

## 11. Testing Strategy

### 11.1 Unit Tests

```python
# tests/test_scoring_service.py
import pytest
from app.services.scoring_service import ScoringService
from app.models.politician import Politician
from app.models.case import LegalCase

@pytest.fixture
def scoring_service(db_session):
    return ScoringService(db_session)

@pytest.fixture
def sample_politician(db_session):
    politician = Politician(
        name="Test Politician",
        position="Senator",
        party="Test Party",
        transparency_score=0.0
    )
    db_session.add(politician)
    db_session.commit()
    return politician

def test_calculate_legal_record_score(scoring_service, sample_politician, db_session):
    """Test legal record score calculation"""
    # Add some cases
    case1 = LegalCase(
        politician_id=sample_politician.id,
        title="Corruption Case",
        status="resolved",
        outcome="guilty",
        severity="high"
    )
    case2 = LegalCase(
        politician_id=sample_politician.id,
        title="Minor Case",
        status="dismissed",
        severity="low"
    )
    db_session.add_all([case1, case2])
    db_session.commit()
    
    score = scoring_service._calculate_legal_record_score(sample_politician)
    
    assert score >= 0
    assert score <= 100
    assert score < 100  # Should be penalized for guilty verdict

def test_transparency_score_calculation(scoring_service, sample_politician):
    """Test full transparency score calculation"""
    result = scoring_service.calculate_transparency_score(sample_politician.id)
    
    assert "score" in result
    assert "breakdown" in result
    assert 0 <= result["score"] <= 100

# tests/test_notification_service.py
def test_create_notification(db_session, sample_user):
    """Test notification creation"""
    service = NotificationService(db_session)
    
    notification = service.create_notification(
        user_id=sample_user.id,
        type="test",
        title="Test Notification",
        message="This is a test"
    )
    
    assert notification.id is not None
    assert notification.status == "pending"

# tests/test_verification_service.py
def test_community_voting(db_session, sample_politician, sample_user):
    """Test community verification voting"""
    service = VerificationService(db_session)
    
    vote = service.vote_on_entity(
        "politician",
        sample_politician.id,
        sample_user.id,
        "upvote",
        "Verified information"
    )
    
    assert vote.vote_type == "upvote"
    
    summary = service.get_verification_summary("politician", sample_politician.id)
    assert summary["upvotes"] == 1
```

### 11.2 Integration Tests

```python
# tests/test_api_integration.py
import pytest
from fastapi.testclient import TestClient

@pytest.fixture
def auth_headers(client, sample_user):
    """Get authentication headers"""
    response = client.post("/api/v1/auth/login", json={
        "email": sample_user.email,
        "password": "testpassword"
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_politician_crud_flow(client, auth_headers):
    """Test complete politician CRUD flow"""
    # Create
    response = client.post(
        "/api/v1/politicians",
        json={
            "name": "New Politician",
            "position": "Governor",
            "party": "Test Party"
        },
        headers=auth_headers
    )
    assert response.status_code == 201
    politician_id = response.json()["id"]
    
    # Read
    response = client.get(f"/api/v1/politicians/{politician_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "New Politician"
    
    # Update
    response = client.patch(
        f"/api/v1/politicians/{politician_id}",
        json={"party": "Updated Party"},
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["party"] == "Updated Party"
    
    # Delete
    response = client.delete(
        f"/api/v1/politicians/{politician_id}",
        headers=auth_headers
    )
    assert response.status_code == 204

def test_search_functionality(client):
    """Test search endpoints"""
    # Semantic search
    response = client.get("/api/v1/search/semantic?q=corruption&type=politicians")
    assert response.status_code == 200
    assert "politicians" in response.json()
    
    # Autocomplete
    response = client.get("/api/v1/search/autocomplete?q=john")
    assert response.status_code == 200

def test_notification_flow(client, auth_headers, db_session):
    """Test notification system"""
    # Create notification preference
    response = client.put(
        "/api/v1/notifications/preferences",
        json={
            "email_enabled": True,
            "frequency": "instant"
        },
        headers=auth_headers
    )
    assert response.status_code == 200
    
    # Get notifications
    response = client.get("/api/v1/notifications", headers=auth_headers)
    assert response.status_code == 200
```

### 11.3 Performance Tests

```python
# tests/test_performance.py
import pytest
from locust import HttpUser, task, between

class PlatformUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Login on start"""
        response = self.client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "testpassword"
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    @task(3)
    def view_politicians(self):
        """View politicians list"""
        self.client.get("/api/v1/politicians")
    
    @task(2)
    def view_politician_details(self):
        """View single politician"""
        self.client.get("/api/v1/politicians/sample-id")
    
    @task(1)
    def search(self):
        """Search politicians"""
        self.client.get("/api/v1/search?q=corruption")
    
    @task(1)
    def get_analytics(self):
        """Get analytics"""
        self.client.get("/api/v1/analytics/overview")

# Run with: locust -f tests/test_performance.py

# Database performance test
def test_query_performance(db_session):
    """Test database query performance"""
    import time
    
    # Test politician list query
    start = time.time()
    politicians = db_session.query(Politician).limit(100).all()
    duration = time.time() - start
    assert duration < 0.5  # Should complete in under 500ms
    
    # Test complex join query
    start = time.time()
    query = db_session.query(Politician).join(LegalCase).filter(
        LegalCase.status == "ongoing"
    ).limit(50).all()
    duration = time.time() - start
    assert duration < 1.0  # Should complete in under 1 second

# Cache performance test
def test_cache_performance():
    """Test caching effectiveness"""
    from app.core.cache import cache_manager
    
    # First call (cache miss)
    import time
    start = time.time()
    cache_manager.set("test_key", {"data": "test"}, ttl=60)
    set_duration = time.time() - start
    
    # Second call (cache hit)
    start = time.time()
    result = cache_manager.get("test_key")
    get_duration = time.time() - start
    
    assert result == {"data": "test"}
    assert get_duration < set_duration  # Cache hit should be faster
```

### 11.4 Security Tests

```python
# tests/test_security.py
def test_sql_injection_prevention(client):
    """Test SQL injection prevention"""
    malicious_queries = [
        "'; DROP TABLE politicians; --",
        "1' OR '1'='1",
        "admin'--"
    ]
    
    for query in malicious_queries:
        response = client.get(f"/api/v1/search?q={query}")
        # Should not cause error or return unauthorized data
        assert response.status_code in [200, 400]

def test_xss_prevention(client):
    """Test XSS prevention"""
    xss_payload = "<script>alert('XSS')</script>"
    
    response = client.post("/api/v1/comments", json={
        "entity_type": "politician",
        "entity_id": "test-id",
        "content": xss_payload
    })
    
    # Should sanitize or reject
    if response.status_code == 201:
        comment = response.json()
        assert "<script>" not in comment["content"]

def test_rate_limiting(client):
    """Test rate limiting"""
    # Make many requests quickly
    responses = []
    for _ in range(150):
        response = client.get("/api/v1/politicians")
        responses.append(response.status_code)
    
    # Should eventually hit rate limit
    assert 429 in responses

def test_authentication_required(client):
    """Test protected endpoints require auth"""
    protected_endpoints = [
        ("/api/v1/reports", "POST"),
        ("/api/v1/politicians/test-id", "PATCH"),
        ("/api/v1/notifications", "GET")
    ]
    
    for endpoint, method in protected_endpoints:
        if method == "GET":
            response = client.get(endpoint)
        elif method == "POST":
            response = client.post(endpoint, json={})
        elif method == "PATCH":
            response = client.patch(endpoint, json={})
        
        assert response.status_code == 401

def test_2fa_enforcement(client, db_session):
    """Test 2FA enforcement"""
    # Create user with 2FA enabled
    user = User(
        email="2fa@example.com",
        hashed_password=hash_password("password"),
        two_factor_enabled=True,
        two_factor_secret="test_secret"
    )
    db_session.add(user)
    db_session.commit()
    
    # Try login without 2FA token
    response = client.post("/api/v1/auth/login", json={
        "email": "2fa@example.com",
        "password": "password"
    })
    
    assert response.json()["requires_2fa"] == True
```

---

## 12. Deployment Strategy

### 12.1 Production Environment Setup

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.prod
    environment:
      - APP_ENV=production
      - DEBUG=False
    ports:
      - "8000:8000"
    depends_on:
      - db
      - redis
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 2G
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=kenya_ni_yetu
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "5432:5432"
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 4G
    restart: always

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: always

  celery_worker:
    build:
      context: .
      dockerfile: Dockerfile.prod
    command: celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
    environment:
      - APP_ENV=production
    depends_on:
      - db
      - redis
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2'
          memory: 2G
    restart: always

  celery_beat:
    build:
      context: .
      dockerfile: Dockerfile.prod
    command: celery -A app.tasks.celery_app beat --loglevel=info
    environment:
      - APP_ENV=production
    depends_on:
      - redis
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - static_files:/static
    depends_on:
      - api
    restart: always

volumes:
  postgres_data:
  redis_data:
  static_files:
```

### 12.2 Dockerfile.prod

```dockerfile
# Dockerfile.prod
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -u 1000 appuser

# Set work directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run application
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--access-logfile", "-", "--error-logfile", "-"]
```

### 12.3 Nginx Configuration

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream api_backend {
        least_conn;
        server api:8000 max_fails=3 fail_timeout=30s;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general_limit:10m rate=100r/s;

    # Caching
    proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m;

    server {
        listen 80;
        server_name kenyaniyetu.org www.kenyaniyetu.org;
        
        # Redirect to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name kenyaniyetu.org www.kenyaniyetu.org;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security Headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Static files
        location /static/ {
            alias /static/;
            expires 30d;
            add_header Cache-Control "public, immutable";
        }

        # API endpoints
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            
            proxy_pass http://api_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Caching for GET requests
            proxy_cache api_cache;
            proxy_cache_key "$scheme$request_method$host$request_uri";
            proxy_cache_valid 200 5m;
            proxy_cache_valid 404 1m;
            proxy_cache_bypass $http_cache_control;
            add_header X-Cache-Status $upstream_cache_status;
        }

        # WebSocket support
        location /ws/ {
            proxy_pass http://api_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_read_timeout 86400;
        }

        # Health check
        location /health {
            access_log off;
            proxy_pass http://api_backend/health;
        }
    }
}
```

### 12.4 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt
      
      - name: Run tests
        run: |
          pytest --cov=app --cov-report=xml
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost/test_db
          REDIS_URL: redis://localhost:6379/0
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Container Registry
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          file: ./Dockerfile.prod
          push: true
          tags: |
            kenyaniyetu/api:latest
            kenyaniyetu/api:${{ github.sha }}
          cache-from: type=registry,ref=kenyaniyetu/api:latest
          cache-to: type=inline

  deploy:
    needs: build
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to production
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/kenya-ni-yetu
            docker-compose pull
            docker-compose up -d --no-deps --build api
            docker-compose exec -T api alembic upgrade head
            docker system prune -f
      
      - name: Health check
        run: |
          sleep 30
          curl -f https://api.kenyaniyetu.org/health || exit 1
      
      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Phase 2 deployment completed!'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()
```

### 12.5 Monitoring & Logging

```python
# app/core/monitoring.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.celery import CeleryIntegration
from prometheus_client import Counter, Histogram, generate_latest
import logging

# Setup Sentry
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[
            FastApiIntegration(),
            CeleryIntegration()
        ],
        environment=settings.APP_ENV,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
    )

# Prometheus metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_DURATION = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint']
)

SCORING_DURATION = Histogram(
    'scoring_calculation_duration_seconds',
    'Transparency score calculation duration'
)

# Logging configuration
logging.config.dictConfig({
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'default': {
            'format': '[%(asctime)s] %(levelname)s in %(module)s: %(message)s',
        },
        'json': {
            '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(name)s %(levelname)s %(message)s'
        }
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'default',
            'stream': 'ext://sys.stdout'
        },
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'formatter': 'json',
            'filename': 'logs/app.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 10
        }
    },
    'root': {
        'level': 'INFO',
        'handlers': ['console', 'file']
    }
})

# Middleware for metrics
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    REQUEST_DURATION.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)
    
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    return response

# Metrics endpoint
@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type="text/plain")
```

### 12.6 Database Backup Strategy

```bash
#!/bin/bash
# scripts/backup_database.sh

# Configuration
DB_NAME="kenya_ni_yetu"
DB_USER="postgres"
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz"
S3_BUCKET="s3://kenya-ni-yetu-backups"

# Create backup directory
mkdir -p $BACKUP_DIR

# Perform backup
echo "Starting database backup..."
pg_dump -U $DB_USER -Fc $DB_NAME | gzip > $BACKUP_FILE

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Backup created successfully: $BACKUP_FILE"
    
    # Upload to S3
    aws s3 cp $BACKUP_FILE $S3_BUCKET/
    
    # Remove old local backups (keep last 7 days)
    find $BACKUP_DIR -name "${DB_NAME}_*.sql.gz" -mtime +7 -delete
    
    # Remove old S3 backups (keep last 30 days)
    aws s3 ls $S3_BUCKET/ | while read -r line; do
        createDate=$(echo $line | awk {'print $1" "$2'})
        createDate=$(date -d "$createDate" +%s)
        olderThan=$(date --date "30 days ago" +%s)
        if [[ $createDate -lt $olderThan ]]; then
            fileName=$(echo $line | awk {'print $4'})
            aws s3 rm $S3_BUCKET/$fileName
        fi
    done
    
    echo "Backup completed and uploaded to S3"
else
    echo "Backup failed!"
    exit 1
fi
```

### 12.7 Health Check Endpoint

```python
# app/api/v1/health.py
from fastapi import APIRouter, Depends
from sqlalchemy import text

router = APIRouter(tags=["health"])

@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Comprehensive health check"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {}
    }
    
    # Database check
    try:
        db.execute(text("SELECT 1"))
        health_status["checks"]["database"] = "healthy"
    except Exception as e:
        health_status["checks"]["database"] = f"unhealthy: {str(e)}"
        health_status["status"] = "unhealthy"
    
    # Redis check
    try:
        cache_manager.redis_client.ping()
        health_status["checks"]["redis"] = "healthy"
    except Exception as e:
        health_status["checks"]["redis"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"
    
    # Celery check
    try:
        from app.tasks.celery_app import app as celery_app
        inspect = celery_app.control.inspect()
        stats = inspect.stats()
        if stats:
            health_status["checks"]["celery"] = "healthy"
        else:
            health_status["checks"]["celery"] = "no workers"
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["checks"]["celery"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"
    
    status_code = 200 if health_status["status"] == "healthy" else 503
    return JSONResponse(content=health_status, status_code=status_code)
```

---

## 13. Documentation

### 13.1 API Documentation

```python
# app/main.py - Enhanced API docs
app = FastAPI(
    title="Kenya ni Yetu API",
    description="""
    ## Political Transparency Platform API
    
    This API provides access to Kenya's political transparency data including:
    
    * **Politicians**: Comprehensive profiles with transparency scores
    * **Legal Cases**: Court cases and legal proceedings
    * **Promises**: Campaign promises and their fulfillment
    * **Reports**: Community-submitted flagged reports
    * **Analytics**: Statistical insights and trends
    * **Real-time**: WebSocket connections for live updates
    
    ## Authentication
    
    Most endpoints require authentication using JWT tokens:
    
    1. Register or login to get an access token
    2. Include in requests: `Authorization: Bearer <token>`
    3. Tokens expire after 30 minutes
    4. Use refresh token to get new access token
    
    ## Rate Limiting
    
    - Anonymous: 100 requests/minute
    - Authenticated: 500 requests/minute  
    - Admin: 1000 requests/minute
    
    ## Webhooks
    
    Subscribe to events via webhooks for real-time notifications.
    """,
    version="2.0.0",
    contact={
        "name": "Kenya ni Yetu Team",
        "email": "api@kenyaniyetu.org",
        "url": "https://kenyaniyetu.org"
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT"
    },
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {"name": "auth", "description": "Authentication endpoints"},
        {"name": "politicians", "description": "Politician data and profiles"},
        {"name": "reports", "description": "Flagged reports and submissions"},
        {"name": "search", "description": "Search and filtering"},
        {"name": "analytics", "description": "Statistics and insights"},
        {"name": "notifications", "description": "User notifications"},
        {"name": "admin", "description": "Administrative functions"},
    ]
)
```

### 13.2 Developer Portal

Create comprehensive documentation at `docs/`:

- **Getting Started Guide**
- **Authentication Tutorial**
- **API Reference**
- **Webhook Guide**
- **Code Examples** (Python, JavaScript, etc.)
- **Best Practices**
- **Changelog**

---

## Phase 2 Success Metrics

### Technical Metrics
- [ ] API response time < 200ms (p95)
- [ ] Database query time < 100ms (p95)
- [ ] WebSocket latency < 50ms
- [ ] 99.9% uptime
- [ ] Cache hit ratio > 80%
- [ ] Test coverage > 85%

### Feature Metrics
- [ ] 1000+ news articles scraped daily
- [ ] 90%+ sentiment analysis accuracy
- [ ] Real-time updates delivered < 1 second
- [ ] 10,000+ active users
- [ ] 5,000+ verified data points
- [ ] 100+ webhooks configured
- [ ] 50+ API integrations

### User Engagement Metrics
- [ ] Average session duration > 5 minutes
- [ ] User retention rate > 60%
- [ ] Community verification participation > 30%
- [ ] Report submission rate increased by 200%
- [ ] Comment engagement > 1000 per day

---

## Quick Reference

### Environment Variables (Phase 2 Additions)

```bash
# AI/ML
OPENAI_API_KEY=your-openai-key
HUGGINGFACE_API_KEY=your-hf-key  # Optional alternative
EMBEDDING_MODEL=text-embedding-3-small

# Notification Services
SENDGRID_API_KEY=your-sendgrid-key
AFRICAS_TALKING_API_KEY=your-at-key  # For SMS
AFRICAS_TALKING_USERNAME=your-username

# Security
ENCRYPTION_KEY=your-32-byte-encryption-key
JWT_REFRESH_SECRET=your-refresh-secret
TOTP_ISSUER=Kenya ni Yetu

# Monitoring
SENTRY_DSN=your-sentry-dsn
PROMETHEUS_PORT=9090

# External Services
NEWS_API_KEY=your-news-api-key  # Optional
```

### Key Commands

```bash
# Start Phase 2 services
docker-compose -f docker-compose.prod.yml up -d

# Generate embeddings for existing data
python scripts/generate_embeddings.py

# Train ML scoring model
python scripts/train_scoring_model.py

# Run security audit
python scripts/security_audit.py

# Generate API documentation
python scripts/generate_api_docs.py

# Database maintenance
python scripts/vacuum_analyze.py

# Performance monitoring
docker-compose logs -f --tail=100 api

# Check system health
curl https://api.kenyaniyetu.org/health
```

### Common Troubleshooting

**WebSocket connections failing:**
```bash
# Check nginx configuration
nginx -t
# Verify WebSocket proxy settings
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8000/ws/alerts
```

**Celery workers not processing:**
```bash
# Check worker status
celery -A app.tasks.celery_app inspect active
# Restart workers
docker-compose restart celery_worker
```

**Cache not working:**
```bash
# Test Redis connection
redis-cli ping
# Clear cache
redis-cli FLUSHALL
```

**Database slow queries:**
```bash
# Check slow queries
psql -d kenya_ni_yetu -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
# Run VACUUM ANALYZE
python scripts/vacuum_analyze.py
```

---

## Phase 2 Deliverables Checklist

### Core Features
- [x] Automated news scraping system
- [x] AI sentiment analysis
- [x] Semantic search with embeddings
- [x] Real-time WebSocket notifications
- [x] Advanced notification system
- [x] Source verification system
- [x] Audit trail and version control
- [x] Comprehensive analytics dashboard
- [x] Performance optimization (caching, indexes)
- [x] Two-factor authentication
- [x] API key management
- [x] Comment system
- [x] User reputation system
- [x] GraphQL API
- [x] Webhook system
- [x] Enhanced admin tools

### Infrastructure
- [x] Production Docker setup
- [x] CI/CD pipeline
- [x] Monitoring and logging
- [x] Database backup strategy
- [x] Health check system
- [x] Load balancing
- [x] SSL/TLS configuration
- [x] Rate limiting

### Documentation
- [x] API documentation
- [x] Developer guide
- [x] Deployment guide
- [x] Testing documentation
- [x] Security guidelines
- [x] Troubleshooting guide

---

## Support & Resources

### Documentation
- **API Docs**: https://docs.kenyaniyetu.org
- **Developer Portal**: https://developers.kenyaniyetu.org
- **GitHub**: https://github.com/kenyaniyetu/backend

### Community
- **Slack**: kenya-ni-yetu.slack.com
- **Email**: developers@kenyaniyetu.org
- **Issues**: https://github.com/kenyaniyetu/backend/issues

### Team Contacts
- **Technical Lead**: tech@kenyaniyetu.org
- **DevOps**: devops@kenyaniyetu.org
- **Security**: security@kenyaniyetu.org

---

## Next Steps: Phase 3 Preview

Phase 3 (Future) will focus on:

- **Mobile Apps**: Native iOS and Android applications
- **Advanced AI**: Predictive analytics and trend forecasting
- **Blockchain**: Immutable audit trail using blockchain
- **Public API Marketplace**: Monetized API access tiers
- **Multi-language Support**: Swahili, Kikuyu, and other local languages
- **Advanced Visualizations**: Interactive data visualization tools
- **Crowdsourcing Platform**: Expanded community contributions
- **Third-party Integrations**: Integration with government systems

---

## License

MIT License - See LICENSE file for details

---

## Acknowledgments

Built with:
- FastAPI
- PostgreSQL with pgvector
- Redis
- Celery
- OpenAI
- React (frontend)
- And many other open-source tools

Special thanks to the Kenyan tech community and all contributors working towards government transparency.

---

**Last Updated**: October 2025  
**Version**: 2.0.0  
**Status**: Production Ready

For questions or support, contact: developers@kenyaniyetu.org# Phase 2 Development Guide - Kenya ni Yetu

## Overview

This document outlines Phase 2 development for the Kenya ni Yetu Political Transparency Platform. Phase 2 builds upon the foundation established in Phase 1, focusing on advanced features, scalability, AI/ML enhancements, and real-time capabilities.

**Timeline:** 12-16 weeks
**Prerequisites:** Phase 1 completion, production deployment, initial user feedback

---

## Table of Contents

1. [AI/ML Enhancements](#1-aiml-enhancements)
2. [Real-time Features](#2-real-time-features)
3. [Data Integrity & Verification](#3-data-integrity--verification)
4. [Advanced Analytics](#4-advanced-analytics)
5. [Scale & Performance](#5-scale--performance)
6. [Enhanced Security](#6-enhanced-security)
7. [Community Features](#7-community-features)
8. [Integration & APIs](#8-integration--apis)
9. [Admin & Moderation Tools](#9-admin--moderation-tools)
10. [Implementation Timeline](#10-implementation-timeline)
11. [Testing Strategy](#11-testing-strategy)
12. [Deployment Strategy](#12-deployment-strategy)

---

## 1. AI/ML Enhancements

### 1.1 Automated News Scraping & Analysis

#### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Scrapers   │────▶│  Processing  │────▶│   Storage    │
│   (Celery)   │     │   Pipeline   │     │  (Postgres)  │
└──────────────┘     └──────────────┘     └──────────────┘
       │                     │                     │
       │                     ▼                     │
       │             ┌──────────────┐              │
       └────────────▶│  AI Analysis │◀─────────────┘
                     │  (OpenAI/HF) │
                     └──────────────┘
```

#### Implementation

**New Models:**

```python
# app/models/news_source.py
class NewsSource(Base):
    __tablename__ = "news_sources"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    base_url = Column(String(500), nullable=False)
    scraper_type = Column(String(50), nullable=False)  # rss, html, api
    scraper_config = Column(JSONB)  # CSS selectors, API params
    is_active = Column(Boolean, default=True)
    reliability_score = Column(Numeric(3, 2))  # 0-1
    last_scraped_at = Column(DateTime)
    scrape_frequency = Column(Integer, default=3600)  # seconds
    created_at = Column(DateTime, default=func.now())

# app/models/scraping_job.py
class ScrapingJob(Base):
    __tablename__ = "scraping_jobs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id = Column(UUID(as_uuid=True), ForeignKey("news_sources.id"))
    status = Column(String(50), nullable=False)  # pending, running, completed, failed
    articles_found = Column(Integer, default=0)
    articles_processed = Column(Integer, default=0)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    error_message = Column(Text)
    metadata = Column(JSONB)
```

**Scraper Service:**

```python
# app/services/scraper_service.py
from bs4 import BeautifulSoup
import feedparser
import httpx
from typing import List, Dict
import re

class NewsScraperService:
    def __init__(self, db: Session):
        self.db = db
        self.http_client = httpx.AsyncClient(timeout=30.0)
    
    async def scrape_source(self, source: NewsSource) -> List[Dict]:
        """Scrape articles from a news source"""
        if source.scraper_type == "rss":
            return await self._scrape_rss(source)
        elif source.scraper_type == "html":
            return await self._scrape_html(source)
        elif source.scraper_type == "api":
            return await self._scrape_api(source)
    
    async def _scrape_rss(self, source: NewsSource) -> List[Dict]:
        """Scrape RSS feed"""
        response = await self.http_client.get(source.base_url)
        feed = feedparser.parse(response.text)
        
        articles = []
        for entry in feed.entries:
            article = {
                "title": entry.title,
                "url": entry.link,
                "published_at": entry.published_parsed,
                "content": self._clean_html(entry.get("summary", "")),
                "source_name": source.name
            }
            articles.append(article)
        
        return articles
    
    async def _scrape_html(self, source: NewsSource) -> List[Dict]:
        """Scrape HTML page"""
        config = source.scraper_config
        response = await self.http_client.get(source.base_url)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        articles = []
        article_elements = soup.select(config.get("article_selector", "article"))
        
        for element in article_elements:
            try:
                title_el = element.select_one(config.get("title_selector"))
                link_el = element.select_one(config.get("link_selector"))
                date_el = element.select_one(config.get("date_selector"))
                
                if title_el and link_el:
                    article = {
                        "title": title_el.text.strip(),
                        "url": self._make_absolute_url(link_el.get("href"), source.base_url),
                        "published_at": self._parse_date(date_el.text if date_el else None),
                        "source_name": source.name
                    }
                    articles.append(article)
            except Exception as e:
                continue
        
        return articles
    
    def _clean_html(self, html: str) -> str:
        """Remove HTML tags and clean text"""
        soup = BeautifulSoup(html, 'html.parser')
        return soup.get_text(strip=True)
    
    def _make_absolute_url(self, url: str, base_url: str) -> str:
        """Convert relative URL to absolute"""
        if url.startswith("http"):
            return url
        return urljoin(base_url, url)

# app/services/sentiment_service.py
from transformers import pipeline
import openai

class SentimentAnalysisService:
    def __init__(self):
        # Option 1: Using Hugging Face (free, local)
        self.analyzer = pipeline(
            "sentiment-analysis",
            model="nlptown/bert-base-multilingual-uncased-sentiment"
        )
        
        # Option 2: Using OpenAI (paid, more accurate)
        self.openai_client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
    
    def analyze_sentiment(self, text: str, method: str = "huggingface") -> float:
        """Analyze sentiment of text. Returns score from -1 (negative) to 1 (positive)"""
        if method == "huggingface":
            return self._analyze_huggingface(text)
        elif method == "openai":
            return self._analyze_openai(text)
    
    def _analyze_huggingface(self, text: str) -> float:
        """Use Hugging Face for sentiment analysis"""
        result = self.analyzer(text[:512])[0]  # Limit to 512 tokens
        
        # Convert 5-star rating to -1 to 1 scale
        stars = int(result['label'].split()[0])
        sentiment = (stars - 3) / 2  # Convert 1-5 to -1 to 1
        
        return sentiment
    
    def _analyze_openai(self, text: str) -> float:
        """Use OpenAI for sentiment analysis"""
        prompt = f"""Analyze the sentiment of this news article excerpt about a politician.
        Return only a number from -1 (very negative) to 1 (very positive).
        
        Text: {text[:2000]}
        
        Sentiment score:"""
        
        response = self.openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=10
        )
        
        try:
            score = float(response.choices[0].message.content.strip())
            return max(-1, min(1, score))  # Clamp between -1 and 1
        except:
            return 0.0  # Neutral if parsing fails

# app/services/entity_linking_service.py
class EntityLinkingService:
    def __init__(self, db: Session):
        self.db = db
    
    def extract_and_link_politicians(self, text: str, article_id: UUID) -> List[UUID]:
        """Extract politician names and link to database records"""
        # Get all politician names
        politicians = self.db.query(Politician).all()
        politician_names = {p.name.lower(): p.id for p in politicians}
        
        # Find mentions in text
        linked_politicians = []
        text_lower = text.lower()
        
        for name, politician_id in politician_names.items():
            if name in text_lower:
                linked_politicians.append(politician_id)
        
        return linked_politicians
    
    def calculate_relevance(self, text: str, politician_name: str) -> float:
        """Calculate how relevant the article is to the politician"""
        text_lower = text.lower()
        name_lower = politician_name.lower()
        
        # Count mentions
        mention_count = text_lower.count(name_lower)
        
        # Check if in title or first paragraph (higher weight)
        first_200_chars = text_lower[:200]
        in_opening = name_lower in first_200_chars
        
        # Calculate relevance score
        relevance = min(1.0, (mention_count * 0.2) + (0.3 if in_opening else 0))
        
        return relevance
```

**Celery Tasks:**

```python
# app/tasks/scraping_tasks.py
from celery import shared_task
from app.services.scraper_service import NewsScraperService
from app.services.sentiment_service import SentimentAnalysisService
from app.services.entity_linking_service import EntityLinkingService

@shared_task(bind=True, max_retries=3)
def scrape_news_source(self, source_id: str):
    """Scrape a single news source"""
    db = SessionLocal()
    try:
        source = db.query(NewsSource).filter(NewsSource.id == source_id).first()
        if not source or not source.is_active:
            return
        
        # Create scraping job
        job = ScrapingJob(
            source_id=source_id,
            status="running",
            started_at=datetime.utcnow()
        )
        db.add(job)
        db.commit()
        
        # Scrape articles
        scraper = NewsScraperService(db)
        articles = await scraper.scrape_source(source)
        
        job.articles_found = len(articles)
        
        # Process each article
        sentiment_service = SentimentAnalysisService()
        entity_service = EntityLinkingService(db)
        
        for article_data in articles:
            # Check if article already exists
            existing = db.query(NewsMention).filter(
                NewsMention.url == article_data["url"]
            ).first()
            
            if existing:
                continue
            
            # Analyze sentiment
            sentiment = sentiment_service.analyze_sentiment(article_data["content"])
            
            # Link to politicians
            politician_ids = entity_service.extract_and_link_politicians(
                article_data["title"] + " " + article_data["content"],
                None
            )
            
            # Create news mentions for each politician
            for politician_id in politician_ids:
                relevance = entity_service.calculate_relevance(
                    article_data["content"],
                    db.query(Politician).get(politician_id).name
                )
                
                news_mention = NewsMention(
                    politician_id=politician_id,
                    title=article_data["title"],
                    source=article_data["source_name"],
                    url=article_data["url"],
                    content_summary=article_data["content"][:500],
                    sentiment=sentiment,
                    published_at=article_data["published_at"],
                    relevance_score=relevance
                )
                db.add(news_mention)
                job.articles_processed += 1
        
        # Complete job
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        db.commit()
        
        # Update source last scraped time
        source.last_scraped_at = datetime.utcnow()
        db.commit()
        
    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = datetime.utcnow()
        db.commit()
        raise self.retry(exc=e, countdown=300)  # Retry after 5 minutes
    finally:
        db.close()

@shared_task
def schedule_all_scrapers():
    """Schedule scraping for all active news sources"""
    db = SessionLocal()
    try:
        sources = db.query(NewsSource).filter(NewsSource.is_active == True).all()
        
        for source in sources:
            # Check if enough time has passed since last scrape
            if source.last_scraped_at:
                time_since_last = (datetime.utcnow() - source.last_scraped_at).total_seconds()
                if time_since_last < source.scrape_frequency:
                    continue
            
            # Schedule scraping task
            scrape_news_source.delay(str(source.id))
    finally:
        db.close()
```

**Celery Beat Schedule:**

```python
# app/tasks/celery_app.py
from celery.schedules import crontab

app.conf.beat_schedule = {
    'scrape-news-every-hour': {
        'task': 'app.tasks.scraping_tasks.schedule_all_scrapers',
        'schedule': crontab(minute=0),  # Every hour
    },
    'recalculate-scores-daily': {
        'task': 'app.tasks.scoring_tasks.recalculate_all_scores',
        'schedule': crontab(hour=2, minute=0),  # 2 AM daily
    },
}
```

**API Endpoints:**

```python
# app/api/v1/news.py
from fastapi import APIRouter, Depends
from app.services.scraper_service import NewsScraperService

router = APIRouter(prefix="/news", tags=["news"])

@router.post("/sources", status_code=201)
async def create_news_source(
    source: NewsSourceCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new news source (Admin only)"""
    db_source = NewsSource(**source.dict())
    db.add(db_source)
    db.commit()
    return db_source

@router.post("/sources/{source_id}/scrape")
async def trigger_scrape(
    source_id: UUID,
    current_user: User = Depends(get_current_admin_user)
):
    """Manually trigger scraping for a source"""
    scrape_news_source.delay(str(source_id))
    return {"message": "Scraping job scheduled"}

@router.get("/sources/{source_id}/jobs")
async def get_scraping_jobs(
    source_id: UUID,
    db: Session = Depends(get_db)
):
    """Get scraping job history for a source"""
    jobs = db.query(ScrapingJob).filter(
        ScrapingJob.source_id == source_id
    ).order_by(ScrapingJob.started_at.desc()).limit(20).all()
    return jobs
```

### 1.2 Enhanced Scoring System

#### Machine Learning Score Predictor

```python
# app/services/ml_scoring_service.py
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
import joblib
import numpy as np

class MLScoringService:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.model_path = "models/transparency_predictor.pkl"
        self.scaler_path = "models/scaler.pkl"
        
        # Load pre-trained model if exists
        try:
            self.model = joblib.load(self.model_path)
            self.scaler = joblib.load(self.scaler_path)
        except:
            pass
    
    def extract_features(self, politician: Politician, db: Session) -> np.ndarray:
        """Extract features for ML model"""
        # Legal cases features
        cases = db.query(LegalCase).filter(
            LegalCase.politician_id == politician.id
        ).all()
        
        total_cases = len(cases)
        ongoing_cases = len([c for c in cases if c.status == "ongoing"])
        resolved_guilty = len([c for c in cases if c.status == "resolved" and "guilty" in (c.outcome or "").lower()])
        
        # Promise features
        promises = db.query(Promise).filter(
            Promise.politician_id == politician.id
        ).all()
        
        total_promises = len(promises)
        fulfilled_promises = len([p for p in promises if p.status == "fulfilled"])
        broken_promises = len([p for p in promises if p.status == "broken"])
        fulfillment_rate = fulfilled_promises / total_promises if total_promises > 0 else 0
        
        # News sentiment features
        recent_news = db.query(NewsMention).filter(
            NewsMention.politician_id == politician.id,
            NewsMention.published_at >= datetime.utcnow() - timedelta(days=90)
        ).all()
        
        avg_sentiment = np.mean([n.sentiment for n in recent_news]) if recent_news else 0
        sentiment_variance = np.var([n.sentiment for n in recent_news]) if recent_news else 0
        news_volume = len(recent_news)
        
        # Report features
        reports = db.query(FlaggedReport).filter(
            FlaggedReport.politician_id == politician.id
        ).all()
        
        total_reports = len(reports)
        verified_reports = len([r for r in reports if r.status == "verified"])
        
        # Time in office (if available)
        days_in_office = (datetime.utcnow() - politician.created_at).days
        
        # Compile feature vector
        features = np.array([
            total_cases,
            ongoing_cases,
            resolved_guilty,
            total_promises,
            fulfilled_promises,
            broken_promises,
            fulfillment_rate,
            avg_sentiment,
            sentiment_variance,
            news_volume,
            total_reports,
            verified_reports,
            days_in_office
        ])
        
        return features.reshape(1, -1)
    
    def predict_score(self, politician: Politician, db: Session) -> Dict:
        """Predict transparency score using ML model"""
        if self.model is None:
            return None
        
        features = self.extract_features(politician, db)
        features_scaled = self.scaler.transform(features)
        
        predicted_score = self.model.predict(features_scaled)[0]
        
        # Get feature importance
        feature_names = [
            "total_cases", "ongoing_cases", "resolved_guilty",
            "total_promises", "fulfilled_promises", "broken_promises",
            "fulfillment_rate", "avg_sentiment", "sentiment_variance",
            "news_volume", "total_reports", "verified_reports", "days_in_office"
        ]
        
        importances = dict(zip(feature_names, self.model.feature_importances_))
        
        return {
            "predicted_score": float(predicted_score),
            "feature_importances": importances,
            "confidence": self._calculate_confidence(features_scaled)
        }
    
    def _calculate_confidence(self, features: np.ndarray) -> float:
        """Calculate confidence in prediction"""
        # Use ensemble predictions to estimate confidence
        if hasattr(self.model, 'estimators_'):
            predictions = [tree.predict(features)[0] for tree in self.model.estimators_]
            variance = np.var(predictions)
            # Lower variance = higher confidence
            confidence = max(0, min(100, 100 - (variance * 10)))
            return confidence
        return 75.0  # Default confidence
    
    def train_model(self, db: Session):
        """Train ML model on historical data"""
        # Get all politicians with score history
        politicians = db.query(Politician).filter(
            Politician.transparency_score.isnot(None)
        ).all()
        
        X = []
        y = []
        
        for politician in politicians:
            features = self.extract_features(politician, db)
            X.append(features[0])
            y.append(politician.transparency_score)
        
        X = np.array(X)
        y = np.array(y)
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Train model
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        self.model.fit(X_scaled, y)
        
        # Save model
        joblib.dump(self.model, self.model_path)
        joblib.dump(self.scaler, self.scaler_path)
        
        return {
            "samples": len(X),
            "r2_score": self.model.score(X_scaled, y)
        }
```

#### Score Trend Analysis

```python
# app/services/trend_analysis_service.py
from scipy import stats
import pandas as pd

class TrendAnalysisService:
    def __init__(self, db: Session):
        self.db = db
    
    def analyze_score_trend(self, politician_id: UUID, days: int = 90) -> Dict:
        """Analyze transparency score trend over time"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        history = self.db.query(ScoreHistory).filter(
            ScoreHistory.politician_id == politician_id,
            ScoreHistory.calculated_at >= cutoff_date
        ).order_by(ScoreHistory.calculated_at).all()
        
        if len(history) < 2:
            return {"trend": "insufficient_data"}
        
        # Convert to pandas for analysis
        df = pd.DataFrame([
            {"date": h.calculated_at, "score": float(h.transparency_score)}
            for h in history
        ])
        
        # Calculate trend
        x = np.arange(len(df))
        y = df["score"].values
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
        
        # Determine trend direction
        if p_value < 0.05:  # Statistically significant
            if slope > 0.5:
                trend = "improving"
            elif slope < -0.5:
                trend = "declining"
            else:
                trend = "stable"
        else:
            trend = "stable"
        
        # Calculate volatility
        volatility = df["score"].std()
        
        # Detect anomalies
        anomalies = self._detect_anomalies(df)
        
        return {
            "trend": trend,
            "slope": float(slope),
            "r_squared": float(r_value ** 2),
            "volatility": float(volatility),
            "current_score": float(y[-1]),
            "score_change": float(y[-1] - y[0]),
            "anomalies": anomalies,
            "data_points": len(history)
        }
    
    def _detect_anomalies(self, df: pd.DataFrame) -> List[Dict]:
        """Detect anomalous score changes"""
        # Use Z-score method
        z_scores = np.abs(stats.zscore(df["score"]))
        anomalies = []
        
        for idx, z in enumerate(z_scores):
            if z > 2.5:  # Threshold for anomaly
                anomalies.append({
                    "date": df.iloc[idx]["date"].isoformat(),
                    "score": float(df.iloc[idx]["score"]),
                    "z_score": float(z)
                })
        
        return anomalies
    
    def compare_politicians(self, politician_ids: List[UUID]) -> Dict:
        """Compare transparency scores of multiple politicians"""
        comparison = []
        
        for politician_id in politician_ids:
            politician = self.db.query(Politician).get(politician_id)
            if not politician:
                continue
            
            trend = self.analyze_score_trend(politician_id)
            
            comparison.append({
                "politician_id": str(politician_id),
                "name": politician.name,
                "current_score": politician.transparency_score,
                "trend": trend["trend"],
                "score_change_90d": trend.get("score_change", 0)
            })
        
        return {
            "comparison": comparison,
            "average_score": np.mean([p["current_score"] for p in comparison if p["current_score"]]),
            "best_performer": max(comparison, key=lambda x: x["current_score"]) if comparison else None,
            "most_improved": max(comparison, key=lambda x: x.get("score_change_90d", 0)) if comparison else None
        }
```

### 1.3 Semantic Search with pgvector

#### Database Setup

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns
ALTER TABLE politicians ADD COLUMN embedding vector(1536);
ALTER TABLE news_mentions ADD COLUMN embedding vector(1536);
ALTER TABLE promises ADD COLUMN embedding vector(1536);

-- Create vector indexes for faster similarity search
CREATE INDEX idx_politicians_embedding ON politicians USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_news_embedding ON news_mentions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

#### Embedding Service

```python
# app/services/embedding_service.py
import openai
from typing import List

class EmbeddingService:
    def __init__(self):
        self.client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = "text-embedding-3-small"  # 1536 dimensions
    
    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for text"""
        response = self.client.embeddings.create(
            input=text,
            model=self.model
        )
        return response.data[0].embedding
    
    def generate_politician_embedding(self, politician: Politician) -> List[float]:
        """Generate comprehensive embedding for politician"""
        # Combine multiple fields for richer representation
        text_parts = [
            f"Name: {politician.name}",
            f"Position: {politician.position}",
            f"Party: {politician.party}" if politician.party else "",
            f"County: {politician.county}" if politician.county else "",
            f"Bio: {politician.bio}" if politician.bio else ""
        ]
        
        combined_text = " ".join([p for p in text_parts if p])
        return self.generate_embedding(combined_text)
    
    def batch_generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        # OpenAI allows batch processing up to 2048 texts
        batch_size = 2048
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            response = self.client.embeddings.create(
                input=batch,
                model=self.model
            )
            embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(embeddings)
        
        return all_embeddings

# app/services/semantic_search_service.py
class SemanticSearchService:
    def __init__(self, db: Session):
        self.db = db
        self.embedding_service = EmbeddingService()
    
    def search_politicians(self, query: str, limit: int = 10) -> List[Dict]:
        """Semantic search for politicians"""
        # Generate query embedding
        query_embedding = self.embedding_service.generate_embedding(query)
        
        # Perform vector similarity search
        results = self.db.execute(text("""
            SELECT 
                id, 
                name, 
                position, 
                party, 
                county, 
                transparency_score,
                1 - (embedding <=> :query_embedding) as similarity
            FROM politicians
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> :query_embedding
            LIMIT :limit
        """), {
            "query_embedding": str(query_embedding),
            "limit": limit
        }).fetchall()
        
        return [
            {
                "id": str(row.id),
                "name": row.name,
                "position": row.position,
                "party": row.party,
                "county": row.county,
                "transparency_score": float(row.transparency_score),
                "similarity": float(row.similarity),
                "reason": self._explain_similarity(politician, row)
            }
            for row in results
        ]
    
    def _explain_similarity(self, politician1: Politician, politician2_row) -> str:
        """Explain why two politicians are similar"""
        reasons = []
        
        if politician1.party == politician2_row.party:
            reasons.append(f"Same party ({politician1.party})")
        
        if politician1.county == politician2_row.county:
            reasons.append(f"Same county ({politician1.county})")
        
        score_diff = abs(politician1.transparency_score - politician2_row.transparency_score)
        if score_diff < 10:
            reasons.append("Similar transparency scores")
        
        return ", ".join(reasons) if reasons else "Similar profile"
    
    def search_news(self, query: str, politician_id: UUID = None, limit: int = 20) -> List[Dict]:
        """Semantic search for news mentions"""
        query_embedding = self.embedding_service.generate_embedding(query)
        
        sql = """
            SELECT 
                n.id,
                n.politician_id,
                n.title,
                n.source,
                n.url,
                n.content_summary,
                n.sentiment,
                n.published_at,
                p.name as politician_name,
                1 - (n.embedding <=> :query_embedding) as similarity
            FROM news_mentions n
            JOIN politicians p ON n.politician_id = p.id
            WHERE n.embedding IS NOT NULL
        """
        
        params = {"query_embedding": str(query_embedding), "limit": limit}
        
        if politician_id:
            sql += " AND n.politician_id = :politician_id"
            params["politician_id"] = politician_id
        
        sql += " ORDER BY n.embedding <=> :query_embedding LIMIT :limit"
        
        results = self.db.execute(text(sql), params).fetchall()
        
        return [
            {
                "id": str(row.id),
                "politician_id": str(row.politician_id),
                "politician_name": row.politician_name,
                "title": row.title,
                "source": row.source,
                "url": row.url,
                "content_summary": row.content_summary,
                "sentiment": float(row.sentiment),
                "published_at": row.published_at.isoformat(),
                "similarity": float(row.similarity)
            }
            for row in results
        ]

# Celery task to generate embeddings
@shared_task
def generate_all_embeddings():
    """Generate embeddings for all politicians and news"""
    db = SessionLocal()
    embedding_service = EmbeddingService()
    
    try:
        # Generate politician embeddings
        politicians = db.query(Politician).filter(
            Politician.embedding.is_(None)
        ).all()
        
        for politician in politicians:
            embedding = embedding_service.generate_politician_embedding(politician)
            politician.embedding = embedding
            db.commit()
        
        # Generate news embeddings
        news = db.query(NewsMention).filter(
            NewsMention.embedding.is_(None)
        ).limit(1000).all()  # Process in batches
        
        texts = [f"{n.title} {n.content_summary}" for n in news]
        embeddings = embedding_service.batch_generate_embeddings(texts)
        
        for i, news_item in enumerate(news):
            news_item.embedding = embeddings[i]
        
        db.commit()
        
    finally:
        db.close()
```

**API Endpoints:**

```python
# app/api/v1/search.py (Enhanced)
@router.get("/semantic")
async def semantic_search(
    q: str = Query(..., min_length=3),
    type: str = Query("all", regex="^(all|politicians|news)$"),
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db)
):
    """Semantic search across platform"""
    search_service = SemanticSearchService(db)
    
    results = {}
    
    if type in ["all", "politicians"]:
        results["politicians"] = search_service.search_politicians(q, limit)
    
    if type in ["all", "news"]:
        results["news"] = search_service.search_news(q, limit=limit)
    
    return results

@router.get("/politicians/{politician_id}/similar")
async def get_similar_politicians(
    politician_id: UUID,
    limit: int = Query(5, le=20),
    db: Session = Depends(get_db)
):
    """Find politicians similar to the given one"""
    search_service = SemanticSearchService(db)
    return search_service.find_similar_politicians(politician_id, limit)
```

---

## 2. Real-time Features

### 2.1 WebSocket Integration

#### Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Client    │◀───────▶│  FastAPI    │◀───────▶│    Redis    │
│  (Browser)  │ WebSocket│  WebSocket  │  PubSub │   Channel   │
└─────────────┘         └─────────────┘         └─────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │   Celery    │
                        │   Workers   │
                        └─────────────┘
```

#### Implementation

```python
# app/websocket/connection_manager.py
from fastapi import WebSocket
from typing import Dict, List, Set
import json
import redis.asyncio as redis

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.user_connections: Dict[str, WebSocket] = {}
        self.redis_client = None
    
    async def connect(self, websocket: WebSocket, user_id: str = None, channel: str = "general"):
        """Connect a WebSocket client"""
        await websocket.accept()
        
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        
        self.active_connections[channel].add(websocket)
        
        if user_id:
            self.user_connections[user_id] = websocket
        
        # Subscribe to Redis channel
        if not self.redis_client:
            self.redis_client = await redis.from_url(settings.REDIS_URL)
    
    def disconnect(self, websocket: WebSocket, channel: str = "general"):
        """Disconnect a WebSocket client"""
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)
        
        # Remove from user connections
        for user_id, ws in list(self.user_connections.items()):
            if ws == websocket:
                del self.user_connections[user_id]
    
    async def send_personal_message(self, message: dict, user_id: str):
        """Send message to specific user"""
        if user_id in self.user_connections:
            websocket = self.user_connections[user_id]
            await websocket.send_json(message)
    
    async def broadcast_to_channel(self, message: dict, channel: str = "general"):
        """Broadcast message to all connections in a channel"""
        if channel in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[channel]:
                try:
                    await connection.send_json(message)
                except:
                    disconnected.add(connection)
            
            # Clean up disconnected clients
            for connection in disconnected:
                self.disconnect(connection, channel)
    
    async def publish_to_redis(self, channel: str, message: dict):
        """Publish message to Redis for cross-server broadcasting"""
        if self.redis_client:
            await self.redis_client.publish(
                channel,
                json.dumps(message)
            )

manager = ConnectionManager()

# app/websocket/handlers.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from app.core.security import get_current_user_ws

ws_router = APIRouter()

@ws_router.websocket("/ws/alerts")
async def websocket_alerts(
    websocket: WebSocket,
    token: str = None
):
    """WebSocket endpoint for real-time alerts"""
    # Optional authentication
    user = None
    if token:
        try:
            user = await get_current_user_ws(token)
        except:
            await websocket.close(code=1008)  # Policy violation
            return
    
    await manager.connect(websocket, user.id if user else None, "alerts")
    
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            
            # Handle ping/pong for keep-alive
            if data == "ping":
                await websocket.send_text("pong")
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, "alerts")

@ws_router.websocket("/ws/politician/{politician_id}")
async def websocket_politician(
    websocket: WebSocket,
    politician_id: UUID
):
    """WebSocket for real-time updates on a specific politician"""
    channel = f"politician:{politician_id}"
    await manager.connect(websocket, channel=channel)
    
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)

@ws_router.websocket("/ws/admin/dashboard")
async def websocket_admin_dashboard(
    websocket: WebSocket,
    token: str
):
    """Real-time admin dashboard updates"""
    try:
        user = await get_current_user_ws(token)
        if user.role != "admin":
            await websocket.close(code=1008)
            return
    except:
        await websocket.close(code=1008)
        return
    
    await manager.connect(websocket, user.id, "admin_dashboard")
    
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, "admin_dashboard")

# Helper function to send WebSocket notifications
async def send_websocket_notification(channel: str, notification: dict):
    """Send notification through WebSocket"""
    await manager.broadcast_to_channel(notification, channel)
    await manager.publish_to_redis(channel, notification)
```

**Integration with Celery Tasks:**

```python
# app/tasks/notification_tasks.py
@shared_task
def notify_score_update(politician_id: str, old_score: float, new_score: float):
    """Notify users when a politician's score changes significantly"""
    if abs(new_score - old_score) < 5:
        return  # Only notify for significant changes
    
    notification = {
        "type": "score_update",
        "politician_id": politician_id,
        "old_score": old_score,
        "new_score": new_score,
        "change": new_score - old_score,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Send to general alerts channel
    asyncio.run(send_websocket_notification("alerts", notification))
    
    # Send to politician-specific channel
    asyncio.run(send_websocket_notification(f"politician:{politician_id}", notification))

@shared_task
def notify_new_report(report_id: str):
    """Notify admins of new flagged reports"""
    db = SessionLocal()
    try:
        report = db.query(FlaggedReport).get(report_id)
        if not report:
            return
        
        notification = {
            "type": "new_report",
            "report_id": str(report.id),
            "politician_id": str(report.politician_id),
            "politician_name": report.politician.name,
            "issue_type": report.issue_type,
            "priority": report.priority,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send to admin dashboard
        asyncio.run(send_websocket_notification("admin_dashboard", notification))
    
    finally:
        db.close()
```

### 2.2 Advanced Notification System

#### Database Schema

```sql
-- Notification preferences
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    push_enabled BOOLEAN DEFAULT TRUE,
    websocket_enabled BOOLEAN DEFAULT TRUE,
    frequency VARCHAR(50) DEFAULT 'instant',
    followed_politicians JSONB DEFAULT '[]',
    alert_types JSONB DEFAULT '["score_update", "new_report", "promise_update"]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id),
    CHECK (frequency IN ('instant', 'daily', 'weekly'))
);

-- Notification queue
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    channels VARCHAR(100)[] DEFAULT ARRAY['websocket'],
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'normal',
    scheduled_for TIMESTAMP DEFAULT NOW(),
    sent_at TIMESTAMP,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    CHECK (status IN ('pending', 'sent', 'failed', 'read')),
    CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

CREATE INDEX idx_notifications_user ON notifications(user_id, status);
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_for) WHERE status = 'pending';
```

#### Implementation

```python
# app/models/notification.py
class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    email_enabled = Column(Boolean, default=True)
    sms_enabled = Column(Boolean, default=False)
    push_enabled = Column(Boolean, default=True)
    websocket_enabled = Column(Boolean, default=True)
    frequency = Column(String(50), default="instant")
    followed_politicians = Column(JSONB, default=[])
    alert_types = Column(JSONB, default=["score_update", "new_report", "promise_update"])
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type = Column(String(100), nullable=False)
    title = Column(String(500), nullable=False)
    message = Column(Text, nullable=False)
    data = Column(JSONB)
    channels = Column(ARRAY(String), default=["websocket"])
    status = Column(String(50), default="pending")
    priority = Column(String(20), default="normal")
    scheduled_for = Column(DateTime, default=func.now())
    sent_at = Column(DateTime)
    read_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())

# app/services/notification_service.py
class NotificationService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_notification(
        self,
        user_id: UUID,
        type: str,
        title: str,
        message: str,
        data: dict = None,
        channels: List[str] = None,
        priority: str = "normal"
    ) -> Notification:
        """Create a new notification"""
        # Get user preferences
        prefs = self.db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id
        ).first()
        
        # Determine channels based on preferences
        if channels is None:
            channels = []
            if prefs:
                if prefs.websocket_enabled:
                    channels.append("websocket")
                if prefs.email_enabled:
                    channels.append("email")
                if prefs.sms_enabled:
                    channels.append("sms")
            else:
                channels = ["websocket"]
        
        notification = Notification(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            data=data,
            channels=channels,
            priority=priority
        )
        
        self.db.add(notification)
        self.db.commit()
        
        # Send immediately if instant frequency
        if not prefs or prefs.frequency == "instant":
            send_notification.delay(str(notification.id))
        
        return notification
    
    def notify_followers(
        self,
        politician_id: UUID,
        type: str,
        title: str,
        message: str,
        data: dict = None
    ):
        """Notify all users following a politician"""
        # Find users following this politician
        followers = self.db.query(NotificationPreference).filter(
            NotificationPreference.followed_politicians.contains([str(politician_id)])
        ).all()
        
        for follower_prefs in followers:
            # Check if user wants this type of alert
            if type in follower_prefs.alert_types:
                self.create_notification(
                    user_id=follower_prefs.user_id,
                    type=type,
                    title=title,
                    message=message,
                    data=data
                )
    
    def mark_as_read(self, notification_id: UUID, user_id: UUID):
        """Mark notification as read"""
        notification = self.db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()
        
        if notification:
            notification.read_at = datetime.utcnow()
            notification.status = "read"
            self.db.commit()

# app/tasks/notification_tasks.py
@shared_task
def send_notification(notification_id: str):
    """Send notification through configured channels"""
    db = SessionLocal()
    try:
        notification = db.query(Notification).get(notification_id)
        if not notification or notification.status != "pending":
            return
        
        success = True
        
        # Send through each channel
        for channel in notification.channels:
            try:
                if channel == "websocket":
                    asyncio.run(send_websocket_notification(
                        f"user:{notification.user_id}",
                        {
                            "type": notification.type,
                            "title": notification.title,
                            "message": notification.message,
                            "data": notification.data,
                            "id": str(notification.id)
                        }
                    ))
                
                elif channel == "email":
                    send_email_notification.delay(notification_id)
                
                elif channel == "sms":
                    send_sms_notification.delay(notification_id)
            
            except Exception as e:
                success = False
        
        # Update notification status
        notification.status = "sent" if success else "failed"
        notification.sent_at = datetime.utcnow()
        db.commit()
    
    finally:
        db.close()

@shared_task
def send_email_notification(notification_id: str):
    """Send email notification"""
    db = SessionLocal()
    try:
        notification = db.query(Notification).get(notification_id)
        if not notification:
            return
        
        user = db.query(User).get(notification.user_id)
        if not user or not user.email:
            return
        
        # Use SendGrid or SMTP
        send_email(
            to_email=user.email,
            subject=notification.title,
            body=notification.message,
            html_template="notification_email.html",
            context={
                "title": notification.title,
                "message": notification.message,
                "data": notification.data,
                "user_name": user.full_name
            }
        )
    
    finally:
        db.close()

@shared_task
def send_sms_notification(notification_id: str):
    """Send SMS notification (Africa's Talking or Twilio)"""
    db = SessionLocal()
    try:
        notification = db.query(Notification).get(notification_id)
        if not notification:
            return
        
        user = db.query(User).get(notification.user_id)
        if not user or not user.phone_number:
            return
        
        # Use Africa's Talking for Kenya
        # import africastalking
        # africastalking.initialize(username, api_key)
        # sms = africastalking.SMS
        # sms.send(notification.message, [user.phone_number])
        
        pass  # Implement based on chosen SMS provider
    
    finally:
        db.close()

@shared_task
def send_digest_notifications():
    """Send daily/weekly digest notifications"""
    db = SessionLocal()
    try:
        # Find users with daily/weekly frequency
        daily_users = db.query(NotificationPreference).filter(
            NotificationPreference.frequency == "daily"
        ).all()
        
        for user_prefs in daily_users:
            # Get pending notifications from last 24 hours
            notifications = db.query(Notification).filter(
                Notification.user_id == user_prefs.user_id,
                Notification.status == "pending",
                Notification.created_at >= datetime.utcnow() - timedelta(days=1)
            ).all()
            
            if notifications:
                # Create digest email
                send_digest_email.delay(
                    str(user_prefs.user_id),
                    [str(n.id) for n in notifications]
                )
    
    finally:
        db.close()
```

**API Endpoints:**

```python
# app/api/v1/notifications.py
router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("")
async def get_notifications(
    status: Optional[str] = None,
    limit: int = Query(20, le=100),
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's notifications"""
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    
    if status:
        query = query.filter(Notification.status == status)
    
    total = query.count()
    notifications = query.order_by(
        Notification.created_at.desc()
    ).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "notifications": notifications
    }

@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark notification as read"""
    service = NotificationService(db)
    service.mark_as_read(notification_id, current_user.id)
    return {"message": "Notification marked as read"}

@router.get("/preferences")
async def get_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's notification preferences"""
    prefs = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == current_user.id
    ).first()
    
    if not prefs:
        # Create default preferences
        prefs = NotificationPreference(user_id=current_user.id)
        db.add(prefs)
        db.commit()
    
    return prefs

@router.put("/preferences")
async def update_notification_preferences(
    preferences: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update notification preferences"""
    prefs = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == current_user.id
    ).first()
    
    if not prefs:
        prefs = NotificationPreference(user_id=current_user.id)
        db.add(prefs)
    
    for key, value in preferences.dict(exclude_unset=True).items():
        setattr(prefs, key, value)
    
    prefs.updated_at = datetime.utcnow()
    db.commit()
    
    return prefs

@router.post("/politicians/{politician_id}/follow")
async def follow_politician(
    politician_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Follow a politician for notifications"""
    prefs = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == current_user.id
    ).first()
    
    if not prefs:
        prefs = NotificationPreference(user_id=current_user.id)
        db.add(prefs)
    
    if str(politician_id) not in prefs.followed_politicians:
        prefs.followed_politicians.append(str(politician_id))
        db.commit()
    
    return {"message": "Now following politician"}

@router.delete("/politicians/{politician_id}/follow")
async def unfollow_politician(
    politician_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unfollow a politician"""
    prefs = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == current_user.id
    ).first()
    
    if prefs and str(politician_id) in prefs.followed_politicians:
        prefs.followed_politicians.remove(str(politician_id))
        db.commit()
    
    return {"message": "Unfollowed politician"}
```

---

## 3. Data Integrity & Verification

### 3.1 Source Verification System

```python
# app/models/source.py
class Source(Base):
    __tablename__ = "sources"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # news, government, court, social_media
    url = Column(String(500))
    credibility_score = Column(Numeric(3, 2), default=0.50)  # 0-1
    verification_status = Column(String(50), default="unverified")
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    verified_at = Column(DateTime)
    domain = Column(String(255))
    bias_rating = Column(String(50))  # left, center, right, unknown
    fact_check_rating = Column(Numeric(3, 2))  # 0-1
    metadata = Column(JSONB)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class SourceCitation(Base):
    __tablename__ = "source_citations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String(50), nullable=False)  # case, promise, linkage, news
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id"))
    url = Column(Text, nullable=False)
    citation_text = Column(Text)
    page_number = Column(Integer)
    accessed_at = Column(DateTime, default=func.now())
    is_verified = Column(Boolean, default=False)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    verified_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())

class VerificationVote(Base):
    __tablename__ = "verification_votes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    vote_type = Column(String(20), nullable=False)  # upvote, downvote, flag
    comment = Column(Text)
    created_at = Column(DateTime, default=func.now())
    
    __table_args__ = (
        UniqueConstraint('entity_type', 'entity_id', 'user_id', name='unique_user_vote'),
    )

# app/services/verification_service.py
class VerificationService:
    def __init__(self, db: Session):
        self.db = db
    
    def calculate_source_credibility(self, source_id: UUID) -> float:
        """Calculate credibility score for a source"""
        source = self.db.query(Source).get(source_id)
        if not source:
            return 0.5
        
        # Factors affecting credibility
        factors = []
        
        # 1. Verification status (40%)
        if source.verification_status == "verified":
            factors.append(1.0 * 0.4)
        elif source.verification_status == "pending":
            factors.append(0.6 * 0.4)
        else:
            factors.append(0.3 * 0.4)
        
        # 2. Type of source (30%)
        type_scores = {
            "government": 0.9,
            "court": 0.95,
            "news": 0.7,
            "social_media": 0.4,
            "other": 0.5
        }
        factors.append(type_scores.get(source.type, 0.5) * 0.3)
        
        # 3. Fact check rating (20%)
        if source.fact_check_rating:
            factors.append(float(source.fact_check_rating) * 0.2)
        else:
            factors.append(0.5 * 0.2)
        
        # 4. Community verification (10%)
        citations = self.db.query(SourceCitation).filter(
            SourceCitation.source_id == source_id
        ).all()
        
        if citations:
            verified_count = sum(1 for c in citations if c.is_verified)
            verification_rate = verified_count / len(citations)
            factors.append(verification_rate * 0.1)
        else:
            factors.append(0.5 * 0.1)
        
        credibility = sum(factors)
        
        # Update source credibility
        source.credibility_score = credibility
        self.db.commit()
        
        return credibility
    
    def add_citation(
        self,
        entity_type: str,
        entity_id: UUID,
        source_url: str,
        citation_text: str = None,
        user_id: UUID = None
    ) -> SourceCitation:
        """Add a source citation to an entity"""
        # Extract domain from URL
        from urllib.parse import urlparse
        domain = urlparse(source_url).netloc
        
        # Find or create source
        source = self.db.query(Source).filter(Source.domain == domain).first()
        if not source:
            source = Source(
                name=domain,
                type="other",
                domain=domain,
                url=source_url
            )
            self.db.add(source)
            self.db.commit()
        
        citation = SourceCitation(
            entity_type=entity_type,
            entity_id=entity_id,
            source_id=source.id,
            url=source_url,
            citation_text=citation_text
        )
        
        self.db.add(citation)
        self.db.commit()
        
        return citation
    
    def vote_on_entity(
        self,
        entity_type: str,
        entity_id: UUID,
        user_id: UUID,
        vote_type: str,
        comment: str = None
    ) -> VerificationVote:
        """User votes to verify/flag an entity"""
        # Check if user already voted
        existing = self.db.query(VerificationVote).filter(
            VerificationVote.entity_type == entity_type,
            VerificationVote.entity_id == entity_id,
            VerificationVote.user_id == user_id
        ).first()
        
        if existing:
            # Update existing vote
            existing.vote_type = vote_type
            existing.comment = comment
            self.db.commit()
            return existing
        
        vote = VerificationVote(
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user_id,
            vote_type=vote_type,
            comment=comment
        )
        
        self.db.add(vote)
        self.db.commit()
        
        # Update entity verification status based on votes
        self._update_entity_verification(entity_type, entity_id)
        
        return vote
    
    def _update_entity_verification(self, entity_type: str, entity_id: UUID):
        """Update entity verification status based on community votes"""
        votes = self.db.query(VerificationVote).filter(
            VerificationVote.entity_type == entity_type,
            VerificationVote.entity_id == entity_id
        ).all()
        
        upvotes = sum(1 for v in votes if v.vote_type == "upvote")
        downvotes = sum(1 for v in votes if v.vote_type == "downvote")
        flags = sum(1 for v in votes if v.vote_type == "flag")
        
        # Simple verification logic
        total_votes = upvotes + downvotes
        if total_votes >= 5:
            verification_score = upvotes / total_votes
            
            # Update entity based on type
            if entity_type == "case":
                case = self.db.query(LegalCase).get(entity_id)
                if case:
                    case.is_verified = verification_score >= 0.7
            elif entity_type == "promise":
                promise = self.db.query(Promise).get(entity_id)
                if promise:
                    promise.is_verified = verification_score >= 0.7
        
        # Auto-flag for review if many flags
        if flags >= 3:
            # Create admin notification
            pass  # Implement admin flagging
        
        self.db.commit()
    
    def get_verification_summary(self, entity_type: str, entity_id: UUID) -> Dict:
        """Get verification summary for an entity"""
        votes = self.db.query(VerificationVote).filter(
            VerificationVote.entity_type == entity_type,
            VerificationVote.entity_id == entity_id
        ).all()
        
        citations = self.db.query(SourceCitation).filter(
            SourceCitation.entity_type == entity_type,
            SourceCitation.entity_id == entity_id
        ).all()
        
        upvotes = sum(1 for v in votes if v.vote_type == "upvote")
        downvotes = sum(1 for v in votes if v.vote_type == "downvote")
        flags = sum(1 for v in votes if v.vote_type == "flag")
        
        return {
            "total_votes": len(votes),
            "upvotes": upvotes,
            "downvotes": downvotes,
            "flags": flags,
            "verification_score": upvotes / (upvotes + downvotes) if (upvotes + downvotes) > 0 else 0,
            "citations_count": len(citations),
            "verified_citations": sum(1 for c in citations if c.is_verified),
            "avg_source_credibility": np.mean([float(c.source.credibility_score) for c in citations]) if citations else 0
        }
```

### 3.2 Audit Trail System

```python
# app/models/audit.py
class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50))
    entity_id = Column(UUID(as_uuid=True))
    changes = Column(JSONB)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    timestamp = Column(DateTime, default=func.now(), index=True)
    
    user = relationship("User")

class DataVersion(Base):
    __tablename__ = "data_versions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    version_number = Column(Integer, nullable=False)
    data_snapshot = Column(JSONB, nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    change_reason = Column(Text)
    created_at = Column(DateTime, default=func.now())
    
    __table_args__ = (
        Index('idx_version_entity', 'entity_type', 'entity_id', 'version_number'),
    )

# app/services/audit_service.py
class AuditService:
    def __init__(self, db: Session):
        self.db = db
    
    def log_action(
        self,
        user_id: UUID,
        action: str,
        entity_type: str = None,
        entity_id: UUID = None,
        changes: dict = None,
        request: Request = None
    ):
        """Log an audit event"""
        log = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            changes=changes,
            ip_address=request.client.host if request else None,
            user_agent=request.headers.get("user-agent") if request else None
        )
        
        self.db.add(log)
        self.db.commit()
    
    def create_version(
        self,
        entity_type: str,
        entity_id: UUID,
        data: dict,
        user_id: UUID,
        reason: str = None
    ):
        """Create a version snapshot of data"""
        # Get current version number
        latest = self.db.query(DataVersion).filter(
            DataVersion.entity_type == entity_type,
            DataVersion.entity_id == entity_id
        ).order_by(DataVersion.version_number.desc()).first()
        
        version_number = (latest.version_number + 1) if latest else 1
        
        version = DataVersion(
            entity_type=entity_type,
            entity_id=entity_id,
            version_number=version_number,
            data_snapshot=data,
            changed_by=user_id,
            change_reason=reason
        )
        
        self.db.add(version)
        self.db.commit()
        
        return version
    
    def get_version_history(
        self,
        entity_type: str,
        entity_id: UUID,
        limit: int = 20
    ) -> List[DataVersion]:
        """Get version history for an entity"""
        return self.db.query(DataVersion).filter(
            DataVersion.entity_type == entity_type,
            DataVersion.entity_id == entity_id
        ).order_by(DataVersion.version_number.desc()).limit(limit).all()
    
    def compare_versions(
        self,
        entity_type: str,
        entity_id: UUID,
        version1: int,
        version2: int
    ) -> Dict:
        """Compare two versions of an entity"""
        v1 = self.db.query(DataVersion).filter(
            DataVersion.entity_type == entity_type,
            DataVersion.entity_id == entity_id,
            DataVersion.version_number == version1
        ).first()
        
        v2 = self.db.query(DataVersion).filter(
            DataVersion.entity_type == entity_type,
            DataVersion.entity_id == entity_id,
            DataVersion.version_number == version2
        ).first()
        
        if not v1 or not v2:
            return None
        
        # Find differences
        changes = {}
        all_keys = set(v1.data_snapshot.keys()) | set(v2.data_snapshot.keys())
        
        for key in all_keys:
            val1 = v1.data_snapshot.get(key)
            val2 = v2.data_snapshot.get(key)
            
            if val1 != val2:
                changes[key] = {
                    "from": val1,
                    "to": val2
                }
        
        return {
            "version1": version1,
            "version2": version2,
            "changes": changes,
            "changed_by_v1": str(v1.changed_by) if v1.changed_by else None,
            "changed_by_v2": str(v2.changed_by) if v2.changed_by else None,
            "timestamp_v1": v1.created_at.isoformat(),
            "timestamp_v2": v2.created_at.isoformat()
        }
    
    def revert_to_version(
        self,
        entity_type: str,
        entity_id: UUID,
        version_number: int,
        user_id: UUID
    ):
        """Revert entity to a previous version"""
        version = self.db.query(DataVersion).filter(
            DataVersion.entity_type == entity_type,
            DataVersion.entity_id == entity_id,
            DataVersion.version_number == version_number
        ).first()
        
        if not version:
            raise ValueError("Version not found")
        
        # Get entity and update
        if entity_type == "politician":
            entity = self.db.query(Politician).get(entity_id)
        elif entity_type == "case":
            entity = self.db.query(LegalCase).get(entity_id)
        # ... other entity types
        
        if not entity:
            raise ValueError("Entity not found")
        
        # Update entity with version data
        for key, value in version.data_snapshot.items():
            if hasattr(entity, key):
                setattr(entity, key, value)
        
        # Create new version for the revert
        current_data = {c.name: getattr(entity, c.name) for c in entity.__table__.columns}
        self.create_version(
            entity_type,
            entity_id,
            current_data,
            user_id,
            f"Reverted to version {version_number}"
        )
        
        # Log the revert action
        self.log_action(
            user_id,
            "revert_version",
            entity_type,
            entity_id,
            {"reverted_to": version_number}
        )
        
        self.db.commit()

# Middleware to auto-log changes
from sqlalchemy import event

def setup_audit_listeners():
    """Setup SQLAlchemy event listeners for automatic auditing"""
    
    @event.listens_for(Politician, 'before_update')
    def politician_before_update(mapper, connection, target):
        # Store old values
        target._old_values = {}
        for col in mapper.columns:
            target._old_values[col.name] = getattr(target, col.name)
    
    @event.listens_for(Politician, 'after_update')
    def politician_after_update(mapper, connection, target):
        # Compare old and new values
        if hasattr(target, '_old_values'):
            changes = {}
            for col in mapper.columns:
                old_val = target._old_values.get(col.name)
                new_val = getattr(target, col.name)
                if old_val != new_val:
                    changes[col.name] = {
                        "from": str(old_val),
                        "to": str(new_val)
                    }
            
            if changes:
                # Create audit log (need to pass user_id from context)
                pass  # Implement context-based user tracking
```

**API Endpoints:**

```python
# app/api/v1/verification.py
router = APIRouter(prefix="/verification", tags=["verification"])

@router.post("/entities/{entity_type}/{entity_id}/vote")
async def vote_on_entity(
    entity_type: str,
    entity_id: UUID,
    vote: VerificationVoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Vote to verify or flag an entity"""
    service = VerificationService(db)
    result = service.vote_on_entity(
        entity_type,
        entity_id,
        current_user.id,
        vote.vote_type,
        vote.comment
    )
    return result

@router.get("/entities/{entity_type}/{entity_id}/summary")
async def get_verification_summary(
    entity_type: str,
    entity_id: UUID,
    db: Session = Depends(get_db)
):
    """Get verification summary for an entity"""
    service = VerificationService(db)
    return service.get_verification_summary(entity_type, entity_id)

@router.post("/citations")
async def add_citation(
    citation: CitationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a source citation"""
    service = VerificationService(db)
    result = service.add_citation(
        citation.entity_type,
        citation.entity_id,
        citation.source_url,
        citation.citation_text,
        current_user.id
    )
    return result

# app/api/v1/audit.py
router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("/entities/{entity_type}/{entity_id}/history")
async def get_entity_history(
    entity_type: str,
    entity_id: UUID,
    limit: int = Query(20, le=100),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get version history for an entity (Admin only)"""
    service = AuditService(db)
    return service.get_version_history(entity_type, entity_id, limit)

@router.get("/entities/{entity_type}/{entity_id}/compare")
async def compare_versions(
    entity_type: str,
    entity_id: UUID,
    version1: int,
    version2: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Compare two versions of an entity (Admin only)"""
    service = AuditService(db)
    return service.compare_versions(entity_type, entity_id, version1, version2)

@router.post("/entities/{entity_type}/{entity_id}/revert")
async def revert_to_version(
    entity_type: str,
    entity_id: UUID,
    version: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Revert entity to a previous version (Admin only)"""
    service = AuditService(db)
    service.revert_to_version(entity_type, entity_id, version, current_user.id)
    return {"message": f"Reverted to version {version}"}

@router.get("/logs")
async def get_audit_logs(
    user_id: Optional[UUID] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(50, le=500),
    offset: int = 0,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get audit logs with filters (Admin only)"""
    query = db.query(AuditLog)
    
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if start_date:
        query = query.filter(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.filter(AuditLog.timestamp <= end_date)
    
    total = query.count()
    logs = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "logs": logs
    }
```

---

## 4. Advanced Analytics

### 4.1 Analytics Service

```python
# app/services/analytics_service.py
class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db
    
    def get_platform_overview(self) -> Dict:
        """Get comprehensive platform statistics"""
        return {
            "politicians": {
                "total": self.db.query(Politician).count(),
                "active": self.db.query(Politician).filter(Politician.is_active == True).count(),
                "avg_transparency_score": self.db.query(func.avg(Politician.transparency_score)).scalar()
            },
            "cases": {
                "total": self.db.query(LegalCase).count(),
                "ongoing": self.db.query(LegalCase).filter(LegalCase.status == "ongoing").count(),
                "resolved": self.db.query(LegalCase).filter(LegalCase.status == "resolved").count()
            },
            "promises": {
                "total": self.db.query(Promise).count(),
                "fulfilled": self.db.query(Promise).filter(Promise.status == "fulfilled").count(),
                "broken": self.db.query(Promise).filter(Promise.status == "broken").count(),
                "fulfillment_rate": self._calculate_promise_fulfillment_rate()
            },
            "reports": {
                "total": self.db.query(FlaggedReport).count(),
                "pending": self.db.query(FlaggedReport).filter(FlaggedReport.status == "under_review").count(),
                "verified": self.db.query(FlaggedReport).filter(FlaggedReport.status == "verified").count()
            },
            "users": {
                "total": self.db.query(User).count(),
                "active_30d": self._count_active_users(30)
            }
        }
    
    def get_score_distribution(self) -> Dict:
        """Get transparency score distribution"""
        politicians = self.db.query(Politician.transparency_score).filter(
            Politician.transparency_score.isnot(None)
        ).all()
        
        scores = [float(p.transparency_score) for p in politicians]
        
        # Create bins
        bins = [0, 20, 40, 60, 80, 100]
        distribution = {}
        
        for i in range(len(bins) - 1):
            count = sum(1 for s in scores if bins[i] <= s < bins[i+1])
            distribution[f"{bins[i]}-{bins[i+1]}"] = count
        
        return {
            "distribution": distribution,
            "mean": np.mean(scores) if scores else 0,
            "median": np.median(scores) if scores else 0,
            "std": np.std(scores) if scores else 0,
            "min": min(scores) if scores else 0,
            "max": max(scores) if scores else 0
        }
    
    def get_party_comparison(self) -> List[Dict]:
        """Compare transparency scores by party"""
        results = self.db.query(
            Politician.party,
            func.count(Politician.id).label("count"),
            func.avg(Politician.transparency_score).label("avg_score"),
            func.min(Politician.transparency_score).label("min_score"),
            func.max(Politician.transparency_score).label("max_score")
        ).filter(
            Politician.party.isnot(None),
            Politician.transparency_score.isnot(None)
        ).group_by(Politician.party).all()
        
        return [
            {
                "party": r.party,
                "politician_count": r.count,
                "avg_transparency_score": float(r.avg_score),
                "min_score": float(r.min_score),
                "max_score": float(r.max_score)
            }
            for r in results
        ]
    
    def get_county_stats(self) -> List[Dict]:
        """Get statistics by county"""
        results = self.db.query(
            Politician.county,
            func.count(Politician.id).label("count"),
            func.avg(Politician.transparency_score).label("avg_score")
        ).filter(
            Politician.county.isnot(None)
        ).group_by(Politician.county).all()
        
        # Add case and promise counts
        county_stats = []
        for r in results:
            politician_ids = [p.id for p in self.db.query(Politician.id).filter(
                Politician.county == r.county
            ).all()]
            
            case_count = self.db.query(LegalCase).filter(
                LegalCase.politician_id.in_(politician_ids)
            ).count()
            
            promise_count = self.db.query(Promise).filter(
                Promise.politician_id.in_(politician_ids)
            ).count()
            
            county_stats.append({
                "county": r.county,
                "politician_count": r.count,
                "avg_transparency_score": float(r.avg_score) if r.avg_score else 0,
                "total_cases": case_count,
                "total_promises": promise_count
            })
        
        return sorted(county_stats, key=lambda x: x["avg_transparency_score"], reverse=True)
    
    def get_trending_politicians(self, days: int = 7, limit: int = 10) -> List[Dict]:
        """Get trending politicians based on recent activity"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Calculate trending score based on:
        # - New cases
        # - News mentions
        # - Score changes
        # - Report activity
        
        subquery_cases = self.db.query(
            LegalCase.politician_id,
            func.count(LegalCase.id).label("new_cases")
        ).filter(
            LegalCase.created_at >= cutoff_date
        ).group_by(LegalCase.politician_id).subquery()
        
        subquery_news = self.db.query(
            NewsMention.politician_id,
            func.count(NewsMention.id).label("news_count")
        ).filter(
            NewsMention.published_at >= cutoff_date
        ).group_by(NewsMention.politician_id).subquery()
        
        results = self.db.query(
            Politician,
            func.coalesce(subquery_cases.c.new_cases, 0).label("new_cases"),
            func.coalesce(subquery_news.c.news_count, 0).label("news_mentions")
        ).outerjoin(
            subquery_cases, Politician.id == subquery_cases.c.politician_id
        ).outerjoin(
            subquery_news, Politician.id == subquery_news.c.politician_id
        ).filter(
            or_(
                subquery_cases.c.new_cases > 0,
                subquery_news.c.news_count > 0
            )
        ).all()
        
        # Calculate trending score
        trending = []
        for r in results:
            politician = r[0]
            new_cases = r.new_cases
            news_mentions = r.news_mentions
            
            # Simple trending score
            trending_score = (new_cases * 10) + (news_mentions * 5)
            
            trending.append({
                "politician": politician,
                "trending_score": trending_score,
                "new_cases": new_cases,
                "news_mentions": news_mentions
            })
        
        # Sort by trending score
        trending.sort(key=lambda x: x["trending_score"], reverse=True)
        
        return trending[:limit]
    
    def get_time_series_data(
        self,
        metric: str,
        start_date: datetime,
        end_date: datetime,
        interval: str = "day"
    ) -> List[Dict]:
        """Get time series data for various metrics"""
        if metric == "transparency_scores":
            return self._get_score_time_series(start_date, end_date, interval)
        elif metric == "new_reports":
            return self._get_reports_time_series(start_date, end_date, interval)
        elif metric == "case_filings":
            return self._get_cases_time_series(start_date, end_date, interval)
        else:
            return []
    
    def _get_score_time_series(
        self,
        start_date: datetime,
        end_date: datetime,
        interval: str
    ) -> List[Dict]:
        """Get average transparency score over time"""
        # Use score_history table
        if interval == "day":
            date_trunc = func.date_trunc('day', ScoreHistory.calculated_at)
        elif interval == "week":
            date_trunc = func.date_trunc('week', ScoreHistory.calculated_at)
        elif interval == "month":
            date_trunc = func.date_trunc('month', ScoreHistory.calculated_at)
        
        results = self.db.query(
            date_trunc.label("period"),
            func.avg(ScoreHistory.transparency_score).label("avg_score"),
            func.count(ScoreHistory.id).label("count")
        ).filter(
            ScoreHistory.calculated_at >= start_date,
            ScoreHistory.calculated_at <= end_date
        ).group_by("period").order_by("period").all()
        
        return [
            {
                "period": r.period.isoformat(),
                "avg_score": float(r.avg_score),
                "count": r.count
            }
            for r in results
        ]
    
    def _calculate_promise_fulfillment_rate(self) -> float:
        """Calculate overall promise fulfillment rate"""
        total = self.db.query(Promise).count()
        if total == 0:
            return 0
        
        fulfilled = self.db.query(Promise).filter(
            Promise.status == "fulfilled"
        ).count()
        
        return (fulfilled / total) * 100
    
    def _count_active_users(self, days: int) -> int:
        """Count users active in the last N days"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        return self.db.query(User).filter(
            User.last_login >= cutoff
        ).count()

# app/services/export_service.py
import csv
import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

class ExportService:
    def __init__(self, db: Session):
        self.db = db
    
    def export_to_csv(self, entity_type: str, filters: dict = None) -> io.StringIO:
        """Export data to CSV"""
        output = io.StringIO()
        writer = csv.writer(output)
        
        if entity_type == "politicians":
            writer.writerow([
                "ID", "Name", "Position", "Party", "County",
                "Transparency Score", "Date Created"
            ])
            
            query = self.db.query(Politician)
            if filters:
                # Apply filters
                pass
            
            for p in query.all():
                writer.writerow([
                    str(p.id), p.name, p.position, p.party,
                    p.county, p.transparency_score, p.created_at
                ])
        
        # Similar for other entity types
        
        output.seek(0)
        return output
    
    def generate_report_pdf(self, politician_id: UUID) -> io.BytesIO:
        """Generate PDF report for a politician"""
        politician = self.db.query(Politician).get(politician_id)
        if not politician:
            return None
        
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        
        # Title
        p.setFont("Helvetica-Bold", 20)
        p.drawString(50, 750, f"Transparency Report: {politician.name}")
        
        # Basic info
        p.setFont("Helvetica", 12)
        y = 700
        p.drawString(50, y, f"Position: {politician.position}")
        y -= 20
        p.drawString(50, y, f"Party: {politician.party}")
        y -= 20
        p.drawString(50, y, f"Transparency Score: {politician.transparency_score}/100")
        
        # Cases
        y -= 40
        p.setFont("Helvetica-Bold", 14)
        p.drawString(50, y, "Legal Cases")
        y -= 20
        p.setFont("Helvetica", 10)
        
        cases = self.db.query(LegalCase).filter(
            LegalCase.politician_id == politician_id
        ).all()
        
        for case in cases[:10]:  # Limit to 10
            p.drawString(70, y, f"• {case.title} ({case.status})")
            y -= 15
            if y < 100:
                p.showPage()
                y = 750
        
        p.save()
        buffer.seek(0)
        return buffer
```

**API Endpoints:**

```python
# app/api/v1/analytics.py
router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/overview")
async def get_platform_overview(
    db: Session = Depends(get_db)
):
    """Get comprehensive platform statistics"""
    service = AnalyticsService(db)
    return service.get_platform_overview()

@router.get("/scores/distribution")
async def get_score_distribution(
    db: Session = Depends(get_db)
):
    """Get transparency score distribution"""
    service = AnalyticsService(db)
    return service.get_score_distribution()

@router.get("/comparison/parties")
async def compare_parties(
    db: Session = Depends(get_db)
):
    """Compare transparency scores by party"""
    service = AnalyticsService(db)
    return service.get_party_comparison()

@router.get("/comparison/counties")
async def get_county_stats(
    db: Session = Depends(get_db)
):
    """Get statistics by county"""
    service = AnalyticsService(db)
    return service.get_county_stats()

@router.get("/trending")
async def get_trending_politicians(
    days: int = Query(7, ge=1, le=30),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Get trending politicians"""
    service = AnalyticsService(db)
    return service.get_trending_politicians(days, limit)

@router.get("/time-series/{metric}")
async def get_time_series(
    metric: str,
    start_date: datetime,
    end_date: datetime,
    interval: str = Query("day", regex="^(day|week|month)$"),
    db: Session = Depends(get_db)
):
    """Get time series data for metrics"""
    service = AnalyticsService(db)
    return service.get_time_series_data(metric, start_date, end_date, interval)

@router.get("/export/{entity_type}")
async def export_data(
    entity_type: str,
    format: str = Query("csv", regex="^(csv|json|xlsx)$"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Export data (Admin only)"""
    service = ExportService(db)
    
    if format == "csv":
        csv_data = service.export_to_csv(entity_type)
        return Response(
            content=csv_data.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={entity_type}.csv"}
        )
    
    # Similar for other formats

@router.get("/reports/politician/{politician_id}")
async def generate_politician_report(
    politician_id: UUID,
    format: str = Query("pdf", regex="^(pdf|html)$"),
    db: Session = Depends(get_db)
):
    """Generate comprehensive report for a politician"""
    service = ExportService(db)
    
    if format == "pdf":
        pdf_buffer = service.generate_report_pdf(politician_id)
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=politician_report.pdf"}
        )
```

---

## 5. Scale & Performance

### 5.1 Caching Strategy

```python
# app/core/cache.py
import redis
import pickle
from functools import wraps
from typing import Optional, Callable
import hashlib
import json

class CacheManager:
    def __init__(self):
        self.redis_client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=False  # We'll handle encoding
        )
    
    def generate_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate cache key from function arguments"""
        key_data = f"{prefix}:{str(args)}:{str(sorted(kwargs.items()))}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def get(self, key: str) -> Optional[any]:
        """Get value from cache"""
        try:
            data = self.redis_client.get(key)
            if data:
                return pickle.loads(data)
        except Exception as e:
            print(f"Cache get error: {e}")
        return None
    
    def set(self, key: str, value: any, ttl: int = 300):
        """Set value in cache with TTL (seconds)"""
        try:
            self.redis_client.setex(
                key,
                ttl,
                pickle.dumps(value)
            )
        except Exception as e:
            print(f"Cache set error: {e}")
    
    def delete(self, key: str):
        """Delete key from cache"""
        try:
            self.redis_client.delete(key)
        except Exception as e:
            print(f"Cache delete error: {e}")
    
    def delete_pattern(self, pattern: str):
        """Delete all keys matching pattern"""
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                self.redis_client.delete(*keys)
        except Exception as e:
            print(f"Cache delete pattern error: {e}")
    
    def invalidate_politician(self, politician_id: UUID):
        """Invalidate all cache entries for a politician"""
        patterns = [
            f"politician:{politician_id}:*",
            f"politician_list:*",
            f"search:*",
            f"stats:*"
        ]
        for pattern in patterns:
            self.delete_pattern(pattern)

cache_manager = CacheManager()

# Decorator for caching
def cached(prefix: str, ttl: int = 300, invalidate_on: list = None):
    """Cache decorator for functions"""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = cache_manager.generate_key(prefix, *args, **kwargs)
            
            # Try to get from cache
            cached_value = cache_manager.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Call function and cache result
            result = await func(*args, **kwargs)
            cache_manager.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator

# Example usage in services
class CachedPoliticianService:
    def __init__(self, db: Session):
        self.db = db
    
    @cached(prefix="politician", ttl=600)
    async def get_politician(self, politician_id: UUID) -> dict:
        """Get politician with caching"""
        politician = self.db.query(Politician).get(politician_id)
        if not politician:
            return None
        
        # Convert to dict
        return {
            "id": str(politician.id),
            "name": politician.name,
            "position": politician.position,
            "party": politician.party,
            "transparency_score": float(politician.transparency_score)
        }
    
    @cached(prefix="politician_cases", ttl=300)
    async def get_politician_cases(self, politician_id: UUID) -> list:
        """Get politician cases with caching"""
        cases = self.db.query(LegalCase).filter(
            LegalCase.politician_id == politician_id
        ).all()
        
        return [
            {
                "id": str(c.id),
                "title": c.title,
                "status": c.status,
                "court": c.court
            }
            for c in cases
        ]
```

### 5.2 Database Optimization

```sql
-- Additional indexes for performance
CREATE INDEX CONCURRENTLY idx_politicians_active_score 
ON politicians(is_active, transparency_score DESC) 
WHERE is_active = TRUE;

CREATE INDEX CONCURRENTLY idx_news_politician_published 
ON news_mentions(politician_id, published_at DESC);

CREATE INDEX CONCURRENTLY idx_cases_politician_status 
ON legal_cases(politician_id, status);

CREATE INDEX CONCURRENTLY idx_promises_politician_status 
ON promises(politician_id, status);

-- Materialized view for dashboard statistics
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM politicians WHERE is_active = TRUE) as total_politicians,
    (SELECT COUNT(*) FROM legal_cases WHERE status = 'ongoing') as ongoing_cases,
    (SELECT COUNT(*) FROM promises WHERE status = 'fulfilled') as fulfilled_promises,
    (SELECT COUNT(*) FROM flagged_reports WHERE status = 'under_review') as pending_reports,
    (SELECT AVG(transparency_score) FROM politicians WHERE transparency_score IS NOT NULL) as avg_transparency_score,
    NOW() as last_updated;

CREATE UNIQUE INDEX ON dashboard_stats (last_updated);

-- Refresh materialized view periodically
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats;
END;
$ LANGUAGE plpgsql;

-- Partitioning for large tables
CREATE TABLE score_history_partitioned (
    LIKE score_history INCLUDING ALL
) PARTITION BY RANGE (calculated_at);

-- Create monthly partitions
CREATE TABLE score_history_2024_01 PARTITION OF score_history_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE score_history_2024_02 PARTITION OF score_history_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Auto-create partitions function
CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $
DECLARE
    start_date date;
    end_date date;
    partition_name text;
BEGIN
    start_date := date_trunc('month', CURRENT_DATE);
    end_date := start_date + interval '1 month';
    partition_name := 'score_history_' || to_char(start_date, 'YYYY_MM');
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF score_history_partitioned
         FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
    );
END;
$ LANGUAGE plpgsql;
```

```python
# app/services/database_optimization_service.py
class DatabaseOptimizationService:
    def __init__(self, db: Session):
        self.db = db
    
    def refresh_materialized_views(self):
        """Refresh all materialized views"""
        self.db.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats"))
        self.db.commit()
    
    def analyze_tables(self):
        """Run ANALYZE on all tables for query optimization"""
        tables = [
            "politicians", "legal_cases", "promises",
            "news_mentions", "flagged_reports", "score_history"
        ]
        
        for table in tables:
            self.db.execute(text(f"ANALYZE {table}"))
        
        self.db.commit()
    
    def get_slow_queries(self, limit: int = 10) -> List[Dict]:
        """Get slow queries from pg_stat_statements"""
        result = self.db.execute(text("""
            SELECT 
                query,
                calls,
                total_exec_time,
                mean_exec_time,
                max_exec_time
            FROM pg_stat_statements
            WHERE query NOT LIKE '%pg_stat_statements%'
            ORDER BY mean_exec_time DESC
            LIMIT :limit
        """), {"limit": limit})
        
        return [dict(row) for row in result]
    
    def vacuum_analyze(self):
        """Run VACUUM ANALYZE on all tables"""
        # Must be run outside transaction
        self.db.execute(text("VACUUM ANALYZE"))

# Celery task for periodic optimization
@shared_task
def optimize_database():
    """Run database optimization tasks"""
    db = SessionLocal()
    try:
        service = DatabaseOptimizationService(db)
        service.refresh_materialized_views()
        service.analyze_tables()
    finally:
        db.close()

# Add to celery beat schedule
app.conf.beat_schedule['optimize-database'] = {
    'task': 'app.tasks.optimization_tasks.optimize_database',
    'schedule': crontab(hour=3, minute=0),  # 3 AM daily
}
```

### 5.3 API Rate Limiting

```python
# app/core/rate_limit.py
from fastapi import HTTPException, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute", "1000/hour"],
    storage_uri=settings.REDIS_URL
)

# Custom rate limit handler
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "message": "Too many requests. Please try again later.",
            "retry_after": exc.detail
        }
    )

# Apply to FastAPI app
# app/main.py
from app.core.rate_limit import limiter, custom_rate_limit_handler

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, custom_rate_limit_handler)

# Usage in endpoints
@router.get("/politicians")
@limiter.limit("50/minute")
async def get_politicians(request: Request, db: Session = Depends(get_db)):
    """Get politicians with rate limiting"""
    pass

# Different limits for authenticated users
def get_rate_limit(request: Request) -> str:
    """Dynamic rate limit based on user role"""
    # Check if user is authenticated
    token = request.headers.get("Authorization")
    if token:
        try:
            user = verify_token(token)
            if user.role == "admin":
                return "1000/minute"
            elif user.role == "premium":
                return "500/minute"
        except:
            pass
    
    return "100/minute"

@router.get("/search")
@limiter.limit(get_rate_limit)
async def search(request: Request, q: str, db: Session = Depends(get_db)):
    """Search with dynamic rate limiting"""
    pass
```

### 5.4 Background Job Optimization

```python
# app/tasks/celery_config.py
from celery import Celery
from kombu import Exchange, Queue

app = Celery('kenya_ni_yetu')

# Configure task routing
app.conf.task_routes = {
    'app.tasks.scraping_tasks.*': {'queue': 'scraping'},
    'app.tasks.scoring_tasks.*': {'queue': 'scoring'},
    'app.tasks.notification_tasks.*': {'queue': 'notifications'},
    'app.tasks.export_tasks.*': {'queue': 'exports'},
}

# Configure task priorities
app.conf.task_queues = (
    Queue('default', Exchange('default'), routing_key='default', priority=5),
    Queue('high_priority', Exchange('high_priority'), routing_key='high_priority', priority=10),
    Queue('low_priority', Exchange('low_priority'), routing_key='low_priority', priority=1),
    Queue('scraping', Exchange('scraping'), routing_key='scraping', priority=3),
    Queue('scoring', Exchange('scoring'), routing_key='scoring', priority=7),
    Queue('notifications', Exchange('notifications'), routing_key='notifications', priority=8),
)

# Task optimization settings
app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,  # Disable prefetching for long tasks
    task_time_limit=3600,  # 1 hour hard limit
    task_soft_time_limit=3000,  # 50 minutes soft limit
    broker_connection_retry_on_startup=True,
)

# Monitoring
app.conf.worker_send_task_events = True
app.conf.task_send_sent_event = True

# app/tasks/optimized_tasks.py
@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=300,
    priority=7
)
def recalculate_transparency_score(self, politician_id: str):
    """Optimized score calculation with retry logic"""
    db = SessionLocal()
    try:
        scoring_service = ScoringService(db)
        result = scoring_service.calculate_transparency_score(politician_id)
        
        # Invalidate cache
        cache_manager.invalidate_politician(politician_id)
        
        # Notify via WebSocket
        notify_score_update.delay(
            politician_id,
            result['old_score'],
            result['new_score']
        )
        
        return result
    
    except SoftTimeLimitExceeded:
        # Task took too long, retry with lower priority
        self.retry(priority=3)
    
    except Exception as e:
        logger.error(f"Score calculation failed: {e}")
        self.retry(exc=e, countdown=self.default_retry_delay * (self.request.retries + 1))
    
    finally:
        db.close()

# Batch processing for efficiency
@shared_task
def batch_recalculate_scores(politician_ids: List[str], batch_size: int = 10):
    """Process score calculations in batches"""
    for i in range(0, len(politician_ids), batch_size):
        batch = politician_ids[i:i + batch_size]
        group([
            recalculate_transparency_score.s(pid) for pid in batch
        ]).apply_async()
```

---

## 6. Enhanced Security

### 6.1 Two-Factor Authentication

```python
# app/models/user.py (additions)
class User(Base):
    # ... existing fields ...
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(32))
    backup_codes = Column(JSONB)  # Encrypted backup codes
    two_factor_verified_at = Column(DateTime)

# app/services/two_factor_service.py
import pyotp
import qrcode
import io
from cryptography.fernet import Fernet

class TwoFactorService:
    def __init__(self, db: Session):
        self.db = db
        self.cipher = Fernet(settings.ENCRYPTION_KEY.encode())
    
    def enable_2fa(self, user_id: UUID) -> Dict:
        """Enable 2FA for user and return QR code"""
        user = self.db.query(User).get(user_id)
        if not user:
            raise ValueError("User not found")
        
        # Generate secret
        secret = pyotp.random_base32()
        user.two_factor_secret = self._encrypt(secret)
        
        # Generate backup codes
        backup_codes = [pyotp.random_base32()[:8] for _ in range(10)]
        user.backup_codes = [self._encrypt(code) for code in backup_codes]
        
        self.db.commit()
        
        # Generate QR code
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(
            name=user.email,
            issuer_name="Kenya ni Yetu"
        )
        
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        return {
            "qr_code": buffer.getvalue(),
            "secret": secret,
            "backup_codes": backup_codes
        }
    
    def verify_2fa_setup(self, user_id: UUID, token: str) -> bool:
        """Verify 2FA token during setup"""
        user = self.db.query(User).get(user_id)
        if not user or not user.two_factor_secret:
            return False
        
        secret = self._decrypt(user.two_factor_secret)
        totp = pyotp.TOTP(secret)
        
        if totp.verify(token):
            user.two_factor_enabled = True
            user.two_factor_verified_at = datetime.utcnow()
            self.db.commit()
            return True
        
        return False
    
    def verify_2fa_token(self, user_id: UUID, token: str) -> bool:
        """Verify 2FA token during login"""
        user = self.db.query(User).get(user_id)
        if not user or not user.two_factor_enabled:
            return False
        
        # Try TOTP token
        secret = self._decrypt(user.two_factor_secret)
        totp = pyotp.TOTP(secret)
        
        if totp.verify(token):
            return True
        
        # Try backup codes
        for encrypted_code in user.backup_codes:
            backup_code = self._decrypt(encrypted_code)
            if token == backup_code:
                # Remove used backup code
                user.backup_codes.remove(encrypted_code)
                self.db.commit()
                return True
        
        return False
    
    def disable_2fa(self, user_id: UUID):
        """Disable 2FA for user"""
        user = self.db.query(User).get(user_id)
        if user:
            user.two_factor_enabled = False
            user.two_factor_secret = None
            user.backup_codes = None
            self.db.commit()
    
    def _encrypt(self, data: str) -> str:
        """Encrypt sensitive data"""
        return self.cipher.encrypt(data.encode()).decode()
    
    def _decrypt(self, data: str) -> str:
        """Decrypt sensitive data"""
        return self.cipher.decrypt(data.encode()).decode()

# app/api/v1/auth.py (additions)
@router.post("/2fa/enable")
async def enable_2fa(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Enable 2FA for current user"""
    service = TwoFactorService(db)
    result = service.enable_2fa(current_user.id)
    
    # Return QR code as base64
    import base64
    qr_base64 = base64.b64encode(result["qr_code"]).decode()
    
    return {
        "qr_code": qr_base64,
        "secret": result["secret"],
        "backup_codes": result["backup_codes"]
    }

@router.post("/2fa/verify-setup")
async def verify_2fa_setup(
    token: str = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify 2FA setup"""
    service = TwoFactorService(db)
    success = service.verify_2fa_setup(current_user.id, token)
    
    if success:
        return {"message": "2FA enabled successfully"}
    else:
        raise HTTPException(status_code=400, detail="Invalid token")

@router.post("/login")
async def login(
    credentials: LoginRequest,
    db: Session = Depends(get_db)
):
    """Login with optional 2FA"""
    user = authenticate_user(db, credentials.email, credentials.password)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if 2FA is enabled
    if user.two_factor_enabled:
        if not credentials.two_factor_token:
            return {
                "requires_2fa": True,
                "message": "2FA token required"
            }
        
        service = TwoFactorService(db)
        if not service.verify_2fa_token(user.id, credentials.two_factor_token):
            raise HTTPException(status_code=401, detail="Invalid 2FA token")
    
    # Generate tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }
```

### 6.2 API Key Management

```python
# app/models/api_key.py
class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    key_hash = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    scopes = Column(JSONB, default=[])  # Permissions
    rate_limit = Column(Integer, default=1000)  # Requests per hour
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
    
    user = relationship("User", back_populates="api_keys")

# app/services/api_key_service.py
import secrets
import hashlib

class APIKeyService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_api_key(
        self,
        user_id: UUID,
        name: str,
        scopes: List[str] = None,
        expires_in_days: int = 365
    ) -> Dict:
        """Create new API key"""
        # Generate random key
        key = f"kny_{secrets.token_urlsafe(32)}"
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        
        api_key = APIKey(
            user_id=user_id,
            key_hash=key_hash,
            name=name,
            scopes=scopes or ["read"],
            expires_at=datetime.utcnow() + timedelta(days=expires_in_days)
        )
        
        self.db.add(api_key)
        self.db.commit()
        
        return {
            "api_key": key,  # Only shown once!
            "id": str(api_key.id),
            "name": api_key.name,
            "expires_at": api_key.expires_at.isoformat()
        }
    
    def verify_api_key(self, key: str) -> Optional[APIKey]:
        """Verify API key and return associated key object"""
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        
        api_key = self.db.query(APIKey).filter(
            APIKey.key_hash == key_hash,
            APIKey.is_active == True
        ).first()
        
        if not api_key:
            return None
        
        # Check expiration
        if api_key.expires_at and api_key.expires_at < datetime.utcnow():
            return None
        
        # Update last used
        api_key.last_used_at = datetime.utcnow()
        self.db.commit()
        
        return api_key
    
    def revoke_api_key(self, key_id: UUID, user_id: UUID):
        """Revoke an API key"""
        api_key = self.db.query(APIKey).filter(
            APIKey.id == key_id,
            APIKey.user_id == user_id
        ).first()
        
        if api_key:
            api_key.is_active = False
            self.db.commit()

# Dependency for API key authentication
async def get_api_key(
    api_key: str = Header(None, alias="X-API-Key"),
    db: Session = Depends(get_db)
) -> APIKey:
    """Validate API key from header"""
    if not api_key:
        raise HTTPException(status_code=401, detail="API key required")
    
    service = APIKeyService(db)
    key_obj = service.verify_api_key(api_key)
    
    if not key_obj:
        raise HTTPException(status_code=401, detail="Invalid or expired API key")
    
    return key_obj

# Check scopes
def require_scopes(*required_scopes: str):
    """Dependency to check API key scopes"""
    def dependency(api_key: APIKey = Depends(get_api_key)):
        if not all(scope in api_key.scopes for scope in required_scopes):
            raise HTTPException(
                status_code=403,
                detail=f"Required scopes: {', '.join(required_scopes)}"
            )
        return api_key
    return dependency

# Usage in endpoints
@router.get("/politicians")
async def get_politicians(
    api_key: APIKey = Depends(require_scopes("read")),
    db: Session = Depends(get_db)
):
    """Get politicians with API key auth"""
    pass

@router.post("/reports")
async def create_report(
    report: ReportCreate,
    api_key: APIKey = Depends(require_scopes("write")),
    db: Session = Depends(get_db)
):
    """Create report with API key auth"""
    pass
```

---

## 7. Community Features

### 7.1 Comment System

```python
# app/models/comment.py
class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(UUID(as"similarity": float(row.similarity)
            }
            for row in results
        ]
    
    def find_similar_politicians(self, politician_id: UUID, limit: int = 5) -> List[Dict]:
        """Find politicians similar to a given politician"""
        politician = self.db.query(Politician).get(politician_id)
        if not politician or not politician.embedding:
            return []
        
        results = self.db.execute(text("""
            SELECT 
                id, 
                name, 
                position, 
                party, 
                transparency_score,
                1 - (embedding <=> :politician_embedding) as similarity
            FROM politicians
            WHERE id != :politician_id 
            AND embedding IS NOT NULL
            ORDER BY embedding <=> :politician_embedding
            LIMIT :limit
        """), {
            "politician_embedding": str(politician.embedding),
            "politician_id": politician_id,
            "limit": limit
        }).fetchall()
        
        return [
            {
                "id": str(row.id),
                "name": row.name,
                "position": row.position,
                "party": row.party,
                "transparency_score": float(row.transparency_score),
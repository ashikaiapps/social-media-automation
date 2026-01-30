# Architecture Overview

## System Design

### **Microservices Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Dashboard     │────│  Content API    │────│   AI Service    │
│   (React)       │    │   (Node.js)     │    │  (OpenAI GPT)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────│  Platform APIs  │──────────────┘
                        │ (LinkedIn, IG,  │
                        │  TikTok, FB)    │
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │ Queue & Schedule│
                        │ (BullMQ/Redis)  │
                        └─────────────────┘
```

### **Tech Stack Rationale**

**Backend: Node.js + Express**
- Fast API development
- Great social media API SDKs
- Easy JSON handling
- Excellent async support

**Database: PostgreSQL + Prisma**
- Reliable ACID compliance
- JSON support for flexible content
- Great performance for analytics
- Type-safe ORM with Prisma

**Queue: BullMQ + Redis**
- Reliable job scheduling
- Retry logic built-in
- Dashboard for monitoring
- Horizontal scaling ready

**AI: OpenAI GPT-4**
- Best caption generation
- Platform-specific optimization
- Hashtag research capabilities
- Cost-effective for volume

## Database Schema

```sql
-- Core entities
Users (id, email, company, role, created_at)
SocialAccounts (id, user_id, platform, account_id, tokens, status)
ContentPosts (id, user_id, content, media_urls, platforms, status)
ScheduledJobs (id, post_id, scheduled_for, status, attempts)
Analytics (id, post_id, platform, likes, shares, comments, reach)

-- Multi-tenancy
Companies (id, name, plan, settings)
CompanyUsers (company_id, user_id, role)
```

## API Endpoints

```typescript
// Authentication
POST /auth/login
POST /auth/register
GET  /auth/me

// Social Accounts
GET    /accounts
POST   /accounts/connect/:platform
DELETE /accounts/:id

// Content Management
GET    /posts
POST   /posts
PUT    /posts/:id
DELETE /posts/:id
POST   /posts/:id/schedule

// Analytics
GET /analytics/posts/:id
GET /analytics/overview
GET /analytics/platform/:platform
```

## Deployment Architecture

### **AWS ECS Fargate Setup**
- **Load Balancer**: ALB for API routing
- **Services**: Auto-scaling containers
- **Database**: RDS PostgreSQL Multi-AZ
- **Cache**: ElastiCache Redis cluster
- **Storage**: S3 for media files
- **CDN**: CloudFront for global delivery

### **CI/CD Pipeline**
```yaml
# GitHub Actions workflow
1. Code push to main
2. Run tests (Jest + Cypress)
3. Build Docker images
4. Push to ECR
5. Deploy to ECS staging
6. Run integration tests
7. Deploy to ECS production
```

## Security Considerations

### **OAuth 2.0 Flow**
- Secure token storage with encryption
- Automatic token refresh
- Scope-limited permissions
- Rate limiting per user/account

### **Data Protection**
- Environment variables for secrets
- API key rotation schedule
- Input validation and sanitization
- HTTPS everywhere

### **Compliance**
- GDPR-ready data handling
- SOC 2 Type II preparation
- Platform terms of service adherence
- Content moderation policies

---
**Ready to build? Start with Phase 1 LinkedIn integration!**
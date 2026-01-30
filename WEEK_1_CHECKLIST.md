# 🚀 WEEK 1 ACTION PLAN - LinkedIn MVP

**Goal**: Get LinkedIn posting working by end of Week 1

---

## DAY 1 (Monday) - Environment Setup

### ✅ Prerequisites Check
```bash
# Run these commands to verify your setup:
node --version    # Need 18+
npm --version     # Need 8+
docker --version  # For containerization
psql --version    # PostgreSQL 14+
git --version     # For version control
```

### ✅ Get API Keys (CRITICAL!)

#### 1. LinkedIn Developer Account
- [ ] Visit: https://www.linkedin.com/developers/apps
- [ ] Click "Create App"
- [ ] Fill in:
  - **App name**: "Social Media Automation"
  - **LinkedIn Page**: Your company page (required)
  - **App logo**: Upload any logo
- [ ] Add products:
  - [x] "Sign In with LinkedIn"
  - [x] "Marketing Developer Platform"
- [ ] Set redirect URI: `http://localhost:3000/auth/linkedin/callback`
- [ ] **SAVE**: Client ID and Client Secret

#### 2. OpenAI API Key
- [ ] Visit: https://platform.openai.com/api-keys
- [ ] Create new secret key
- [ ] Add $20-50 credit for development
- [ ] **SAVE**: API key (starts with `sk-`)

### ✅ Project Setup
```bash
# 1. Navigate to the project
cd social-media-automation

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env with your API keys (see template below)

# 4. Setup local services
./scripts/setup-local.sh

# 5. Start development
npm run dev
```

### ✅ Environment File (.env)
```bash
# Copy this template to .env and fill in your values:

# Database
DATABASE_URL="postgresql://socialmedia:devpassword123@localhost:5432/socialmedia"
REDIS_URL="redis://localhost:6379"

# LinkedIn API (GET THESE FROM STEP 1)
LINKEDIN_CLIENT_ID="your_client_id_here"
LINKEDIN_CLIENT_SECRET="your_client_secret_here" 
LINKEDIN_REDIRECT_URI="http://localhost:3000/auth/linkedin/callback"

# OpenAI API (GET FROM STEP 2)
OPENAI_API_KEY="sk-your_api_key_here"

# App Config
JWT_SECRET="your-super-secret-jwt-key-change-this"
APP_PORT=3000
NODE_ENV="development"
FRONTEND_URL="http://localhost:3001"
```

---

## DAY 2 (Tuesday) - Test Basic Functionality

### ✅ Start Services
```bash
# Option 1: Docker Compose (Recommended)
docker-compose up -d

# Option 2: Manual startup
brew services start postgresql
brew services start redis
npm run dev

# Test health check
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

### ✅ Test User Registration
```bash
# Test API with curl or Postman
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "company": "Ashik.ai",
    "password": "testpassword123"
  }'

# Should return user info and JWT token
```

### ✅ Test LinkedIn Connection
```bash
# 1. First get auth URL
curl -X GET http://localhost:3000/api/accounts/connect/linkedin \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 2. Visit the returned authUrl in browser
# 3. Complete LinkedIn OAuth flow
```

---

## DAY 3 (Wednesday) - LinkedIn Posting

### ✅ Test Post Creation
```bash
# Create a test post
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Test post from my social media automation system! 🚀",
    "platforms": ["LINKEDIN"],
    "title": "First automated post"
  }'
```

### ✅ Test Immediate Publishing
```bash
# Publish the post immediately
curl -X POST http://localhost:3000/api/posts/POST_ID/publish \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check your LinkedIn profile - the post should appear!
```

---

## DAY 4 (Thursday) - Scheduling System

### ✅ Test Scheduled Posts
```bash
# Schedule a post for 1 hour from now
FUTURE_TIME=$(date -d "+1 hour" -Iseconds)

curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"This post was scheduled automatically! ⏰\",
    \"platforms\": [\"LINKEDIN\"],
    \"scheduledFor\": \"$FUTURE_TIME\"
  }"
```

### ✅ Monitor Job Queue
```bash
# Check if background worker is processing jobs
docker-compose logs worker

# Should show: "Post publishing worker started"
```

---

## DAY 5 (Friday) - Media Upload

### ✅ Test Image Uploads
```bash
# Test posting with an image
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "content=Check out this image post! 📸" \
  -F "platforms=[\"LINKEDIN\"]" \
  -F "media=@/path/to/your/image.jpg"
```

---

## WEEK 1 SUCCESS CRITERIA

By end of Week 1, you should have:
- [ ] ✅ LinkedIn OAuth working (can connect LinkedIn account)
- [ ] ✅ Can create and publish text posts to LinkedIn
- [ ] ✅ Can schedule posts for future publishing  
- [ ] ✅ Can upload and post images to LinkedIn
- [ ] ✅ Background job processing working
- [ ] ✅ All tests passing
- [ ] ✅ Development environment running smoothly

---

## 🐛 Common Issues & Solutions

### Problem: "LinkedIn OAuth fails"
**Solution**: 
- Verify redirect URI exactly matches in LinkedIn app settings
- Check Client ID and Secret are correct in .env
- Ensure LinkedIn app has correct products enabled

### Problem: "Database connection failed"
**Solution**:
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# If not running:
brew services start postgresql

# Create database if it doesn't exist:
createdb socialmedia
```

### Problem: "Redis connection failed" 
**Solution**:
```bash
# Check if Redis is running
brew services list | grep redis

# If not running:
brew services start redis
```

### Problem: "File upload fails"
**Solution**:
```bash
# Ensure directories exist
mkdir -p uploads/temp uploads/media logs

# Check permissions
chmod 755 uploads
```

### Problem: "Jobs not processing"
**Solution**:
- Check if worker is running: `docker-compose logs worker`
- Restart worker: `docker-compose restart worker`
- Check Redis connection in worker logs

---

## 📞 Ready for Week 2?

Once Week 1 is complete:
- [ ] Demo to first potential client
- [ ] Start building simple React dashboard
- [ ] Add AI caption generation
- [ ] Begin pre-sales conversations

**You'll have a working LinkedIn automation system ready for client demos!**

---

## 🆘 Need Help?

**Technical Issues**:
- Check `/docs` folder for detailed guides
- Review error logs in `logs/` directory
- Test each component individually

**Business Questions**:
- Start reaching out to agency contacts
- Prepare demo script for LinkedIn automation
- Plan pricing: $200-500/month for Phase 1

**The foundation is built. Time to make it work! 🚀**
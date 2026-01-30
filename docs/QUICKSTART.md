# Quick Start Guide

## Prerequisites Checklist

### **Required Accounts & API Keys**
- [ ] **LinkedIn Developer Account** → [Apply Here](https://www.linkedin.com/developers/apps)
  - Create new app for "Sign In with LinkedIn" and "Marketing Developer Platform"
  - Note: Client ID and Client Secret
  - Set redirect URI: `http://localhost:3000/auth/linkedin/callback`

- [ ] **OpenAI API Account** → [Get Key](https://platform.openai.com/api-keys)
  - Minimum $5 credit for testing
  - GPT-4 access recommended

- [ ] **AWS Account** (for production deployment)
  - RDS, ECS, S3, ElastiCache access
  - IAM user with appropriate permissions

### **Development Environment**
```bash
# Check versions
node --version  # Need 18+
npm --version   # Need 8+
docker --version
psql --version  # PostgreSQL 14+
```

## Step 1: Project Setup

### **Clone and Install**
```bash
# Create the project
mkdir social-media-automation
cd social-media-automation

# Initialize package.json
npm init -y

# Install core dependencies
npm install express prisma @prisma/client bullmq ioredis
npm install linkedin-api-client openai multer sharp
npm install bcryptjs jsonwebtoken cors helmet
npm install dotenv winston

# Install dev dependencies  
npm install -D nodemon jest supertest cypress
npm install -D @types/node @types/express typescript
npm install -D eslint prettier husky
```

### **Environment Setup**
```bash
# Create environment file
cp .env.example .env
```

**.env file template:**
```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/socialmedia"
REDIS_URL="redis://localhost:6379"

# LinkedIn API
LINKEDIN_CLIENT_ID="your_linkedin_client_id"
LINKEDIN_CLIENT_SECRET="your_linkedin_client_secret"
LINKEDIN_REDIRECT_URI="http://localhost:3000/auth/linkedin/callback"

# OpenAI
OPENAI_API_KEY="sk-your_openai_key"

# App Config
JWT_SECRET="your_jwt_secret_key_here"
APP_PORT=3000
NODE_ENV="development"

# AWS (for production)
AWS_ACCESS_KEY_ID="your_aws_key"
AWS_SECRET_ACCESS_KEY="your_aws_secret"
AWS_REGION="us-east-1"
S3_BUCKET_NAME="your-app-media-bucket"
```

## Step 2: Database Setup

### **PostgreSQL Installation**
```bash
# macOS with Homebrew
brew install postgresql
brew services start postgresql

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database
createdb socialmedia
```

### **Redis Installation**
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian  
sudo apt install redis-server
sudo systemctl start redis-server
```

### **Prisma Database Schema**
Create `prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String         @id @default(cuid())
  email         String         @unique
  name          String?
  company       String?
  passwordHash  String
  role          Role           @default(USER)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  
  socialAccounts SocialAccount[]
  contentPosts   ContentPost[]
  
  @@map("users")
}

model SocialAccount {
  id           String   @id @default(cuid())
  userId       String
  platform     Platform
  accountId    String
  accountName  String
  accessToken  String
  refreshToken String?
  expiresAt    DateTime?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, platform, accountId])
  @@map("social_accounts")
}

model ContentPost {
  id          String      @id @default(cuid())
  userId      String
  title       String?
  content     String
  mediaUrls   String[]
  platforms   Platform[]
  status      PostStatus  @default(DRAFT)
  scheduledFor DateTime?
  publishedAt DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("content_posts")
}

enum Role {
  USER
  ADMIN
}

enum Platform {
  LINKEDIN
  INSTAGRAM
  TIKTOK
  FACEBOOK
}

enum PostStatus {
  DRAFT
  SCHEDULED
  PUBLISHED
  FAILED
}
```

### **Initialize Database**
```bash
# Generate Prisma client
npx prisma generate

# Create and run migrations
npx prisma db push

# (Optional) Open Prisma Studio
npx prisma studio
```

## Step 3: Basic Server Setup

### **Create server structure:**
```bash
mkdir -p src/{routes,services,middleware,utils}
mkdir -p src/{models,controllers,jobs}
touch src/app.js src/server.js
```

### **Basic Express App (`src/app.js`)**
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;
```

### **Start the server (`src/server.js`)**
```javascript
const app = require('./app');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PORT = process.env.APP_PORT || 3000;

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
```

## Step 4: Test Your Setup

### **Run the development server:**
```bash
npm run dev
# or
node src/server.js
```

### **Test endpoints:**
```bash
# Health check
curl http://localhost:3000/health

# Should return:
# {"status":"ok","timestamp":"2026-01-29T..."}
```

### **Add to package.json scripts:**
```json
{
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "test": "jest",
    "prisma:studio": "npx prisma studio"
  }
}
```

## Step 5: LinkedIn Integration (Next)

Once your basic server is running, you're ready to add LinkedIn OAuth and posting capabilities. The next steps will be:

1. **LinkedIn OAuth Flow** - User authentication and token storage
2. **LinkedIn Posting API** - Text and image posting
3. **Job Queue Setup** - Scheduling system with BullMQ
4. **Basic Dashboard** - React frontend for content management

---

**✅ Setup Complete!** Your development environment is ready for Phase 1 LinkedIn integration. 

**Next**: Follow the LinkedIn integration guide in `/docs/LINKEDIN_INTEGRATION.md`
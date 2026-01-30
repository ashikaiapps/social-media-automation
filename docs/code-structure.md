# Social Media Automation System - Complete Project Structure

## Project Root Structure

```
social-media-automation/
├── README.md                          # Project overview and quick start
├── docker-compose.dev.yml             # Development environment
├── docker-compose.prod.yml            # Production environment
├── package.json                       # Root package.json for workspace
├── tsconfig.json                      # TypeScript configuration
├── .env.example                       # Environment variables template
├── .gitignore                         # Git ignore rules
└── .github/
    └── workflows/
        ├── ci.yml                     # Continuous integration
        ├── deploy-staging.yml         # Staging deployment
        └── deploy-production.yml      # Production deployment

# Core Services
├── services/
    ├── api/                           # Main API service (Clawdbot Skill)
    │   ├── src/
    │   │   ├── controllers/           # HTTP request handlers
    │   │   ├── services/              # Business logic
    │   │   ├── models/                # Database models
    │   │   ├── middlewares/           # Express middlewares
    │   │   ├── routes/                # API routes
    │   │   ├── utils/                 # Utility functions
    │   │   └── app.ts                 # Express app setup
    │   ├── Dockerfile                 # Container definition
    │   ├── package.json               # API dependencies
    │   └── tsconfig.json              # TypeScript config
    │
    ├── scheduler/                     # Background job scheduler
    │   ├── src/
    │   │   ├── jobs/                  # Job definitions
    │   │   ├── processors/            # Job processors
    │   │   ├── utils/                 # Utilities
    │   │   └── index.ts               # Entry point
    │   ├── Dockerfile
    │   └── package.json
    │
    ├── media-processor/               # Media processing service
    │   ├── src/
    │   │   ├── processors/            # Media processing logic
    │   │   ├── optimizers/            # Platform-specific optimizers
    │   │   ├── storage/               # File storage handlers
    │   │   └── index.ts
    │   ├── Dockerfile
    │   └── package.json
    │
    └── analytics-collector/           # Analytics data collection
        ├── src/
        │   ├── collectors/            # Platform-specific collectors
        │   ├── aggregators/           # Data aggregation
        │   └── index.ts
        ├── Dockerfile
        └── package.json

# Frontend Dashboard
├── dashboard/                         # React dashboard application
    ├── src/
    │   ├── components/                # Reusable UI components
    │   ├── pages/                     # Next.js pages
    │   ├── hooks/                     # Custom React hooks
    │   ├── utils/                     # Utility functions
    │   ├── styles/                    # CSS and styling
    │   └── types/                     # TypeScript type definitions
    ├── public/                        # Static assets
    ├── next.config.js                 # Next.js configuration
    ├── tailwind.config.js             # Tailwind CSS config
    ├── package.json
    └── tsconfig.json

# Shared Libraries
├── packages/
    ├── core/                          # Shared core logic
    │   ├── src/
    │   │   ├── types/                 # Common type definitions
    │   │   ├── interfaces/            # Shared interfaces
    │   │   ├── constants/             # Application constants
    │   │   └── utils/                 # Shared utilities
    │   ├── package.json
    │   └── tsconfig.json
    │
    ├── platform-apis/                 # Platform API wrappers
    │   ├── src/
    │   │   ├── linkedin/              # LinkedIn API wrapper
    │   │   ├── instagram/             # Instagram API wrapper
    │   │   ├── tiktok/                # TikTok API wrapper
    │   │   ├── facebook/              # Facebook API wrapper
    │   │   └── base/                  # Base API client
    │   └── package.json
    │
    └── database/                      # Database schema and utilities
        ├── prisma/
        │   ├── schema.prisma           # Prisma schema
        │   ├── migrations/             # Database migrations
        │   └── seeds/                  # Seed data
        ├── src/
        │   ├── client.ts               # Prisma client setup
        │   └── seed.ts                 # Seeding script
        └── package.json

# Infrastructure & Config
├── infrastructure/
    ├── aws/                           # AWS CloudFormation/CDK
    │   ├── cloudformation/            # CloudFormation templates
    │   ├── cdk/                       # AWS CDK infrastructure
    │   └── scripts/                   # Deployment scripts
    │
    ├── docker/                        # Docker configurations
    │   ├── nginx/                     # Nginx configuration
    │   └── monitoring/                # Monitoring setup
    │
    └── k8s/                          # Kubernetes manifests (optional)
        ├── deployments/
        ├── services/
        └── configmaps/

# Documentation
├── docs/                             # ✅ Already created
    ├── technical-architecture.md    # ✅ System design
    ├── platform-apis.md            # ✅ API research
    ├── implementation-plan.md       # ✅ Development roadmap
    ├── database-schema.md           # ✅ Database design
    ├── deployment-strategy.md       # ✅ Infrastructure guide
    ├── api-documentation.md        # API endpoints documentation
    ├── user-guide.md               # End-user documentation
    └── contributing.md             # Development guidelines

# Testing
├── tests/
    ├── integration/                  # Integration tests
    ├── e2e/                         # End-to-end tests
    ├── performance/                 # Load testing
    └── fixtures/                    # Test data
    
# Scripts & Tools
├── scripts/
    ├── setup.sh                     # Project setup script
    ├── deploy.sh                    # Deployment script
    ├── backup.sh                    # Backup script
    └── monitor.sh                   # Monitoring script

# Configuration Files
├── config/
    ├── development.json             # Development config
    ├── staging.json                 # Staging config
    ├── production.json              # Production config
    └── clawdbot-skill.yml          # Clawdbot skill configuration
```

## Key Implementation Files

### 1. Core API Service Structure

```typescript
// services/api/src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth';
import { postsRouter } from './routes/posts';
import { accountsRouter } from './routes/accounts';
import { analyticsRouter } from './routes/analytics';
import { errorHandler } from './middlewares/error';
import { logger } from './utils/logger';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/posts', postsRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/analytics', analyticsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

export { app };
```

### 2. Platform API Wrapper Example

```typescript
// packages/platform-apis/src/linkedin/client.ts
import { BaseAPIClient } from '../base/client';
import { PlatformPost, PostResult, MediaFile } from '@social-automation/core/types';

export class LinkedInAPIClient extends BaseAPIClient {
  private readonly baseURL = 'https://api.linkedin.com';
  
  constructor(accessToken: string) {
    super(accessToken);
  }

  async createPost(post: PlatformPost): Promise<PostResult> {
    const linkedInPost = {
      author: post.authorUrn,
      commentary: post.content,
      visibility: post.visibility || 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: post.targetAudience || [],
        thirdPartyDistributionChannels: []
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
      ...(post.media && { content: await this.formatMedia(post.media) })
    };

    try {
      const response = await this.post('/rest/posts', linkedInPost, {
        headers: {
          'LinkedIn-Version': '202501',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });

      return {
        platformPostId: response.headers['x-restli-id'],
        status: 'published',
        url: `https://www.linkedin.com/feed/update/${response.headers['x-restli-id']}/`,
        publishedAt: new Date()
      };
    } catch (error) {
      throw this.handleAPIError(error, 'linkedin');
    }
  }

  async uploadMedia(file: MediaFile): Promise<string> {
    // Implementation for LinkedIn media upload
    const uploadResponse = await this.post('/rest/images', {
      initializeUploadRequest: {
        owner: file.ownerUrn
      }
    });

    const uploadUrl = uploadResponse.value.uploadUrl;
    const imageUrn = uploadResponse.value.image;

    // Upload binary data
    await this.uploadBinary(uploadUrl, file.buffer, file.mimeType);

    return imageUrn;
  }

  private async formatMedia(media: MediaFile[]): Promise<any> {
    if (media.length === 1) {
      const mediaUrn = await this.uploadMedia(media[0]);
      return {
        media: {
          id: mediaUrn,
          title: media[0].title || '',
          altText: media[0].altText || ''
        }
      };
    }

    // Handle multiple images (MultiImage)
    const imageUrns = await Promise.all(
      media.map(file => this.uploadMedia(file))
    );

    return {
      multiImage: {
        images: imageUrns.map((urn, index) => ({
          id: urn,
          altText: media[index].altText || ''
        }))
      }
    };
  }
}
```

### 3. Scheduling Service

```typescript
// services/scheduler/src/jobs/postPublisher.ts
import { Job, Worker } from 'bullmq';
import { PrismaClient } from '@social-automation/database';
import { platformAPIFactory } from '@social-automation/platform-apis';
import { logger } from '../utils/logger';

interface PostPublishJob {
  postId: string;
  accountId: string;
  platform: string;
}

const prisma = new PrismaClient();

export const postPublisherWorker = new Worker(
  'post-publisher',
  async (job: Job<PostPublishJob>) => {
    const { postId, accountId, platform } = job.data;
    
    try {
      // Get post and account details
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
          mediaFiles: true,
          client: true
        }
      });

      const account = await prisma.account.findUnique({
        where: { id: accountId },
        include: {
          tokens: true
        }
      });

      if (!post || !account) {
        throw new Error('Post or account not found');
      }

      // Get platform-specific content
      const platformContent = post.contentVariations[platform] || post.content;
      
      // Initialize platform API client
      const apiClient = platformAPIFactory.create(
        platform,
        account.tokens.accessToken
      );

      // Prepare media files
      const mediaFiles = await Promise.all(
        post.mediaFiles.map(async (media) => ({
          ...media,
          buffer: await getMediaBuffer(media.storagePath),
          platformVersion: media.platformVersions[platform]
        }))
      );

      // Publish post
      const result = await apiClient.createPost({
        content: platformContent,
        media: mediaFiles,
        settings: post.postSettings
      });

      // Update post platform status
      await prisma.postPlatform.update({
        where: {
          postId_accountId: {
            postId,
            accountId
          }
        },
        data: {
          platformPostId: result.platformPostId,
          status: 'published',
          publishedAt: result.publishedAt,
          platformData: result.metadata || {}
        }
      });

      // Log success
      logger.info('Post published successfully', {
        postId,
        platform,
        platformPostId: result.platformPostId
      });

      return result;

    } catch (error) {
      // Update status to failed
      await prisma.postPlatform.update({
        where: {
          postId_accountId: {
            postId,
            accountId
          }
        },
        data: {
          status: 'failed',
          errorMessage: error.message
        }
      });

      logger.error('Post publishing failed', {
        postId,
        platform,
        error: error.message
      });

      throw error;
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    },
    concurrency: 5,
    removeOnComplete: 100,
    removeOnFail: 50
  }
);

// Helper function to get media buffer
async function getMediaBuffer(storagePath: string): Promise<Buffer> {
  // Implementation depends on storage backend (S3, local filesystem, etc.)
  if (storagePath.startsWith('s3://')) {
    // AWS S3 implementation
    return getS3Object(storagePath);
  } else {
    // Local filesystem implementation
    return fs.readFileSync(storagePath);
  }
}
```

### 4. Dashboard Component Example

```typescript
// dashboard/src/components/PostCreator.tsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Select } from './ui/select';
import { DateTimePicker } from './ui/datetime-picker';
import { MediaUploader } from './MediaUploader';
import { PlatformSelector } from './PlatformSelector';
import { useCreatePost } from '../hooks/useApi';

const postSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  platforms: z.array(z.string()).min(1, 'Select at least one platform'),
  scheduledAt: z.date().optional(),
  media: z.array(z.any()).optional()
});

type PostFormData = z.infer<typeof postSchema>;

export function PostCreator() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  
  const createPost = useCreatePost();
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue
  } = useForm<PostFormData>({
    resolver: zodResolver(postSchema)
  });

  const content = watch('content', '');

  const onSubmit = async (data: PostFormData) => {
    try {
      const formData = new FormData();
      formData.append('content', data.content);
      formData.append('platforms', JSON.stringify(data.platforms));
      
      if (data.scheduledAt) {
        formData.append('scheduledAt', data.scheduledAt.toISOString());
      }

      mediaFiles.forEach((file, index) => {
        formData.append(`media[${index}]`, file);
      });

      await createPost.mutateAsync(formData);
      
      // Reset form or redirect
    } catch (error) {
      console.error('Failed to create post:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Create New Post</h1>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Content Input */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Post Content
          </label>
          <Textarea
            {...register('content')}
            placeholder="What would you like to share?"
            className="min-h-32"
            maxLength={2200}
          />
          {errors.content && (
            <p className="text-red-500 text-sm mt-1">
              {errors.content.message}
            </p>
          )}
          <div className="text-right text-sm text-gray-500 mt-1">
            {content.length}/2200
          </div>
        </div>

        {/* Platform Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Platforms
          </label>
          <PlatformSelector
            selected={selectedPlatforms}
            onChange={(platforms) => {
              setSelectedPlatforms(platforms);
              setValue('platforms', platforms);
            }}
          />
        </div>

        {/* Media Upload */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Media (Optional)
          </label>
          <MediaUploader
            files={mediaFiles}
            onChange={setMediaFiles}
            platforms={selectedPlatforms}
          />
        </div>

        {/* Scheduling */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Schedule (Optional)
          </label>
          <DateTimePicker
            value={watch('scheduledAt')}
            onChange={(date) => setValue('scheduledAt', date)}
            minDate={new Date()}
          />
        </div>

        {/* Preview Section */}
        {content && selectedPlatforms.length > 0 && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-medium mb-2">Preview</h3>
            {selectedPlatforms.map((platform) => (
              <PostPreview
                key={platform}
                platform={platform}
                content={content}
                media={mediaFiles}
              />
            ))}
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex space-x-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Publishing...' : 'Publish Now'}
          </Button>
          
          <Button
            type="submit"
            variant="outline"
            disabled={isSubmitting || !watch('scheduledAt')}
            className="flex-1"
          >
            {isSubmitting ? 'Scheduling...' : 'Schedule Post'}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

### 5. Clawdbot Skill Configuration

```yaml
# config/clawdbot-skill.yml
skill:
  name: "social-media-automation"
  displayName: "Social Media Automation"
  description: "Automated posting and management for LinkedIn, Instagram, TikTok, and Facebook"
  version: "1.0.0"
  author: "Ashik.ai Agency"
  
  # Skill type and integration
  type: "api-service"
  category: "marketing"
  
  # API endpoints exposed to Clawdbot
  endpoints:
    - path: "/api/posts"
      methods: ["GET", "POST", "PUT", "DELETE"]
      auth: "required"
      rateLimit: "100/hour"
      
    - path: "/api/posts/schedule"
      methods: ["POST"]
      auth: "required"
      rateLimit: "50/hour"
      
    - path: "/api/accounts"
      methods: ["GET", "POST", "DELETE"]
      auth: "required"
      rateLimit: "20/hour"
      
    - path: "/api/analytics"
      methods: ["GET"]
      auth: "required"
      rateLimit: "30/hour"

  # Required permissions
  permissions:
    - "web_access"        # For API calls to social platforms
    - "file_storage"      # For media file handling
    - "database"          # For data persistence
    - "scheduler"         # For cron job scheduling
    - "notifications"     # For status updates

  # Environment variables required
  environment:
    - name: "DATABASE_URL"
      required: true
      description: "PostgreSQL connection string"
      
    - name: "REDIS_URL"
      required: true
      description: "Redis connection string for caching and jobs"
      
    - name: "AWS_ACCESS_KEY_ID"
      required: false
      description: "AWS access key for S3 storage"
      
    - name: "OPENAI_API_KEY"
      required: false
      description: "OpenAI API key for content generation"

  # Clawdbot integration commands
  commands:
    - name: "post"
      description: "Create and publish a social media post"
      usage: "/social post \"Your content here\" --platforms linkedin,instagram --schedule \"2024-01-30 15:00\""
      
    - name: "schedule"
      description: "Schedule a post for later"
      usage: "/social schedule \"Content\" --platforms all --time \"tomorrow 9am\""
      
    - name: "analytics"
      description: "Get analytics for recent posts"
      usage: "/social analytics --timeframe 7d --platform linkedin"
      
    - name: "accounts"
      description: "Manage connected social media accounts"
      usage: "/social accounts --list or --connect linkedin"

  # Webhook endpoints for real-time updates
  webhooks:
    - path: "/webhooks/post-status"
      description: "Receive post status updates"
      
    - path: "/webhooks/platform-auth"
      description: "Handle OAuth authentication callbacks"

  # Health check configuration
  health:
    endpoint: "/health"
    timeout: 5000
    interval: 30000

  # Resource requirements
  resources:
    cpu: "500m"
    memory: "1Gi"
    storage: "5Gi"
    
  # Scaling configuration
  scaling:
    minReplicas: 1
    maxReplicas: 10
    targetCPUUtilization: 70
    targetMemoryUtilization: 80
```

### 6. Docker Configuration

```dockerfile
# services/api/Dockerfile
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    ffmpeg \
    imagemagick \
    curl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/*/package.json ./packages/*/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
```

This comprehensive project structure provides a solid foundation for building the social media automation system as a Clawdbot skill with all the necessary components, documentation, and configuration files for production deployment.
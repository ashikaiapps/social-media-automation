# Testing & Quality Assurance Strategy

## Testing Framework Overview

Comprehensive testing strategy ensuring reliability, performance, and security across all system components.

## Testing Pyramid Structure

```
                   ┌─────────────────┐
                   │   E2E Tests     │  ←  Small quantity, high confidence
                   │   (Playwright)  │
                   └─────────────────┘
                 ┌───────────────────────┐
                 │  Integration Tests    │  ←  Medium quantity, medium confidence
                 │  (Jest + Supertest)   │
                 └───────────────────────┘
               ┌─────────────────────────────┐
               │      Unit Tests             │  ←  Large quantity, fast feedback
               │   (Jest + Testing Library)  │
               └─────────────────────────────┘
```

## Unit Testing Strategy

### Backend Services (API, Scheduler, Media Processor)

**Test Framework:** Jest + TypeScript
**Coverage Target:** 85%+ line coverage
**Mock Strategy:** Dependency injection with interfaces

```typescript
// services/api/src/services/__tests__/postService.test.ts
import { PostService } from '../postService';
import { MockPrismaClient } from '../../__mocks__/prisma';
import { MockPlatformAPIFactory } from '../../__mocks__/platformAPI';

describe('PostService', () => {
  let postService: PostService;
  let mockPrisma: MockPrismaClient;
  let mockAPIFactory: MockPlatformAPIFactory;

  beforeEach(() => {
    mockPrisma = new MockPrismaClient();
    mockAPIFactory = new MockPlatformAPIFactory();
    postService = new PostService(mockPrisma, mockAPIFactory);
  });

  describe('createPost', () => {
    it('should create a post with valid data', async () => {
      const postData = {
        content: 'Test post content',
        platforms: ['linkedin', 'instagram'],
        clientId: 'client-123'
      };

      mockPrisma.post.create.mockResolvedValueOnce({
        id: 'post-123',
        ...postData,
        status: 'draft',
        createdAt: new Date()
      });

      const result = await postService.createPost(postData);

      expect(result.id).toBe('post-123');
      expect(mockPrisma.post.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: postData.content,
          clientId: postData.clientId,
          status: 'draft'
        })
      });
    });

    it('should throw error for invalid platform', async () => {
      const postData = {
        content: 'Test content',
        platforms: ['invalid-platform'],
        clientId: 'client-123'
      };

      await expect(postService.createPost(postData))
        .rejects
        .toThrow('Invalid platform: invalid-platform');
    });

    it('should validate content length for each platform', async () => {
      const longContent = 'a'.repeat(3001); // Exceeds LinkedIn limit
      
      const postData = {
        content: longContent,
        platforms: ['linkedin'],
        clientId: 'client-123'
      };

      await expect(postService.createPost(postData))
        .rejects
        .toThrow('Content exceeds LinkedIn character limit');
    });
  });

  describe('schedulePost', () => {
    it('should schedule post for future publishing', async () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      
      const postData = {
        id: 'post-123',
        scheduledAt: futureDate,
        platforms: ['linkedin']
      };

      mockPrisma.post.update.mockResolvedValueOnce({
        ...postData,
        status: 'scheduled'
      });

      const result = await postService.schedulePost(postData);

      expect(result.status).toBe('scheduled');
      expect(mockPrisma.post.update).toHaveBeenCalledWith({
        where: { id: 'post-123' },
        data: {
          scheduledAt: futureDate,
          status: 'scheduled'
        }
      });
    });

    it('should not allow scheduling in the past', async () => {
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
      
      const postData = {
        id: 'post-123',
        scheduledAt: pastDate,
        platforms: ['linkedin']
      };

      await expect(postService.schedulePost(postData))
        .rejects
        .toThrow('Cannot schedule post in the past');
    });
  });
});
```

### Platform API Clients

```typescript
// packages/platform-apis/src/linkedin/__tests__/client.test.ts
import { LinkedInAPIClient } from '../client';
import { MockHTTPClient } from '../../__mocks__/httpClient';

describe('LinkedInAPIClient', () => {
  let client: LinkedInAPIClient;
  let mockHttp: MockHTTPClient;

  beforeEach(() => {
    mockHttp = new MockHTTPClient();
    client = new LinkedInAPIClient('mock-token');
    client.setHttpClient(mockHttp);
  });

  describe('createPost', () => {
    it('should create text-only post successfully', async () => {
      const postData = {
        content: 'Hello LinkedIn!',
        authorUrn: 'urn:li:organization:123456',
        visibility: 'PUBLIC'
      };

      mockHttp.post.mockResolvedValueOnce({
        data: {},
        headers: {
          'x-restli-id': 'urn:li:share:6844785523593134080'
        }
      });

      const result = await client.createPost(postData);

      expect(result.platformPostId).toBe('urn:li:share:6844785523593134080');
      expect(result.status).toBe('published');
      expect(mockHttp.post).toHaveBeenCalledWith(
        '/rest/posts',
        expect.objectContaining({
          author: postData.authorUrn,
          commentary: postData.content,
          visibility: 'PUBLIC',
          lifecycleState: 'PUBLISHED'
        }),
        expect.objectContaining({
          headers: {
            'LinkedIn-Version': '202501',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        })
      );
    });

    it('should handle rate limiting errors', async () => {
      mockHttp.post.mockRejectedValueOnce({
        response: {
          status: 429,
          data: {
            message: 'Rate limit exceeded'
          },
          headers: {
            'retry-after': '60'
          }
        }
      });

      await expect(client.createPost({
        content: 'Test',
        authorUrn: 'urn:li:organization:123456'
      })).rejects.toMatchObject({
        type: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 60
      });
    });

    it('should upload and attach media files', async () => {
      const postData = {
        content: 'Post with image',
        authorUrn: 'urn:li:organization:123456',
        media: [{
          buffer: Buffer.from('fake-image-data'),
          filename: 'test.jpg',
          mimeType: 'image/jpeg'
        }]
      };

      // Mock image upload response
      mockHttp.post
        .mockResolvedValueOnce({ // Upload initialization
          value: {
            uploadUrl: 'https://upload.linkedin.com/...',
            image: 'urn:li:image:C49klciosC89'
          }
        })
        .mockResolvedValueOnce({ // Post creation
          data: {},
          headers: { 'x-restli-id': 'urn:li:share:123' }
        });

      mockHttp.put.mockResolvedValueOnce({}); // Binary upload

      const result = await client.createPost(postData);

      expect(mockHttp.post).toHaveBeenCalledWith('/rest/images', expect.any(Object));
      expect(mockHttp.put).toHaveBeenCalledWith(
        'https://upload.linkedin.com/...',
        postData.media[0].buffer,
        expect.objectContaining({
          headers: { 'Content-Type': 'image/jpeg' }
        })
      );
      expect(result.platformPostId).toBe('urn:li:share:123');
    });
  });

  describe('error handling', () => {
    it('should handle authentication errors', async () => {
      mockHttp.post.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      });

      await expect(client.createPost({
        content: 'Test',
        authorUrn: 'urn:li:organization:123456'
      })).rejects.toMatchObject({
        type: 'INVALID_TOKEN'
      });
    });

    it('should handle content policy violations', async () => {
      mockHttp.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            message: 'Content violates community guidelines'
          }
        }
      });

      await expect(client.createPost({
        content: 'Inappropriate content',
        authorUrn: 'urn:li:organization:123456'
      })).rejects.toMatchObject({
        type: 'CONTENT_POLICY_VIOLATION'
      });
    });
  });
});
```

## Integration Testing Strategy

### API Endpoint Testing

```typescript
// services/api/src/__tests__/integration/posts.test.ts
import request from 'supertest';
import { app } from '../../app';
import { PrismaClient } from '@social-automation/database';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestUser, createTestClient } from '../fixtures/users';

describe('POST /api/posts', () => {
  let prisma: PrismaClient;
  let authToken: string;
  let clientId: string;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
    const { user, token } = await createTestUser(prisma);
    const client = await createTestClient(prisma, user.id);
    authToken = token;
    clientId = client.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase(prisma);
  });

  beforeEach(async () => {
    // Clean up posts between tests
    await prisma.post.deleteMany({});
  });

  it('should create a new post successfully', async () => {
    const postData = {
      content: 'Integration test post',
      platforms: ['linkedin'],
      clientId: clientId
    };

    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send(postData)
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      content: postData.content,
      status: 'draft',
      platforms: postData.platforms
    });

    // Verify in database
    const createdPost = await prisma.post.findUnique({
      where: { id: response.body.id }
    });
    expect(createdPost).toBeTruthy();
    expect(createdPost?.content).toBe(postData.content);
  });

  it('should handle file uploads for media posts', async () => {
    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .field('content', 'Post with image')
      .field('platforms', 'linkedin,instagram')
      .field('clientId', clientId)
      .attach('media[0]', Buffer.from('fake-image-data'), 'test.jpg')
      .expect(201);

    expect(response.body.mediaFiles).toHaveLength(1);
    expect(response.body.mediaFiles[0]).toMatchObject({
      filename: expect.stringContaining('.jpg'),
      mimeType: 'image/jpeg',
      mediaType: 'image'
    });
  });

  it('should validate required fields', async () => {
    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({}) // Empty payload
      .expect(400);

    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'content' }),
        expect.objectContaining({ field: 'platforms' }),
        expect.objectContaining({ field: 'clientId' })
      ])
    );
  });

  it('should require authentication', async () => {
    await request(app)
      .post('/api/posts')
      .send({
        content: 'Test post',
        platforms: ['linkedin'],
        clientId: clientId
      })
      .expect(401);
  });

  it('should enforce rate limiting', async () => {
    const postData = {
      content: 'Rate limit test',
      platforms: ['linkedin'],
      clientId: clientId
    };

    // Make requests up to the rate limit
    const requests = Array(101).fill(null).map(() =>
      request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData)
    );

    const responses = await Promise.all(requests);
    
    // Last request should be rate limited
    expect(responses[100].status).toBe(429);
    expect(responses[100].body.message).toContain('rate limit');
  });
});

describe('POST /api/posts/:id/schedule', () => {
  let prisma: PrismaClient;
  let authToken: string;
  let postId: string;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
    const { user, token } = await createTestUser(prisma);
    const client = await createTestClient(prisma, user.id);
    authToken = token;
    
    // Create a test post
    const post = await prisma.post.create({
      data: {
        content: 'Test post for scheduling',
        clientId: client.id,
        status: 'draft'
      }
    });
    postId = post.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase(prisma);
  });

  it('should schedule a post for future publishing', async () => {
    const scheduleTime = new Date(Date.now() + 3600000); // 1 hour from now

    const response = await request(app)
      .post(`/api/posts/${postId}/schedule`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        scheduledAt: scheduleTime.toISOString(),
        platforms: ['linkedin']
      })
      .expect(200);

    expect(response.body.status).toBe('scheduled');
    expect(new Date(response.body.scheduledAt)).toEqual(scheduleTime);
    
    // Verify job was queued
    // (This would require integration with the actual job queue)
  });

  it('should not allow scheduling in the past', async () => {
    const pastTime = new Date(Date.now() - 3600000); // 1 hour ago

    const response = await request(app)
      .post(`/api/posts/${postId}/schedule`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        scheduledAt: pastTime.toISOString(),
        platforms: ['linkedin']
      })
      .expect(400);

    expect(response.body.message).toContain('past');
  });
});
```

### Database Integration Tests

```typescript
// packages/database/src/__tests__/integration/relationships.test.ts
import { PrismaClient } from '@prisma/client';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/database';

describe('Database Relationships', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase(prisma);
  });

  beforeEach(async () => {
    // Clean up data between tests
    await prisma.postAnalytics.deleteMany();
    await prisma.postPlatform.deleteMany();
    await prisma.mediaFile.deleteMany();
    await prisma.post.deleteMany();
    await prisma.platformToken.deleteMany();
    await prisma.account.deleteMany();
    await prisma.client.deleteMany();
    await prisma.agency.deleteMany();
  });

  it('should cascade delete client data when agency is deleted', async () => {
    // Create agency with client and posts
    const agency = await prisma.agency.create({
      data: {
        name: 'Test Agency',
        email: 'test@agency.com',
        clients: {
          create: {
            name: 'Test Client',
            industry: 'Technology',
            posts: {
              create: {
                content: 'Test post',
                status: 'draft'
              }
            }
          }
        }
      }
    });

    // Verify data exists
    let posts = await prisma.post.findMany();
    expect(posts).toHaveLength(1);

    // Delete agency
    await prisma.agency.delete({ where: { id: agency.id } });

    // Verify cascading deletion
    posts = await prisma.post.findMany();
    expect(posts).toHaveLength(0);

    const clients = await prisma.client.findMany();
    expect(clients).toHaveLength(0);
  });

  it('should maintain referential integrity for post platforms', async () => {
    const agency = await prisma.agency.create({
      data: {
        name: 'Test Agency',
        email: 'test@agency.com',
        clients: {
          create: {
            name: 'Test Client',
            accounts: {
              create: {
                platform: 'linkedin',
                platformAccountId: '123456',
                username: 'testuser'
              }
            },
            posts: {
              create: {
                content: 'Test post',
                status: 'published'
              }
            }
          }
        }
      },
      include: {
        clients: {
          include: {
            accounts: true,
            posts: true
          }
        }
      }
    });

    const client = agency.clients[0];
    const account = client.accounts[0];
    const post = client.posts[0];

    // Create post platform entry
    const postPlatform = await prisma.postPlatform.create({
      data: {
        postId: post.id,
        accountId: account.id,
        status: 'published',
        platformPostId: 'platform-123'
      }
    });

    // Add analytics
    await prisma.postAnalytics.create({
      data: {
        postPlatformId: postPlatform.id,
        metricName: 'likes',
        metricValue: 25,
        recordedAt: new Date()
      }
    });

    // Verify relationships
    const postWithPlatforms = await prisma.post.findUnique({
      where: { id: post.id },
      include: {
        postPlatforms: {
          include: {
            analytics: true,
            account: true
          }
        }
      }
    });

    expect(postWithPlatforms?.postPlatforms).toHaveLength(1);
    expect(postWithPlatforms?.postPlatforms[0].analytics).toHaveLength(1);
    expect(postWithPlatforms?.postPlatforms[0].account.username).toBe('testuser');
  });
});
```

## End-to-End Testing Strategy

### Frontend-Backend Integration Tests

```typescript
// tests/e2e/post-creation.spec.ts
import { test, expect } from '@playwright/test';
import { setupE2EEnvironment, cleanupE2EEnvironment } from './helpers/setup';

test.describe('Post Creation Flow', () => {
  test.beforeAll(async () => {
    await setupE2EEnvironment();
  });

  test.afterAll(async () => {
    await cleanupE2EEnvironment();
  });

  test('should create and publish a post successfully', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@agency.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');

    // Navigate to post creation
    await page.waitForURL('/dashboard');
    await page.click('[data-testid=create-post-button]');

    // Fill out post form
    await page.fill('[data-testid=post-content]', 'This is a test post created via E2E testing');
    
    // Select platforms
    await page.check('[data-testid=platform-linkedin]');
    await page.check('[data-testid=platform-instagram]');

    // Upload media
    const fileInput = page.locator('[data-testid=media-upload] input[type=file]');
    await fileInput.setInputFiles('./tests/fixtures/test-image.jpg');
    
    // Wait for upload to complete
    await expect(page.locator('[data-testid=media-preview]')).toBeVisible();

    // Preview should show platform-specific formatting
    await expect(page.locator('[data-testid=preview-linkedin]')).toBeVisible();
    await expect(page.locator('[data-testid=preview-instagram]')).toBeVisible();

    // Publish post
    await page.click('[data-testid=publish-button]');

    // Wait for success message
    await expect(page.locator('[data-testid=success-message]')).toContainText('Post published successfully');

    // Verify post appears in posts list
    await page.goto('/posts');
    await expect(page.locator('[data-testid=post-item]').first()).toContainText('This is a test post created via E2E testing');
  });

  test('should schedule a post for future publishing', async ({ page }) => {
    await page.goto('/posts/create');

    // Fill basic post data
    await page.fill('[data-testid=post-content]', 'Scheduled post via E2E testing');
    await page.check('[data-testid=platform-linkedin]');

    // Set future date
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 2);
    
    await page.fill('[data-testid=schedule-date]', futureDate.toISOString().slice(0, 16));

    // Schedule post
    await page.click('[data-testid=schedule-button]');

    // Verify scheduling
    await expect(page.locator('[data-testid=success-message]')).toContainText('Post scheduled');

    // Check scheduled posts
    await page.goto('/posts?filter=scheduled');
    await expect(page.locator('[data-testid=scheduled-post]').first()).toContainText('Scheduled post via E2E testing');
  });

  test('should handle media upload errors gracefully', async ({ page }) => {
    await page.goto('/posts/create');

    // Try to upload invalid file
    const fileInput = page.locator('[data-testid=media-upload] input[type=file]');
    await fileInput.setInputFiles('./tests/fixtures/invalid-file.txt');

    // Should show error message
    await expect(page.locator('[data-testid=upload-error]')).toContainText('Invalid file type');
    
    // Should not allow publishing
    await expect(page.locator('[data-testid=publish-button]')).toBeDisabled();
  });
});

test.describe('Account Management', () => {
  test('should connect LinkedIn account via OAuth', async ({ page, context }) => {
    await page.goto('/accounts');
    
    // Click connect LinkedIn
    await page.click('[data-testid=connect-linkedin]');

    // Handle OAuth flow in new tab
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.click('[data-testid=connect-linkedin]')
    ]);

    // Mock LinkedIn OAuth (in real test, this would be actual LinkedIn)
    await newPage.goto('/auth/linkedin/callback?code=mock-auth-code&state=mock-state');

    // Wait for redirect back to accounts page
    await page.waitForURL('/accounts');

    // Verify account was connected
    await expect(page.locator('[data-testid=linkedin-account]')).toBeVisible();
    await expect(page.locator('[data-testid=connection-status]')).toContainText('Connected');
  });

  test('should handle OAuth errors', async ({ page }) => {
    await page.goto('/accounts');
    
    // Simulate OAuth error
    await page.goto('/auth/linkedin/callback?error=access_denied');
    
    // Should show error message
    await expect(page.locator('[data-testid=auth-error]')).toContainText('Connection failed');
  });
});
```

## Performance Testing

### Load Testing with Artillery

```yaml
# tests/performance/load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Normal load"
    - duration: 60
      arrivalRate: 100
      name: "Peak load"
  variables:
    testToken: "{{ $randomString() }}"
  processor: "./performance-helpers.js"

scenarios:
  - name: "Create and publish posts"
    weight: 60
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "load-test@agency.com"
            password: "password123"
          capture:
            - json: "$.token"
              as: "authToken"
      - post:
          url: "/api/posts"
          headers:
            Authorization: "Bearer {{ authToken }}"
          json:
            content: "Load test post {{ $randomString() }}"
            platforms: ["linkedin"]
            clientId: "{{ generateClientId() }}"
          expect:
            - statusCode: 201
      
  - name: "Fetch analytics data"
    weight: 30
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "analytics-test@agency.com"
            password: "password123"
          capture:
            - json: "$.token"
              as: "authToken"
      - get:
          url: "/api/analytics?timeframe=7d"
          headers:
            Authorization: "Bearer {{ authToken }}"
          expect:
            - statusCode: 200
            - contentType: "application/json"
      
  - name: "Upload media files"
    weight: 10
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "media-test@agency.com"
            password: "password123"
          capture:
            - json: "$.token"
              as: "authToken"
      - post:
          url: "/api/posts"
          headers:
            Authorization: "Bearer {{ authToken }}"
          formData:
            content: "Post with media"
            platforms: "instagram,linkedin"
            clientId: "{{ generateClientId() }}"
            "media[0]": "@./test-image.jpg"
          expect:
            - statusCode: 201
```

```javascript
// tests/performance/performance-helpers.js
const { faker } = require('@faker-js/faker');

function generateClientId(context, events, done) {
  const clientIds = [
    'client-1', 'client-2', 'client-3', 'client-4', 'client-5'
  ];
  context.vars.clientId = faker.helpers.arrayElement(clientIds);
  return done();
}

module.exports = {
  generateClientId
};
```

## Security Testing

### OWASP Security Tests

```typescript
// tests/security/security.test.ts
import request from 'supertest';
import { app } from '../../services/api/src/app';

describe('Security Tests', () => {
  describe('Input Validation', () => {
    it('should prevent SQL injection in post content', async () => {
      const maliciousContent = "'; DROP TABLE posts; --";
      
      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', 'Bearer valid-token')
        .send({
          content: maliciousContent,
          platforms: ['linkedin'],
          clientId: 'client-123'
        });

      // Should either sanitize or reject
      expect(response.status).not.toBe(500);
      
      // Verify database integrity
      const posts = await prisma.post.findMany();
      expect(posts).toBeDefined(); // Table should still exist
    });

    it('should prevent XSS in post content', async () => {
      const xssContent = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', 'Bearer valid-token')
        .send({
          content: xssContent,
          platforms: ['linkedin'],
          clientId: 'client-123'
        })
        .expect(201);

      // Content should be sanitized
      expect(response.body.content).not.toContain('<script>');
    });

    it('should validate file uploads for malicious content', async () => {
      // Try to upload a file with malicious name
      await request(app)
        .post('/api/posts')
        .set('Authorization', 'Bearer valid-token')
        .field('content', 'Test post')
        .field('platforms', 'linkedin')
        .field('clientId', 'client-123')
        .attach('media[0]', Buffer.from('fake-data'), '../../../etc/passwd')
        .expect(400);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should require valid JWT token', async () => {
      await request(app)
        .get('/api/posts')
        .expect(401);

      await request(app)
        .get('/api/posts')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should prevent access to other clients data', async () => {
      const client1Token = 'valid-token-client-1';
      const client2Id = 'client-2';

      await request(app)
        .get(`/api/posts?clientId=${client2Id}`)
        .set('Authorization', `Bearer ${client1Token}`)
        .expect(403);
    });

    it('should handle token expiration', async () => {
      const expiredToken = 'expired-jwt-token';

      await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits per user', async () => {
      const token = 'rate-limit-test-token';
      
      // Make requests up to limit
      for (let i = 0; i < 100; i++) {
        const response = await request(app)
          .get('/api/posts')
          .set('Authorization', `Bearer ${token}`);
        
        if (i < 99) {
          expect(response.status).toBe(200);
        } else {
          expect(response.status).toBe(429);
        }
      }
    });

    it('should have different rate limits for different endpoints', async () => {
      const token = 'rate-limit-test-token';

      // Upload endpoint should have stricter limits
      for (let i = 0; i < 11; i++) {
        const response = await request(app)
          .post('/api/posts')
          .set('Authorization', `Bearer ${token}`)
          .attach('media[0]', Buffer.from('data'), 'test.jpg');
        
        if (i < 10) {
          expect(response.status).not.toBe(429);
        } else {
          expect(response.status).toBe(429);
        }
      }
    });
  });

  describe('Data Protection', () => {
    it('should not expose sensitive data in responses', async () => {
      const response = await request(app)
        .get('/api/accounts')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      // Access tokens should be redacted
      response.body.accounts.forEach(account => {
        expect(account.tokens?.accessToken).toBeUndefined();
        expect(account.tokens?.refreshToken).toBeUndefined();
      });
    });

    it('should encrypt sensitive data at rest', async () => {
      // This would verify database encryption
      const rawTokenData = await prisma.platformToken.findFirst({
        where: { accountId: 'test-account-id' }
      });

      // Access token should be encrypted
      expect(rawTokenData?.accessToken).not.toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });
});
```

## Monitoring & Observability Testing

### Health Check Tests

```typescript
// tests/monitoring/health.test.ts
import request from 'supertest';
import { app } from '../../services/api/src/app';

describe('Health Checks', () => {
  it('should return healthy status when all services are up', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'healthy',
      timestamp: expect.any(String),
      services: {
        database: 'healthy',
        redis: 'healthy',
        storage: 'healthy'
      }
    });
  });

  it('should return degraded status when non-critical services are down', async () => {
    // Mock storage service down
    jest.mock('../../src/services/storage', () => ({
      isHealthy: () => false
    }));

    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('degraded');
  });

  it('should return unhealthy when critical services are down', async () => {
    // Mock database down
    jest.mock('../../src/services/database', () => ({
      isHealthy: () => false
    }));

    const response = await request(app)
      .get('/health')
      .expect(503);

    expect(response.body.status).toBe('unhealthy');
  });
});
```

## Test Data Management

### Test Fixtures and Factories

```typescript
// tests/fixtures/factories.ts
import { faker } from '@faker-js/faker';
import { PrismaClient } from '@social-automation/database';

export class TestDataFactory {
  constructor(private prisma: PrismaClient) {}

  async createAgency(overrides: Partial<Agency> = {}) {
    return this.prisma.agency.create({
      data: {
        name: faker.company.name(),
        email: faker.internet.email(),
        planType: 'professional',
        ...overrides
      }
    });
  }

  async createClient(agencyId: string, overrides: Partial<Client> = {}) {
    return this.prisma.client.create({
      data: {
        agencyId,
        name: faker.company.name(),
        industry: faker.commerce.department(),
        preferences: {
          brandColors: ['#007bff', '#28a745'],
          postingTimes: ['09:00', '15:00', '19:00']
        },
        ...overrides
      }
    });
  }

  async createAccount(clientId: string, platform: Platform, overrides: Partial<Account> = {}) {
    return this.prisma.account.create({
      data: {
        clientId,
        platform,
        platformAccountId: faker.string.alphanumeric(10),
        username: faker.internet.userName(),
        displayName: faker.person.fullName(),
        active: true,
        ...overrides
      }
    });
  }

  async createPost(clientId: string, overrides: Partial<Post> = {}) {
    return this.prisma.post.create({
      data: {
        clientId,
        content: faker.lorem.paragraphs(2),
        status: 'draft',
        postSettings: {
          hashtags: faker.helpers.arrayElements(['#tech', '#business', '#innovation'], 3)
        },
        ...overrides
      }
    });
  }

  async createCompletePostFlow(agencyId?: string) {
    const agency = agencyId ? 
      await this.prisma.agency.findUnique({ where: { id: agencyId } }) :
      await this.createAgency();
      
    const client = await this.createClient(agency.id);
    const account = await this.createAccount(client.id, 'linkedin');
    const post = await this.createPost(client.id);

    await this.prisma.postPlatform.create({
      data: {
        postId: post.id,
        accountId: account.id,
        status: 'published',
        platformPostId: faker.string.alphanumeric(16)
      }
    });

    return { agency, client, account, post };
  }
}
```

## CI/CD Integration

### Test Pipeline Configuration

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '18'
  POSTGRES_VERSION: '14'

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit -- --coverage
        
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
          
      redis:
        image: redis:6
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run database migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379

  e2e-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Start services
        run: |
          docker-compose -f docker-compose.test.yml up -d
          npm run wait-for-services
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  security-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Run security audit
        run: npm audit --audit-level=high
      
      - name: Run OWASP dependency check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'social-media-automation'
          path: '.'
          format: 'JSON'
      
      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  performance-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Artillery
        run: npm install -g artillery@latest
      
      - name: Start application
        run: |
          docker-compose -f docker-compose.test.yml up -d
          npm run wait-for-services
      
      - name: Run performance tests
        run: artillery run tests/performance/load-test.yml
      
      - name: Upload performance results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: artillery-results.json
```

This comprehensive testing strategy ensures high code quality, security, and performance across all components of the social media automation system.
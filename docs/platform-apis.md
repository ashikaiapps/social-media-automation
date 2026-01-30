# Platform API Research & Integration Guide

## Overview

Comprehensive research on each platform's API capabilities, limitations, and integration requirements for automated posting.

## Platform Comparison Matrix

| Feature | LinkedIn | Instagram | TikTok | Facebook |
|---------|----------|-----------|--------|----------|
| **Text Posts** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **Image Posts** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Video Posts** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Multi-Image** | ✅ Yes | ✅ Yes | ✅ Yes (carousel) | ✅ Yes |
| **Stories** | ❌ No | ⚠️ Limited | ❌ No | ✅ Yes |
| **Reels/Short Video** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Scheduling** | ✅ API Native | ✅ API Native | ✅ API Native | ✅ API Native |
| **Analytics** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Rate Limiting** | 300 req/hour | 200 req/hour | 1000 req/day | 200 req/hour |

## LinkedIn API

### Authentication
- **Method**: OAuth 2.0
- **Required Scopes**: 
  - `w_member_social` - Post as individual
  - `w_organization_social` - Post as company page
  - `r_organization_social` - Read organization posts
- **Token Validity**: 60 days (requires refresh)

### Content Types & Limitations

#### Text Posts
```json
{
  "author": "urn:li:organization:123456",
  "commentary": "Your post content with #hashtags and @mentions",
  "visibility": "PUBLIC",
  "distribution": {
    "feedDistribution": "MAIN_FEED"
  },
  "lifecycleState": "PUBLISHED"
}
```

#### Image Posts
- **Supported Formats**: JPG, PNG, GIF
- **Max File Size**: 20MB
- **Recommended Dimensions**: 1200x627px (1.91:1), 1080x1080px (1:1)
- **Multiple Images**: Up to 20 images per post
- **Alt Text**: Supported for accessibility

#### Video Posts
- **Supported Formats**: MP4, MOV, WMV, FLV, AVI, MKV
- **Max File Size**: 5GB
- **Max Duration**: 10 minutes
- **Recommended Dimensions**: 1280x720px (16:9)
- **Thumbnail**: Custom thumbnail supported

#### Rate Limits
- **Posts**: 300 requests per hour per user
- **Media Upload**: 100 requests per hour
- **Analytics**: 1000 requests per hour

### Implementation Example
```typescript
class LinkedInAPI {
  async createPost(postData: LinkedInPost): Promise<PostResult> {
    const response = await this.client.post('/rest/posts', {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202501',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: postData
    });
    
    return {
      id: response.headers['x-restli-id'],
      status: 'published',
      url: `https://www.linkedin.com/feed/update/${response.headers['x-restli-id']}/`
    };
  }
}
```

## Instagram Graph API

### Authentication
- **Method**: Facebook Login (OAuth 2.0)
- **Required Permissions**:
  - `pages_show_list` - Access page list
  - `pages_read_engagement` - Read page engagement
  - `content_management` - Manage page content
  - `business_management` - Manage business assets

### Content Types & Limitations

#### Instagram Business Account Required
- Personal accounts cannot use Instagram Graph API for publishing
- Business or Creator account linked to Facebook Page required

#### Image Posts
- **Supported Formats**: JPG, PNG
- **Max File Size**: 8MB
- **Aspect Ratios**: 
  - Square: 1:1 (1080x1080px)
  - Landscape: 1.91:1 (1080x566px)
  - Portrait: 4:5 (1080x1350px)

#### Video Posts (Feed)
- **Supported Formats**: MP4, MOV
- **Max File Size**: 1GB
- **Max Duration**: 60 seconds (feed), 15 minutes (IGTV)
- **Aspect Ratios**: Same as images
- **Min Resolution**: 720px

#### Instagram Reels
- **Duration**: 15-90 seconds
- **Aspect Ratio**: 9:16 vertical
- **Resolution**: 1080x1920px minimum
- **Format**: MP4 with H.264 codec

### Rate Limits
- **Posts**: 200 requests per hour
- **Media Upload**: 100 requests per hour
- **Business Discovery**: 200 requests per hour per user

### API Workflow
```typescript
// Instagram requires 2-step process
class InstagramAPI {
  async publishPost(mediaUrl: string, caption: string): Promise<PostResult> {
    // Step 1: Create media container
    const container = await this.createMediaContainer({
      image_url: mediaUrl,
      caption: caption,
      access_token: this.pageToken
    });
    
    // Step 2: Publish the container
    const published = await this.publishContainer(container.id);
    
    return {
      id: published.id,
      status: 'published'
    };
  }
}
```

## TikTok Content Posting API

### Authentication
- **Method**: OAuth 2.0
- **Required Scopes**: 
  - `video.publish` - Post videos to TikTok
  - `user.info.basic` - Access basic user info
- **Approval Required**: App must be approved for production use

### Content Types & Limitations

#### Video Posts Only
- **Supported Formats**: MP4, WEBM, MOV
- **File Size**: 50MB - 4GB
- **Duration**: 3 seconds - 10 minutes
- **Resolution**: 540x960px minimum, 1080x1920px recommended
- **Aspect Ratio**: 9:16 (vertical)
- **Frame Rate**: 23-60 FPS

#### Photo Posts (Beta)
- **Supported Formats**: JPEG, PNG, WebP
- **File Size**: 10MB maximum
- **Resolution**: 1080x1920px recommended
- **Aspect Ratio**: 9:16 preferred
- **Multiple Photos**: 2-35 images per post

### Privacy Levels
- `PUBLIC_TO_EVERYONE` - Public visibility
- `MUTUAL_FOLLOW_FRIENDS` - Friends only
- `SELF_ONLY` - Private/draft

### Rate Limits
- **Posts**: 1000 requests per day per app
- **Creator Info**: 100 requests per hour per user
- **Status Check**: 100 requests per hour per user

### Implementation Flow
```typescript
class TikTokAPI {
  async postVideo(videoFile: Buffer, postInfo: TikTokPostInfo): Promise<PostResult> {
    // Step 1: Query creator info
    const creatorInfo = await this.getCreatorInfo();
    
    // Step 2: Initialize upload
    const initResponse = await this.initializeUpload({
      post_info: postInfo,
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoFile.length,
        chunk_size: 10000000,
        total_chunk_count: Math.ceil(videoFile.length / 10000000)
      }
    });
    
    // Step 3: Upload video file
    await this.uploadVideo(initResponse.upload_url, videoFile);
    
    // Step 4: Check status
    const status = await this.checkPublishStatus(initResponse.publish_id);
    
    return {
      id: initResponse.publish_id,
      status: status.status
    };
  }
}
```

## Facebook Graph API

### Authentication
- **Method**: Facebook Login (OAuth 2.0)
- **Required Permissions**:
  - `pages_manage_posts` - Create and manage posts
  - `pages_read_engagement` - Read page insights
  - `publish_to_groups` - Post to groups (if applicable)

### Content Types & Limitations

#### Text Posts
```json
{
  "message": "Your post content with #hashtags",
  "published": true
}
```

#### Photo Posts
- **Supported Formats**: JPG, PNG, GIF, WebP
- **Max File Size**: 10MB per image
- **Max Images**: 10 per multi-photo post
- **Recommended Size**: 1200x630px for shared links

#### Video Posts
- **Supported Formats**: MP4, MOV, AVI, WMV, FLV, 3GPP
- **Max File Size**: 10GB
- **Max Duration**: 240 minutes
- **Recommended**: 1280x720px (16:9)

#### Facebook Reels
- **Duration**: 3-60 seconds
- **Aspect Ratio**: 9:16 vertical
- **Resolution**: 1080x1920px
- **Format**: MP4

### Rate Limits
- **Posts**: 200 requests per hour per user
- **Pages**: 4800 requests per hour per app
- **Insights**: 200 requests per hour per user

### Scheduling Support
```typescript
class FacebookAPI {
  async schedulePost(postData: FacebookPost, scheduleTime: Date): Promise<PostResult> {
    const scheduledPublishTime = Math.floor(scheduleTime.getTime() / 1000);
    
    const response = await this.client.post(`/${this.pageId}/feed`, {
      ...postData,
      published: false,
      scheduled_publish_time: scheduledPublishTime
    });
    
    return {
      id: response.id,
      status: 'scheduled',
      scheduledTime: scheduleTime
    };
  }
}
```

## Cross-Platform Considerations

### Content Optimization Strategy

#### Caption Optimization
```typescript
interface PlatformCaptionRules {
  linkedin: {
    maxLength: 3000;
    hashtagsRecommended: 3-5;
    mentionsSupported: true;
    formatting: 'rich-text';
  };
  instagram: {
    maxLength: 2200;
    hashtagsRecommended: 10-30;
    mentionsSupported: true;
    formatting: 'plain-text';
  };
  tiktok: {
    maxLength: 2200;
    hashtagsRecommended: 3-5;
    mentionsSupported: true;
    formatting: 'plain-text';
  };
  facebook: {
    maxLength: 63206;
    hashtagsRecommended: 1-2;
    mentionsSupported: true;
    formatting: 'plain-text';
  };
}
```

#### Media Processing Requirements
```typescript
interface MediaSpecs {
  image: {
    linkedin: { aspectRatio: [1.91, 1], maxSize: '20MB', formats: ['jpg', 'png'] };
    instagram: { aspectRatio: [1, 1], maxSize: '8MB', formats: ['jpg', 'png'] };
    tiktok: { aspectRatio: [9, 16], maxSize: '10MB', formats: ['jpg', 'png', 'webp'] };
    facebook: { aspectRatio: [1.91, 1], maxSize: '10MB', formats: ['jpg', 'png', 'gif'] };
  };
  video: {
    linkedin: { aspectRatio: [16, 9], maxSize: '5GB', maxDuration: 600 };
    instagram: { aspectRatio: [9, 16], maxSize: '1GB', maxDuration: 60 };
    tiktok: { aspectRatio: [9, 16], maxSize: '4GB', maxDuration: 600 };
    facebook: { aspectRatio: [16, 9], maxSize: '10GB', maxDuration: 14400 };
  };
}
```

### Error Handling Strategy

#### Common API Errors
```typescript
enum APIErrorTypes {
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INVALID_TOKEN = 'invalid_token',
  CONTENT_POLICY_VIOLATION = 'content_policy_violation',
  MEDIA_PROCESSING_ERROR = 'media_processing_error',
  NETWORK_ERROR = 'network_error'
}

class APIErrorHandler {
  handle(error: APIError, platform: Platform): RetryStrategy {
    switch (error.type) {
      case APIErrorTypes.RATE_LIMIT_EXCEEDED:
        return { retry: true, delay: error.retryAfter * 1000 };
      case APIErrorTypes.INVALID_TOKEN:
        return { retry: true, action: 'refresh_token' };
      case APIErrorTypes.CONTENT_POLICY_VIOLATION:
        return { retry: false, action: 'manual_review' };
      default:
        return { retry: true, delay: 5000, maxRetries: 3 };
    }
  }
}
```

### Webhook Support

#### Platform Webhook Capabilities
- **LinkedIn**: Limited webhook support, polling required for updates
- **Instagram**: Webhooks for mentions, comments, story mentions
- **TikTok**: Webhooks for video status updates, comments
- **Facebook**: Comprehensive webhook support for all interactions

#### Implementation
```typescript
interface WebhookHandler {
  linkedin: null; // No webhook support
  instagram: {
    events: ['mentions', 'comments', 'live_comments'];
    verification: 'meta_challenge';
  };
  tiktok: {
    events: ['video_status', 'comment'];
    verification: 'header_signature';
  };
  facebook: {
    events: ['feed', 'mention', 'comment'];
    verification: 'meta_challenge';
  };
}
```

## Implementation Recommendations

### SDK/Library Selection
- **LinkedIn**: Official REST API, custom implementation recommended
- **Instagram**: Facebook SDK for Node.js
- **TikTok**: Official TikTok API SDK (when available) or custom implementation
- **Facebook**: Official Facebook SDK for Node.js

### Testing Strategy
- **Sandbox Environments**: Available for all platforms during development
- **Test Accounts**: Required for each platform integration testing
- **Content Restrictions**: Unverified apps may have limited visibility
- **Rate Limit Testing**: Essential for production readiness

### Security Best Practices
- **Token Encryption**: Store all tokens encrypted at rest
- **Token Rotation**: Implement automatic token refresh
- **Scope Minimization**: Request only necessary permissions
- **Audit Logging**: Log all API interactions for security monitoring
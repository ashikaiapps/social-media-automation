const { Worker } = require('bullmq');
const Redis = require('ioredis');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// LinkedIn API configuration
const LINKEDIN_CONFIG = {
  apiUrl: 'https://api.linkedin.com/v2'
};

// Create post publishing worker
const postWorker = new Worker('post-scheduler', async (job) => {
  console.log(`Processing job ${job.id}: ${job.name}`);
  
  try {
    const { postId } = job.data;

    // Get post and user's social accounts
    const post = await prisma.contentPost.findUnique({
      where: { id: postId },
      include: {
        user: {
          include: {
            socialAccounts: {
              where: { isActive: true }
            }
          }
        }
      }
    });

    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }

    if (post.status === 'PUBLISHED') {
      console.log(`Post ${postId} already published, skipping`);
      return { status: 'already_published' };
    }

    const results = [];

    // Publish to each platform
    for (const platform of post.platforms) {
      const account = post.user.socialAccounts.find(
        acc => acc.platform === platform && acc.isActive
      );

      if (!account) {
        console.error(`No active ${platform} account found for user ${post.userId}`);
        results.push({ platform, status: 'error', error: 'No active account' });
        continue;
      }

      try {
        let publishResult;
        
        switch (platform) {
          case 'LINKEDIN':
            publishResult = await publishToLinkedIn(post, account);
            break;
          case 'INSTAGRAM':
            publishResult = await publishToInstagram(post, account);
            break;
          case 'TIKTOK':
            publishResult = await publishToTikTok(post, account);
            break;
          case 'FACEBOOK':
            publishResult = await publishToFacebook(post, account);
            break;
          default:
            throw new Error(`Platform ${platform} not supported`);
        }

        results.push({ platform, status: 'success', ...publishResult });

      } catch (error) {
        console.error(`Failed to publish to ${platform}:`, error);
        results.push({ 
          platform, 
          status: 'error', 
          error: error.message 
        });
      }
    }

    // Update post status
    const hasErrors = results.some(r => r.status === 'error');
    const allFailed = results.every(r => r.status === 'error');

    await prisma.contentPost.update({
      where: { id: postId },
      data: {
        status: allFailed ? 'FAILED' : 'PUBLISHED',
        publishedAt: allFailed ? null : new Date()
      }
    });

    console.log(`Post ${postId} publishing completed:`, results);

    return {
      postId,
      results,
      status: allFailed ? 'failed' : (hasErrors ? 'partial_success' : 'success')
    };

  } catch (error) {
    console.error('Job processing error:', error);
    
    // Mark post as failed
    if (job.data.postId) {
      try {
        await prisma.contentPost.update({
          where: { id: job.data.postId },
          data: { status: 'FAILED' }
        });
      } catch (dbError) {
        console.error('Failed to update post status:', dbError);
      }
    }

    throw error;
  }
}, {
  connection: redis,
  concurrency: 5, // Process up to 5 posts concurrently
});

// LinkedIn publishing function
async function publishToLinkedIn(post, account) {
  try {
    // Check token expiry
    if (account.expiresAt && new Date() >= account.expiresAt) {
      throw new Error('LinkedIn access token expired');
    }

    const headers = {
      'Authorization': `Bearer ${account.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    };

    // Get user's LinkedIn URN
    const profileResponse = await axios.get(`${LINKEDIN_CONFIG.apiUrl}/me`, { headers });
    const personUrn = `urn:li:person:${profileResponse.data.id}`;

    let postData;

    if (post.mediaUrls && post.mediaUrls.length > 0) {
      // Post with media (image)
      const mediaUrn = await uploadMediaToLinkedIn(post.mediaUrls[0], account.accessToken);
      
      postData = {
        author: personUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: post.content
            },
            shareMediaCategory: 'IMAGE',
            media: [{
              status: 'READY',
              description: {
                text: post.title || 'Shared via Social Media Automation'
              },
              media: mediaUrn,
              title: {
                text: post.title || 'Social Media Post'
              }
            }]
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      };
    } else {
      // Text-only post
      postData = {
        author: personUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: post.content
            },
            shareMediaCategory: 'NONE'
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      };
    }

    const response = await axios.post(
      `${LINKEDIN_CONFIG.apiUrl}/ugcPosts`,
      postData,
      { headers }
    );

    return {
      platformPostId: response.data.id,
      url: `https://linkedin.com/feed/update/${response.data.id}`,
      publishedAt: new Date()
    };

  } catch (error) {
    console.error('LinkedIn publishing error:', error.response?.data || error);
    throw new Error(`LinkedIn publishing failed: ${error.response?.data?.message || error.message}`);
  }
}

// Helper function to upload media to LinkedIn
async function uploadMediaToLinkedIn(mediaPath, accessToken) {
  try {
    const fs = require('fs');
    const path = require('path');

    // Register upload
    const registerResponse = await axios.post(
      `${LINKEDIN_CONFIG.apiUrl}/assets?action=registerUpload`,
      {
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: 'urn:li:person:' + (await getUserId(accessToken)),
          serviceRelationships: [{
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent'
          }]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const uploadUrl = registerResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
    const asset = registerResponse.data.value.asset;

    // Upload file
    const fileBuffer = fs.readFileSync(mediaPath);
    await axios.post(uploadUrl, fileBuffer, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream'
      }
    });

    return asset;

  } catch (error) {
    console.error('Media upload error:', error);
    throw error;
  }
}

// Helper function to get LinkedIn user ID
async function getUserId(accessToken) {
  const response = await axios.get(`${LINKEDIN_CONFIG.apiUrl}/me`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  return response.data.id;
}

// Placeholder functions for other platforms (to be implemented)
async function publishToInstagram(post, account) {
  // Instagram Basic Display API doesn't support posting
  // Would need Instagram Business Account and Facebook Graph API
  throw new Error('Instagram publishing not yet implemented');
}

async function publishToTikTok(post, account) {
  // TikTok Content Posting API implementation
  throw new Error('TikTok publishing not yet implemented');
}

async function publishToFacebook(post, account) {
  // Facebook Graph API implementation
  throw new Error('Facebook publishing not yet implemented');
}

// Worker event handlers
postWorker.on('completed', (job, returnvalue) => {
  console.log(`Job ${job.id} completed successfully:`, returnvalue);
});

postWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});

postWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down worker...');
  await postWorker.close();
  await redis.disconnect();
  process.exit(0);
});

console.log('Post publishing worker started');

module.exports = postWorker;
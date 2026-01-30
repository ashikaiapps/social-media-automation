const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// Get user's posts
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, platform } = req.query;
    const skip = (page - 1) * limit;

    const where = { userId: req.user.userId };
    
    if (status) {
      where.status = status;
    }
    
    if (platform) {
      where.platforms = { has: platform };
    }

    const [posts, totalCount] = await Promise.all([
      prisma.contentPost.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: [
          { scheduledFor: 'desc' },
          { createdAt: 'desc' }
        ],
        select: {
          id: true,
          title: true,
          content: true,
          mediaUrls: true,
          platforms: true,
          status: true,
          scheduledFor: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.contentPost.count({ where })
    ]);

    res.json({
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + posts.length < totalCount
      }
    });

  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to get posts' });
  }
});

// Create new post
router.post('/', authenticateToken, upload.array('media', 5), async (req, res) => {
  try {
    const { title, content, platforms, scheduledFor } = req.body;

    // Validate required fields
    if (!content || !platforms) {
      return res.status(400).json({ error: 'Content and platforms are required' });
    }

    // Parse platforms if it's a string
    const platformArray = Array.isArray(platforms) ? platforms : JSON.parse(platforms);

    // Process uploaded media files
    let mediaUrls = [];
    if (req.files && req.files.length > 0) {
      mediaUrls = await processMediaFiles(req.files);
    }

    // Create post
    const post = await prisma.contentPost.create({
      data: {
        userId: req.user.userId,
        title: title || null,
        content,
        mediaUrls,
        platforms: platformArray,
        status: scheduledFor ? 'SCHEDULED' : 'DRAFT',
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null
      }
    });

    // If scheduled, add to job queue
    if (scheduledFor) {
      const postQueue = req.app.locals.postQueue;
      await postQueue.add(
        'publish-post',
        { postId: post.id },
        {
          delay: new Date(scheduledFor).getTime() - Date.now(),
          jobId: `post-${post.id}` // Prevent duplicates
        }
      );
    }

    res.status(201).json({
      message: 'Post created successfully',
      post
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Get single post
router.get('/:postId', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await prisma.contentPost.findFirst({
      where: {
        id: postId,
        userId: req.user.userId
      }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ post });

  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Failed to get post' });
  }
});

// Update post
router.put('/:postId', authenticateToken, upload.array('media', 5), async (req, res) => {
  try {
    const { postId } = req.params;
    const { title, content, platforms, scheduledFor } = req.body;

    // Check if post exists and belongs to user
    const existingPost = await prisma.contentPost.findFirst({
      where: {
        id: postId,
        userId: req.user.userId
      }
    });

    if (!existingPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Don't allow editing published posts
    if (existingPost.status === 'PUBLISHED') {
      return res.status(400).json({ error: 'Cannot edit published posts' });
    }

    // Process new media files if uploaded
    let mediaUrls = existingPost.mediaUrls;
    if (req.files && req.files.length > 0) {
      // Clean up old media files
      await cleanupMediaFiles(existingPost.mediaUrls);
      // Process new media files
      mediaUrls = await processMediaFiles(req.files);
    }

    // Parse platforms if provided
    const platformArray = platforms ? 
      (Array.isArray(platforms) ? platforms : JSON.parse(platforms)) 
      : existingPost.platforms;

    // Update post
    const updatedPost = await prisma.contentPost.update({
      where: { id: postId },
      data: {
        title: title !== undefined ? title : existingPost.title,
        content: content !== undefined ? content : existingPost.content,
        mediaUrls,
        platforms: platformArray,
        status: scheduledFor ? 'SCHEDULED' : (existingPost.status === 'SCHEDULED' ? 'DRAFT' : existingPost.status),
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null
      }
    });

    // Update job queue if scheduling changed
    const postQueue = req.app.locals.postQueue;
    
    // Remove existing job
    await postQueue.removeRepeatable(`post-${postId}`);
    
    // Add new job if scheduled
    if (scheduledFor) {
      await postQueue.add(
        'publish-post',
        { postId: updatedPost.id },
        {
          delay: new Date(scheduledFor).getTime() - Date.now(),
          jobId: `post-${updatedPost.id}`
        }
      );
    }

    res.json({
      message: 'Post updated successfully',
      post: updatedPost
    });

  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete post
router.delete('/:postId', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await prisma.contentPost.findFirst({
      where: {
        id: postId,
        userId: req.user.userId
      }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Clean up media files
    await cleanupMediaFiles(post.mediaUrls);

    // Remove from job queue if scheduled
    if (post.status === 'SCHEDULED') {
      const postQueue = req.app.locals.postQueue;
      await postQueue.removeRepeatable(`post-${postId}`);
    }

    // Delete post
    await prisma.contentPost.delete({
      where: { id: postId }
    });

    res.json({ message: 'Post deleted successfully' });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Publish post immediately
router.post('/:postId/publish', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await prisma.contentPost.findFirst({
      where: {
        id: postId,
        userId: req.user.userId
      }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.status === 'PUBLISHED') {
      return res.status(400).json({ error: 'Post is already published' });
    }

    // Add to job queue for immediate processing
    const postQueue = req.app.locals.postQueue;
    await postQueue.add('publish-post', { postId }, { priority: 10 });

    // Update post status
    await prisma.contentPost.update({
      where: { id: postId },
      data: { 
        status: 'SCHEDULED',
        scheduledFor: new Date() // Immediate
      }
    });

    res.json({ message: 'Post queued for publishing' });

  } catch (error) {
    console.error('Publish post error:', error);
    res.status(500).json({ error: 'Failed to publish post' });
  }
});

// Helper function to process uploaded media files
async function processMediaFiles(files) {
  const mediaUrls = [];
  
  for (const file of files) {
    try {
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const outputPath = `uploads/media/${fileName}`;

      // Ensure directory exists
      await fs.mkdir('uploads/media', { recursive: true });

      if (file.mimetype.startsWith('image/')) {
        // Process image with sharp
        await sharp(file.path)
          .resize(1080, 1080, { 
            fit: 'inside', 
            withoutEnlargement: true 
          })
          .jpeg({ quality: 85 })
          .toFile(`${outputPath}.jpg`);
          
        mediaUrls.push(`${outputPath}.jpg`);
      } else if (file.mimetype.startsWith('video/')) {
        // For videos, just move the file (video processing would be added later)
        const videoPath = `${outputPath}${path.extname(file.originalname)}`;
        await fs.rename(file.path, videoPath);
        mediaUrls.push(videoPath);
      }

      // Clean up temp file
      try {
        await fs.unlink(file.path);
      } catch (err) {
        // File might already be moved/deleted
      }

    } catch (error) {
      console.error('Error processing media file:', error);
      // Continue with other files
    }
  }

  return mediaUrls;
}

// Helper function to clean up media files
async function cleanupMediaFiles(mediaUrls) {
  for (const mediaUrl of mediaUrls) {
    try {
      await fs.unlink(mediaUrl);
    } catch (error) {
      // File might not exist, that's OK
    }
  }
}

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

module.exports = router;
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Get post analytics
router.get('/posts/:postId', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;

    // Verify post belongs to user
    const post = await prisma.contentPost.findFirst({
      where: {
        id: postId,
        userId: req.user.userId
      }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Get analytics data (placeholder for now - would integrate with platform APIs)
    const analytics = {
      postId,
      platforms: post.platforms,
      publishedAt: post.publishedAt,
      metrics: {
        // These would come from actual platform APIs
        linkedin: {
          likes: 0,
          comments: 0,
          shares: 0,
          views: 0,
          clickThroughRate: 0
        }
      },
      summary: {
        totalEngagement: 0,
        reach: 0,
        impressions: 0
      }
    };

    res.json({ analytics });

  } catch (error) {
    console.error('Get post analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Get overview analytics for user
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get posts count by status
    const postsStats = await prisma.contentPost.groupBy({
      by: ['status'],
      where: {
        userId: req.user.userId,
        createdAt: {
          gte: startDate
        }
      },
      _count: {
        status: true
      }
    });

    // Get posts count by platform
    const publishedPosts = await prisma.contentPost.findMany({
      where: {
        userId: req.user.userId,
        status: 'PUBLISHED',
        publishedAt: {
          gte: startDate
        }
      },
      select: {
        platforms: true,
        publishedAt: true
      }
    });

    // Process platform statistics
    const platformStats = {};
    publishedPosts.forEach(post => {
      post.platforms.forEach(platform => {
        if (!platformStats[platform]) {
          platformStats[platform] = { count: 0, recent: [] };
        }
        platformStats[platform].count++;
        platformStats[platform].recent.push(post.publishedAt);
      });
    });

    // Get engagement metrics (placeholder - would come from platform APIs)
    const engagementMetrics = {
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalViews: 0,
      averageEngagementRate: 0
    };

    // Calculate posting frequency
    const postingFrequency = {
      daily: publishedPosts.length / parseInt(days),
      weekly: (publishedPosts.length / parseInt(days)) * 7,
      monthly: (publishedPosts.length / parseInt(days)) * 30
    };

    res.json({
      overview: {
        dateRange: {
          startDate,
          endDate: new Date(),
          days: parseInt(days)
        },
        posts: {
          total: postsStats.reduce((sum, stat) => sum + stat._count.status, 0),
          byStatus: postsStats.reduce((acc, stat) => {
            acc[stat.status.toLowerCase()] = stat._count.status;
            return acc;
          }, {}),
          byPlatform: platformStats
        },
        engagement: engagementMetrics,
        frequency: postingFrequency
      }
    });

  } catch (error) {
    console.error('Get overview analytics error:', error);
    res.status(500).json({ error: 'Failed to get overview analytics' });
  }
});

// Get platform-specific analytics
router.get('/platform/:platform', authenticateToken, async (req, res) => {
  try {
    const { platform } = req.params;
    const { days = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get posts for specific platform
    const posts = await prisma.contentPost.findMany({
      where: {
        userId: req.user.userId,
        platforms: {
          has: platform.toUpperCase()
        },
        publishedAt: {
          gte: startDate
        }
      },
      select: {
        id: true,
        title: true,
        content: true,
        publishedAt: true,
        mediaUrls: true
      },
      orderBy: {
        publishedAt: 'desc'
      }
    });

    // Platform-specific metrics (placeholder - would integrate with actual APIs)
    const platformMetrics = {
      platform: platform.toUpperCase(),
      totalPosts: posts.length,
      metrics: {
        averageLikes: 0,
        averageComments: 0,
        averageShares: 0,
        averageViews: 0,
        bestPerformingPost: null,
        worstPerformingPost: null
      },
      postPerformance: posts.map(post => ({
        id: post.id,
        title: post.title,
        publishedAt: post.publishedAt,
        engagement: {
          likes: 0,
          comments: 0,
          shares: 0,
          views: 0
        }
      }))
    };

    res.json({ platformMetrics });

  } catch (error) {
    console.error('Get platform analytics error:', error);
    res.status(500).json({ error: 'Failed to get platform analytics' });
  }
});

// Get posting insights and recommendations
router.get('/insights', authenticateToken, async (req, res) => {
  try {
    // Get user's posting history for analysis
    const recentPosts = await prisma.contentPost.findMany({
      where: {
        userId: req.user.userId,
        status: 'PUBLISHED',
        publishedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      select: {
        platforms: true,
        publishedAt: true,
        mediaUrls: true
      }
    });

    // Analyze posting patterns
    const insights = {
      postingPattern: analyzePostingPattern(recentPosts),
      contentInsights: analyzeContentPerformance(recentPosts),
      recommendations: generateRecommendations(recentPosts)
    };

    res.json({ insights });

  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json({ error: 'Failed to get insights' });
  }
});

// Helper functions for analytics
function analyzePostingPattern(posts) {
  const hourCounts = new Array(24).fill(0);
  const dayCounts = new Array(7).fill(0);
  
  posts.forEach(post => {
    const date = new Date(post.publishedAt);
    hourCounts[date.getHours()]++;
    dayCounts[date.getDay()]++;
  });

  const bestHour = hourCounts.indexOf(Math.max(...hourCounts));
  const bestDay = dayCounts.indexOf(Math.max(...dayCounts));
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    totalPosts: posts.length,
    bestTimeToPost: {
      hour: bestHour,
      day: dayNames[bestDay]
    },
    postingFrequency: {
      postsPerDay: posts.length / 30,
      mostActiveHour: bestHour,
      mostActiveDay: dayNames[bestDay]
    }
  };
}

function analyzeContentPerformance(posts) {
  const withMedia = posts.filter(post => post.mediaUrls.length > 0).length;
  const withoutMedia = posts.length - withMedia;

  return {
    mediaUsage: {
      withMedia,
      withoutMedia,
      mediaUsageRate: posts.length > 0 ? (withMedia / posts.length * 100).toFixed(1) : 0
    },
    contentTypes: {
      textOnly: withoutMedia,
      imagePost: withMedia, // Simplified - would analyze actual media types
      videoPost: 0 // Placeholder
    }
  };
}

function generateRecommendations(posts) {
  const recommendations = [];

  // Posting frequency recommendations
  const avgPostsPerDay = posts.length / 30;
  if (avgPostsPerDay < 0.5) {
    recommendations.push({
      type: 'frequency',
      title: 'Increase Posting Frequency',
      description: 'Consider posting more regularly. Aim for at least 3-4 posts per week for better engagement.',
      priority: 'high'
    });
  }

  // Media usage recommendations
  const mediaUsageRate = posts.length > 0 ? (posts.filter(p => p.mediaUrls.length > 0).length / posts.length) : 0;
  if (mediaUsageRate < 0.3) {
    recommendations.push({
      type: 'content',
      title: 'Add More Visual Content',
      description: 'Posts with images or videos typically get higher engagement. Try including media in at least 50% of your posts.',
      priority: 'medium'
    });
  }

  // Platform diversification
  const platformUsage = {};
  posts.forEach(post => {
    post.platforms.forEach(platform => {
      platformUsage[platform] = (platformUsage[platform] || 0) + 1;
    });
  });

  if (Object.keys(platformUsage).length < 2) {
    recommendations.push({
      type: 'platform',
      title: 'Diversify Platform Usage',
      description: 'Consider expanding to multiple social media platforms to reach a wider audience.',
      priority: 'low'
    });
  }

  return recommendations;
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
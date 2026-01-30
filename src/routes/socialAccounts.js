const express = require('express');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// LinkedIn OAuth configuration
const LINKEDIN_CONFIG = {
  clientId: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  redirectUri: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3000/auth/linkedin/callback',
  scope: 'r_liteprofile r_emailaddress w_member_social',
  authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
  tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
  apiUrl: 'https://api.linkedin.com/v2'
};

// Get user's connected social accounts
router.get('/', authenticateToken, async (req, res) => {
  try {
    const accounts = await prisma.socialAccount.findMany({
      where: { 
        userId: req.user.userId,
        isActive: true
      },
      select: {
        id: true,
        platform: true,
        accountId: true,
        accountName: true,
        isActive: true,
        createdAt: true,
        expiresAt: true
      }
    });

    res.json({ accounts });

  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Failed to get accounts' });
  }
});

// Start LinkedIn OAuth flow
router.get('/connect/linkedin', authenticateToken, (req, res) => {
  const state = Buffer.from(JSON.stringify({ 
    userId: req.user.userId,
    timestamp: Date.now()
  })).toString('base64');

  const authUrl = `${LINKEDIN_CONFIG.authUrl}?` + 
    `response_type=code&` +
    `client_id=${LINKEDIN_CONFIG.clientId}&` +
    `redirect_uri=${encodeURIComponent(LINKEDIN_CONFIG.redirectUri)}&` +
    `state=${state}&` +
    `scope=${encodeURIComponent(LINKEDIN_CONFIG.scope)}`;

  res.json({ authUrl });
});

// LinkedIn OAuth callback handler
router.post('/connect/linkedin/callback', authenticateToken, async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // Verify state parameter
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (err) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    if (stateData.userId !== req.user.userId) {
      return res.status(400).json({ error: 'State mismatch' });
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(LINKEDIN_CONFIG.tokenUrl, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: LINKEDIN_CONFIG.redirectUri,
      client_id: LINKEDIN_CONFIG.clientId,
      client_secret: LINKEDIN_CONFIG.clientSecret
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { access_token, expires_in } = tokenResponse.data;

    // Get LinkedIn profile info
    const profileResponse = await axios.get(`${LINKEDIN_CONFIG.apiUrl}/me`, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const profile = profileResponse.data;
    const accountName = `${profile.localizedFirstName} ${profile.localizedLastName}`;

    // Save account to database
    const expiresAt = new Date(Date.now() + (expires_in * 1000));
    
    await prisma.socialAccount.upsert({
      where: {
        userId_platform_accountId: {
          userId: req.user.userId,
          platform: 'LINKEDIN',
          accountId: profile.id
        }
      },
      update: {
        accountName,
        accessToken: access_token,
        expiresAt,
        isActive: true
      },
      create: {
        userId: req.user.userId,
        platform: 'LINKEDIN',
        accountId: profile.id,
        accountName,
        accessToken: access_token,
        expiresAt,
        isActive: true
      }
    });

    res.json({
      message: 'LinkedIn account connected successfully',
      account: {
        platform: 'LINKEDIN',
        accountId: profile.id,
        accountName,
        expiresAt
      }
    });

  } catch (error) {
    console.error('LinkedIn connection error:', error);
    if (error.response?.data) {
      console.error('LinkedIn API response:', error.response.data);
    }
    res.status(500).json({ error: 'Failed to connect LinkedIn account' });
  }
});

// Disconnect social account
router.delete('/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await prisma.socialAccount.findFirst({
      where: {
        id: accountId,
        userId: req.user.userId
      }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Mark as inactive instead of deleting (preserve post history)
    await prisma.socialAccount.update({
      where: { id: accountId },
      data: { isActive: false }
    });

    res.json({ message: 'Account disconnected successfully' });

  } catch (error) {
    console.error('Disconnect account error:', error);
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
});

// Test account connection
router.get('/:accountId/test', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await prisma.socialAccount.findFirst({
      where: {
        id: accountId,
        userId: req.user.userId,
        isActive: true
      }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found or inactive' });
    }

    // Test the connection based on platform
    let testResult;
    
    if (account.platform === 'LINKEDIN') {
      try {
        const response = await axios.get(`${LINKEDIN_CONFIG.apiUrl}/me`, {
          headers: {
            'Authorization': `Bearer ${account.accessToken}`
          }
        });
        testResult = { 
          status: 'connected', 
          accountName: `${response.data.localizedFirstName} ${response.data.localizedLastName}` 
        };
      } catch (error) {
        testResult = { 
          status: 'error', 
          error: error.response?.data?.message || 'Connection test failed' 
        };
      }
    } else {
      testResult = { status: 'unsupported', error: 'Platform not yet supported' };
    }

    res.json({
      account: {
        id: account.id,
        platform: account.platform,
        accountName: account.accountName
      },
      test: testResult
    });

  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

// Middleware to authenticate JWT token (duplicate from auth.js - should be moved to shared middleware)
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
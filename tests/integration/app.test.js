const request = require('supertest');
const app = require('../src/app');

describe('App Integration Tests', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('environment');
    });
  });

  describe('API Routes', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Route not found');
    });
  });

  describe('Authentication', () => {
    it('should require token for protected routes', async () => {
      await request(app)
        .get('/api/posts')
        .expect(401);
    });
  });
});

describe('Error Handling', () => {
  it('should handle malformed JSON', async () => {
    await request(app)
      .post('/api/auth/login')
      .send('invalid json')
      .expect(400);
  });
});
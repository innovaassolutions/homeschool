import request from 'supertest';
import app from './app';

describe('Express App', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        status: expect.stringMatching(/^(healthy|degraded)$/),
        timestamp: expect.any(String),
        service: 'homeschool-api',
        database: expect.objectContaining({
          status: expect.stringMatching(/^(healthy|unhealthy)$/),
          timestamp: expect.any(String),
          database: 'main',
          namespace: 'homeschool'
        })
      });
    });
  });

  describe('GET /api/hello', () => {
    it('should return hello world message', async () => {
      const response = await request(app)
        .get('/api/hello')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Hello World from Homeschool API!',
        timestamp: expect.any(String)
      });
    });
  });

  describe('GET /unknown-route', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Not Found',
        message: 'Route not found'
      });
    });
  });
});
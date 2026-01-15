import { DatabaseService } from './database';

describe('DatabaseService', () => {
  let dbService: DatabaseService;

  beforeAll(() => {
    // Set NODE_ENV to development for testing
    process.env.NODE_ENV = 'development';
  });

  beforeEach(() => {
    dbService = new DatabaseService();
  });

  afterEach(async () => {
    if (dbService) {
      await dbService.disconnect();
    }
  });

  describe('Connection Management', () => {
    it('should connect to SurrealDB', async () => {
      await expect(dbService.connect()).resolves.not.toThrow();
      expect(dbService.isConnected()).toBe(true);
    });

    it('should disconnect from SurrealDB', async () => {
      await dbService.connect();
      await dbService.disconnect();
      expect(dbService.isConnected()).toBe(false);
    });

    it('should handle connection errors gracefully', async () => {
      if (process.env.NODE_ENV === 'development') {
        // In development mode, connections are mocked
        const invalidDbService = new DatabaseService('invalid://connection');
        await expect(invalidDbService.connect()).resolves.not.toThrow();
      } else {
        const invalidDbService = new DatabaseService('invalid://connection');
        await expect(invalidDbService.connect()).rejects.toThrow();
      }
    });
  });

  describe('Database Operations', () => {
    beforeEach(async () => {
      await dbService.connect();
    });

    it('should perform health check', async () => {
      const health = await dbService.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
    });

    it('should execute basic query', async () => {
      const result = await dbService.query('SELECT * FROM health');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Environment Configuration', () => {
    it('should use environment variables for connection', () => {
      const originalUrl = process.env.SURREALDB_URL;
      const originalNamespace = process.env.SURREALDB_NAMESPACE;
      const originalDatabase = process.env.SURREALDB_DATABASE;

      process.env.SURREALDB_URL = 'memory';
      process.env.SURREALDB_NAMESPACE = 'test';
      process.env.SURREALDB_DATABASE = 'test';

      const testDbService = new DatabaseService();
      expect(testDbService.config.url).toBe('memory');
      expect(testDbService.config.namespace).toBe('test');
      expect(testDbService.config.database).toBe('test');

      // Restore original values
      process.env.SURREALDB_URL = originalUrl;
      process.env.SURREALDB_NAMESPACE = originalNamespace;
      process.env.SURREALDB_DATABASE = originalDatabase;
    });
  });
});
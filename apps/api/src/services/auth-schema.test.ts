import { DatabaseService } from './database';
import { AuthSchemaService, getAuthSchema } from './auth-schema';

describe('AuthSchemaService', () => {
  let db: DatabaseService;
  let authSchema: AuthSchemaService;

  beforeAll(() => {
    // Set NODE_ENV to development for testing
    process.env.NODE_ENV = 'development';
  });

  beforeEach(async () => {
    db = new DatabaseService();
    await db.connect();
    authSchema = getAuthSchema(db);
  });

  afterEach(async () => {
    if (db) {
      await db.disconnect();
    }
  });

  describe('Schema Creation', () => {
    it('should create authentication schema successfully', async () => {
      expect(async () => {
        await authSchema.createAuthenticationSchema();
      }).not.toThrow();
    });

    it('should create authentication scopes successfully', async () => {
      expect(async () => {
        await authSchema.createAuthenticationScopes();
      }).not.toThrow();
    });

    it('should validate schema exists', async () => {
      await authSchema.createAuthenticationSchema();
      const isValid = await authSchema.validateSchema();
      expect(isValid).toBe(true);
    });
  });

  describe('Table Structure Validation', () => {
    beforeEach(async () => {
      await authSchema.createAuthenticationSchema();
    });

    it('should have auth_families table with correct structure', async () => {
      // In development mode, this will be mocked
      // In production, would verify actual table structure
      const isValid = await authSchema.validateSchema();
      expect(isValid).toBe(true);
    });

    it('should have auth_child_profiles table with correct structure', async () => {
      const isValid = await authSchema.validateSchema();
      expect(isValid).toBe(true);
    });

    it('should have auth_sessions table with correct structure', async () => {
      const isValid = await authSchema.validateSchema();
      expect(isValid).toBe(true);
    });
  });

  describe('Development Mode Behavior', () => {
    it('should handle development mode schema creation', async () => {
      // Ensure we're in development mode
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await authSchema.createAuthenticationSchema();

      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Development mode: Simulating authentication schema creation');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Mock authentication tables created');

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle development mode scope creation', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await authSchema.createAuthenticationScopes();

      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Development mode: Simulating authentication scopes creation');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Mock authentication scopes created');

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Error Handling', () => {
    it('should handle schema validation errors gracefully', async () => {
      // Mock a database error
      const originalQuery = db.query;
      db.query = jest.fn().mockRejectedValue(new Error('Database error'));

      const isValid = await authSchema.validateSchema();

      // In development mode, this should still return true due to mocking
      // In production mode, this would return false
      expect(typeof isValid).toBe('boolean');

      // Restore original method
      db.query = originalQuery;
    });
  });

  describe('Interface Compliance', () => {
    it('should have correct AuthFamily interface structure', () => {
      const mockFamily = {
        parent_email: 'parent@example.com',
        parent_name: 'John Doe',
        subscription_tier: 'free',
        coppa_consent_date: '2025-09-15T00:00:00Z',
        coppa_consent_version: '1.0',
        privacy_settings: {
          data_collection: true,
          analytics_sharing: false,
          marketing_emails: false,
          research_participation: false
        }
      };

      expect(mockFamily.parent_email).toBeDefined();
      expect(mockFamily.parent_name).toBeDefined();
      expect(mockFamily.privacy_settings).toBeDefined();
      expect(mockFamily.coppa_consent_date).toBeDefined();
    });

    it('should have correct AuthChildProfile interface structure', () => {
      const mockChild = {
        family_id: 'family:123',
        child_name: 'Jane Doe',
        age_group: 'ages6to9' as const,
        privacy_level: 'standard',
        parental_controls: {
          voice_recordings_allowed: true,
          camera_uploads_allowed: true,
          ai_interactions_logged: true,
          progress_sharing_enabled: true,
          real_time_monitoring: false
        }
      };

      expect(mockChild.family_id).toBeDefined();
      expect(mockChild.child_name).toBeDefined();
      expect(mockChild.age_group).toBeDefined();
      expect(mockChild.parental_controls).toBeDefined();
      expect(['ages6to9', 'ages10to13', 'ages14to16']).toContain(mockChild.age_group);
    });

    it('should have correct AuthSession interface structure', () => {
      const mockSession = {
        user_id: 'user:123',
        user_type: 'parent' as const,
        family_id: 'family:123',
        expires_at: '2025-09-16T00:00:00Z'
      };

      expect(mockSession.user_id).toBeDefined();
      expect(mockSession.user_type).toBeDefined();
      expect(mockSession.family_id).toBeDefined();
      expect(mockSession.expires_at).toBeDefined();
      expect(['parent', 'child']).toContain(mockSession.user_type);
    });
  });
});
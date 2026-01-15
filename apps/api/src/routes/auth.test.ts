import request from 'supertest';
import app from '../app';
import { getDatabase } from '../services/database';

describe('Auth Routes', () => {
  let db: any;

  beforeAll(() => {
    // Set NODE_ENV to development for testing
    process.env.NODE_ENV = 'development';
    db = getDatabase();
  });

  beforeEach(async () => {
    await db.connect();
    // Clear test data between tests
    if ((global as any).testFamilies) {
      (global as any).testFamilies = [];
    }
  });

  afterEach(async () => {
    await db.disconnect();
  });

  describe('POST /api/auth/register-family', () => {
    const validRegistrationData = {
      parentName: 'John Doe',
      parentEmail: 'john.doe@example.com',
      password: 'securePassword123',
      coppaConsent: true,
      coppaConsentVersion: '1.0',
      privacySettings: {
        data_collection: true,
        analytics_sharing: false,
        marketing_emails: false,
        research_participation: false
      }
    };

    it('should register a new family successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register-family')
        .send(validRegistrationData)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        message: 'Family registered successfully',
        family: expect.objectContaining({
          id: expect.any(String),
          parent_name: validRegistrationData.parentName,
          parent_email: validRegistrationData.parentEmail,
          subscription_tier: 'free',
          coppa_consent_version: validRegistrationData.coppaConsentVersion
        }),
        accessToken: expect.any(String),
        refreshToken: expect.any(String)
      });

      // Password should not be returned
      expect(response.body.family.password).toBeUndefined();
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register-family')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Validation Error',
        message: expect.stringContaining('required')
      });
    });

    it('should validate email format', async () => {
      const invalidEmailData = {
        ...validRegistrationData,
        parentEmail: 'invalid-email'
      };

      const response = await request(app)
        .post('/api/auth/register-family')
        .send(invalidEmailData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Validation Error',
        message: expect.stringContaining('email')
      });
    });

    it('should require COPPA consent', async () => {
      const noCoppaData = {
        ...validRegistrationData,
        coppaConsent: false
      };

      const response = await request(app)
        .post('/api/auth/register-family')
        .send(noCoppaData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toEqual({
        error: 'COPPA Consent Required',
        message: 'COPPA consent is required for family registration'
      });
    });

    it('should prevent duplicate email registration', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register-family')
        .send(validRegistrationData)
        .expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register-family')
        .send(validRegistrationData)
        .expect('Content-Type', /json/)
        .expect(409);

      expect(response.body).toEqual({
        error: 'Registration Conflict',
        message: 'An account with this email already exists'
      });
    });

    it('should validate password strength', async () => {
      const weakPasswordData = {
        ...validRegistrationData,
        password: '123'
      };

      const response = await request(app)
        .post('/api/auth/register-family')
        .send(weakPasswordData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Validation Error',
        message: 'Password must be at least 8 characters long and contain at least one letter and one number'
      });
    });

    it('should initialize default privacy settings when not provided', async () => {
      const noPrivacySettingsData = {
        parentName: 'Jane Doe',
        parentEmail: 'jane.doe@example.com',
        password: 'securePassword123',
        coppaConsent: true,
        coppaConsentVersion: '1.0'
      };

      const response = await request(app)
        .post('/api/auth/register-family')
        .send(noPrivacySettingsData)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body.family.privacy_settings).toEqual({
        data_collection: true,
        analytics_sharing: false,
        marketing_emails: false,
        research_participation: false
      });
    });
  });

  describe('POST /api/auth/login', () => {
    const loginData = {
      email: 'login.user@example.com',
      password: 'securePassword123'
    };

    beforeEach(async () => {
      // Clear any existing test data
      (global as any).testFamilies = [];

      // Register a family for login tests
      await request(app)
        .post('/api/auth/register-family')
        .send({
          parentName: 'John Doe',
          parentEmail: loginData.email,
          password: loginData.password,
          coppaConsent: true,
          coppaConsentVersion: '1.0'
        });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Login successful',
        family: expect.objectContaining({
          id: expect.any(String),
          parent_email: loginData.email,
          subscription_tier: 'free'
        }),
        accessToken: expect.any(String),
        refreshToken: expect.any(String)
      });

      // Password should not be returned
      expect(response.body.family.password).toBeUndefined();
    });

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: loginData.password
        })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      });
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: loginData.email,
          password: 'wrongPassword'
        })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      });
    });

    it('should validate required fields for login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Validation Error',
        message: expect.stringContaining('required')
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Clear any existing test data
      (global as any).testFamilies = [];

      // Register and get refresh token
      const registerResponse = await request(app)
        .post('/api/auth/register-family')
        .send({
          parentName: 'John Doe',
          parentEmail: 'refresh.user@example.com',
          password: 'securePassword123',
          coppaConsent: true,
          coppaConsentVersion: '1.0'
        });

      refreshToken = registerResponse.body.refreshToken;
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        accessToken: expect.any(String),
        refreshToken: expect.any(String)
      });
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication Failed',
        message: 'Invalid refresh token'
      });
    });

    it('should require refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Validation Error',
        message: 'Refresh token is required'
      });
    });
  });
});
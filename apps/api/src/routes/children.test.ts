import request from 'supertest';
import app from '../app';
import { getDatabase } from '../services/database';

describe('Children Routes', () => {
  let db: any;
  let familyId: string;
  let accessToken: string;

  beforeAll(() => {
    process.env.NODE_ENV = 'development';
    db = getDatabase();
  });

  beforeEach(async () => {
    await db.connect();
    // Clear test data between tests
    if ((global as any).testFamilies) {
      (global as any).testFamilies = [];
    }
    if ((global as any).testChildProfiles) {
      (global as any).testChildProfiles = [];
    }

    // Register a family for child profile tests
    const familyResponse = await request(app)
      .post('/api/auth/register-family')
      .send({
        parentName: 'Test Parent',
        parentEmail: 'parent@children.test',
        password: 'securePassword123',
        coppaConsent: true,
        coppaConsentVersion: '1.0'
      });

    familyId = familyResponse.body.family.id;
    accessToken = familyResponse.body.accessToken;
  });

  afterEach(async () => {
    await db.disconnect();
  });

  describe('POST /api/family/child-profiles', () => {
    const validChildData = {
      childName: 'Emma Johnson',
      ageGroup: 'ages6to9',
      privacyLevel: 'standard',
      parentalControls: {
        screen_time_limit: 60,
        content_filters: ['educational_only'],
        communication_allowed: false
      }
    };

    it('should create a new child profile successfully', async () => {
      const response = await request(app)
        .post('/api/family/child-profiles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validChildData)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        message: 'Child profile created successfully',
        childProfile: expect.objectContaining({
          id: expect.any(String),
          family_id: familyId,
          child_name: validChildData.childName,
          age_group: validChildData.ageGroup,
          privacy_level: validChildData.privacyLevel,
          parental_controls: validChildData.parentalControls
        })
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/family/child-profiles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Validation Error',
        message: expect.stringContaining('required')
      });
    });

    it('should validate age group enum values', async () => {
      const invalidAgeGroupData = {
        ...validChildData,
        ageGroup: 'invalid_age_group'
      };

      const response = await request(app)
        .post('/api/family/child-profiles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidAgeGroupData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Validation Error',
        message: 'Age group must be one of: ages6to9, ages10to13, ages14to16'
      });
    });

    it('should validate privacy level enum values', async () => {
      const invalidPrivacyData = {
        ...validChildData,
        privacyLevel: 'invalid_privacy'
      };

      const response = await request(app)
        .post('/api/family/child-profiles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidPrivacyData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Validation Error',
        message: 'Privacy level must be one of: strict, standard, relaxed'
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/family/child-profiles')
        .send(validChildData)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication Required',
        message: 'Access token is required'
      });
    });

    it('should initialize default parental controls when not provided', async () => {
      const noControlsData = {
        childName: 'Default Child',
        ageGroup: 'ages10to13',
        privacyLevel: 'standard'
      };

      const response = await request(app)
        .post('/api/family/child-profiles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(noControlsData)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body.childProfile.parental_controls).toEqual({
        screen_time_limit: 120,
        content_filters: ['age_appropriate'],
        communication_allowed: false
      });
    });
  });

  describe('GET /api/family/child-profiles', () => {
    beforeEach(async () => {
      // Create test child profiles
      await request(app)
        .post('/api/family/child-profiles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          childName: 'First Child',
          ageGroup: 'ages6to9',
          privacyLevel: 'strict'
        });

      await request(app)
        .post('/api/family/child-profiles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          childName: 'Second Child',
          ageGroup: 'ages10to13',
          privacyLevel: 'standard'
        });
    });

    it('should get all child profiles for family', async () => {
      const response = await request(app)
        .get('/api/family/child-profiles')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        childProfiles: expect.arrayContaining([
          expect.objectContaining({
            child_name: 'First Child',
            age_group: 'ages6to9'
          }),
          expect.objectContaining({
            child_name: 'Second Child',
            age_group: 'ages10to13'
          })
        ])
      });

      expect(response.body.childProfiles).toHaveLength(2);
    });

    it('should require authentication for listing profiles', async () => {
      const response = await request(app)
        .get('/api/family/child-profiles')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication Required',
        message: 'Access token is required'
      });
    });
  });

  describe('PUT /api/family/child-profiles/:id', () => {
    let childProfileId: string;

    beforeEach(async () => {
      // Create a child profile to update
      const createResponse = await request(app)
        .post('/api/family/child-profiles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          childName: 'Update Test Child',
          ageGroup: 'ages6to9',
          privacyLevel: 'standard'
        });

      childProfileId = createResponse.body.childProfile.id;
    });

    it('should update child profile successfully', async () => {
      const updateData = {
        childName: 'Updated Child Name',
        ageGroup: 'ages10to13',
        privacyLevel: 'strict',
        parentalControls: {
          screen_time_limit: 90,
          content_filters: ['educational_only', 'no_social_media'],
          communication_allowed: false
        }
      };

      const response = await request(app)
        .put(`/api/family/child-profiles/${childProfileId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Child profile updated successfully',
        childProfile: expect.objectContaining({
          id: childProfileId,
          child_name: updateData.childName,
          age_group: updateData.ageGroup,
          privacy_level: updateData.privacyLevel,
          parental_controls: updateData.parentalControls
        })
      });
    });

    it('should validate age group on update', async () => {
      const response = await request(app)
        .put(`/api/family/child-profiles/${childProfileId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ageGroup: 'invalid_age' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Validation Error',
        message: 'Age group must be one of: ages6to9, ages10to13, ages14to16'
      });
    });

    it('should return 404 for non-existent child profile', async () => {
      const response = await request(app)
        .put('/api/family/child-profiles/nonexistent')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ childName: 'Test' })
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toEqual({
        error: 'Not Found',
        message: 'Child profile not found'
      });
    });

    it('should require authentication for updates', async () => {
      const response = await request(app)
        .put(`/api/family/child-profiles/${childProfileId}`)
        .send({ childName: 'Test' })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication Required',
        message: 'Access token is required'
      });
    });
  });
});
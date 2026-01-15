import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  authenticateToken,
  validateFamilyAccess,
  ageAppropriateContent,
  AuthenticatedRequest
} from './auth';

// Mock JWT secret for tests (matches what middleware uses in development)
const JWT_SECRET = 'dev-secret-key';
const JWT_REFRESH_SECRET = 'dev-refresh-secret';

// Mock response object
const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Mock next function
const mockNext = jest.fn();

describe('Authentication Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Don't override JWT_SECRET - let middleware use its default
    process.env.NODE_ENV = 'development';
  });

  describe('authenticateToken', () => {
    it('should authenticate valid JWT token successfully', () => {
      const familyId = 'family:123';
      const userType = 'parent';
      const token = jwt.sign({ familyId, userType, userId: familyId }, JWT_SECRET, { expiresIn: '15m' });

      const req = {
        headers: {
          authorization: `Bearer ${token}`
        }
      } as AuthenticatedRequest;
      const res = mockResponse();

      authenticateToken(req, res, mockNext);

      expect(req.familyId).toBe(familyId);
      expect(req.userType).toBe(userType);
      expect(req.userId).toBe(familyId);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', () => {
      const req = { headers: {} } as AuthenticatedRequest;
      const res = mockResponse();

      authenticateToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication Required',
        message: 'Access token is required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with malformed authorization header', () => {
      const req = {
        headers: {
          authorization: 'InvalidFormat'
        }
      } as AuthenticatedRequest;
      const res = mockResponse();

      authenticateToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication Required',
        message: 'Access token is required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid JWT token', () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid-token'
        }
      } as AuthenticatedRequest;
      const res = mockResponse();

      authenticateToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication Failed',
        message: 'Invalid access token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject expired JWT token', () => {
      const familyId = 'family:123';
      const userType = 'parent';
      const expiredToken = jwt.sign(
        { familyId, userType, userId: familyId },
        JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const req = {
        headers: {
          authorization: `Bearer ${expiredToken}`
        }
      } as AuthenticatedRequest;
      const res = mockResponse();

      authenticateToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication Failed',
        message: 'Invalid access token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle child user tokens', () => {
      const familyId = 'family:123';
      const childId = 'child:456';
      const userType = 'child';
      const token = jwt.sign(
        { familyId, userType, userId: childId, childId },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      const req = {
        headers: {
          authorization: `Bearer ${token}`
        }
      } as AuthenticatedRequest;
      const res = mockResponse();

      authenticateToken(req, res, mockNext);

      expect(req.familyId).toBe(familyId);
      expect(req.userType).toBe(userType);
      expect(req.userId).toBe(childId);
      expect(req.childId).toBe(childId);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateFamilyAccess', () => {
    beforeEach(() => {
      // Clear test data
      if ((global as any).testChildProfiles) {
        (global as any).testChildProfiles = [];
      }
    });

    it('should allow parent access to own family data', () => {
      const req = {
        familyId: 'family:123',
        userType: 'parent',
        params: { familyId: 'family:123' }
      } as AuthenticatedRequest;
      const res = mockResponse();

      validateFamilyAccess(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow child access to own family data', () => {
      const req = {
        familyId: 'family:123',
        userType: 'child',
        childId: 'child:456',
        params: { familyId: 'family:123' }
      } as AuthenticatedRequest;
      const res = mockResponse();

      validateFamilyAccess(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny access to different family data', () => {
      const req = {
        familyId: 'family:123',
        userType: 'parent',
        params: { familyId: 'family:456' }
      } as AuthenticatedRequest;
      const res = mockResponse();

      validateFamilyAccess(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access Denied',
        message: 'You do not have permission to access this family data'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow child access to own profile', () => {
      // Setup test child profile
      const childProfile = {
        id: 'child:456',
        family_id: 'family:123',
        child_name: 'Test Child',
        age_group: 'ages6to9'
      };
      (global as any).testChildProfiles = [childProfile];

      const req = {
        familyId: 'family:123',
        userType: 'child',
        childId: 'child:456',
        params: { id: 'child:456' }
      } as AuthenticatedRequest;
      const res = mockResponse();

      validateFamilyAccess(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny child access to other child profiles', () => {
      // Setup test child profiles
      const childProfiles = [
        {
          id: 'child:456',
          family_id: 'family:123',
          child_name: 'Test Child 1',
          age_group: 'ages6to9'
        },
        {
          id: 'child:789',
          family_id: 'family:123',
          child_name: 'Test Child 2',
          age_group: 'ages10to13'
        }
      ];
      (global as any).testChildProfiles = childProfiles;

      const req = {
        familyId: 'family:123',
        userType: 'child',
        childId: 'child:456',
        params: { id: 'child:789' }
      } as AuthenticatedRequest;
      const res = mockResponse();

      validateFamilyAccess(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access Denied',
        message: 'You can only access your own profile'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should work without params (for list endpoints)', () => {
      const req = {
        familyId: 'family:123',
        userType: 'parent',
        params: {}
      } as AuthenticatedRequest;
      const res = mockResponse();

      validateFamilyAccess(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('ageAppropriateContent', () => {
    beforeEach(() => {
      // Clear test data
      if ((global as any).testChildProfiles) {
        (global as any).testChildProfiles = [];
      }
    });

    it('should allow parent access to all content', () => {
      const req = {
        familyId: 'family:123',
        userType: 'parent',
        body: { contentType: 'adult_content' }
      } as AuthenticatedRequest;
      const res = mockResponse();

      ageAppropriateContent(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should filter content for ages6to9 children', () => {
      // Setup child profile
      const childProfile = {
        id: 'child:456',
        family_id: 'family:123',
        child_name: 'Young Child',
        age_group: 'ages6to9'
      };
      (global as any).testChildProfiles = [childProfile];

      const req = {
        familyId: 'family:123',
        userType: 'child',
        childId: 'child:456',
        body: { contentType: 'social_media' }
      } as AuthenticatedRequest;
      const res = mockResponse();

      ageAppropriateContent(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Content Restricted',
        message: 'This content is not appropriate for your age group'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow educational content for all age groups', () => {
      // Setup child profile
      const childProfile = {
        id: 'child:456',
        family_id: 'family:123',
        child_name: 'Young Child',
        age_group: 'ages6to9'
      };
      (global as any).testChildProfiles = [childProfile];

      const req = {
        familyId: 'family:123',
        userType: 'child',
        childId: 'child:456',
        body: { contentType: 'educational' }
      } as AuthenticatedRequest;
      const res = mockResponse();

      ageAppropriateContent(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow age-appropriate content for ages10to13', () => {
      // Setup child profile
      const childProfile = {
        id: 'child:789',
        family_id: 'family:123',
        child_name: 'Middle Child',
        age_group: 'ages10to13'
      };
      (global as any).testChildProfiles = [childProfile];

      const req = {
        familyId: 'family:123',
        userType: 'child',
        childId: 'child:789',
        body: { contentType: 'age_appropriate' }
      } as AuthenticatedRequest;
      const res = mockResponse();

      ageAppropriateContent(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow broader content for ages14to16', () => {
      // Setup child profile
      const childProfile = {
        id: 'child:101',
        family_id: 'family:123',
        child_name: 'Teen Child',
        age_group: 'ages14to16'
      };
      (global as any).testChildProfiles = [childProfile];

      const req = {
        familyId: 'family:123',
        userType: 'child',
        childId: 'child:101',
        body: { contentType: 'teen_appropriate' }
      } as AuthenticatedRequest;
      const res = mockResponse();

      ageAppropriateContent(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle missing child profile gracefully', () => {
      (global as any).testChildProfiles = [];

      const req = {
        familyId: 'family:123',
        userType: 'child',
        childId: 'child:nonexistent',
        body: { contentType: 'educational' }
      } as AuthenticatedRequest;
      const res = mockResponse();

      ageAppropriateContent(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Profile Not Found',
        message: 'Child profile not found for content filtering'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should work without body content', () => {
      const req = {
        familyId: 'family:123',
        userType: 'parent',
        body: {}
      } as AuthenticatedRequest;
      const res = mockResponse();

      ageAppropriateContent(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../services/database';

// JWT secrets
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// Extended request interface for authenticated requests
export interface AuthenticatedRequest extends Request {
  familyId?: string;
  userType?: 'parent' | 'child';
  userId?: string;
  childId?: string;
}

// Authentication middleware to verify JWT tokens
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Authentication Required',
      message: 'Access token is required'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Set authenticated user details
    req.familyId = decoded.familyId;
    req.userType = decoded.userType;
    req.userId = decoded.userId;

    // For child users, also set childId
    if (decoded.userType === 'child' && decoded.childId) {
      req.childId = decoded.childId;
    }

    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Authentication Failed',
      message: 'Invalid access token'
    });
  }
};

// Middleware to validate family-scoped data access
export const validateFamilyAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { familyId, userType, childId } = req;
    const { familyId: paramFamilyId, id: resourceId } = req.params;

    // Allow access if no specific family ID is being requested (for list endpoints)
    if (!paramFamilyId && !resourceId) {
      return next();
    }

    // Check family access for family-scoped resources
    if (paramFamilyId && paramFamilyId !== familyId) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You do not have permission to access this family data'
      });
    }

    // For child users, ensure they can only access their own profile
    if (userType === 'child' && resourceId && childId) {
      // Check if the resource being accessed is the child's own profile
      if (process.env.NODE_ENV === 'development') {
        // Development mode: check against test data
        const testChildProfiles = (global as any).testChildProfiles || [];
        const childProfile = testChildProfiles.find((profile: any) => profile.id === childId);

        if (!childProfile) {
          return res.status(403).json({
            error: 'Access Denied',
            message: 'Child profile not found'
          });
        }

        // Allow access only to own profile
        if (resourceId !== childId) {
          return res.status(403).json({
            error: 'Access Denied',
            message: 'You can only access your own profile'
          });
        }
      } else {
        // Production mode: check against database
        const db = getDatabase();
        const childProfile = await db.query(
          'SELECT * FROM auth_child_profiles WHERE id = $childId AND family_id = $familyId',
          { childId, familyId }
        );

        if (!childProfile || childProfile.length === 0) {
          return res.status(403).json({
            error: 'Access Denied',
            message: 'Child profile not found'
          });
        }

        // Allow access only to own profile
        if (resourceId !== childId) {
          return res.status(403).json({
            error: 'Access Denied',
            message: 'You can only access your own profile'
          });
        }
      }
    }

    next();
  } catch (error) {
    console.error('Family access validation error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate family access'
    });
  }
};

// Content filtering types based on age groups
const CONTENT_RESTRICTIONS = {
  'ages6to9': {
    allowed: ['educational', 'games_educational', 'stories_age_appropriate'],
    blocked: ['social_media', 'chat', 'user_generated_content', 'advanced_topics']
  },
  'ages10to13': {
    allowed: ['educational', 'age_appropriate', 'supervised_social', 'basic_research'],
    blocked: ['adult_content', 'unrestricted_chat', 'financial_topics']
  },
  'ages14to16': {
    allowed: ['educational', 'age_appropriate', 'teen_appropriate', 'supervised_research', 'career_planning'],
    blocked: ['adult_content', 'financial_transactions']
  }
};

// Middleware for age-appropriate content filtering
export const ageAppropriateContent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { userType, familyId, childId } = req;
    const { contentType } = req.body;

    // Parents have unrestricted access
    if (userType === 'parent') {
      return next();
    }

    // If no content type specified, allow the request
    if (!contentType) {
      return next();
    }

    // For child users, check age-appropriate content restrictions
    if (userType === 'child' && childId) {
      let childProfile: any = null;

      if (process.env.NODE_ENV === 'development') {
        // Development mode: check against test data
        const testChildProfiles = (global as any).testChildProfiles || [];
        childProfile = testChildProfiles.find((profile: any) => profile.id === childId);
      } else {
        // Production mode: check against database
        const db = getDatabase();
        const result = await db.query(
          'SELECT * FROM auth_child_profiles WHERE id = $childId AND family_id = $familyId',
          { childId, familyId }
        );
        childProfile = result[0] || null;
      }

      if (!childProfile) {
        return res.status(403).json({
          error: 'Profile Not Found',
          message: 'Child profile not found for content filtering'
        });
      }

      const ageGroup = childProfile.age_group;
      const restrictions = CONTENT_RESTRICTIONS[ageGroup as keyof typeof CONTENT_RESTRICTIONS];

      if (!restrictions) {
        return res.status(403).json({
          error: 'Content Restricted',
          message: 'Age group not recognized for content filtering'
        });
      }

      // Check if content type is explicitly blocked
      if (restrictions.blocked.includes(contentType)) {
        return res.status(403).json({
          error: 'Content Restricted',
          message: 'This content is not appropriate for your age group'
        });
      }

      // Allow if content type is in allowed list or if it's not restricted
      if (restrictions.allowed.includes(contentType) || !restrictions.blocked.includes(contentType)) {
        return next();
      }

      // Default: block unknown content types for children
      return res.status(403).json({
        error: 'Content Restricted',
        message: 'This content is not appropriate for your age group'
      });
    }

    next();
  } catch (error) {
    console.error('Age-appropriate content filtering error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate content appropriateness'
    });
  }
};

// Middleware to check session timeouts based on user type
export const validateSessionTimeout = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { userType } = req;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Authentication Required',
        message: 'Access token is required'
      });
    }

    const decoded = jwt.decode(token) as any;

    if (!decoded || !decoded.iat || !decoded.exp) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid token format'
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const tokenAge = now - decoded.iat;

    // Session timeout rules based on user type
    const sessionLimits = {
      parent: 24 * 60 * 60, // 24 hours
      child: 4 * 60 * 60    // 4 hours
    };

    const maxAge = sessionLimits[userType as keyof typeof sessionLimits] || sessionLimits.child;

    if (tokenAge > maxAge) {
      return res.status(401).json({
        error: 'Session Expired',
        message: `Session has exceeded maximum duration for ${userType} users`
      });
    }

    next();
  } catch (error) {
    console.error('Session timeout validation error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate session timeout'
    });
  }
};

// Combined middleware for comprehensive authentication and authorization
export const requireAuth = [authenticateToken, validateSessionTimeout];
export const requireFamilyAuth = [authenticateToken, validateSessionTimeout, validateFamilyAccess];
export const requireAgeAppropriate = [authenticateToken, validateSessionTimeout, ageAppropriateContent];
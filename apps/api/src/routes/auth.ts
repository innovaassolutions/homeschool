import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../services/database';
import { AuthFamily } from '../services/auth-schema';

const router = express.Router();

// Mock JWT secret for development
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';

interface FamilyRegistrationRequest {
  parentName: string;
  parentEmail: string;
  password: string;
  coppaConsent: boolean;
  coppaConsentVersion: string;
  privacySettings?: {
    data_collection: boolean;
    analytics_sharing: boolean;
    marketing_emails: boolean;
    research_participation: boolean;
  };
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RefreshRequest {
  refreshToken: string;
}

// Validation helpers
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password: string): boolean => {
  // At least 8 characters, with at least one letter and one number
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
};

const generateTokens = (familyId: string, userType: 'parent' | 'child' = 'parent') => {
  const accessToken = jwt.sign(
    {
      familyId,
      userType,
      userId: familyId
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    {
      familyId,
      userType
    },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

const hashPassword = async (password: string): Promise<string> => {
  if (process.env.NODE_ENV === 'development') {
    // Mock password hashing for development
    return `hashed_${password}`;
  }
  // In production, would use actual crypto::argon2::generate through SurrealDB
  return `argon2_${password}`;
};

const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  if (process.env.NODE_ENV === 'development') {
    // Mock password verification for development
    return hashedPassword === `hashed_${password}`;
  }
  // In production, would use actual crypto::argon2::compare through SurrealDB
  return hashedPassword === `argon2_${password}`;
};

// POST /api/auth/register-family
router.post('/register-family', async (req: Request, res: Response) => {
  try {
    const {
      parentName,
      parentEmail,
      password,
      coppaConsent,
      coppaConsentVersion,
      privacySettings
    }: FamilyRegistrationRequest = req.body;

    // Validation
    if (!parentName || !parentEmail || !password || coppaConsent === undefined || !coppaConsentVersion) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'All required fields must be provided: parentName, parentEmail, password, coppaConsent, coppaConsentVersion'
      });
      return;
    }

    if (!validateEmail(parentEmail)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Please provide a valid email address'
      });
    }

    if (!validatePassword(password)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Password must be at least 8 characters long and contain at least one letter and one number'
      });
    }

    if (!coppaConsent) {
      res.status(400).json({
        error: 'COPPA Consent Required',
        message: 'COPPA consent is required for family registration'
      });
    }

    const db = getDatabase();

    // Check for existing email
    if (process.env.NODE_ENV === 'development') {
      // In development mode, simulate checking for existing emails
      // For tests, we'll track registrations in memory
      const existingFamily = (global as any).testFamilies?.find(
        (f: any) => f.parent_email === parentEmail
      );

      if (existingFamily) {
        res.status(409).json({
          error: 'Registration Conflict',
          message: 'An account with this email already exists'
        });
      }
    } else {
      // Production database check would go here
      const existingFamily = await db.query(
        'SELECT * FROM auth_families WHERE parent_email = $email',
        { email: parentEmail }
      );

      if (existingFamily.length > 0) {
        res.status(409).json({
          error: 'Registration Conflict',
          message: 'An account with this email already exists'
        });
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create family record
    const familyData: AuthFamily = {
      parent_email: parentEmail,
      parent_name: parentName,
      password: hashedPassword,
      subscription_tier: 'free',
      coppa_consent_date: new Date().toISOString(),
      coppa_consent_version: coppaConsentVersion,
      privacy_settings: privacySettings || {
        data_collection: true,
        analytics_sharing: false,
        marketing_emails: false,
        research_participation: false
      }
    };

    let familyId: string;

    if (process.env.NODE_ENV === 'development') {
      // Mock family creation for development
      familyId = `family:${Date.now()}`;
      const family = { ...familyData, id: familyId };

      // Store in global test state
      if (!(global as any).testFamilies) {
        (global as any).testFamilies = [];
      }
      (global as any).testFamilies.push(family);

      console.log(`✅ Mock family registered: ${parentEmail}`);
    } else {
      // Production family creation
      const result = await db.query(
        'CREATE auth_families SET parent_email = $email, parent_name = $name, password = $password, coppa_consent_date = time::now(), coppa_consent_version = $version, privacy_settings = $privacy',
        {
          email: parentEmail,
          name: parentName,
          password: hashedPassword,
          version: coppaConsentVersion,
          privacy: familyData.privacy_settings
        }
      );
      familyId = result[0].id;
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(familyId, 'parent');

    // Return response without password
    const { password: _, ...familyResponse } = familyData;

    res.status(201).json({
      success: true,
      message: 'Family registered successfully',
      family: {
        id: familyId,
        ...familyResponse
      },
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Family registration error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to register family'
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginRequest = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Email and password are required'
      });
    }

    const db = getDatabase();
    let family: AuthFamily | null = null;

    if (process.env.NODE_ENV === 'development') {
      // Mock family lookup for development
      const testFamilies = (global as any).testFamilies || [];
      family = testFamilies.find((f: any) => f.parent_email === email);
    } else {
      // Production family lookup
      const result = await db.query(
        'SELECT * FROM auth_families WHERE parent_email = $email',
        { email }
      );
      family = result[0] || null;
    }

    if (!family) {
      res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, family.password!);

    if (!isValidPassword) {
      res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password'
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(family.id!, 'parent');

    // Return response without password
    const { password: _, ...familyResponse } = family;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      family: familyResponse,
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to authenticate'
    });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken }: RefreshRequest = req.body;

    if (!refreshToken) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Refresh token is required'
      });
    }

    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;

      // Generate new tokens
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(
        decoded.familyId,
        decoded.userType
      );

      res.status(200).json({
        success: true,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      });

    } catch (jwtError) {
      res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid refresh token'
      });
    }

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to refresh token'
    });
  }
});

export default router;
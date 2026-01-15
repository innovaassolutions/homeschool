import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../services/database';

const router = express.Router();

// JWT secret for development
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

interface AuthenticatedRequest extends Request {
  familyId?: string;
  userType?: string;
}

interface ChildProfileRequest {
  childName: string;
  ageGroup: 'ages6to9' | 'ages10to13' | 'ages14to16';
  privacyLevel: 'strict' | 'standard' | 'relaxed';
  parentalControls?: {
    screen_time_limit: number;
    content_filters: string[];
    communication_allowed: boolean;
  };
}

interface ChildProfile {
  id?: string;
  family_id: string;
  child_name: string;
  age_group: 'ages6to9' | 'ages10to13' | 'ages14to16';
  privacy_level: 'strict' | 'standard' | 'relaxed';
  parental_controls: {
    screen_time_limit: number;
    content_filters: string[];
    communication_allowed: boolean;
  };
  created_at?: string;
  updated_at?: string;
}

// Authentication middleware
const authenticateToken = (req: AuthenticatedRequest, res: Response, next: Function) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      error: 'Authentication Required',
      message: 'Access token is required'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.familyId = decoded.familyId;
    req.userType = decoded.userType;
    next();
  } catch (error) {
    res.status(401).json({
      error: 'Authentication Failed',
      message: 'Invalid access token'
    });
  }
};

// Validation helpers
const validateAgeGroup = (ageGroup: string): boolean => {
  return ['ages6to9', 'ages10to13', 'ages14to16'].includes(ageGroup);
};

const validatePrivacyLevel = (privacyLevel: string): boolean => {
  return ['strict', 'standard', 'relaxed'].includes(privacyLevel);
};

const getDefaultParentalControls = (ageGroup: string) => {
  switch (ageGroup) {
    case 'ages6to9':
      return {
        screen_time_limit: 60,
        content_filters: ['educational_only'],
        communication_allowed: false
      };
    case 'ages10to13':
      return {
        screen_time_limit: 120,
        content_filters: ['age_appropriate'],
        communication_allowed: false
      };
    case 'ages14to16':
      return {
        screen_time_limit: 180,
        content_filters: ['age_appropriate'],
        communication_allowed: true
      };
    default:
      return {
        screen_time_limit: 120,
        content_filters: ['age_appropriate'],
        communication_allowed: false
      };
  }
};

// POST /api/family/child-profiles - Create child profile
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      childName,
      ageGroup,
      privacyLevel,
      parentalControls
    }: ChildProfileRequest = req.body;

    // Validation
    if (!childName || !ageGroup || !privacyLevel) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'All required fields must be provided: childName, ageGroup, privacyLevel'
      });
    }

    if (!validateAgeGroup(ageGroup)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Age group must be one of: ages6to9, ages10to13, ages14to16'
      });
    }

    if (!validatePrivacyLevel(privacyLevel)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Privacy level must be one of: strict, standard, relaxed'
      });
    }

    const db = getDatabase();

    // Create child profile data
    const childProfileData: ChildProfile = {
      family_id: req.familyId!,
      child_name: childName,
      age_group: ageGroup,
      privacy_level: privacyLevel,
      parental_controls: parentalControls || getDefaultParentalControls(ageGroup),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let childProfileId: string;

    if (process.env.NODE_ENV === 'development') {
      // Mock child profile creation for development
      childProfileId = `child:${Date.now()}`;
      const childProfile = { ...childProfileData, id: childProfileId };

      // Store in global test state
      if (!(global as any).testChildProfiles) {
        (global as any).testChildProfiles = [];
      }
      (global as any).testChildProfiles.push(childProfile);

      console.log(`✅ Mock child profile created: ${childName} (${ageGroup})`);
    } else {
      // Production child profile creation
      const result = await db.query(
        `CREATE auth_child_profiles SET
         family_id = $familyId,
         child_name = $childName,
         age_group = $ageGroup,
         privacy_level = $privacyLevel,
         parental_controls = $parentalControls,
         created_at = time::now(),
         updated_at = time::now()`,
        {
          familyId: req.familyId,
          childName,
          ageGroup,
          privacyLevel,
          parentalControls: childProfileData.parental_controls
        }
      );
      childProfileId = result[0].id;
    }

    res.status(201).json({
      success: true,
      message: 'Child profile created successfully',
      childProfile: {
        id: childProfileId,
        ...childProfileData
      }
    });

  } catch (error) {
    console.error('Child profile creation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create child profile'
    });
  }
});

// GET /api/family/child-profiles - Get all child profiles for family
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    let childProfiles: ChildProfile[] = [];

    if (process.env.NODE_ENV === 'development') {
      // Mock child profile retrieval for development
      const testChildProfiles = (global as any).testChildProfiles || [];
      childProfiles = testChildProfiles.filter((profile: ChildProfile) =>
        profile.family_id === req.familyId
      );
    } else {
      // Production child profile retrieval
      const result = await db.query(
        'SELECT * FROM auth_child_profiles WHERE family_id = $familyId ORDER BY created_at ASC',
        { familyId: req.familyId }
      );
      childProfiles = result;
    }

    res.status(200).json({
      success: true,
      childProfiles
    });

  } catch (error) {
    console.error('Child profiles retrieval error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve child profiles'
    });
  }
});

// PUT /api/family/child-profiles/:id - Update child profile
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const childProfileId = req.params.id;
    const {
      childName,
      ageGroup,
      privacyLevel,
      parentalControls
    }: Partial<ChildProfileRequest> = req.body;

    // Validate age group if provided
    if (ageGroup && !validateAgeGroup(ageGroup)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Age group must be one of: ages6to9, ages10to13, ages14to16'
      });
    }

    // Validate privacy level if provided
    if (privacyLevel && !validatePrivacyLevel(privacyLevel)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Privacy level must be one of: strict, standard, relaxed'
      });
    }

    const db = getDatabase();
    let updatedChildProfile: ChildProfile | null = null;

    if (process.env.NODE_ENV === 'development') {
      // Mock child profile update for development
      const testChildProfiles = (global as any).testChildProfiles || [];
      const profileIndex = testChildProfiles.findIndex(
        (profile: ChildProfile) => profile.id === childProfileId && profile.family_id === req.familyId
      );

      if (profileIndex === -1) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Child profile not found'
        });
      }

      // Update the profile
      const existingProfile = testChildProfiles[profileIndex];
      updatedChildProfile = {
        ...existingProfile,
        ...(childName && { child_name: childName }),
        ...(ageGroup && { age_group: ageGroup }),
        ...(privacyLevel && { privacy_level: privacyLevel }),
        ...(parentalControls && { parental_controls: parentalControls }),
        updated_at: new Date().toISOString()
      };

      testChildProfiles[profileIndex] = updatedChildProfile;
      console.log(`✅ Mock child profile updated: ${childProfileId}`);
    } else {
      // Production child profile update
      const updateFields = [];
      const params: any = { id: childProfileId, familyId: req.familyId };

      if (childName) {
        updateFields.push('child_name = $childName');
        params.childName = childName;
      }
      if (ageGroup) {
        updateFields.push('age_group = $ageGroup');
        params.ageGroup = ageGroup;
      }
      if (privacyLevel) {
        updateFields.push('privacy_level = $privacyLevel');
        params.privacyLevel = privacyLevel;
      }
      if (parentalControls) {
        updateFields.push('parental_controls = $parentalControls');
        params.parentalControls = parentalControls;
      }

      if (updateFields.length === 0) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'At least one field must be provided for update'
        });
      }

      updateFields.push('updated_at = time::now()');

      const result = await db.query(
        `UPDATE $id SET ${updateFields.join(', ')} WHERE family_id = $familyId RETURN *`,
        params
      );

      if (!result || result.length === 0) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Child profile not found'
        });
      }

      updatedChildProfile = result[0];
    }

    res.status(200).json({
      success: true,
      message: 'Child profile updated successfully',
      childProfile: updatedChildProfile
    });

  } catch (error) {
    console.error('Child profile update error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update child profile'
    });
  }
});

export default router;
# Backend Architecture

## Express.js API Structure

```typescript
// Main application structure
apps/api/
├── src/
│   ├── routes/
│   │   ├── auth.ts           // Family registration, login
│   │   ├── children.ts       // Child profile management
│   │   ├── learning.ts       // Learning sessions, progress
│   │   ├── assessment.ts     // Work evaluation, feedback
│   │   └── family.ts         // Family dashboard, settings
│   ├── middleware/
│   │   ├── auth.ts           // JWT + SurrealDB auth
│   │   ├── coppa.ts          // COPPA compliance checks
│   │   ├── ageGate.ts        // Age-appropriate content
│   │   └── familyAccess.ts   // Family data validation
│   ├── services/
│   │   ├── surrealdb.ts      // Database connection
│   │   ├── chatgpt.ts        // AI tutor integration
│   │   ├── assessment.ts     // Work evaluation logic
│   │   └── notifications.ts  // Real-time updates
│   └── types/
│       ├── auth.ts
│       ├── learning.ts
│       └── family.ts
```

## COPPA Compliance Middleware

```typescript
// COPPA compliance validation
export const coppaCompliance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user?.userType === 'child') {
      const childProfile = await surrealdb.query(`
        SELECT 
          age_group,
          family_id.coppa_consent_date,
          family_id.privacy_settings,
          parental_controls
        FROM auth_child_profiles 
        WHERE id = $child_id
      `, { child_id: req.user.childId });

      if (!childProfile[0]) {
        return res.status(403).json({ error: 'Child profile not found' });
      }

      const { coppa_consent_date, privacy_settings, parental_controls } = childProfile[0];
      
      // Ensure COPPA consent is current (within 1 year)
      const consentAge = Date.now() - new Date(coppa_consent_date).getTime();
      const oneYear = 365 * 24 * 60 * 60 * 1000;
      
      if (consentAge > oneYear) {
        return res.status(403).json({ 
          error: 'COPPA consent expired',
          action: 'parent_reconfirmation_required'
        });
      }

      // Add compliance context to request
      req.coppaContext = {
        consentValid: true,
        privacySettings: privacy_settings,
        parentalControls: parental_controls,
        dataCollectionAllowed: privacy_settings.data_collection
      };
    }
    
    next();
  } catch (error) {
    return res.status(500).json({ error: 'COPPA compliance check failed' });
  }
};
```

## Learning Session API with Real-time Updates

```typescript
// Learning session management
router.post('/api/learning/session/start', 
  authenticateToken,
  ageAppropriateContent,
  coppaCompliance,
  async (req: Request, res: Response) => {
    try {
      const { childId, subject, topic } = req.body;
      
      // Validate family access
      if (req.user.familyId !== req.body.familyId) {
        return res.status(403).json({ error: 'Family access denied' });
      }

      // Create learning session
      const session = await surrealdb.query(`
        CREATE learning_sessions SET
          child_id = $child_id,
          subject = $subject,
          topic = $topic,
          start_time = time::now(),
          attention_metrics = {},
          voice_interactions = [],
          privacy_compliant = $coppa_compliant
      `, {
        child_id: childId,
        subject,
        topic,
        coppa_compliant: req.coppaContext?.dataCollectionAllowed || false
      });

      // Start live progress tracking for parents (if enabled)
      if (req.coppaContext?.parentalControls?.real_time_monitoring) {
        await surrealdb.query(`
          CREATE live_session_updates SET
            session_id = $session_id,
            family_id = $family_id,
            update_type = 'session_started',
            timestamp = time::now()
        `, {
          session_id: session[0].id,
          family_id: req.user.familyId
        });
      }

      res.json({ 
        success: true, 
        sessionId: session[0].id,
        privacyMode: req.coppaContext?.dataCollectionAllowed ? 'full' : 'minimal'
      });
      
    } catch (error) {
      res.status(500).json({ error: 'Failed to start learning session' });
    }
  }
);
```
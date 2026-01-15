# Frontend Architecture

## React Component Structure

```typescript
// Age-adaptive component system
interface AgeAdaptiveProps {
  ageGroup: 'ages6to9' | 'ages10to13' | 'ages14to16';
  content: ComponentContent;
}

// Main application structure
src/
├── components/
│   ├── auth/
│   │   ├── FamilyRegistration.tsx
│   │   ├── ChildProfileSelector.tsx
│   │   └── COPPAConsent.tsx
│   ├── learning/
│   │   ├── LearningSession.tsx
│   │   ├── VoiceInteraction.tsx
│   │   └── WorkAssessment.tsx
│   ├── dashboard/
│   │   ├── ParentDashboard.tsx
│   │   ├── ChildProgress.tsx
│   │   └── FamilyOverview.tsx
│   └── age-adaptive/
│       ├── UIAges6to9.tsx
│       ├── UIAges10to13.tsx
│       └── UIAges14to16.tsx
├── hooks/
│   ├── useSurrealAuth.ts
│   ├── useLiveProgress.ts
│   └── useAgeAdaptive.ts
├── services/
│   ├── surrealdb.ts
│   ├── auth.ts
│   └── ai-tutor.ts
└── stores/
    ├── authStore.ts
    ├── learningStore.ts
    └── progressStore.ts
```

## State Management with SurrealDB Live Queries

```typescript
// Real-time progress store with SurrealDB integration
import { create } from 'zustand';
import { surrealdb } from '../services/surrealdb';

interface ProgressStore {
  currentSession: LearningSession | null;
  liveProgress: ProgressUpdate[];
  startLiveTracking: (childId: string) => void;
  stopLiveTracking: () => void;
}

export const useProgressStore = create<ProgressStore>((set, get) => ({
  currentSession: null,
  liveProgress: [],
  
  startLiveTracking: async (childId: string) => {
    // SurrealDB live query for real-time progress
    const unsubscribe = await surrealdb.live(`
      SELECT 
        skill_name,
        mastery_level,
        success_rate,
        last_practiced
      FROM skill_mastery 
      WHERE child_id = $child_id
    `, { child_id: childId }, (data) => {
      set({ liveProgress: data });
    });
    
    // Store unsubscribe function for cleanup
    set({ unsubscribeLive: unsubscribe });
  },
  
  stopLiveTracking: () => {
    const { unsubscribeLive } = get();
    if (unsubscribeLive) {
      unsubscribeLive();
    }
  }
}));
```

## Authentication Hook with Family Context

```typescript
// Custom hook for family-scoped authentication
export const useSurrealAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [childProfiles, setChildProfiles] = useState<ChildProfile[]>([]);

  const loginParent = async (email: string, password: string) => {
    try {
      const token = await surrealdb.signin({
        namespace: 'homeschool',
        database: 'main',
        scope: 'parent',
        email,
        password
      });
      
      // Fetch family data and child profiles
      const familyData = await surrealdb.query(`
        SELECT *, 
          (SELECT * FROM auth_child_profiles WHERE family_id = $auth.id) as children
        FROM auth_families WHERE id = $auth.id
      `);
      
      setUser({ type: 'parent', ...familyData[0] });
      setFamily(familyData[0]);
      setChildProfiles(familyData[0].children);
      
    } catch (error) {
      throw new Error('Login failed');
    }
  };

  const selectChildProfile = async (childId: string) => {
    try {
      const childToken = await surrealdb.signin({
        namespace: 'homeschool',
        database: 'main',
        scope: 'child',
        family_id: family?.id,
        child_profile_id: childId,
        parent_session_valid: true
      });
      
      const childData = childProfiles.find(c => c.id === childId);
      setUser({ type: 'child', ...childData });
      
    } catch (error) {
      throw new Error('Child profile selection failed');
    }
  };

  return {
    user,
    family,
    childProfiles,
    loginParent,
    selectChildProfile,
    logout: () => surrealdb.invalidate()
  };
};
```
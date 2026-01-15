import { useMemo } from 'react';
import { useSurrealAuth } from './useSurrealAuth';

export type AgeGroup = 'ages6to9' | 'ages10to13' | 'ages14to16';

export interface AgeTheme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent: string;
  };
  typography: {
    fontSize: {
      sm: string;
      base: string;
      lg: string;
      xl: string;
    };
    fontWeight: {
      normal: string;
      medium: string;
      bold: string;
    };
  };
  spacing: {
    buttonPadding: string;
    containerPadding: string;
    elementSpacing: string;
  };
  layout: {
    buttonMinHeight: string;
    buttonMinWidth: string;
    touchTarget: string;
  };
}

export interface AgeAdaptiveConfig {
  ageGroup: AgeGroup;
  theme: AgeTheme;
  interactions: {
    showHoverStates: boolean;
    enableAdvancedGestures: boolean;
    animationDuration: string;
  };
  navigation: {
    complexity: 'simple' | 'balanced' | 'advanced';
    showBreadcrumbs: boolean;
    maxNavigationDepth: number;
  };
}

const ageThemes: Record<AgeGroup, AgeTheme> = {
  'ages6to9': {
    colors: {
      primary: '#10B981', // Bright green
      secondary: '#F59E0B', // Warm yellow
      background: '#F0FDF4', // Very light green
      text: '#1F2937', // Dark gray
      accent: '#EC4899', // Pink accent
    },
    typography: {
      fontSize: {
        sm: '1rem',
        base: '1.25rem',
        lg: '1.5rem',
        xl: '2rem',
      },
      fontWeight: {
        normal: '500',
        medium: '600',
        bold: '700',
      },
    },
    spacing: {
      buttonPadding: '1rem 2rem',
      containerPadding: '2rem',
      elementSpacing: '1.5rem',
    },
    layout: {
      buttonMinHeight: '60px',
      buttonMinWidth: '120px',
      touchTarget: '48px',
    },
  },
  'ages10to13': {
    colors: {
      primary: '#3B82F6', // Blue
      secondary: '#8B5CF6', // Purple
      background: '#F8FAFC', // Light gray
      text: '#1E293B', // Slate gray
      accent: '#06B6D4', // Cyan
    },
    typography: {
      fontSize: {
        sm: '0.875rem',
        base: '1rem',
        lg: '1.25rem',
        xl: '1.5rem',
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        bold: '600',
      },
    },
    spacing: {
      buttonPadding: '0.75rem 1.5rem',
      containerPadding: '1.5rem',
      elementSpacing: '1rem',
    },
    layout: {
      buttonMinHeight: '48px',
      buttonMinWidth: '100px',
      touchTarget: '44px',
    },
  },
  'ages14to16': {
    colors: {
      primary: '#6366F1', // Indigo
      secondary: '#64748B', // Slate
      background: '#FFFFFF', // White
      text: '#0F172A', // Very dark slate
      accent: '#EF4444', // Red accent
    },
    typography: {
      fontSize: {
        sm: '0.75rem',
        base: '0.875rem',
        lg: '1rem',
        xl: '1.25rem',
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        bold: '600',
      },
    },
    spacing: {
      buttonPadding: '0.5rem 1rem',
      containerPadding: '1rem',
      elementSpacing: '0.75rem',
    },
    layout: {
      buttonMinHeight: '40px',
      buttonMinWidth: '80px',
      touchTarget: '40px',
    },
  },
};

export const useAgeAdaptive = (overrideAgeGroup?: AgeGroup): AgeAdaptiveConfig => {
  const { user, isChild } = useSurrealAuth();

  const ageGroup = useMemo(() => {
    if (overrideAgeGroup) return overrideAgeGroup;

    if (isChild && user?.childProfile?.age_group) {
      return user.childProfile.age_group;
    }

    // Default to middle age group for parents or unknown users
    return 'ages10to13' as AgeGroup;
  }, [overrideAgeGroup, isChild, user?.childProfile?.age_group]);

  const config = useMemo((): AgeAdaptiveConfig => {
    const theme = ageThemes[ageGroup];

    return {
      ageGroup,
      theme,
      interactions: {
        showHoverStates: ageGroup !== 'ages6to9',
        enableAdvancedGestures: ageGroup === 'ages14to16',
        animationDuration: ageGroup === 'ages6to9' ? '300ms' : '200ms',
      },
      navigation: {
        complexity: ageGroup === 'ages6to9' ? 'simple' : ageGroup === 'ages10to13' ? 'balanced' : 'advanced',
        showBreadcrumbs: ageGroup !== 'ages6to9',
        maxNavigationDepth: ageGroup === 'ages6to9' ? 2 : ageGroup === 'ages10to13' ? 3 : 5,
      },
    };
  }, [ageGroup]);

  return config;
};
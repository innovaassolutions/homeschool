import { renderHook } from '@testing-library/react';
import { useAgeAdaptive, AgeGroup } from './useAgeAdaptive';
import { useSurrealAuth } from './useSurrealAuth';
import { vi } from 'vitest';

vi.mock('./useSurrealAuth');

const mockUseSurrealAuth = vi.mocked(useSurrealAuth);

describe('useAgeAdaptive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with override age group', () => {
    it('should use override age group regardless of user profile', () => {
      mockUseSurrealAuth.mockReturnValue({
        user: {
          childProfile: {
            age_group: 'ages10to13' as AgeGroup
          }
        },
        isChild: true
      } as any);

      const { result } = renderHook(() => useAgeAdaptive('ages14to16'));

      expect(result.current.ageGroup).toBe('ages14to16');
    });
  });

  describe('with child user', () => {
    it('should use child profile age group when user is child', () => {
      mockUseSurrealAuth.mockReturnValue({
        user: {
          childProfile: {
            age_group: 'ages6to9' as AgeGroup
          }
        },
        isChild: true
      } as any);

      const { result } = renderHook(() => useAgeAdaptive());

      expect(result.current.ageGroup).toBe('ages6to9');
    });

    it('should default to ages10to13 when child has no age group', () => {
      mockUseSurrealAuth.mockReturnValue({
        user: {
          childProfile: {}
        },
        isChild: true
      } as any);

      const { result } = renderHook(() => useAgeAdaptive());

      expect(result.current.ageGroup).toBe('ages10to13');
    });
  });

  describe('with parent user', () => {
    it('should default to ages10to13 for parent users', () => {
      mockUseSurrealAuth.mockReturnValue({
        user: { id: 'parent-123' },
        isChild: false
      } as any);

      const { result } = renderHook(() => useAgeAdaptive());

      expect(result.current.ageGroup).toBe('ages10to13');
    });
  });

  describe('with no user', () => {
    it('should default to ages10to13 for unknown users', () => {
      mockUseSurrealAuth.mockReturnValue({
        user: null,
        isChild: false
      } as any);

      const { result } = renderHook(() => useAgeAdaptive());

      expect(result.current.ageGroup).toBe('ages10to13');
    });
  });

  describe('age group configurations', () => {
    it('should return correct theme for ages6to9', () => {
      mockUseSurrealAuth.mockReturnValue({
        user: {
          childProfile: {
            age_group: 'ages6to9' as AgeGroup
          }
        },
        isChild: true
      } as any);

      const { result } = renderHook(() => useAgeAdaptive());

      expect(result.current.theme.colors.primary).toBe('#10B981');
      expect(result.current.theme.typography.fontSize.base).toBe('1.25rem');
      expect(result.current.theme.layout.buttonMinHeight).toBe('60px');
    });

    it('should return correct theme for ages10to13', () => {
      mockUseSurrealAuth.mockReturnValue({
        user: {
          childProfile: {
            age_group: 'ages10to13' as AgeGroup
          }
        },
        isChild: true
      } as any);

      const { result } = renderHook(() => useAgeAdaptive());

      expect(result.current.theme.colors.primary).toBe('#3B82F6');
      expect(result.current.theme.typography.fontSize.base).toBe('1rem');
      expect(result.current.theme.layout.buttonMinHeight).toBe('48px');
    });

    it('should return correct theme for ages14to16', () => {
      mockUseSurrealAuth.mockReturnValue({
        user: {
          childProfile: {
            age_group: 'ages14to16' as AgeGroup
          }
        },
        isChild: true
      } as any);

      const { result } = renderHook(() => useAgeAdaptive());

      expect(result.current.theme.colors.primary).toBe('#6366F1');
      expect(result.current.theme.typography.fontSize.base).toBe('0.875rem');
      expect(result.current.theme.layout.buttonMinHeight).toBe('40px');
    });
  });

  describe('interaction configurations', () => {
    it('should disable hover states for ages6to9', () => {
      mockUseSurrealAuth.mockReturnValue({
        user: {
          childProfile: {
            age_group: 'ages6to9' as AgeGroup
          }
        },
        isChild: true
      } as any);

      const { result } = renderHook(() => useAgeAdaptive());

      expect(result.current.interactions.showHoverStates).toBe(false);
      expect(result.current.interactions.enableAdvancedGestures).toBe(false);
      expect(result.current.interactions.animationDuration).toBe('300ms');
    });

    it('should enable hover states for ages10to13', () => {
      mockUseSurrealAuth.mockReturnValue({
        user: {
          childProfile: {
            age_group: 'ages10to13' as AgeGroup
          }
        },
        isChild: true
      } as any);

      const { result } = renderHook(() => useAgeAdaptive());

      expect(result.current.interactions.showHoverStates).toBe(true);
      expect(result.current.interactions.enableAdvancedGestures).toBe(false);
      expect(result.current.interactions.animationDuration).toBe('200ms');
    });

    it('should enable advanced gestures for ages14to16', () => {
      mockUseSurrealAuth.mockReturnValue({
        user: {
          childProfile: {
            age_group: 'ages14to16' as AgeGroup
          }
        },
        isChild: true
      } as any);

      const { result } = renderHook(() => useAgeAdaptive());

      expect(result.current.interactions.showHoverStates).toBe(true);
      expect(result.current.interactions.enableAdvancedGestures).toBe(true);
      expect(result.current.interactions.animationDuration).toBe('200ms');
    });
  });

  describe('navigation configurations', () => {
    it('should use simple navigation for ages6to9', () => {
      mockUseSurrealAuth.mockReturnValue({
        user: {
          childProfile: {
            age_group: 'ages6to9' as AgeGroup
          }
        },
        isChild: true
      } as any);

      const { result } = renderHook(() => useAgeAdaptive());

      expect(result.current.navigation.complexity).toBe('simple');
      expect(result.current.navigation.showBreadcrumbs).toBe(false);
      expect(result.current.navigation.maxNavigationDepth).toBe(2);
    });

    it('should use balanced navigation for ages10to13', () => {
      mockUseSurrealAuth.mockReturnValue({
        user: {
          childProfile: {
            age_group: 'ages10to13' as AgeGroup
          }
        },
        isChild: true
      } as any);

      const { result } = renderHook(() => useAgeAdaptive());

      expect(result.current.navigation.complexity).toBe('balanced');
      expect(result.current.navigation.showBreadcrumbs).toBe(true);
      expect(result.current.navigation.maxNavigationDepth).toBe(3);
    });

    it('should use advanced navigation for ages14to16', () => {
      mockUseSurrealAuth.mockReturnValue({
        user: {
          childProfile: {
            age_group: 'ages14to16' as AgeGroup
          }
        },
        isChild: true
      } as any);

      const { result } = renderHook(() => useAgeAdaptive());

      expect(result.current.navigation.complexity).toBe('advanced');
      expect(result.current.navigation.showBreadcrumbs).toBe(true);
      expect(result.current.navigation.maxNavigationDepth).toBe(5);
    });
  });
});
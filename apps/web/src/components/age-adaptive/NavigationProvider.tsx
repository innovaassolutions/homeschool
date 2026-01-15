import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive';

export interface NavigationRoute {
  id: string;
  path: string;
  label: string;
  icon?: React.ReactNode;
  emoji?: string;
  component?: React.ComponentType;
  children?: NavigationRoute[];
  requiresAuth?: boolean;
  ageRestriction?: 'ages6to9' | 'ages10to13' | 'ages14to16' | 'all';
  badge?: string | number;
  description?: string;
  keywords?: string[];
}

export interface NavigationState {
  currentRoute: NavigationRoute | null;
  navigationHistory: NavigationRoute[];
  isLoading: boolean;
  error: string | null;
}

export interface NavigationContextType {
  state: NavigationState;
  routes: NavigationRoute[];
  navigate: (routeId: string, options?: NavigationOptions) => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  getFilteredRoutes: () => NavigationRoute[];
  searchRoutes: (query: string) => NavigationRoute[];
  registerRoute: (route: NavigationRoute) => void;
  unregisterRoute: (routeId: string) => void;
}

export interface NavigationOptions {
  replace?: boolean;
  preserveHistory?: boolean;
  data?: any;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

interface NavigationProviderProps {
  children: React.ReactNode;
  initialRoutes?: NavigationRoute[];
  maxHistorySize?: number;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({
  children,
  initialRoutes = [],
  maxHistorySize = 50
}) => {
  const { ageGroup, navigation: navConfig } = useAgeAdaptive();
  const [routes, setRoutes] = useState<NavigationRoute[]>(initialRoutes);
  const [state, setState] = useState<NavigationState>({
    currentRoute: null,
    navigationHistory: [],
    isLoading: false,
    error: null
  });
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Filter routes based on age group and navigation complexity
  const getFilteredRoutes = useCallback((): NavigationRoute[] => {
    const filterByAge = (routes: NavigationRoute[]): NavigationRoute[] => {
      return routes.filter(route => {
        // Check age restriction
        if (route.ageRestriction && route.ageRestriction !== 'all' && route.ageRestriction !== ageGroup) {
          return false;
        }

        // For simple navigation (ages 6-9), limit depth and complexity
        if (navConfig.complexity === 'simple') {
          // Only show top-level routes or one level deep
          if (route.children) {
            route.children = route.children.filter(child => !child.children);
          }
        }

        // Recursively filter children
        if (route.children) {
          route.children = filterByAge(route.children);
        }

        return true;
      });
    };

    let filtered = filterByAge([...routes]);

    // Limit number of top-level routes for simple navigation
    if (navConfig.complexity === 'simple') {
      filtered = filtered.slice(0, 6); // Maximum 6 items for youngest users
    }

    return filtered;
  }, [routes, ageGroup, navConfig.complexity]);

  // Search through routes based on label, description, and keywords
  const searchRoutes = useCallback((query: string): NavigationRoute[] => {
    if (!query.trim()) return getFilteredRoutes();

    const searchInRoutes = (routes: NavigationRoute[], query: string): NavigationRoute[] => {
      const results: NavigationRoute[] = [];
      const lowerQuery = query.toLowerCase();

      for (const route of routes) {
        const matchesLabel = route.label.toLowerCase().includes(lowerQuery);
        const matchesDescription = route.description?.toLowerCase().includes(lowerQuery);
        const matchesKeywords = route.keywords?.some(keyword =>
          keyword.toLowerCase().includes(lowerQuery)
        );

        if (matchesLabel || matchesDescription || matchesKeywords) {
          results.push(route);
        }

        // Search in children
        if (route.children) {
          const childResults = searchInRoutes(route.children, query);
          results.push(...childResults);
        }
      }

      return results;
    };

    return searchInRoutes(getFilteredRoutes(), query);
  }, [getFilteredRoutes]);

  // Find route by ID
  const findRouteById = useCallback((routeId: string, routes: NavigationRoute[] = []): NavigationRoute | null => {
    const searchRoutes = routes.length > 0 ? routes : getFilteredRoutes();

    for (const route of searchRoutes) {
      if (route.id === routeId) {
        return route;
      }
      if (route.children) {
        const found = findRouteById(routeId, route.children);
        if (found) return found;
      }
    }
    return null;
  }, [getFilteredRoutes]);

  // Navigation function
  const navigate = useCallback((routeId: string, options: NavigationOptions = {}) => {
    const { replace = false, preserveHistory = false } = options;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const route = findRouteById(routeId);

      if (!route) {
        throw new Error(`Route with ID "${routeId}" not found`);
      }

      setState(prev => {
        let newHistory = [...prev.navigationHistory];
        let newIndex = historyIndex;

        if (!preserveHistory) {
          if (replace && newHistory.length > 0) {
            // Replace current route
            newHistory[newIndex] = route;
          } else {
            // Add new route to history
            // Remove any forward history if we're not at the end
            newHistory = newHistory.slice(0, newIndex + 1);
            newHistory.push(route);
            newIndex = newHistory.length - 1;

            // Limit history size
            if (newHistory.length > maxHistorySize) {
              newHistory = newHistory.slice(-maxHistorySize);
              newIndex = newHistory.length - 1;
            }
          }
        }

        return {
          ...prev,
          currentRoute: route,
          navigationHistory: newHistory,
          isLoading: false
        };
      });

      if (!preserveHistory) {
        setHistoryIndex(prev => replace ? prev : prev + 1);
      }

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Navigation failed'
      }));
    }
  }, [findRouteById, historyIndex, maxHistorySize]);

  // Back navigation
  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const route = state.navigationHistory[newIndex];

      setState(prev => ({
        ...prev,
        currentRoute: route
      }));
      setHistoryIndex(newIndex);
    }
  }, [historyIndex, state.navigationHistory]);

  // Forward navigation
  const goForward = useCallback(() => {
    if (historyIndex < state.navigationHistory.length - 1) {
      const newIndex = historyIndex + 1;
      const route = state.navigationHistory[newIndex];

      setState(prev => ({
        ...prev,
        currentRoute: route
      }));
      setHistoryIndex(newIndex);
    }
  }, [historyIndex, state.navigationHistory]);

  // Can navigate back/forward
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < state.navigationHistory.length - 1;

  // Register new route
  const registerRoute = useCallback((route: NavigationRoute) => {
    setRoutes(prev => {
      const exists = prev.some(r => r.id === route.id);
      if (exists) {
        return prev.map(r => r.id === route.id ? route : r);
      }
      return [...prev, route];
    });
  }, []);

  // Unregister route
  const unregisterRoute = useCallback((routeId: string) => {
    setRoutes(prev => prev.filter(r => r.id !== routeId));
  }, []);

  // Keyboard navigation for advanced age groups
  useEffect(() => {
    if (!navConfig.showBreadcrumbs || navConfig.complexity === 'simple') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Alt + Left Arrow: Go back
      if (event.altKey && event.key === 'ArrowLeft' && canGoBack) {
        event.preventDefault();
        goBack();
      }

      // Alt + Right Arrow: Go forward
      if (event.altKey && event.key === 'ArrowRight' && canGoForward) {
        event.preventDefault();
        goForward();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navConfig.showBreadcrumbs, navConfig.complexity, canGoBack, canGoForward, goBack, goForward]);

  // Context value
  const contextValue: NavigationContextType = {
    state,
    routes: getFilteredRoutes(),
    navigate,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    getFilteredRoutes,
    searchRoutes,
    registerRoute,
    unregisterRoute
  };

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  );
};

// Hook for route registration
export const useRouteRegistration = (route: NavigationRoute) => {
  const { registerRoute, unregisterRoute } = useNavigation();

  useEffect(() => {
    registerRoute(route);
    return () => unregisterRoute(route.id);
  }, [route, registerRoute, unregisterRoute]);
};

// Age-appropriate navigation helpers
export const getNavigationConfig = (ageGroup: string) => {
  switch (ageGroup) {
    case 'ages6to9':
      return {
        maxTopLevelItems: 6,
        maxDepth: 1,
        showIcons: false,
        showEmojis: true,
        showBadges: false,
        showDescriptions: true,
        animationDuration: 300,
        touchOptimized: true
      };

    case 'ages10to13':
      return {
        maxTopLevelItems: 8,
        maxDepth: 2,
        showIcons: true,
        showEmojis: true,
        showBadges: true,
        showDescriptions: false,
        animationDuration: 200,
        touchOptimized: true
      };

    case 'ages14to16':
      return {
        maxTopLevelItems: 12,
        maxDepth: 4,
        showIcons: true,
        showEmojis: false,
        showBadges: true,
        showDescriptions: false,
        animationDuration: 150,
        touchOptimized: false
      };

    default:
      return {
        maxTopLevelItems: 8,
        maxDepth: 2,
        showIcons: true,
        showEmojis: false,
        showBadges: true,
        showDescriptions: false,
        animationDuration: 200,
        touchOptimized: false
      };
  }
};
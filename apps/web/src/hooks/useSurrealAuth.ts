import { useState, useCallback, useEffect } from 'react';

// Types for our authentication system
export interface Family {
  id: string;
  parent_name: string;
  parent_email: string;
  subscription_tier: string;
  coppa_consent_date: string;
  coppa_consent_version: string;
  privacy_settings: {
    data_collection: boolean;
    analytics_sharing: boolean;
    marketing_emails: boolean;
    research_participation: boolean;
  };
}

export interface ChildProfile {
  id: string;
  family_id: string;
  child_name: string;
  age_group: 'ages6to9' | 'ages10to13' | 'ages14to16';
  privacy_level: 'strict' | 'standard' | 'relaxed';
  parental_controls: {
    screen_time_limit: number;
    content_filters: string[];
    communication_allowed: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  familyId: string;
  userType: 'parent' | 'child';
  userId: string;
  childId?: string;
  family?: Family;
  childProfile?: ChildProfile;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface FamilyRegistrationData {
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

export interface LoginData {
  email: string;
  password: string;
}

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  error: string | null;
  childProfiles: ChildProfile[];
}

const API_BASE_URL = 'http://localhost:3001/api';

// Token management
const TOKEN_STORAGE_KEY = 'homeschool_tokens';
const REFRESH_TOKEN_KEY = 'homeschool_refresh_token';

const getStoredTokens = (): AuthTokens | null => {
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const storeTokens = (tokens: AuthTokens) => {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
};

const clearTokens = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

// JWT token parsing
const parseJWTPayload = (token: string): any => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

// API helper function
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
};

export const useSurrealAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: null,
    isLoading: true,
    error: null,
    childProfiles: [],
  });

  // Initialize authentication state from stored tokens
  useEffect(() => {
    const initializeAuth = async () => {
      const storedTokens = getStoredTokens();

      if (!storedTokens) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        const payload = parseJWTPayload(storedTokens.accessToken);

        if (!payload || payload.exp * 1000 < Date.now()) {
          // Token expired, try to refresh
          await refreshToken();
          return;
        }

        // Token is valid, restore user state
        const user: AuthUser = {
          familyId: payload.familyId,
          userType: payload.userType,
          userId: payload.userId,
          childId: payload.childId,
        };

        setState(prev => ({
          ...prev,
          user,
          tokens: storedTokens,
          isLoading: false,
        }));

        // Load child profiles for the family
        await loadChildProfiles(storedTokens.accessToken);

      } catch (error) {
        console.error('Failed to initialize auth:', error);
        clearTokens();
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Session expired. Please log in again.'
        }));
      }
    };

    initializeAuth();
  }, []);

  // Load child profiles for the authenticated family
  const loadChildProfiles = useCallback(async (accessToken: string) => {
    try {
      const response = await apiRequest('/family/child-profiles', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      setState(prev => ({
        ...prev,
        childProfiles: response.childProfiles || [],
      }));
    } catch (error) {
      console.error('Failed to load child profiles:', error);
    }
  }, []);

  // Register new family
  const registerFamily = useCallback(async (data: FamilyRegistrationData) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await apiRequest('/auth/register-family', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      const tokens: AuthTokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      };

      const payload = parseJWTPayload(tokens.accessToken);
      const user: AuthUser = {
        familyId: payload.familyId,
        userType: payload.userType,
        userId: payload.userId,
        family: response.family,
      };

      storeTokens(tokens);

      setState(prev => ({
        ...prev,
        user,
        tokens,
        isLoading: false,
        childProfiles: [],
      }));

      return { success: true, user };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      return { success: false, error: errorMessage };
    }
  }, []);

  // Login existing family
  const login = useCallback(async (data: LoginData) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      const tokens: AuthTokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      };

      const payload = parseJWTPayload(tokens.accessToken);
      const user: AuthUser = {
        familyId: payload.familyId,
        userType: payload.userType,
        userId: payload.userId,
        family: response.family,
      };

      storeTokens(tokens);

      setState(prev => ({
        ...prev,
        user,
        tokens,
        isLoading: false,
      }));

      // Load child profiles
      await loadChildProfiles(tokens.accessToken);

      return { success: true, user };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      return { success: false, error: errorMessage };
    }
  }, [loadChildProfiles]);

  // Refresh access token
  const refreshToken = useCallback(async () => {
    const storedTokens = getStoredTokens();

    if (!storedTokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await apiRequest('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: storedTokens.refreshToken }),
      });

      const newTokens: AuthTokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      };

      const payload = parseJWTPayload(newTokens.accessToken);
      const user: AuthUser = {
        familyId: payload.familyId,
        userType: payload.userType,
        userId: payload.userId,
        childId: payload.childId,
      };

      storeTokens(newTokens);

      setState(prev => ({
        ...prev,
        user,
        tokens: newTokens,
        error: null,
      }));

      return newTokens;
    } catch (error) {
      clearTokens();
      setState(prev => ({
        ...prev,
        user: null,
        tokens: null,
        error: 'Session expired. Please log in again.',
      }));
      throw error;
    }
  }, []);

  // Logout
  const logout = useCallback(() => {
    clearTokens();
    setState({
      user: null,
      tokens: null,
      isLoading: false,
      error: null,
      childProfiles: [],
    });
  }, []);

  // Switch to child profile
  const switchToChild = useCallback((childProfile: ChildProfile) => {
    if (!state.user || state.user.userType !== 'parent') {
      return { success: false, error: 'Only parents can switch to child profiles' };
    }

    const updatedUser: AuthUser = {
      ...state.user,
      userType: 'child',
      userId: childProfile.id,
      childId: childProfile.id,
      childProfile,
    };

    setState(prev => ({
      ...prev,
      user: updatedUser,
    }));

    return { success: true };
  }, [state.user]);

  // Switch back to parent
  const switchToParent = useCallback(() => {
    if (!state.user) {
      return { success: false, error: 'No authenticated user' };
    }

    const updatedUser: AuthUser = {
      familyId: state.user.familyId,
      userType: 'parent',
      userId: state.user.familyId,
      family: state.user.family,
    };

    setState(prev => ({
      ...prev,
      user: updatedUser,
    }));

    return { success: true };
  }, [state.user]);

  // Add child profile
  const addChildProfile = useCallback(async (childData: Omit<ChildProfile, 'id' | 'family_id' | 'created_at' | 'updated_at'>) => {
    if (!state.tokens?.accessToken) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await apiRequest('/family/child-profiles', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.tokens.accessToken}`,
        },
        body: JSON.stringify(childData),
      });

      const newChildProfile = response.childProfile;

      setState(prev => ({
        ...prev,
        childProfiles: [...prev.childProfiles, newChildProfile],
      }));

      return { success: true, childProfile: newChildProfile };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create child profile';
      return { success: false, error: errorMessage };
    }
  }, [state.tokens]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    // State
    user: state.user,
    tokens: state.tokens,
    isLoading: state.isLoading,
    error: state.error,
    childProfiles: state.childProfiles,
    isAuthenticated: !!state.user,
    isParent: state.user?.userType === 'parent',
    isChild: state.user?.userType === 'child',

    // Actions
    registerFamily,
    login,
    logout,
    refreshToken,
    switchToChild,
    switchToParent,
    addChildProfile,
    clearError,
  };
};
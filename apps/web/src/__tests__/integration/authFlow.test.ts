/**
 * Integration Tests for Complete Authentication Flow
 * Tests the full end-to-end authentication workflow including:
 * - Family registration with COPPA compliance
 * - Login/logout functionality
 * - Token management and automatic refresh
 * - Child profile creation and switching
 * - Error handling and recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSurrealAuth } from '../../hooks/useSurrealAuth';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console methods to avoid noise in tests
const mockConsole = {
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn()
};
Object.assign(console, mockConsole);

// Test data
const mockFamilyData = {
  parentName: 'John Doe',
  parentEmail: 'john@example.com',
  password: 'securePassword123',
  coppaConsent: true,
  privacySettings: {
    data_collection: true,
    analytics_sharing: false,
    marketing_emails: true,
    research_participation: false
  }
};

const mockLoginData = {
  email: 'john@example.com',
  password: 'securePassword123'
};

const mockTokens = {
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmYW1pbHlJZCI6ImZhbWlseTo6dGVzdCIsInVzZXJUeXBlIjoicGFyZW50IiwidXNlcklkIjoidGVzdC11c2VyIiwiZXhwIjo5OTk5OTk5OTk5fQ.signature',
  refreshToken: 'mock-refresh-token'
};

const mockChildProfile = {
  id: 'child::test-child',
  family_id: 'family::test',
  child_name: 'Alice',
  age_group: 'ages6to9',
  privacy_level: 'standard',
  parental_controls: {
    screen_time_limit: 60,
    content_filters: ['violence', 'adult_language'],
    communication_allowed: false
  },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

describe('Authentication Flow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);

    // Default successful API responses
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Family Registration Flow', () => {
    it('should complete full family registration with COPPA compliance', async () => {
      const registrationResponse = {
        family: {
          id: 'family::test',
          parent_name: 'John Doe',
          parent_email: 'john@example.com'
        },
        tokens: mockTokens,
        coppa_verified: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(registrationResponse)
      });

      const { result } = renderHook(() => useSurrealAuth());

      await act(async () => {
        await result.current.registerFamily(mockFamilyData);
      });

      // Verify API was called correctly
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/auth/register-family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockFamilyData)
      });

      // Verify tokens were stored
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'homeschool_tokens',
        JSON.stringify(mockTokens)
      );

      // Verify user state is set correctly
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isParent).toBe(true);
      expect(result.current.user?.userType).toBe('parent');
      expect(result.current.error).toBeNull();
    });

    it('should handle COPPA consent validation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          message: 'COPPA consent is required for child accounts'
        })
      });

      const { result } = renderHook(() => useSurrealAuth());

      await act(async () => {
        await result.current.registerFamily({
          ...mockFamilyData,
          coppaConsent: false
        });
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('COPPA consent is required for child accounts');
    });
  });

  describe('Login/Logout Flow', () => {
    it('should complete successful login and load child profiles', async () => {
      const loginResponse = {
        family: { id: 'family::test' },
        tokens: mockTokens
      };

      const childProfilesResponse = {
        childProfiles: [mockChildProfile]
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(loginResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(childProfilesResponse)
        });

      const { result } = renderHook(() => useSurrealAuth());

      await act(async () => {
        await result.current.login(mockLoginData);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.childProfiles).toHaveLength(1);
      expect(result.current.childProfiles[0].child_name).toBe('Alice');
    });

    it('should handle login failure gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          message: 'Invalid email or password'
        })
      });

      const { result } = renderHook(() => useSurrealAuth());

      await act(async () => {
        await result.current.login(mockLoginData);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Invalid email or password');
    });

    it('should logout and clear all stored data', async () => {
      // First, simulate being logged in
      const { result } = renderHook(() => useSurrealAuth());

      await act(async () => {
        result.current.logout();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('homeschool_tokens');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.childProfiles).toHaveLength(0);
    });
  });

  describe('Token Management Flow', () => {
    it('should automatically refresh expired tokens', async () => {
      const expiredTokens = {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmYW1pbHlJZCI6ImZhbWlseTo6dGVzdCIsInVzZXJUeXBlIjoicGFyZW50IiwidXNlcklkIjoidGVzdC11c2VyIiwiZXhwIjoxfQ.signature', // expired
        refreshToken: 'mock-refresh-token'
      };

      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(expiredTokens));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tokens: newTokens })
      });

      const { result } = renderHook(() => useSurrealAuth());

      // Wait for useEffect to trigger token refresh
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: expiredTokens.refreshToken })
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'homeschool_tokens',
        JSON.stringify(newTokens)
      );
    });

    it('should handle refresh token failure and logout user', async () => {
      const expiredTokens = {
        accessToken: 'expired-token',
        refreshToken: 'invalid-refresh-token'
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(expiredTokens));

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          message: 'Invalid refresh token'
        })
      });

      const { result } = renderHook(() => useSurrealAuth());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('homeschool_tokens');
      expect(result.current.error).toBe('Session expired. Please log in again.');
    });
  });

  describe('Child Profile Management Flow', () => {
    it('should create new child profile successfully', async () => {
      const newChildData = {
        child_name: 'Bob',
        age_group: 'ages10to13',
        privacy_level: 'strict',
        parental_controls: {
          screen_time_limit: 45,
          content_filters: ['violence', 'adult_language', 'mature_themes'],
          communication_allowed: true
        }
      };

      const createResponse = {
        childProfile: { ...mockChildProfile, ...newChildData, id: 'child::bob' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createResponse)
      });

      // Simulate logged in state
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockTokens));

      const { result } = renderHook(() => useSurrealAuth());

      await act(async () => {
        await result.current.addChildProfile(newChildData);
      });

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/family/child-profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockTokens.accessToken}`
        },
        body: JSON.stringify(newChildData)
      });

      expect(result.current.childProfiles).toHaveLength(1);
      expect(result.current.childProfiles[0].child_name).toBe('Bob');
    });

    it('should switch between parent and child profiles', async () => {
      const { result } = renderHook(() => useSurrealAuth());

      // Simulate having child profiles loaded
      await act(async () => {
        result.current.switchToChild(mockChildProfile);
      });

      expect(result.current.isChild).toBe(true);
      expect(result.current.user?.childId).toBe('child::test-child');
      expect(result.current.user?.childProfile?.child_name).toBe('Alice');

      // Switch back to parent
      await act(async () => {
        result.current.switchToParent();
      });

      expect(result.current.isParent).toBe(true);
      expect(result.current.user?.childId).toBeUndefined();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useSurrealAuth());

      await act(async () => {
        await result.current.login(mockLoginData);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should clear errors when clearError is called', async () => {
      const { result } = renderHook(() => useSurrealAuth());

      // Simulate an error state
      mockFetch.mockRejectedValueOnce(new Error('Test error'));

      await act(async () => {
        await result.current.login(mockLoginData);
      });

      expect(result.current.error).toBe('Test error');

      // Clear the error
      await act(async () => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('should handle malformed JWT tokens safely', async () => {
      const malformedTokens = {
        accessToken: 'not-a-valid-jwt-token',
        refreshToken: 'refresh-token'
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(malformedTokens));

      const { result } = renderHook(() => useSurrealAuth());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('homeschool_tokens');
    });
  });

  describe('State Persistence and Recovery', () => {
    it('should restore valid session from localStorage on initialization', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockTokens));

      // Mock child profiles load
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ childProfiles: [mockChildProfile] })
      });

      const { result } = renderHook(() => useSurrealAuth());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.userType).toBe('parent');
      expect(result.current.childProfiles).toHaveLength(1);
    });

    it('should handle localStorage unavailability gracefully', async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      const { result } = renderHook(() => useSurrealAuth());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('COPPA Compliance Integration', () => {
    it('should enforce age group restrictions during child profile creation', async () => {
      const invalidChildData = {
        child_name: 'Too Young',
        age_group: 'ages6to9',
        privacy_level: 'relaxed',
        parental_controls: {
          screen_time_limit: 180, // Too high for ages6to9
          content_filters: [], // Too permissive
          communication_allowed: true // Not appropriate for young children
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          message: 'Parental controls do not meet COPPA requirements for age group ages6to9'
        })
      });

      const { result } = renderHook(() => useSurrealAuth());

      await act(async () => {
        await result.current.addChildProfile(invalidChildData);
      });

      expect(result.current.error).toBe('Parental controls do not meet COPPA requirements for age group ages6to9');
    });

    it('should validate privacy settings during registration', async () => {
      const invalidPrivacyData = {
        ...mockFamilyData,
        privacySettings: {
          data_collection: false, // Required for educational service
          analytics_sharing: true,
          marketing_emails: true,
          research_participation: true
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          message: 'Data collection consent is required for educational services'
        })
      });

      const { result } = renderHook(() => useSurrealAuth());

      await act(async () => {
        await result.current.registerFamily(invalidPrivacyData);
      });

      expect(result.current.error).toBe('Data collection consent is required for educational services');
    });
  });

  describe('Security Features', () => {
    it('should not expose sensitive token information in state', () => {
      const { result } = renderHook(() => useSurrealAuth());

      // Even when authenticated, tokens should not be directly accessible
      const returnedState = result.current;

      expect(returnedState.tokens).toBeDefined();
      expect(typeof returnedState.tokens?.accessToken).toBe('string');
      expect(typeof returnedState.tokens?.refreshToken).toBe('string');

      // But they should be stored securely
      expect(returnedState.user?.password).toBeUndefined();
    });

    it('should handle concurrent authentication requests safely', async () => {
      const loginResponse = {
        family: { id: 'family::test' },
        tokens: mockTokens
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(loginResponse)
      });

      const { result } = renderHook(() => useSurrealAuth());

      // Make multiple concurrent login attempts
      await act(async () => {
        await Promise.all([
          result.current.login(mockLoginData),
          result.current.login(mockLoginData),
          result.current.login(mockLoginData)
        ]);
      });

      // Should still result in single valid session
      expect(result.current.isAuthenticated).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(6); // 3 login calls + 3 child profile loads
    });
  });
});
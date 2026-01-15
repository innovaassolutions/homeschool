import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useSurrealAuth, FamilyRegistrationData, LoginData } from './useSurrealAuth';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('useSurrealAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default state', async () => {
    const { result } = renderHook(() => useSurrealAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.tokens).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.childProfiles).toEqual([]);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isParent).toBe(false);
    expect(result.current.isChild).toBe(false);

    // Wait for initialization to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should register a new family successfully', async () => {
    const mockResponse = {
      success: true,
      family: {
        id: 'family:123',
        parent_name: 'John Doe',
        parent_email: 'john@example.com',
        subscription_tier: 'free',
      },
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmYW1pbHlJZCI6ImZhbWlseToxMjMiLCJ1c2VyVHlwZSI6InBhcmVudCIsInVzZXJJZCI6ImZhbWlseToxMjMifQ.signature',
      refreshToken: 'mock-refresh-token',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const { result } = renderHook(() => useSurrealAuth());

    const registrationData: FamilyRegistrationData = {
      parentName: 'John Doe',
      parentEmail: 'john@example.com',
      password: 'securePassword123',
      coppaConsent: true,
      coppaConsentVersion: '1.0',
    };

    let registerResult: any;
    await act(async () => {
      registerResult = await result.current.registerFamily(registrationData);
    });

    expect(registerResult.success).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2);
  });

  it('should handle registration failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: 'Email already exists' }),
    });

    const { result } = renderHook(() => useSurrealAuth());

    const registrationData: FamilyRegistrationData = {
      parentName: 'John Doe',
      parentEmail: 'john@example.com',
      password: 'securePassword123',
      coppaConsent: true,
      coppaConsentVersion: '1.0',
    };

    let registerResult: any;
    await act(async () => {
      registerResult = await result.current.registerFamily(registrationData);
    });

    expect(registerResult.success).toBe(false);
    expect(registerResult.error).toBe('Email already exists');
    expect(result.current.error).toBe('Email already exists');
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should login successfully', async () => {
    const mockResponse = {
      success: true,
      family: {
        id: 'family:123',
        parent_name: 'John Doe',
        parent_email: 'john@example.com',
      },
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmYW1pbHlJZCI6ImZhbWlseToxMjMiLCJ1c2VyVHlwZSI6InBhcmVudCIsInVzZXJJZCI6ImZhbWlseToxMjMifQ.signature',
      refreshToken: 'mock-refresh-token',
    };

    // Mock successful login
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    // Mock child profiles fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ childProfiles: [] }),
    });

    const { result } = renderHook(() => useSurrealAuth());

    const loginData: LoginData = {
      email: 'john@example.com',
      password: 'securePassword123',
    };

    let loginResult: any;
    await act(async () => {
      loginResult = await result.current.login(loginData);
    });

    expect(loginResult.success).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should logout successfully', () => {
    const { result } = renderHook(() => useSurrealAuth());

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.tokens).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('homeschool_tokens');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('homeschool_refresh_token');
  });

  it('should clear error', () => {
    const { result } = renderHook(() => useSurrealAuth());

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should have correct computed properties', () => {
    const { result } = renderHook(() => useSurrealAuth());

    // Test initial state
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isParent).toBe(false);
    expect(result.current.isChild).toBe(false);
  });
});
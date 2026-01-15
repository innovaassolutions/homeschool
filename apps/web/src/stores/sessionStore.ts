import { create } from 'zustand';

// Session types matching backend
export type SessionType = 'assessment' | 'lesson' | 'practice' | 'review';
export type SessionState = 'not_started' | 'active' | 'paused' | 'break' | 'completed' | 'abandoned';
export type AgeGroup = 'ages6to9' | 'ages10to13' | 'ages14to16';

export interface LearningObjective {
  id: string;
  description: string;
  category: 'knowledge' | 'skill' | 'behavior';
  targetLevel: 'beginner' | 'intermediate' | 'advanced';
  completed: boolean;
  completedAt?: Date;
}

export interface ProgressMarker {
  id: string;
  timestamp: Date;
  milestone: string;
  description: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface SessionTimingConfig {
  recommendedDuration: number;
  maxDuration: number;
  breakInterval: number;
  breakDuration: number;
  warningBeforeBreak: number;
}

export interface LearningSession {
  id: string;
  type: SessionType;
  state: SessionState;
  childId: string;
  ageGroup: AgeGroup;
  title: string;
  description?: string;
  learningObjectives: LearningObjective[];
  progressMarkers: ProgressMarker[];
  timingConfig: SessionTimingConfig;

  // Timing data
  startTime?: Date;
  endTime?: Date;
  pausedTime?: Date;
  totalDuration: number;
  activeTime: number;
  breakTime: number;
  lastActivity: Date;

  // Voice integration
  voiceSessionId?: string;

  // Analytics
  interactionCount: number;
  averageResponseTime: number;
  completionRate: number;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  completionNotes?: string;
  pauseReason?: string;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  averageDuration: number;
  completionRate: number;
  averageBreakTime: number;
  sessionsByType: Record<SessionType, number>;
  sessionsByAgeGroup: Record<AgeGroup, number>;
}

// API response types
export interface CreateSessionRequest {
  type: SessionType;
  childId: string;
  ageGroup: AgeGroup;
  title: string;
  description?: string;
  learningObjectives: Omit<LearningObjective, 'id' | 'completed' | 'completedAt'>[];
  customTimingConfig?: Partial<SessionTimingConfig>;
}

export interface SessionApiResponse {
  session: LearningSession;
  success: boolean;
  message?: string;
}

// Session store state
interface SessionStore {
  // Current session state
  currentSession: LearningSession | null;
  isSessionActive: boolean;
  timeRemaining: number;
  isBreakTime: boolean;
  breakTimeRemaining: number;

  // Session history
  recentSessions: LearningSession[];
  sessionStats: SessionStats | null;

  // UI state
  isLoading: boolean;
  error: string | null;
  showBreakReminder: boolean;
  showSessionComplete: boolean;

  // Timer state
  timerId: number | null;
  breakTimerId: number | null;

  // Actions
  createSession: (request: CreateSessionRequest) => Promise<void>;
  startSession: (sessionId: string) => Promise<void>;
  pauseSession: (sessionId: string, reason?: string) => Promise<void>;
  resumeSession: (sessionId: string) => Promise<void>;
  completeSession: (sessionId: string, notes?: string) => Promise<void>;
  abandonSession: (sessionId: string, reason?: string) => Promise<void>;

  // Timer actions
  startTimer: () => void;
  stopTimer: () => void;
  startBreakTimer: () => void;
  stopBreakTimer: () => void;

  // Data fetching
  fetchSession: (sessionId: string) => Promise<void>;
  fetchRecentSessions: (childId: string, limit?: number) => Promise<void>;
  fetchSessionStats: (childId: string) => Promise<void>;

  // Voice integration
  linkVoiceSession: (sessionId: string, voiceSessionId: string) => Promise<void>;

  // UI actions
  setError: (error: string | null) => void;
  clearError: () => void;
  dismissBreakReminder: () => void;
  dismissSessionComplete: () => void;

  // Reset and cleanup
  reset: () => void;
  cleanup: () => void;
}

// API base URL
const API_BASE = process.env.NODE_ENV === 'production'
  ? '/api'
  : 'http://localhost:8000/api';

// API helper functions
const apiCall = async (endpoint: string, options?: RequestInit) => {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
};

// Create the session store
export const useSessionStore = create<SessionStore>((set, get) => ({
  // Initial state
  currentSession: null,
  isSessionActive: false,
  timeRemaining: 0,
  isBreakTime: false,
  breakTimeRemaining: 0,
  recentSessions: [],
  sessionStats: null,
  isLoading: false,
  error: null,
  showBreakReminder: false,
  showSessionComplete: false,
  timerId: null,
  breakTimerId: null,

  // Session management actions
  createSession: async (request: CreateSessionRequest) => {
    set({ isLoading: true, error: null });
    try {
      const response: SessionApiResponse = await apiCall('/sessions', {
        method: 'POST',
        body: JSON.stringify(request),
      });

      set({
        currentSession: response.session,
        isLoading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create session',
        isLoading: false
      });
    }
  },

  startSession: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response: SessionApiResponse = await apiCall(`/sessions/${sessionId}/start`, {
        method: 'POST',
      });

      const session = response.session;
      set({
        currentSession: session,
        isSessionActive: true,
        timeRemaining: session.timingConfig.recommendedDuration * 60,
        isLoading: false
      });

      // Start the session timer
      get().startTimer();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to start session',
        isLoading: false
      });
    }
  },

  pauseSession: async (sessionId: string, reason?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response: SessionApiResponse = await apiCall(`/sessions/${sessionId}/pause`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });

      set({
        currentSession: response.session,
        isSessionActive: false,
        isLoading: false
      });

      // Stop timers
      get().stopTimer();
      get().stopBreakTimer();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to pause session',
        isLoading: false
      });
    }
  },

  resumeSession: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response: SessionApiResponse = await apiCall(`/sessions/${sessionId}/resume`, {
        method: 'POST',
      });

      const session = response.session;
      set({
        currentSession: session,
        isSessionActive: true,
        isBreakTime: false,
        isLoading: false
      });

      // Resume the session timer
      get().startTimer();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to resume session',
        isLoading: false
      });
    }
  },

  completeSession: async (sessionId: string, notes?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response: SessionApiResponse = await apiCall(`/sessions/${sessionId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ completionNotes: notes }),
      });

      set({
        currentSession: response.session,
        isSessionActive: false,
        showSessionComplete: true,
        isLoading: false
      });

      // Stop all timers
      get().stopTimer();
      get().stopBreakTimer();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to complete session',
        isLoading: false
      });
    }
  },

  abandonSession: async (sessionId: string, reason?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response: SessionApiResponse = await apiCall(`/sessions/${sessionId}/abandon`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });

      set({
        currentSession: response.session,
        isSessionActive: false,
        isLoading: false
      });

      // Stop all timers
      get().stopTimer();
      get().stopBreakTimer();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to abandon session',
        isLoading: false
      });
    }
  },

  // Timer management
  startTimer: () => {
    const { timerId, currentSession } = get();
    if (timerId || !currentSession) return;

    const newTimerId = window.setInterval(() => {
      const state = get();
      const newTimeRemaining = Math.max(0, state.timeRemaining - 1);

      set({ timeRemaining: newTimeRemaining });

      // Check for break time
      if (!state.isBreakTime && currentSession.timingConfig.breakInterval > 0) {
        const elapsedMinutes = (currentSession.timingConfig.recommendedDuration * 60 - newTimeRemaining) / 60;
        if (elapsedMinutes > 0 && elapsedMinutes % currentSession.timingConfig.breakInterval === 0) {
          set({
            isBreakTime: true,
            showBreakReminder: true,
            breakTimeRemaining: currentSession.timingConfig.breakDuration * 60
          });
          get().startBreakTimer();
        }
      }

      // Auto-complete when time runs out
      if (newTimeRemaining === 0 && state.isSessionActive) {
        get().completeSession(currentSession.id, 'Session completed automatically');
      }
    }, 1000);

    set({ timerId: newTimerId });
  },

  stopTimer: () => {
    const { timerId } = get();
    if (timerId) {
      clearInterval(timerId);
      set({ timerId: null });
    }
  },

  startBreakTimer: () => {
    const { breakTimerId } = get();
    if (breakTimerId) return;

    const newBreakTimerId = window.setInterval(() => {
      const state = get();
      const newBreakTimeRemaining = Math.max(0, state.breakTimeRemaining - 1);

      set({ breakTimeRemaining: newBreakTimeRemaining });

      // End break when time runs out
      if (newBreakTimeRemaining === 0) {
        set({ isBreakTime: false });
        get().stopBreakTimer();
      }
    }, 1000);

    set({ breakTimerId: newBreakTimerId });
  },

  stopBreakTimer: () => {
    const { breakTimerId } = get();
    if (breakTimerId) {
      clearInterval(breakTimerId);
      set({ breakTimerId: null });
    }
  },

  // Data fetching
  fetchSession: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const session: LearningSession = await apiCall(`/sessions/${sessionId}`);
      set({ currentSession: session, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch session',
        isLoading: false
      });
    }
  },

  fetchRecentSessions: async (childId: string, limit = 10) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiCall(`/sessions?childId=${childId}&limit=${limit}`);
      set({ recentSessions: response.sessions, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch recent sessions',
        isLoading: false
      });
    }
  },

  fetchSessionStats: async (childId: string) => {
    set({ isLoading: true, error: null });
    try {
      const stats: SessionStats = await apiCall(`/sessions/stats?childId=${childId}`);
      set({ sessionStats: stats, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch session stats',
        isLoading: false
      });
    }
  },

  // Voice integration
  linkVoiceSession: async (sessionId: string, voiceSessionId: string) => {
    try {
      await apiCall(`/voice/session/${voiceSessionId}/link-learning-session`, {
        method: 'POST',
        body: JSON.stringify({ learningSessionId: sessionId }),
      });

      // Update current session if it matches
      const { currentSession } = get();
      if (currentSession && currentSession.id === sessionId) {
        set({
          currentSession: {
            ...currentSession,
            voiceSessionId
          }
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to link voice session'
      });
    }
  },

  // UI actions
  setError: (error: string | null) => set({ error }),
  clearError: () => set({ error: null }),
  dismissBreakReminder: () => set({ showBreakReminder: false }),
  dismissSessionComplete: () => set({ showSessionComplete: false }),

  // Cleanup
  reset: () => {
    get().cleanup();
    set({
      currentSession: null,
      isSessionActive: false,
      timeRemaining: 0,
      isBreakTime: false,
      breakTimeRemaining: 0,
      recentSessions: [],
      sessionStats: null,
      isLoading: false,
      error: null,
      showBreakReminder: false,
      showSessionComplete: false,
    });
  },

  cleanup: () => {
    get().stopTimer();
    get().stopBreakTimer();
  },
}));

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    useSessionStore.getState().cleanup();
  });
}
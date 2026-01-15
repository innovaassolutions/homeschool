import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface ProgressDataPoint {
  date: string;
  overallProgress: number;
  subjects: {
    [subject: string]: number;
  };
}

export interface LearningObjective {
  id: string;
  subject: string;
  topic: string;
  description: string;
  targetLevel: number;
  completed: boolean;
  completedAt?: Date;
  attempts: number;
  successRate: number;
}

export interface SubjectProgress {
  subject: string;
  totalObjectives: number;
  completedObjectives: number;
  completionRate: number;
  averageSuccessRate: number;
  color: string;
  icon: string;
}

export interface CurriculumProgressData {
  childId: string;
  overallCompletionRate: number;
  subjectProgress: SubjectProgress[];
  recentObjectives: LearningObjective[];
  nextMilestones: string[];
  totalLearningTime: number;
  lastUpdated: Date;
}

export interface WeeklyProgressData {
  week: string;
  weekOf: string;
  data: ProgressDataPoint;
}

export interface MonthlyProgressData {
  month: string;
  monthOf: string;
  data: ProgressDataPoint;
}

interface ProgressState {
  // Current progress data
  currentProgress: Map<string, CurriculumProgressData>;

  // Historical data
  weeklyProgress: Map<string, WeeklyProgressData[]>;
  monthlyProgress: Map<string, MonthlyProgressData[]>;

  // Live connection status
  isConnected: boolean;
  lastSync: Date | null;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  setCurrentProgress: (childId: string, data: CurriculumProgressData) => void;
  updateObjectiveProgress: (childId: string, objectiveId: string, progress: Partial<LearningObjective>) => void;
  setWeeklyProgress: (childId: string, data: WeeklyProgressData[]) => void;
  setMonthlyProgress: (childId: string, data: MonthlyProgressData[]) => void;
  setConnectionStatus: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateLastSync: () => void;

  // Real-time subscriptions
  subscriptions: Map<string, () => void>;
  addSubscription: (childId: string, unsubscribe: () => void) => void;
  removeSubscription: (childId: string) => void;
  clearAllSubscriptions: () => void;
}

export const useProgressStore = create<ProgressState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    currentProgress: new Map(),
    weeklyProgress: new Map(),
    monthlyProgress: new Map(),
    isConnected: false,
    lastSync: null,
    isLoading: false,
    error: null,
    subscriptions: new Map(),

    // Actions
    setCurrentProgress: (childId: string, data: CurriculumProgressData) => {
      set((state) => ({
        currentProgress: new Map(state.currentProgress).set(childId, {
          ...data,
          lastUpdated: new Date()
        }),
        error: null
      }));
    },

    updateObjectiveProgress: (childId: string, objectiveId: string, progress: Partial<LearningObjective>) => {
      set((state) => {
        const currentData = state.currentProgress.get(childId);
        if (!currentData) return state;

        const updatedObjectives = currentData.recentObjectives.map(obj =>
          obj.id === objectiveId ? { ...obj, ...progress } : obj
        );

        const updatedData = {
          ...currentData,
          recentObjectives: updatedObjectives,
          lastUpdated: new Date()
        };

        return {
          currentProgress: new Map(state.currentProgress).set(childId, updatedData)
        };
      });
    },

    setWeeklyProgress: (childId: string, data: WeeklyProgressData[]) => {
      set((state) => ({
        weeklyProgress: new Map(state.weeklyProgress).set(childId, data),
        error: null
      }));
    },

    setMonthlyProgress: (childId: string, data: MonthlyProgressData[]) => {
      set((state) => ({
        monthlyProgress: new Map(state.monthlyProgress).set(childId, data),
        error: null
      }));
    },

    setConnectionStatus: (connected: boolean) => {
      set({ isConnected: connected });
    },

    setLoading: (loading: boolean) => {
      set({ isLoading: loading });
    },

    setError: (error: string | null) => {
      set({ error });
    },

    updateLastSync: () => {
      set({ lastSync: new Date() });
    },

    addSubscription: (childId: string, unsubscribe: () => void) => {
      set((state) => {
        const newSubscriptions = new Map(state.subscriptions);

        // Clean up existing subscription if any
        const existingUnsubscribe = newSubscriptions.get(childId);
        if (existingUnsubscribe) {
          existingUnsubscribe();
        }

        newSubscriptions.set(childId, unsubscribe);
        return { subscriptions: newSubscriptions };
      });
    },

    removeSubscription: (childId: string) => {
      set((state) => {
        const newSubscriptions = new Map(state.subscriptions);
        const unsubscribe = newSubscriptions.get(childId);

        if (unsubscribe) {
          unsubscribe();
          newSubscriptions.delete(childId);
        }

        return { subscriptions: newSubscriptions };
      });
    },

    clearAllSubscriptions: () => {
      const { subscriptions } = get();

      // Unsubscribe from all active subscriptions
      subscriptions.forEach((unsubscribe) => {
        unsubscribe();
      });

      set({ subscriptions: new Map() });
    }
  }))
);

// Selectors for easy data access
export const useCurrentProgress = (childId: string) =>
  useProgressStore((state) => state.currentProgress.get(childId));

export const useWeeklyProgress = (childId: string) =>
  useProgressStore((state) => state.weeklyProgress.get(childId) || []);

export const useMonthlyProgress = (childId: string) =>
  useProgressStore((state) => state.monthlyProgress.get(childId) || []);

export const useConnectionStatus = () =>
  useProgressStore((state) => ({
    isConnected: state.isConnected,
    lastSync: state.lastSync,
    isLoading: state.isLoading,
    error: state.error
  }));
import { useEffect, useRef } from 'react';
import { realTimeProgressService } from '../services/realTimeProgressService';
import {
  useProgressStore,
  useCurrentProgress,
  useWeeklyProgress,
  useMonthlyProgress,
  useConnectionStatus
} from '../stores/progressStore';

interface UseRealTimeProgressOptions {
  childId: string;
  enableHistorical?: boolean;
  autoConnect?: boolean;
}

export const useRealTimeProgress = ({
  childId,
  enableHistorical = true,
  autoConnect = true
}: UseRealTimeProgressOptions) => {
  const isConnecting = useRef(false);
  const hasInitialized = useRef(false);

  // Get data from store
  const currentProgress = useCurrentProgress(childId);
  const weeklyProgress = useWeeklyProgress(childId);
  const monthlyProgress = useMonthlyProgress(childId);
  const connectionStatus = useConnectionStatus();

  // Initialize connection and subscriptions
  useEffect(() => {
    if (!autoConnect || isConnecting.current || hasInitialized.current) return;

    const initializeConnection = async () => {
      isConnecting.current = true;

      try {
        // Initialize the service
        await realTimeProgressService.initialize();

        // Subscribe to current progress updates
        await realTimeProgressService.subscribeToCurrentProgress(childId);

        // Subscribe to historical progress if enabled
        if (enableHistorical) {
          await realTimeProgressService.subscribeToHistoricalProgress(childId);
        }

        // Fetch initial data
        await Promise.all([
          realTimeProgressService.fetchCurrentProgress(childId),
          enableHistorical ? realTimeProgressService.fetchWeeklyProgress(childId) : Promise.resolve(),
          enableHistorical ? realTimeProgressService.fetchMonthlyProgress(childId) : Promise.resolve()
        ]);

        hasInitialized.current = true;
      } catch (error) {
        console.error('Failed to initialize real-time progress:', error);
      } finally {
        isConnecting.current = false;
      }
    };

    initializeConnection();

    // Cleanup on unmount
    return () => {
      useProgressStore.getState().removeSubscription(childId);
    };
  }, [childId, enableHistorical, autoConnect]);

  // Manual connection methods
  const connect = async () => {
    if (isConnecting.current) return;

    isConnecting.current = true;
    try {
      await realTimeProgressService.initialize();
      await realTimeProgressService.subscribeToCurrentProgress(childId);

      if (enableHistorical) {
        await realTimeProgressService.subscribeToHistoricalProgress(childId);
      }

      hasInitialized.current = true;
    } finally {
      isConnecting.current = false;
    }
  };

  const disconnect = async () => {
    useProgressStore.getState().removeSubscription(childId);
    hasInitialized.current = false;
  };

  const refresh = async () => {
    try {
      useProgressStore.getState().setLoading(true);

      await Promise.all([
        realTimeProgressService.fetchCurrentProgress(childId),
        enableHistorical ? realTimeProgressService.fetchWeeklyProgress(childId) : Promise.resolve(),
        enableHistorical ? realTimeProgressService.fetchMonthlyProgress(childId) : Promise.resolve()
      ]);
    } catch (error) {
      console.error('Failed to refresh progress data:', error);
    } finally {
      useProgressStore.getState().setLoading(false);
    }
  };

  return {
    // Data
    currentProgress,
    weeklyProgress,
    monthlyProgress,

    // Connection status
    isConnected: connectionStatus.isConnected,
    isLoading: connectionStatus.isLoading,
    error: connectionStatus.error,
    lastSync: connectionStatus.lastSync,

    // Actions
    connect,
    disconnect,
    refresh,

    // Utilities
    isInitialized: hasInitialized.current,
    hasData: !!currentProgress
  };
};

export default useRealTimeProgress;
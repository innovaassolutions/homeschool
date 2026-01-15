import React from 'react';
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive';
import { useSessionStore } from '../../stores/sessionStore';
import type { AgeGroup } from '../../stores/sessionStore';

interface SessionTimerProps {
  ageGroup: AgeGroup;
  className?: string;
}

export const SessionTimer: React.FC<SessionTimerProps> = ({
  ageGroup,
  className = ''
}) => {
  const {
    currentSession,
    isSessionActive,
    timeRemaining,
    isBreakTime,
    breakTimeRemaining
  } = useSessionStore();

  const { getAgeAdaptiveStyles, getAgeAdaptiveText } = useAgeAdaptive();
  const styles = getAgeAdaptiveStyles(ageGroup);
  const text = getAgeAdaptiveText(ageGroup);

  if (!currentSession) {
    return null;
  }

  // Format time as MM:SS or HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const totalTime = currentSession.timingConfig.recommendedDuration * 60;
  const elapsed = totalTime - timeRemaining;
  const progressPercentage = Math.max(0, Math.min(100, (elapsed / totalTime) * 100));

  // Determine timer color based on remaining time
  const getTimerColor = () => {
    if (isBreakTime) return 'text-blue-600';
    if (!isSessionActive) return 'text-gray-500';

    const minutesRemaining = timeRemaining / 60;
    if (minutesRemaining <= 2) return 'text-red-600';
    if (minutesRemaining <= 5) return 'text-orange-600';
    return 'text-green-600';
  };

  // Age-adaptive display
  const showProgressBar = !text.simple; // Only for older kids
  const showBreakTimer = isBreakTime && currentSession.timingConfig.breakDuration > 0;

  return (
    <div className={`session-timer ${className}`}>
      {/* Main timer display */}
      <div className="text-right">
        {/* Session time */}
        <div className={`
          ${styles.text.heading} font-mono
          ${getTimerColor()}
        `}>
          {formatTime(timeRemaining)}
        </div>

        {/* Timer label */}
        <div className={`${styles.text.small} text-gray-500 -mt-1`}>
          {isBreakTime
            ? (text.simple ? 'Break time!' : 'Break time')
            : !isSessionActive
              ? (text.simple ? 'Paused' : 'Session paused')
              : (text.simple ? 'Time left' : 'Time remaining')
          }
        </div>

        {/* Break timer (if active) */}
        {showBreakTimer && (
          <div className={`${styles.text.body} text-blue-600 font-mono mt-1`}>
            Break: {formatTime(breakTimeRemaining)}
          </div>
        )}
      </div>

      {/* Progress bar (for older kids) */}
      {showProgressBar && !isBreakTime && (
        <div className="mt-3">
          <div className="flex justify-between items-center mb-1">
            <span className={`${styles.text.small} text-gray-500`}>
              Progress
            </span>
            <span className={`${styles.text.small} text-gray-500`}>
              {Math.round(progressPercentage)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`
                h-2 rounded-full transition-all duration-1000 ease-out
                ${isSessionActive
                  ? progressPercentage > 80 ? 'bg-red-500' :
                    progressPercentage > 60 ? 'bg-orange-500' : 'bg-green-500'
                  : 'bg-gray-400'
                }
              `}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Visual indicators for younger kids */}
      {text.simple && (
        <div className="mt-2 flex justify-center">
          {/* Emoji-based progress indicator */}
          <div className="flex space-x-1">
            {Array.from({ length: 5 }, (_, i) => {
              const segmentProgress = progressPercentage / 20; // Each segment is 20%
              const isActive = i < segmentProgress;
              const isCurrent = i <= segmentProgress && i + 1 > segmentProgress;

              return (
                <div
                  key={i}
                  className={`
                    w-3 h-3 rounded-full transition-colors duration-500
                    ${isActive
                      ? 'bg-green-400'
                      : isCurrent
                        ? 'bg-yellow-400 animate-pulse'
                        : 'bg-gray-200'
                    }
                  `}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Break time visual indicator */}
      {isBreakTime && (
        <div className="mt-2 text-center">
          <div className={`
            inline-flex items-center px-3 py-1 rounded-full
            bg-blue-100 text-blue-800 ${styles.text.small}
          `}>
            {text.simple ? '☕ Break!' : '☕ Break Time'}
          </div>
        </div>
      )}

      {/* Session state indicators */}
      {!isSessionActive && !isBreakTime && (
        <div className="mt-2 text-center">
          <div className={`
            inline-flex items-center px-3 py-1 rounded-full
            bg-yellow-100 text-yellow-800 ${styles.text.small}
          `}>
            {text.simple ? '⏸️ Paused' : '⏸️ Session Paused'}
          </div>
        </div>
      )}

      {/* Warning when time is running low */}
      {isSessionActive && !isBreakTime && timeRemaining <= 300 && timeRemaining > 0 && (
        <div className={`
          mt-2 text-center ${styles.text.small} text-orange-600
          ${timeRemaining <= 60 ? 'animate-pulse' : ''}
        `}>
          {timeRemaining <= 60
            ? (text.simple ? '⚠️ Almost done!' : '⚠️ Less than 1 minute left!')
            : (text.simple ? '⚠️ 5 minutes left!' : '⚠️ Less than 5 minutes left!')
          }
        </div>
      )}
    </div>
  );
};
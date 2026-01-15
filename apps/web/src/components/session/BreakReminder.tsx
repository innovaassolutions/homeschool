import React, { useEffect, useState } from 'react';
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive';
import { useSessionStore } from '../../stores/sessionStore';
import type { AgeGroup } from '../../stores/sessionStore';

interface BreakReminderProps {
  ageGroup: AgeGroup;
  onDismiss: () => void;
  onResumeSession: () => void;
  className?: string;
}

export const BreakReminder: React.FC<BreakReminderProps> = ({
  ageGroup,
  onDismiss,
  onResumeSession,
  className = ''
}) => {
  const { breakTimeRemaining, currentSession } = useSessionStore();
  const { getAgeAdaptiveStyles, getAgeAdaptiveText } = useAgeAdaptive();
  const styles = getAgeAdaptiveStyles(ageGroup);
  const text = getAgeAdaptiveText(ageGroup);

  // Auto-dismiss when break time is over
  useEffect(() => {
    if (breakTimeRemaining <= 0) {
      onDismiss();
    }
  }, [breakTimeRemaining, onDismiss]);

  // Format break time
  const formatBreakTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Age-adaptive break activities
  const getBreakActivities = () => {
    const activities = {
      ages6to9: [
        '🤸‍♀️ Do some jumping jacks',
        '💧 Get a drink of water',
        '🧘‍♀️ Take deep breaths',
        '🚶‍♀️ Walk around the room',
        '🤲 Stretch your arms up high'
      ],
      ages10to13: [
        '💧 Hydrate with some water',
        '🚶‍♀️ Take a quick walk',
        '👀 Look away from the screen',
        '🧘‍♀️ Do some breathing exercises',
        '🤸‍♀️ Do some light stretching',
        '🥪 Grab a healthy snack'
      ],
      ages14to16: [
        '💧 Stay hydrated',
        '🚶‍♀️ Move around and stretch',
        '👀 Rest your eyes',
        '🧘‍♀️ Practice mindfulness',
        '🥪 Have a nutritious snack',
        '📱 Check messages (briefly)',
        '🌬️ Get some fresh air'
      ]
    };

    return activities[ageGroup];
  };

  const breakActivities = getBreakActivities();
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);

  // Cycle through activities every few seconds for younger kids
  useEffect(() => {
    if (!text.simple) return;

    const interval = setInterval(() => {
      setCurrentActivityIndex((prev) => (prev + 1) % breakActivities.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [text.simple, breakActivities.length]);

  const handleResumeNow = () => {
    onResumeSession();
    onDismiss();
  };

  return (
    <div className={`break-reminder ${className}`}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        {/* Modal */}
        <div className={`
          bg-white rounded-lg shadow-xl max-w-md mx-4 p-6
          ${styles.spacing.comfortable}
          ${text.simple ? 'border-4 border-blue-300' : 'border border-gray-200'}
        `}>
          {/* Header */}
          <div className="text-center mb-6">
            <div className={`
              ${text.simple ? 'text-6xl' : 'text-4xl'} mb-3
            `}>
              ☕
            </div>
            <h2 className={`${styles.text.heading} text-blue-600 mb-2`}>
              {text.simple ? 'Break Time!' : 'Time for a Break'}
            </h2>
            <p className={`${styles.text.body} text-gray-600`}>
              {text.simple
                ? 'Let\'s take a break and come back refreshed!'
                : 'You\'ve been learning for a while. Take a quick break to recharge.'
              }
            </p>
          </div>

          {/* Break timer */}
          {currentSession && currentSession.timingConfig.breakDuration > 0 && (
            <div className="text-center mb-6">
              <div className={`
                ${styles.text.heading} font-mono text-blue-600 mb-2
                ${text.simple ? 'text-3xl' : 'text-2xl'}
              `}>
                {formatBreakTime(breakTimeRemaining)}
              </div>
              <p className={`${styles.text.small} text-gray-500`}>
                {text.simple ? 'Break time left' : 'Recommended break time remaining'}
              </p>

              {/* Visual progress for younger kids */}
              {text.simple && (
                <div className="flex justify-center mt-3">
                  <div className="flex space-x-1">
                    {Array.from({ length: 5 }, (_, i) => {
                      const progress = (currentSession.timingConfig.breakDuration * 60 - breakTimeRemaining) / (currentSession.timingConfig.breakDuration * 60);
                      const segmentProgress = progress * 5;
                      const isActive = i < segmentProgress;

                      return (
                        <div
                          key={i}
                          className={`
                            w-3 h-3 rounded-full transition-colors duration-500
                            ${isActive ? 'bg-blue-400' : 'bg-gray-200'}
                          `}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Break activities */}
          <div className="mb-6">
            <h3 className={`${styles.text.subheading} mb-3 text-center`}>
              {text.simple ? 'Try this:' : 'Break suggestions:'}
            </h3>

            {text.simple ? (
              // Single rotating activity for younger kids
              <div className={`
                bg-blue-50 rounded-lg p-4 text-center
                transition-all duration-300
              `}>
                <div className={`${styles.text.body} text-blue-800`}>
                  {breakActivities[currentActivityIndex]}
                </div>
              </div>
            ) : (
              // List of activities for older kids
              <div className="space-y-2">
                {breakActivities.slice(0, 4).map((activity, index) => (
                  <div
                    key={index}
                    className={`
                      flex items-center ${styles.text.body} text-gray-700
                      py-2 px-3 rounded-lg hover:bg-gray-50
                    `}
                  >
                    {activity}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            {/* Resume button */}
            <button
              onClick={handleResumeNow}
              className={`
                w-full ${styles.button.primary}
                ${text.simple ? 'py-4 text-lg' : 'py-3'}
                transition-all duration-200
              `}
            >
              {text.simple ? '🚀 Ready to learn!' : '▶️ Resume Session'}
            </button>

            {/* Extend break for older kids */}
            {!text.simple && (
              <button
                onClick={onDismiss}
                className={`
                  w-full ${styles.button.ghost}
                  py-3 transition-all duration-200
                `}
              >
                ⏰ Take a longer break
              </button>
            )}
          </div>

          {/* Encouragement message */}
          <div className="mt-4 text-center">
            <p className={`${styles.text.small} text-gray-500`}>
              {text.simple
                ? '🌟 You\'re doing great!'
                : '💪 Taking breaks helps you learn better!'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
import React, { useState } from 'react';
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive';
import type { AgeGroup, LearningSession } from '../../stores/sessionStore';

interface SessionControlsProps {
  ageGroup: AgeGroup;
  session: LearningSession;
  isSessionActive: boolean;
  isLoading: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onAbandon: () => void;
  className?: string;
}

export const SessionControls: React.FC<SessionControlsProps> = ({
  ageGroup,
  session,
  isSessionActive,
  isLoading,
  onStart,
  onPause,
  onResume,
  onComplete,
  onAbandon,
  className = ''
}) => {
  const { getAgeAdaptiveStyles, getAgeAdaptiveText } = useAgeAdaptive();
  const styles = getAgeAdaptiveStyles(ageGroup);
  const text = getAgeAdaptiveText(ageGroup);

  // Local state for confirmation dialogs
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);

  const handleCompleteConfirm = () => {
    setShowCompleteConfirm(false);
    onComplete();
  };

  const handleAbandonConfirm = () => {
    setShowAbandonConfirm(false);
    onAbandon();
  };

  // Age-adaptive button sizing and layout
  const buttonBaseClass = `
    transition-all duration-200 font-medium rounded-lg
    ${text.simple ? 'text-lg py-4 px-6' : 'text-base py-3 px-4'}
    ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}
  `;

  const primaryButtonClass = `
    ${buttonBaseClass} ${styles.button.primary}
    ${text.simple ? 'shadow-lg' : ''}
  `;

  const secondaryButtonClass = `
    ${buttonBaseClass} ${styles.button.secondary}
  `;

  const dangerButtonClass = `
    ${buttonBaseClass}
    bg-red-500 text-white hover:bg-red-600
    focus:ring-2 focus:ring-red-500 focus:ring-offset-2
  `;

  // Main controls based on session state
  const renderMainControls = () => {
    if (session.state === 'not_started') {
      return (
        <button
          onClick={onStart}
          disabled={isLoading}
          className={`${primaryButtonClass} w-full`}
        >
          {text.simple ? '🚀 Start Learning!' : '▶️ Start Session'}
        </button>
      );
    }

    if (session.state === 'paused' || session.state === 'break') {
      return (
        <div className={`grid ${text.simple ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-3'}`}>
          <button
            onClick={onResume}
            disabled={isLoading}
            className={primaryButtonClass}
          >
            {text.simple ? '▶️ Keep Going!' : '▶️ Resume'}
          </button>
          {!text.simple && (
            <button
              onClick={() => setShowCompleteConfirm(true)}
              disabled={isLoading}
              className={secondaryButtonClass}
            >
              ✅ Complete
            </button>
          )}
        </div>
      );
    }

    if (session.state === 'active') {
      return (
        <div className={`grid ${text.simple ? 'grid-cols-1 gap-3' : 'grid-cols-3 gap-3'}`}>
          <button
            onClick={onPause}
            disabled={isLoading}
            className={secondaryButtonClass}
          >
            {text.simple ? '⏸️ Take a Break' : '⏸️ Pause'}
          </button>
          <button
            onClick={() => setShowCompleteConfirm(true)}
            disabled={isLoading}
            className={primaryButtonClass}
          >
            {text.simple ? '✅ I\'m Done!' : '✅ Complete'}
          </button>
          {!text.simple && (
            <button
              onClick={() => setShowAbandonConfirm(true)}
              disabled={isLoading}
              className={`${buttonBaseClass} bg-gray-300 text-gray-700 hover:bg-gray-400`}
            >
              ❌ Stop
            </button>
          )}
        </div>
      );
    }

    // Completed or abandoned states
    return (
      <div className="text-center py-4">
        <div className={`
          inline-flex items-center px-4 py-2 rounded-full
          ${session.state === 'completed'
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800'
          }
          ${styles.text.body}
        `}>
          {session.state === 'completed'
            ? (text.simple ? '🎉 Great job!' : '🎉 Session completed!')
            : (text.simple ? '😔 Session stopped' : '😔 Session was stopped')
          }
        </div>
      </div>
    );
  };

  // Quick action buttons for younger kids
  const renderQuickActions = () => {
    if (!text.simple || session.state !== 'active') return null;

    return (
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowAbandonConfirm(true)}
          disabled={isLoading}
          className={`
            ${buttonBaseClass}
            bg-orange-100 text-orange-700 hover:bg-orange-200
            text-base py-3
          `}
        >
          😓 I need help
        </button>
        <button
          onClick={onPause}
          disabled={isLoading}
          className={`
            ${buttonBaseClass}
            bg-blue-100 text-blue-700 hover:bg-blue-200
            text-base py-3
          `}
        >
          🚽 Bathroom break
        </button>
      </div>
    );
  };

  return (
    <div className={`session-controls ${className}`}>
      <div className={`
        bg-white rounded-lg border border-gray-200 p-4
        ${styles.spacing.comfortable}
      `}>
        {/* Main control buttons */}
        {renderMainControls()}

        {/* Quick action buttons for younger kids */}
        {renderQuickActions()}

        {/* Session info for older kids */}
        {!text.simple && session.state === 'active' && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center text-sm text-gray-500">
              <span>Interactions: {session.interactionCount}</span>
              <span>Progress: {Math.round(session.completionRate * 100)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Completion confirmation modal */}
      {showCompleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`
            bg-white rounded-lg p-6 max-w-md mx-4
            ${styles.spacing.comfortable}
          `}>
            <h3 className={`${styles.text.heading} mb-4`}>
              {text.simple ? 'Are you sure you\'re done?' : 'Complete this session?'}
            </h3>
            <p className={`${styles.text.body} text-gray-600 mb-6`}>
              {text.simple
                ? 'Did you finish everything you wanted to learn?'
                : 'Mark this session as completed. You can always start a new session later.'
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCompleteConfirm}
                className={primaryButtonClass}
              >
                {text.simple ? '✅ Yes, I\'m done!' : '✅ Complete Session'}
              </button>
              <button
                onClick={() => setShowCompleteConfirm(false)}
                className={secondaryButtonClass}
              >
                {text.simple ? 'Keep going' : 'Continue Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Abandon confirmation modal */}
      {showAbandonConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`
            bg-white rounded-lg p-6 max-w-md mx-4
            ${styles.spacing.comfortable}
          `}>
            <h3 className={`${styles.text.heading} mb-4`}>
              {text.simple ? 'Do you need help?' : 'Stop this session?'}
            </h3>
            <p className={`${styles.text.body} text-gray-600 mb-6`}>
              {text.simple
                ? 'That\'s okay! Let\'s stop here and you can try again later.'
                : 'This will stop your current session. Your progress won\'t be saved.'
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleAbandonConfirm}
                className={dangerButtonClass}
              >
                {text.simple ? '😔 Yes, stop here' : '❌ Stop Session'}
              </button>
              <button
                onClick={() => setShowAbandonConfirm(false)}
                className={secondaryButtonClass}
              >
                {text.simple ? 'Keep trying' : 'Continue Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
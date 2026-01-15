import React, { useEffect, useState } from 'react';
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive';
import { useSessionStore } from '../../stores/sessionStore';
import type { AgeGroup, LearningSession, SessionType } from '../../stores/sessionStore';

interface SessionHistoryProps {
  childId: string;
  ageGroup: AgeGroup;
  limit?: number;
  className?: string;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({
  childId,
  ageGroup,
  limit = 10,
  className = ''
}) => {
  const {
    recentSessions,
    sessionStats,
    isLoading,
    error,
    fetchRecentSessions,
    fetchSessionStats
  } = useSessionStore();

  const { getAgeAdaptiveStyles, getAgeAdaptiveText } = useAgeAdaptive();
  const styles = getAgeAdaptiveStyles(ageGroup);
  const text = getAgeAdaptiveText(ageGroup);

  // Local state
  const [selectedSessionType, setSelectedSessionType] = useState<SessionType | 'all'>('all');

  // Fetch data on mount
  useEffect(() => {
    fetchRecentSessions(childId, limit);
    fetchSessionStats(childId);
  }, [childId, limit, fetchRecentSessions, fetchSessionStats]);

  // Filter sessions by type
  const filteredSessions = selectedSessionType === 'all'
    ? recentSessions
    : recentSessions.filter(session => session.type === selectedSessionType);

  // Format date for display
  const formatDate = (date: Date): string => {
    const sessionDate = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - sessionDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return text.simple ? 'Today' : 'Today';
    if (diffDays === 2) return text.simple ? 'Yesterday' : 'Yesterday';
    if (diffDays <= 7) return text.simple ? `${diffDays} days ago` : `${diffDays} days ago`;

    return sessionDate.toLocaleDateString(undefined, {
      month: text.simple ? 'short' : 'short',
      day: 'numeric',
      year: sessionDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  // Format duration
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}${text.simple ? 'm' : ' min'}`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  // Get session type emoji and label
  const getSessionTypeInfo = (type: SessionType) => {
    const info = {
      assessment: { emoji: '📝', label: text.simple ? 'Test' : 'Assessment' },
      lesson: { emoji: '📚', label: text.simple ? 'Learn' : 'Lesson' },
      practice: { emoji: '💪', label: text.simple ? 'Practice' : 'Practice' },
      review: { emoji: '🔄', label: text.simple ? 'Review' : 'Review' }
    };
    return info[type];
  };

  // Get state color and emoji
  const getStateInfo = (state: string) => {
    const info = {
      completed: { emoji: '✅', color: 'text-green-600', bg: 'bg-green-50', label: text.simple ? 'Done!' : 'Completed' },
      abandoned: { emoji: '❌', color: 'text-red-600', bg: 'bg-red-50', label: text.simple ? 'Stopped' : 'Stopped' },
      paused: { emoji: '⏸️', color: 'text-yellow-600', bg: 'bg-yellow-50', label: text.simple ? 'Paused' : 'Paused' },
      active: { emoji: '▶️', color: 'text-blue-600', bg: 'bg-blue-50', label: text.simple ? 'Active' : 'Active' }
    };
    return info[state] || { emoji: '❓', color: 'text-gray-600', bg: 'bg-gray-50', label: state };
  };

  if (isLoading) {
    return (
      <div className={`session-history ${className}`}>
        <div className="text-center py-8">
          <div className={`${styles.text.body} text-gray-500`}>
            {text.simple ? 'Loading...' : 'Loading your learning history...'}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`session-history ${className}`}>
        <div className="text-center py-8">
          <div className={`${styles.text.body} text-red-600`}>
            {text.simple ? 'Oops! Something went wrong.' : 'Unable to load session history'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`session-history ${className}`}>
      {/* Header with stats */}
      {sessionStats && (
        <div className={`
          bg-white rounded-lg border border-gray-200 p-4 mb-6
          ${styles.spacing.comfortable}
        `}>
          <h2 className={`${styles.text.heading} mb-4`}>
            {text.simple ? 'Your Learning' : 'Learning Progress'}
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`${styles.text.heading} text-blue-600`}>
                {sessionStats.totalSessions}
              </div>
              <div className={`${styles.text.small} text-gray-500`}>
                {text.simple ? 'Sessions' : 'Total Sessions'}
              </div>
            </div>

            <div className="text-center">
              <div className={`${styles.text.heading} text-green-600`}>
                {Math.round(sessionStats.completionRate * 100)}%
              </div>
              <div className={`${styles.text.small} text-gray-500`}>
                {text.simple ? 'Completed' : 'Completion Rate'}
              </div>
            </div>

            <div className="text-center">
              <div className={`${styles.text.heading} text-purple-600`}>
                {formatDuration(sessionStats.averageDuration)}
              </div>
              <div className={`${styles.text.small} text-gray-500`}>
                {text.simple ? 'Average' : 'Avg Duration'}
              </div>
            </div>

            <div className="text-center">
              <div className={`${styles.text.heading} text-orange-600`}>
                {sessionStats.activeSessions}
              </div>
              <div className={`${styles.text.small} text-gray-500`}>
                {text.simple ? 'Active' : 'Active Now'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter buttons (for older kids) */}
      {!text.simple && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {(['all', 'lesson', 'practice', 'review', 'assessment'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedSessionType(type)}
                className={`
                  px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${selectedSessionType === type
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                {type === 'all' ? 'All' : getSessionTypeInfo(type as SessionType).label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Session list */}
      <div className="space-y-3">
        {filteredSessions.length === 0 ? (
          <div className={`
            bg-white rounded-lg border border-gray-200 p-6 text-center
            ${styles.spacing.comfortable}
          `}>
            <div className="text-4xl mb-3">📚</div>
            <h3 className={`${styles.text.subheading} mb-2`}>
              {text.simple ? 'No sessions yet!' : 'No learning sessions found'}
            </h3>
            <p className={`${styles.text.body} text-gray-600`}>
              {text.simple
                ? 'Start your first learning session to see it here!'
                : 'Your completed learning sessions will appear here.'
              }
            </p>
          </div>
        ) : (
          filteredSessions.map((session) => {
            const typeInfo = getSessionTypeInfo(session.type);
            const stateInfo = getStateInfo(session.state);

            return (
              <div
                key={session.id}
                className={`
                  bg-white rounded-lg border border-gray-200 p-4
                  ${styles.spacing.comfortable}
                  hover:shadow-md transition-shadow
                `}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {/* Session title and type */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{typeInfo.emoji}</span>
                      <h3 className={`${styles.text.subheading} flex-1`}>
                        {session.title}
                      </h3>
                      <span className={`
                        inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                        ${stateInfo.bg} ${stateInfo.color}
                      `}>
                        {stateInfo.emoji} {stateInfo.label}
                      </span>
                    </div>

                    {/* Session description */}
                    {session.description && !text.simple && (
                      <p className={`${styles.text.small} text-gray-600 mb-2`}>
                        {session.description}
                      </p>
                    )}

                    {/* Session stats */}
                    <div className="flex items-center gap-4">
                      <span className={`${styles.text.small} text-gray-500`}>
                        📅 {formatDate(session.createdAt)}
                      </span>
                      <span className={`${styles.text.small} text-gray-500`}>
                        ⏱️ {formatDuration(Math.round(session.totalDuration / 60))}
                      </span>
                      {session.state === 'completed' && (
                        <span className={`${styles.text.small} text-gray-500`}>
                          🎯 {Math.round(session.completionRate * 100)}%
                        </span>
                      )}
                      {!text.simple && session.interactionCount > 0 && (
                        <span className={`${styles.text.small} text-gray-500`}>
                          💬 {session.interactionCount} interactions
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Load more button */}
      {recentSessions.length >= limit && (
        <div className="text-center mt-6">
          <button
            onClick={() => fetchRecentSessions(childId, limit + 10)}
            disabled={isLoading}
            className={`
              ${styles.button.ghost}
              ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {isLoading
              ? (text.simple ? 'Loading...' : 'Loading more...')
              : (text.simple ? 'Show more' : 'Load more sessions')
            }
          </button>
        </div>
      )}
    </div>
  );
};
import React from 'react';
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive';
import type { AgeGroup, LearningSession } from '../../stores/sessionStore';

interface SessionCompleteProps {
  ageGroup: AgeGroup;
  session: LearningSession;
  onDismiss: () => void;
  onNewSession: () => void;
  className?: string;
}

export const SessionComplete: React.FC<SessionCompleteProps> = ({
  ageGroup,
  session,
  onDismiss,
  onNewSession,
  className = ''
}) => {
  const { getAgeAdaptiveStyles, getAgeAdaptiveText } = useAgeAdaptive();
  const styles = getAgeAdaptiveStyles(ageGroup);
  const text = getAgeAdaptiveText(ageGroup);

  // Calculate session stats
  const sessionDurationMinutes = Math.round(session.totalDuration / 60);
  const completionPercentage = Math.round(session.completionRate * 100);
  const completedObjectives = session.learningObjectives.filter(obj => obj.completed).length;

  // Age-adaptive celebration messages
  const getCelebrationMessage = () => {
    const messages = {
      ages6to9: [
        'Amazing work! 🌟',
        'You\'re a superstar! ⭐',
        'Fantastic job! 🎉',
        'You did it! 🚀'
      ],
      ages10to13: [
        'Excellent work! 🎯',
        'Great job completing your session! 👏',
        'You should be proud! 🌟',
        'Well done! 💪'
      ],
      ages14to16: [
        'Session completed successfully! 🎯',
        'Great work on your learning goals! 📚',
        'Excellent progress! 💪',
        'You\'ve accomplished a lot! 🌟'
      ]
    };

    const messageList = messages[ageGroup];
    return messageList[Math.floor(Math.random() * messageList.length)];
  };

  // Format session duration
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} ${text.simple ? 'minutes' : 'min'}`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  // Achievement badges based on session performance
  const getAchievements = () => {
    const achievements = [];

    if (completionPercentage >= 90) {
      achievements.push({
        emoji: '🏆',
        title: text.simple ? 'Champion!' : 'High Achiever',
        description: text.simple ? 'You did almost everything!' : 'Completed 90%+ of objectives'
      });
    }

    if (sessionDurationMinutes >= session.timingConfig.recommendedDuration) {
      achievements.push({
        emoji: '⏰',
        title: text.simple ? 'Time Master!' : 'Time Manager',
        description: text.simple ? 'You stayed focused!' : 'Completed full recommended session'
      });
    }

    if (session.interactionCount >= 10) {
      achievements.push({
        emoji: '🗣️',
        title: text.simple ? 'Great Talker!' : 'Active Learner',
        description: text.simple ? 'You asked lots of questions!' : 'High interaction engagement'
      });
    }

    if (session.averageResponseTime <= 3000) {
      achievements.push({
        emoji: '⚡',
        title: text.simple ? 'Quick Thinker!' : 'Quick Responder',
        description: text.simple ? 'You were super fast!' : 'Fast response times'
      });
    }

    return achievements;
  };

  const achievements = getAchievements();

  return (
    <div className={`session-complete ${className}`}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        {/* Modal */}
        <div className={`
          bg-white rounded-lg shadow-xl max-w-lg mx-4 p-6
          ${styles.spacing.comfortable}
          ${text.simple ? 'border-4 border-green-300' : 'border border-gray-200'}
        `}>
          {/* Celebration header */}
          <div className="text-center mb-6">
            <div className={`
              ${text.simple ? 'text-8xl animate-bounce' : 'text-6xl'} mb-4
            `}>
              🎉
            </div>
            <h2 className={`${styles.text.heading} text-green-600 mb-2`}>
              {getCelebrationMessage()}
            </h2>
            <p className={`${styles.text.body} text-gray-600`}>
              {text.simple
                ? `You finished learning about "${session.title}"!`
                : `You've successfully completed your ${session.type} session!`
              }
            </p>
          </div>

          {/* Session summary */}
          <div className={`
            bg-gray-50 rounded-lg p-4 mb-6
            ${styles.spacing.comfortable}
          `}>
            <h3 className={`${styles.text.subheading} mb-3`}>
              {text.simple ? 'What you did:' : 'Session Summary'}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Duration */}
              <div className="text-center">
                <div className={`${styles.text.heading} text-blue-600`}>
                  {formatDuration(sessionDurationMinutes)}
                </div>
                <div className={`${styles.text.small} text-gray-500`}>
                  {text.simple ? 'Time spent' : 'Duration'}
                </div>
              </div>

              {/* Completion rate */}
              <div className="text-center">
                <div className={`${styles.text.heading} text-green-600`}>
                  {completionPercentage}%
                </div>
                <div className={`${styles.text.small} text-gray-500`}>
                  {text.simple ? 'Completed' : 'Progress'}
                </div>
              </div>

              {/* Interactions (for older kids) */}
              {!text.simple && (
                <>
                  <div className="text-center">
                    <div className={`${styles.text.heading} text-purple-600`}>
                      {session.interactionCount}
                    </div>
                    <div className={`${styles.text.small} text-gray-500`}>
                      Interactions
                    </div>
                  </div>

                  <div className="text-center">
                    <div className={`${styles.text.heading} text-orange-600`}>
                      {completedObjectives}
                    </div>
                    <div className={`${styles.text.small} text-gray-500`}>
                      Goals met
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Achievements */}
          {achievements.length > 0 && (
            <div className="mb-6">
              <h3 className={`${styles.text.subheading} mb-3`}>
                {text.simple ? 'You earned:' : 'Achievements'}
              </h3>
              <div className="space-y-2">
                {achievements.map((achievement, index) => (
                  <div
                    key={index}
                    className={`
                      flex items-center p-3 rounded-lg
                      ${text.simple ? 'bg-yellow-50 border-2 border-yellow-200' : 'bg-gray-50'}
                    `}
                  >
                    <div className={`
                      ${text.simple ? 'text-3xl' : 'text-2xl'} mr-3
                    `}>
                      {achievement.emoji}
                    </div>
                    <div>
                      <div className={`${styles.text.body} font-medium`}>
                        {achievement.title}
                      </div>
                      <div className={`${styles.text.small} text-gray-600`}>
                        {achievement.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-3">
            {/* Start new session */}
            <button
              onClick={onNewSession}
              className={`
                w-full ${styles.button.primary}
                ${text.simple ? 'py-4 text-lg' : 'py-3'}
                transition-all duration-200
              `}
            >
              {text.simple ? '🚀 Learn more!' : '📚 Start New Session'}
            </button>

            {/* View progress (for older kids) */}
            {!text.simple && (
              <button
                onClick={onDismiss}
                className={`
                  w-full ${styles.button.secondary}
                  py-3 transition-all duration-200
                `}
              >
                📊 View Learning Progress
              </button>
            )}

            {/* Done for now */}
            <button
              onClick={onDismiss}
              className={`
                w-full ${styles.button.ghost}
                ${text.simple ? 'py-3 text-base' : 'py-3'}
                transition-all duration-200
              `}
            >
              {text.simple ? '✅ All done for now' : '✅ Done for Now'}
            </button>
          </div>

          {/* Encouragement message */}
          <div className="mt-4 text-center">
            <p className={`${styles.text.small} text-gray-500`}>
              {text.simple
                ? '🌟 Keep up the great work!'
                : '🌟 Great job! Learning is a journey, and you\'re making excellent progress.'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
import React from 'react';
import { PhotoAnnotations, VisualAnnotation } from './PhotoAnnotations';

// Match the backend interfaces
export interface FeedbackContent {
  feedback: string;
  positiveReinforcement: string[];
  improvementSuggestions: ImprovementSuggestion[];
  visualAnnotations: VisualAnnotation[];
  learningInsights: LearningInsight;
  ageGroup: 'ages6to9' | 'ages10to13' | 'ages14to16';
  voiceFeedbackUrl?: string;
}

export interface ImprovementSuggestion {
  area: string;
  suggestion: string;
  actionable: boolean;
  priority?: 'low' | 'medium' | 'high';
  resources?: string[];
}

export interface LearningInsight {
  commonErrorPatterns: string[];
  skillsNeedingFocus: string[];
  recommendedActivities: string[];
  progressIndicators: {
    area: string;
    currentLevel: string;
    targetLevel: string;
    timeframe: string;
  }[];
  motivationalElements: string[];
}

export interface FeedbackDisplayProps {
  feedbackContent: FeedbackContent;
  analysisImageUrl: string;
  onRetryFeedback?: () => void;
  onPlayVoiceFeedback?: () => void;
  className?: string;
}

const getPriorityColor = (priority?: string): string => {
  switch (priority) {
    case 'high':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'low':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

const getAgeAppropriateStyles = (ageGroup: string) => {
  switch (ageGroup) {
    case 'ages6to9':
      return {
        container: 'bg-gradient-to-br from-blue-50 to-green-50 border-2 border-blue-200 rounded-xl',
        heading: 'text-2xl font-bold text-blue-700',
        subheading: 'text-lg font-semibold text-green-600',
        text: 'text-base text-gray-700',
        button: 'bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-full text-lg',
        card: 'bg-white border-2 border-blue-100 rounded-lg shadow-sm'
      };
    case 'ages10to13':
      return {
        container: 'bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg',
        heading: 'text-xl font-bold text-purple-700',
        subheading: 'text-lg font-semibold text-pink-600',
        text: 'text-sm text-gray-700',
        button: 'bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-5 rounded-lg',
        card: 'bg-white border border-purple-100 rounded-md shadow-sm'
      };
    case 'ages14to16':
      return {
        container: 'bg-white border border-gray-200 rounded-md',
        heading: 'text-lg font-bold text-gray-800',
        subheading: 'text-base font-semibold text-gray-700',
        text: 'text-sm text-gray-600',
        button: 'bg-gray-700 hover:bg-gray-800 text-white font-medium py-2 px-4 rounded',
        card: 'bg-gray-50 border border-gray-200 rounded shadow-sm'
      };
    default:
      return {
        container: 'bg-white border border-gray-200 rounded-md',
        heading: 'text-lg font-bold text-gray-800',
        subheading: 'text-base font-semibold text-gray-700',
        text: 'text-sm text-gray-600',
        button: 'bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded',
        card: 'bg-gray-50 border border-gray-200 rounded shadow-sm'
      };
  }
};

export const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({
  feedbackContent,
  analysisImageUrl,
  onRetryFeedback,
  onPlayVoiceFeedback,
  className = ''
}) => {
  const styles = getAgeAppropriateStyles(feedbackContent.ageGroup);

  return (
    <div className={`feedback-display ${styles.container} p-6 space-y-6 ${className}`}>

      {/* Header with Voice Control */}
      <div className="feedback-header flex justify-between items-start">
        <h2 className={`${styles.heading} mb-2`}>
          {feedbackContent.ageGroup === 'ages6to9' ? '🌟 Your Learning Adventure!' :
           feedbackContent.ageGroup === 'ages10to13' ? '📚 Feedback Report' :
           '📋 Performance Analysis'}
        </h2>

        {feedbackContent.voiceFeedbackUrl && onPlayVoiceFeedback && (
          <button
            onClick={onPlayVoiceFeedback}
            className={`${styles.button} flex items-center space-x-2`}
          >
            <span>🔊</span>
            <span>
              {feedbackContent.ageGroup === 'ages6to9' ? 'Listen to Feedback' : 'Play Audio'}
            </span>
          </button>
        )}
      </div>

      {/* Main Feedback Text */}
      <div className={`feedback-content ${styles.card} p-4`}>
        <h3 className={`${styles.subheading} mb-3`}>
          {feedbackContent.ageGroup === 'ages6to9' ? '💭 What I Think' : 'Feedback'}
        </h3>
        <p className={`${styles.text} leading-relaxed`}>
          {feedbackContent.feedback}
        </p>
      </div>

      {/* Photo with Annotations */}
      {analysisImageUrl && feedbackContent.visualAnnotations.length > 0 && (
        <div className={`photo-review ${styles.card} p-4`}>
          <h3 className={`${styles.subheading} mb-3`}>
            {feedbackContent.ageGroup === 'ages6to9' ? '📸 Your Work with Tips' : 'Annotated Review'}
          </h3>
          <PhotoAnnotations
            imageUrl={analysisImageUrl}
            annotations={feedbackContent.visualAnnotations}
            interactive={true}
            ageGroup={feedbackContent.ageGroup}
            className="mx-auto"
          />
        </div>
      )}

      {/* Positive Reinforcement */}
      {feedbackContent.positiveReinforcement.length > 0 && (
        <div className={`positive-feedback ${styles.card} p-4`}>
          <h3 className={`${styles.subheading} mb-3 text-green-600`}>
            {feedbackContent.ageGroup === 'ages6to9' ? '⭐ Things You Did Great!' :
             feedbackContent.ageGroup === 'ages10to13' ? '✨ Strengths' :
             '✓ Positive Aspects'}
          </h3>
          <ul className="space-y-2">
            {feedbackContent.positiveReinforcement.map((item, index) => (
              <li key={index} className={`${styles.text} flex items-start space-x-2`}>
                <span className="text-green-500 mt-1">
                  {feedbackContent.ageGroup === 'ages6to9' ? '🌟' : '•'}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvement Suggestions */}
      {feedbackContent.improvementSuggestions.length > 0 && (
        <div className={`improvement-suggestions ${styles.card} p-4`}>
          <h3 className={`${styles.subheading} mb-3 text-orange-600`}>
            {feedbackContent.ageGroup === 'ages6to9' ? '🚀 Ways to Get Even Better!' :
             feedbackContent.ageGroup === 'ages10to13' ? '💡 Improvement Ideas' :
             '→ Areas for Improvement'}
          </h3>
          <div className="space-y-3">
            {feedbackContent.improvementSuggestions.map((suggestion, index) => (
              <div
                key={index}
                className={`suggestion-item p-3 rounded-lg border ${getPriorityColor(suggestion.priority)}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className={`font-semibold ${styles.text}`}>
                    {suggestion.area.replace('_', ' ').split(' ').map(word =>
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')}
                  </h4>
                  {suggestion.priority && (
                    <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(suggestion.priority)}`}>
                      {suggestion.priority}
                    </span>
                  )}
                </div>
                <p className={`${styles.text} mb-2`}>
                  {suggestion.suggestion}
                </p>
                {suggestion.resources && suggestion.resources.length > 0 && (
                  <div className="resources mt-2">
                    <span className={`text-xs font-medium ${styles.text}`}>Resources:</span>
                    <ul className="text-xs space-y-1 mt-1">
                      {suggestion.resources.map((resource, idx) => (
                        <li key={idx} className={styles.text}>• {resource}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Learning Insights */}
      <div className={`learning-insights ${styles.card} p-4`}>
        <h3 className={`${styles.subheading} mb-3 text-purple-600`}>
          {feedbackContent.ageGroup === 'ages6to9' ? '🧠 Learning Journey' :
           feedbackContent.ageGroup === 'ages10to13' ? '📊 Progress Insights' :
           '📈 Learning Analytics'}
        </h3>

        <div className="insights-grid space-y-4">

          {/* Recommended Activities */}
          {feedbackContent.learningInsights.recommendedActivities.length > 0 && (
            <div>
              <h4 className={`font-medium ${styles.text} mb-2`}>
                {feedbackContent.ageGroup === 'ages6to9' ? '🎯 Fun Activities for You' : 'Recommended Activities'}
              </h4>
              <ul className="space-y-1">
                {feedbackContent.learningInsights.recommendedActivities.map((activity, index) => (
                  <li key={index} className={`${styles.text} flex items-start space-x-2`}>
                    <span className="text-purple-500 mt-1">
                      {feedbackContent.ageGroup === 'ages6to9' ? '🎮' : '•'}
                    </span>
                    <span>{activity}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Progress Indicators */}
          {feedbackContent.learningInsights.progressIndicators.length > 0 && (
            <div>
              <h4 className={`font-medium ${styles.text} mb-2`}>
                {feedbackContent.ageGroup === 'ages6to9' ? '📈 Your Progress' : 'Progress Tracking'}
              </h4>
              <div className="space-y-2">
                {feedbackContent.learningInsights.progressIndicators.map((indicator, index) => (
                  <div key={index} className="progress-item p-2 bg-gray-50 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`font-medium ${styles.text}`}>
                        {indicator.area.replace('_', ' ').split(' ').map(word =>
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ')}
                      </span>
                      <span className={`text-xs ${styles.text}`}>
                        {indicator.timeframe}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className={styles.text}>
                        {indicator.currentLevel} → {indicator.targetLevel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Motivational Elements */}
          {feedbackContent.learningInsights.motivationalElements.length > 0 && (
            <div>
              <h4 className={`font-medium ${styles.text} mb-2`}>
                {feedbackContent.ageGroup === 'ages6to9' ? '💪 You Can Do It!' : 'Encouragement'}
              </h4>
              <div className="flex flex-wrap gap-2">
                {feedbackContent.learningInsights.motivationalElements.map((element, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium"
                  >
                    {element}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons flex justify-center space-x-4 pt-4">
        {onRetryFeedback && (
          <button
            onClick={onRetryFeedback}
            className={`${styles.button} flex items-center space-x-2`}
          >
            <span>🔄</span>
            <span>
              {feedbackContent.ageGroup === 'ages6to9' ? 'Try Again' : 'Regenerate Feedback'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
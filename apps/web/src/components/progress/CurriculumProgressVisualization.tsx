import React, { useState, useEffect } from 'react';
import { AgeAdaptiveWrapper } from '../age-adaptive/AgeAdaptiveWrapper';
import { useAgeAdaptive, AgeGroup } from '../../hooks/useAgeAdaptive';
import { useRealTimeProgress } from '../../hooks/useRealTimeProgress';

// Types for progress data
interface LearningObjective {
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

interface SubjectProgress {
  subject: string;
  totalObjectives: number;
  completedObjectives: number;
  completionRate: number;
  averageSuccessRate: number;
  color: string;
  icon: string;
}

interface CurriculumProgressData {
  childId: string;
  overallCompletionRate: number;
  subjectProgress: SubjectProgress[];
  recentObjectives: LearningObjective[];
  nextMilestones: string[];
  totalLearningTime: number; // in minutes
}

interface CurriculumProgressVisualizationProps {
  childId: string;
  ageGroup?: AgeGroup;
  progressData?: CurriculumProgressData;
  onObjectiveClick?: (objective: LearningObjective) => void;
  className?: string;
}

export const CurriculumProgressVisualization: React.FC<CurriculumProgressVisualizationProps> = ({
  childId,
  ageGroup,
  progressData,
  onObjectiveClick,
  className = ''
}) => {
  const { ageGroup: currentAgeGroup, theme } = useAgeAdaptive(ageGroup);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  // Use real-time progress data
  const {
    currentProgress: realTimeProgress,
    isConnected,
    isLoading,
    error,
    lastSync,
    refresh
  } = useRealTimeProgress({
    childId,
    enableHistorical: false,
    autoConnect: true
  });

  // Mock data for development - in real app would come from props or API
  const mockProgressData: CurriculumProgressData = {
    childId,
    overallCompletionRate: 0.68,
    subjectProgress: [
      {
        subject: 'Mathematics',
        totalObjectives: 25,
        completedObjectives: 18,
        completionRate: 0.72,
        averageSuccessRate: 0.85,
        color: '#10B981',
        icon: '🔢'
      },
      {
        subject: 'Reading',
        totalObjectives: 30,
        completedObjectives: 22,
        completionRate: 0.73,
        averageSuccessRate: 0.88,
        color: '#3B82F6',
        icon: '📚'
      },
      {
        subject: 'Science',
        totalObjectives: 20,
        completedObjectives: 12,
        completionRate: 0.60,
        averageSuccessRate: 0.82,
        color: '#8B5CF6',
        icon: '🔬'
      },
      {
        subject: 'Social Studies',
        totalObjectives: 15,
        completedObjectives: 9,
        completionRate: 0.60,
        averageSuccessRate: 0.79,
        color: '#F59E0B',
        icon: '🌍'
      }
    ],
    recentObjectives: [
      {
        id: 'obj-1',
        subject: 'Mathematics',
        topic: 'Multiplication',
        description: 'Multiply two-digit numbers',
        targetLevel: 7,
        completed: true,
        completedAt: new Date(),
        attempts: 3,
        successRate: 0.89
      },
      {
        id: 'obj-2',
        subject: 'Reading',
        topic: 'Comprehension',
        description: 'Identify main ideas in passages',
        targetLevel: 6,
        completed: true,
        completedAt: new Date(),
        attempts: 2,
        successRate: 0.92
      }
    ],
    nextMilestones: [
      'Master division with remainders',
      'Read chapter books independently',
      'Understand photosynthesis process',
      'Learn about ancient civilizations'
    ],
    totalLearningTime: 1240 // minutes
  };

  // Use real-time data if available, fallback to provided data, then mock data
  const data = realTimeProgress || progressData || mockProgressData;

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (currentAgeGroup === 'ages6to9') {
      return hours > 0 ? `${hours} hours` : `${remainingMinutes} minutes`;
    } else {
      return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
    }
  };

  const getProgressBarHeight = () => {
    switch (currentAgeGroup) {
      case 'ages6to9': return '24px';
      case 'ages10to13': return '20px';
      case 'ages14to16': return '16px';
      default: return '20px';
    }
  };

  const getGridColumns = () => {
    switch (currentAgeGroup) {
      case 'ages6to9': return 'grid-cols-1';
      case 'ages10to13': return 'grid-cols-2';
      case 'ages14to16': return 'grid-cols-2 lg:grid-cols-4';
      default: return 'grid-cols-2';
    }
  };

  const getTextSizes = () => {
    switch (currentAgeGroup) {
      case 'ages6to9': return {
        title: 'text-2xl',
        subtitle: 'text-lg',
        body: 'text-base',
        small: 'text-sm'
      };
      case 'ages10to13': return {
        title: 'text-xl',
        subtitle: 'text-base',
        body: 'text-sm',
        small: 'text-xs'
      };
      case 'ages14to16': return {
        title: 'text-lg',
        subtitle: 'text-sm',
        body: 'text-xs',
        small: 'text-xs'
      };
      default: return {
        title: 'text-xl',
        subtitle: 'text-base',
        body: 'text-sm',
        small: 'text-xs'
      };
    }
  };

  const textSizes = getTextSizes();

  return (
    <AgeAdaptiveWrapper ageGroup={currentAgeGroup} className={className}>
      <div className="curriculum-progress-container p-6 bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className={`font-bold text-gray-800 ${textSizes.title}`}>
              {currentAgeGroup === 'ages6to9' ? '🎓 My Learning Progress' : 'Learning Progress'}
            </h2>

            {/* Connection Status Indicator */}
            <div className="flex items-center space-x-2">
              {isLoading && (
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className={`text-blue-600 ${textSizes.small}`}>Syncing...</span>
                </div>
              )}

              {error && (
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className={`text-red-600 ${textSizes.small}`}>Connection Error</span>
                  <button
                    onClick={refresh}
                    className={`text-red-600 hover:text-red-800 underline ${textSizes.small}`}
                  >
                    Retry
                  </button>
                </div>
              )}

              {isConnected && !isLoading && !error && (
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className={`text-green-600 ${textSizes.small}`}>
                    {currentAgeGroup === 'ages6to9' ? 'Live' : 'Real-time'}
                  </span>
                  {lastSync && (
                    <span className={`text-gray-500 ${textSizes.small}`}>
                      • {lastSync.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Overall Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`font-medium text-gray-700 ${textSizes.subtitle}`}>
                Overall Progress
              </span>
              <span className={`font-bold text-green-600 ${textSizes.subtitle}`}>
                {Math.round(data.overallCompletionRate * 100)}%
              </span>
            </div>
            <div
              className="w-full bg-gray-200 rounded-full overflow-hidden"
              style={{ height: getProgressBarHeight() }}
            >
              <div
                className="bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-500 ease-out flex items-center justify-center"
                style={{
                  width: `${data.overallCompletionRate * 100}%`,
                  height: '100%'
                }}
              >
                {currentAgeGroup === 'ages6to9' && (
                  <span className="text-white text-xs font-bold">
                    {Math.round(data.overallCompletionRate * 100)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Learning Time Summary */}
          <div className={`text-gray-600 ${textSizes.body}`}>
            Total Learning Time: <span className="font-semibold">{formatTime(data.totalLearningTime)}</span>
          </div>
        </div>

        {/* Subject Progress Cards */}
        <div className={`grid gap-4 mb-6 ${getGridColumns()}`}>
          {data.subjectProgress.map((subject) => (
            <div
              key={subject.subject}
              className={`
                bg-white border-2 rounded-lg p-4 cursor-pointer transition-all duration-200
                ${selectedSubject === subject.subject
                  ? 'border-blue-400 shadow-md transform scale-105'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }
                ${currentAgeGroup === 'ages6to9' ? 'p-6' : 'p-4'}
              `}
              onClick={() => setSelectedSubject(
                selectedSubject === subject.subject ? null : subject.subject
              )}
            >
              {/* Subject Header */}
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-2">{subject.icon}</span>
                <div className="flex-1">
                  <h3 className={`font-semibold text-gray-800 ${textSizes.subtitle}`}>
                    {subject.subject}
                  </h3>
                  <p className={`text-gray-600 ${textSizes.small}`}>
                    {subject.completedObjectives}/{subject.totalObjectives} objectives
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-2">
                <div
                  className="w-full bg-gray-200 rounded-full overflow-hidden"
                  style={{ height: getProgressBarHeight() }}
                >
                  <div
                    className="rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${subject.completionRate * 100}%`,
                      backgroundColor: subject.color,
                      height: '100%'
                    }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="flex justify-between items-center">
                <span className={`font-bold ${textSizes.body}`} style={{ color: subject.color }}>
                  {Math.round(subject.completionRate * 100)}%
                </span>
                {currentAgeGroup !== 'ages6to9' && (
                  <span className={`text-gray-500 ${textSizes.small}`}>
                    {Math.round(subject.averageSuccessRate * 100)}% accuracy
                  </span>
                )}
              </div>

              {/* Expanded Details */}
              {selectedSubject === subject.subject && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="space-y-2">
                    <div className={`flex justify-between ${textSizes.small}`}>
                      <span className="text-gray-600">Success Rate:</span>
                      <span className="font-medium">{Math.round(subject.averageSuccessRate * 100)}%</span>
                    </div>
                    <div className={`flex justify-between ${textSizes.small}`}>
                      <span className="text-gray-600">Remaining:</span>
                      <span className="font-medium">
                        {subject.totalObjectives - subject.completedObjectives} objectives
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Recent Achievements */}
        {data.recentObjectives.length > 0 && (
          <div className="mb-6">
            <h3 className={`font-semibold text-gray-800 mb-3 ${textSizes.subtitle}`}>
              {currentAgeGroup === 'ages6to9' ? '🎉 Recent Achievements' : 'Recent Achievements'}
            </h3>
            <div className="space-y-2">
              {data.recentObjectives.slice(0, currentAgeGroup === 'ages6to9' ? 2 : 3).map((objective) => (
                <div
                  key={objective.id}
                  className={`
                    flex items-center p-3 bg-green-50 border border-green-200 rounded-lg cursor-pointer
                    hover:bg-green-100 transition-colors duration-200
                    ${currentAgeGroup === 'ages6to9' ? 'p-4' : 'p-3'}
                  `}
                  onClick={() => onObjectiveClick?.(objective)}
                >
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-3">
                    <span className="text-white text-sm">✓</span>
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium text-gray-800 ${textSizes.body}`}>
                      {objective.description}
                    </p>
                    <p className={`text-gray-600 ${textSizes.small}`}>
                      {objective.subject} • {Math.round(objective.successRate * 100)}% success rate
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Milestones */}
        <div>
          <h3 className={`font-semibold text-gray-800 mb-3 ${textSizes.subtitle}`}>
            {currentAgeGroup === 'ages6to9' ? '🎯 What\'s Next' : 'Next Milestones'}
          </h3>
          <div className="grid gap-2">
            {data.nextMilestones.slice(0, currentAgeGroup === 'ages6to9' ? 2 : 4).map((milestone, index) => (
              <div
                key={index}
                className={`
                  flex items-center p-3 bg-blue-50 border border-blue-200 rounded-lg
                  ${currentAgeGroup === 'ages6to9' ? 'p-4' : 'p-3'}
                `}
              >
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                  <span className="text-white text-sm font-bold">{index + 1}</span>
                </div>
                <p className={`text-gray-800 ${textSizes.body}`}>
                  {milestone}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AgeAdaptiveWrapper>
  );
};

export default CurriculumProgressVisualization;
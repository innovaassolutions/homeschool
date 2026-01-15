import React, { useState } from 'react';
import { AgeAdaptiveWrapper } from '../age-adaptive/AgeAdaptiveWrapper';
import { useAgeAdaptive, AgeGroup } from '../../hooks/useAgeAdaptive';
import CurriculumProgressVisualization from './CurriculumProgressVisualization';
import HistoricalProgressChart from './HistoricalProgressChart';

interface ProgressDashboardProps {
  childId: string;
  ageGroup?: AgeGroup;
  className?: string;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  childId,
  ageGroup,
  className = ''
}) => {
  const { ageGroup: currentAgeGroup, theme } = useAgeAdaptive(ageGroup);
  const [activeView, setActiveView] = useState<'current' | 'historical'>('current');
  const [historicalTimeRange, setHistoricalTimeRange] = useState<'weekly' | 'monthly'>('weekly');

  const getLayoutClasses = () => {
    switch (currentAgeGroup) {
      case 'ages6to9':
        return 'space-y-6';
      case 'ages10to13':
        return 'space-y-4';
      case 'ages14to16':
        return 'space-y-4';
      default:
        return 'space-y-4';
    }
  };

  const getTextSizes = () => {
    switch (currentAgeGroup) {
      case 'ages6to9': return {
        title: 'text-3xl',
        subtitle: 'text-xl',
        body: 'text-lg',
        small: 'text-base'
      };
      case 'ages10to13': return {
        title: 'text-2xl',
        subtitle: 'text-lg',
        body: 'text-base',
        small: 'text-sm'
      };
      case 'ages14to16': return {
        title: 'text-xl',
        subtitle: 'text-base',
        body: 'text-sm',
        small: 'text-xs'
      };
      default: return {
        title: 'text-2xl',
        subtitle: 'text-lg',
        body: 'text-base',
        small: 'text-sm'
      };
    }
  };

  const getNavigationStyle = () => {
    switch (currentAgeGroup) {
      case 'ages6to9':
        return {
          containerClass: 'bg-gradient-to-r from-blue-100 to-purple-100 p-4 rounded-xl',
          buttonClass: 'px-6 py-3 rounded-lg font-bold text-lg',
          activeClass: 'bg-white text-blue-600 shadow-lg transform scale-105',
          inactiveClass: 'text-blue-700 hover:bg-white/50'
        };
      case 'ages10to13':
        return {
          containerClass: 'bg-gray-100 p-3 rounded-lg',
          buttonClass: 'px-4 py-2 rounded-md font-medium',
          activeClass: 'bg-blue-500 text-white shadow-md',
          inactiveClass: 'text-gray-700 hover:bg-gray-200'
        };
      case 'ages14to16':
        return {
          containerClass: 'border-b border-gray-200',
          buttonClass: 'px-3 py-2 font-medium',
          activeClass: 'border-b-2 border-blue-500 text-blue-600',
          inactiveClass: 'text-gray-500 hover:text-gray-700'
        };
      default:
        return {
          containerClass: 'bg-gray-100 p-3 rounded-lg',
          buttonClass: 'px-4 py-2 rounded-md font-medium',
          activeClass: 'bg-blue-500 text-white shadow-md',
          inactiveClass: 'text-gray-700 hover:bg-gray-200'
        };
    }
  };

  const textSizes = getTextSizes();
  const navStyle = getNavigationStyle();

  const getGreeting = () => {
    switch (currentAgeGroup) {
      case 'ages6to9':
        return '🌟 My Learning Journey';
      case 'ages10to13':
        return 'Learning Progress Dashboard';
      case 'ages14to16':
        return 'Academic Progress Overview';
      default:
        return 'Learning Progress Dashboard';
    }
  };

  const getViewLabels = () => {
    switch (currentAgeGroup) {
      case 'ages6to9':
        return {
          current: '🎯 Right Now',
          historical: '📈 Over Time'
        };
      case 'ages10to13':
        return {
          current: 'Current Progress',
          historical: 'Progress History'
        };
      case 'ages14to16':
        return {
          current: 'Current',
          historical: 'Trends'
        };
      default:
        return {
          current: 'Current Progress',
          historical: 'Progress History'
        };
    }
  };

  const viewLabels = getViewLabels();

  return (
    <AgeAdaptiveWrapper ageGroup={currentAgeGroup} className={className}>
      <div className={`progress-dashboard ${getLayoutClasses()}`}>
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className={`font-bold text-gray-800 mb-2 ${textSizes.title}`}>
            {getGreeting()}
          </h1>
          {currentAgeGroup === 'ages6to9' && (
            <p className={`text-gray-600 ${textSizes.body}`}>
              See how amazing you're doing! 🎉
            </p>
          )}
        </div>

        {/* Navigation */}
        <div className={`flex justify-center mb-6 ${navStyle.containerClass}`}>
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveView('current')}
              className={`${navStyle.buttonClass} transition-all duration-200 ${
                activeView === 'current' ? navStyle.activeClass : navStyle.inactiveClass
              }`}
            >
              {viewLabels.current}
            </button>
            <button
              onClick={() => setActiveView('historical')}
              className={`${navStyle.buttonClass} transition-all duration-200 ${
                activeView === 'historical' ? navStyle.activeClass : navStyle.inactiveClass
              }`}
            >
              {viewLabels.historical}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="transition-all duration-300">
          {activeView === 'current' ? (
            <CurriculumProgressVisualization
              childId={childId}
              ageGroup={currentAgeGroup}
            />
          ) : (
            <HistoricalProgressChart
              childId={childId}
              ageGroup={currentAgeGroup}
              timeRange={historicalTimeRange}
              onTimeRangeChange={setHistoricalTimeRange}
            />
          )}
        </div>

        {/* Age-specific footer messages */}
        {currentAgeGroup === 'ages6to9' && (
          <div className="mt-6 text-center bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className={`text-yellow-800 ${textSizes.body}`}>
              🌟 Keep up the great work! Every step forward is something to be proud of! 🌟
            </p>
          </div>
        )}

        {currentAgeGroup === 'ages10to13' && (
          <div className="mt-6 text-center bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className={`text-blue-800 ${textSizes.small}`}>
              Your progress shows dedication and growth. Remember that learning is a journey!
            </p>
          </div>
        )}

        {currentAgeGroup === 'ages14to16' && (
          <div className="mt-6 text-center border-t border-gray-200 pt-4">
            <p className={`text-gray-600 ${textSizes.small}`}>
              Track your academic growth and identify areas for focused improvement.
            </p>
          </div>
        )}
      </div>
    </AgeAdaptiveWrapper>
  );
};

export default ProgressDashboard;
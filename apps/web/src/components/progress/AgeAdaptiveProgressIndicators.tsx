import React from 'react';
import { AgeAdaptiveWrapper } from '../age-adaptive/AgeAdaptiveWrapper';
import { useAgeAdaptive, AgeGroup } from '../../hooks/useAgeAdaptive';

interface ProgressIndicatorProps {
  value: number; // 0-1
  subject?: string;
  color?: string;
  ageGroup?: AgeGroup;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const AgeAdaptiveProgressBar: React.FC<ProgressIndicatorProps> = ({
  value,
  subject,
  color = '#10B981',
  ageGroup,
  showLabel = true,
  size = 'medium',
  className = ''
}) => {
  const { ageGroup: currentAgeGroup } = useAgeAdaptive(ageGroup);

  const getBarConfig = () => {
    switch (currentAgeGroup) {
      case 'ages6to9':
        return {
          height: size === 'small' ? '32px' : size === 'large' ? '48px' : '40px',
          borderRadius: '20px',
          showPercentage: true,
          showStars: true,
          animationDuration: '1000ms'
        };
      case 'ages10to13':
        return {
          height: size === 'small' ? '24px' : size === 'large' ? '32px' : '28px',
          borderRadius: '14px',
          showPercentage: true,
          showStars: false,
          animationDuration: '700ms'
        };
      case 'ages14to16':
        return {
          height: size === 'small' ? '16px' : size === 'large' ? '24px' : '20px',
          borderRadius: '8px',
          showPercentage: true,
          showStars: false,
          animationDuration: '500ms'
        };
      default:
        return {
          height: size === 'small' ? '24px' : size === 'large' ? '32px' : '28px',
          borderRadius: '14px',
          showPercentage: true,
          showStars: false,
          animationDuration: '700ms'
        };
    }
  };

  const barConfig = getBarConfig();
  const percentage = Math.round(value * 100);

  const getStarCount = () => {
    if (percentage >= 90) return 3;
    if (percentage >= 70) return 2;
    if (percentage >= 50) return 1;
    return 0;
  };

  return (
    <AgeAdaptiveWrapper ageGroup={currentAgeGroup} className={className}>
      <div className="progress-bar-container">
        {showLabel && subject && (
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-700">
              {subject}
            </span>
            {barConfig.showPercentage && (
              <span className="font-bold" style={{ color }}>
                {percentage}%
                {barConfig.showStars && (
                  <span className="ml-2">
                    {'⭐'.repeat(getStarCount())}
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        <div
          className="w-full bg-gray-200 overflow-hidden"
          style={{
            height: barConfig.height,
            borderRadius: barConfig.borderRadius
          }}
        >
          <div
            className="h-full transition-all ease-out flex items-center justify-center"
            style={{
              width: `${percentage}%`,
              backgroundColor: color,
              transitionDuration: barConfig.animationDuration,
              borderRadius: barConfig.borderRadius
            }}
          >
            {currentAgeGroup === 'ages6to9' && percentage > 20 && (
              <span className="text-white font-bold text-sm">
                {percentage}%
              </span>
            )}
          </div>
        </div>
      </div>
    </AgeAdaptiveWrapper>
  );
};

interface CircularProgressProps extends ProgressIndicatorProps {
  strokeWidth?: number;
}

export const AgeAdaptiveCircularProgress: React.FC<CircularProgressProps> = ({
  value,
  subject,
  color = '#10B981',
  ageGroup,
  showLabel = true,
  size = 'medium',
  strokeWidth,
  className = ''
}) => {
  const { ageGroup: currentAgeGroup } = useAgeAdaptive(ageGroup);

  const getCircleConfig = () => {
    switch (currentAgeGroup) {
      case 'ages6to9':
        return {
          diameter: size === 'small' ? 80 : size === 'large' ? 120 : 100,
          strokeWidth: strokeWidth || 8,
          showEmoji: true,
          showPercentage: true,
          textSize: 'text-lg'
        };
      case 'ages10to13':
        return {
          diameter: size === 'small' ? 70 : size === 'large' ? 100 : 80,
          strokeWidth: strokeWidth || 6,
          showEmoji: false,
          showPercentage: true,
          textSize: 'text-base'
        };
      case 'ages14to16':
        return {
          diameter: size === 'small' ? 60 : size === 'large' ? 80 : 70,
          strokeWidth: strokeWidth || 4,
          showEmoji: false,
          showPercentage: true,
          textSize: 'text-sm'
        };
      default:
        return {
          diameter: size === 'small' ? 70 : size === 'large' ? 100 : 80,
          strokeWidth: strokeWidth || 6,
          showEmoji: false,
          showPercentage: true,
          textSize: 'text-base'
        };
    }
  };

  const config = getCircleConfig();
  const radius = (config.diameter - config.strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value * circumference);
  const percentage = Math.round(value * 100);

  const getProgressEmoji = () => {
    if (percentage >= 90) return '🎉';
    if (percentage >= 70) return '😊';
    if (percentage >= 50) return '👍';
    if (percentage >= 25) return '📚';
    return '🌱';
  };

  return (
    <AgeAdaptiveWrapper ageGroup={currentAgeGroup} className={className}>
      <div className="flex flex-col items-center">
        <div className="relative">
          <svg
            width={config.diameter}
            height={config.diameter}
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              cx={config.diameter / 2}
              cy={config.diameter / 2}
              r={radius}
              stroke="#E5E7EB"
              strokeWidth={config.strokeWidth}
              fill="transparent"
            />

            {/* Progress circle */}
            <circle
              cx={config.diameter / 2}
              cy={config.diameter / 2}
              r={radius}
              stroke={color}
              strokeWidth={config.strokeWidth}
              fill="transparent"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {config.showEmoji && (
              <span className="text-2xl mb-1">
                {getProgressEmoji()}
              </span>
            )}
            {config.showPercentage && (
              <span className={`font-bold ${config.textSize}`} style={{ color }}>
                {percentage}%
              </span>
            )}
          </div>
        </div>

        {showLabel && subject && (
          <span className="mt-2 text-center text-sm font-medium text-gray-700">
            {subject}
          </span>
        )}
      </div>
    </AgeAdaptiveWrapper>
  );
};

interface ProgressStepsProps {
  steps: Array<{
    id: string;
    title: string;
    completed: boolean;
    current?: boolean;
  }>;
  ageGroup?: AgeGroup;
  className?: string;
}

export const AgeAdaptiveProgressSteps: React.FC<ProgressStepsProps> = ({
  steps,
  ageGroup,
  className = ''
}) => {
  const { ageGroup: currentAgeGroup } = useAgeAdaptive(ageGroup);

  const getStepConfig = () => {
    switch (currentAgeGroup) {
      case 'ages6to9':
        return {
          layout: 'vertical',
          showEmojis: true,
          iconSize: 'w-8 h-8',
          textSize: 'text-base',
          spacing: 'space-y-4'
        };
      case 'ages10to13':
        return {
          layout: 'horizontal',
          showEmojis: false,
          iconSize: 'w-6 h-6',
          textSize: 'text-sm',
          spacing: 'space-x-4'
        };
      case 'ages14to16':
        return {
          layout: 'horizontal',
          showEmojis: false,
          iconSize: 'w-5 h-5',
          textSize: 'text-xs',
          spacing: 'space-x-3'
        };
      default:
        return {
          layout: 'horizontal',
          showEmojis: false,
          iconSize: 'w-6 h-6',
          textSize: 'text-sm',
          spacing: 'space-x-4'
        };
    }
  };

  const config = getStepConfig();

  const getStepIcon = (step: typeof steps[0], index: number) => {
    if (config.showEmojis) {
      if (step.completed) return '✅';
      if (step.current) return '🎯';
      return '⭕';
    }

    return (
      <div
        className={`${config.iconSize} rounded-full flex items-center justify-center font-bold text-sm ${
          step.completed
            ? 'bg-green-500 text-white'
            : step.current
            ? 'bg-blue-500 text-white'
            : 'bg-gray-300 text-gray-600'
        }`}
      >
        {step.completed ? '✓' : index + 1}
      </div>
    );
  };

  return (
    <AgeAdaptiveWrapper ageGroup={currentAgeGroup} className={className}>
      <div className={`flex ${config.layout === 'vertical' ? 'flex-col' : 'flex-row items-center'} ${config.spacing}`}>
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex ${config.layout === 'vertical' ? 'flex-row' : 'flex-col'} items-center ${
              config.layout === 'vertical' ? 'space-x-3' : 'space-y-2'
            }`}
          >
            <div className="flex items-center">
              {typeof getStepIcon(step, index) === 'string' ? (
                <span className="text-2xl">{getStepIcon(step, index)}</span>
              ) : (
                getStepIcon(step, index)
              )}
            </div>

            <span
              className={`${config.textSize} font-medium text-center ${
                step.completed
                  ? 'text-green-700'
                  : step.current
                  ? 'text-blue-700'
                  : 'text-gray-500'
              }`}
            >
              {step.title}
            </span>

            {/* Connector line */}
            {index < steps.length - 1 && config.layout === 'horizontal' && (
              <div
                className={`h-0.5 flex-1 ${
                  steps[index + 1].completed ? 'bg-green-300' : 'bg-gray-300'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </AgeAdaptiveWrapper>
  );
};

export default {
  AgeAdaptiveProgressBar,
  AgeAdaptiveCircularProgress,
  AgeAdaptiveProgressSteps
};
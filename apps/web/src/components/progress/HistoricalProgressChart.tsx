import React, { useState, useEffect } from 'react';
import { AgeAdaptiveWrapper } from '../age-adaptive/AgeAdaptiveWrapper';
import { useAgeAdaptive, AgeGroup } from '../../hooks/useAgeAdaptive';
import { useRealTimeProgress } from '../../hooks/useRealTimeProgress';

interface ProgressDataPoint {
  date: string;
  overallProgress: number;
  subjects: {
    [subject: string]: number;
  };
}

interface WeeklyProgressData {
  week: string;
  weekOf: string;
  data: ProgressDataPoint;
}

interface MonthlyProgressData {
  month: string;
  monthOf: string;
  data: ProgressDataPoint;
}

interface HistoricalProgressChartProps {
  childId: string;
  ageGroup?: AgeGroup;
  timeRange?: 'weekly' | 'monthly';
  weeklyData?: WeeklyProgressData[];
  monthlyData?: MonthlyProgressData[];
  onTimeRangeChange?: (range: 'weekly' | 'monthly') => void;
  className?: string;
}

export const HistoricalProgressChart: React.FC<HistoricalProgressChartProps> = ({
  childId,
  ageGroup,
  timeRange = 'weekly',
  weeklyData,
  monthlyData,
  onTimeRangeChange,
  className = ''
}) => {
  const { ageGroup: currentAgeGroup, theme } = useAgeAdaptive(ageGroup);
  const [selectedSubject, setSelectedSubject] = useState<string>('overall');
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // Use real-time progress data
  const {
    weeklyProgress: realTimeWeeklyData,
    monthlyProgress: realTimeMonthlyData,
    isConnected,
    isLoading,
    error,
    lastSync,
    refresh
  } = useRealTimeProgress({
    childId,
    enableHistorical: true,
    autoConnect: true
  });

  // Mock data for development
  const mockWeeklyData: WeeklyProgressData[] = [
    {
      week: 'Week 1',
      weekOf: 'Week of Sept 2',
      data: {
        date: '2024-09-02',
        overallProgress: 0.45,
        subjects: {
          Mathematics: 0.52,
          Reading: 0.48,
          Science: 0.38,
          'Social Studies': 0.42
        }
      }
    },
    {
      week: 'Week 2',
      weekOf: 'Week of Sept 9',
      data: {
        date: '2024-09-09',
        overallProgress: 0.51,
        subjects: {
          Mathematics: 0.58,
          Reading: 0.54,
          Science: 0.42,
          'Social Studies': 0.48
        }
      }
    },
    {
      week: 'Week 3',
      weekOf: 'Week of Sept 16',
      data: {
        date: '2024-09-16',
        overallProgress: 0.58,
        subjects: {
          Mathematics: 0.65,
          Reading: 0.61,
          Science: 0.48,
          'Social Studies': 0.54
        }
      }
    },
    {
      week: 'Week 4',
      weekOf: 'Week of Sept 23',
      data: {
        date: '2024-09-23',
        overallProgress: 0.64,
        subjects: {
          Mathematics: 0.69,
          Reading: 0.67,
          Science: 0.55,
          'Social Studies': 0.58
        }
      }
    },
    {
      week: 'Week 5',
      weekOf: 'Week of Sept 30',
      data: {
        date: '2024-09-30',
        overallProgress: 0.68,
        subjects: {
          Mathematics: 0.72,
          Reading: 0.73,
          Science: 0.60,
          'Social Studies': 0.60
        }
      }
    }
  ];

  const mockMonthlyData: MonthlyProgressData[] = [
    {
      month: 'June',
      monthOf: 'June 2024',
      data: {
        date: '2024-06-30',
        overallProgress: 0.35,
        subjects: {
          Mathematics: 0.38,
          Reading: 0.42,
          Science: 0.28,
          'Social Studies': 0.32
        }
      }
    },
    {
      month: 'July',
      monthOf: 'July 2024',
      data: {
        date: '2024-07-31',
        overallProgress: 0.42,
        subjects: {
          Mathematics: 0.45,
          Reading: 0.48,
          Science: 0.35,
          'Social Studies': 0.38
        }
      }
    },
    {
      month: 'August',
      monthOf: 'August 2024',
      data: {
        date: '2024-08-31',
        overallProgress: 0.49,
        subjects: {
          Mathematics: 0.52,
          Reading: 0.55,
          Science: 0.42,
          'Social Studies': 0.45
        }
      }
    },
    {
      month: 'September',
      monthOf: 'September 2024',
      data: {
        date: '2024-09-30',
        overallProgress: 0.68,
        subjects: {
          Mathematics: 0.72,
          Reading: 0.73,
          Science: 0.60,
          'Social Studies': 0.60
        }
      }
    }
  ];

  const data = timeRange === 'weekly'
    ? (realTimeWeeklyData.length > 0 ? realTimeWeeklyData : weeklyData || mockWeeklyData)
    : (realTimeMonthlyData.length > 0 ? realTimeMonthlyData : monthlyData || mockMonthlyData);

  const subjectColors = {
    overall: '#10B981',
    Mathematics: '#10B981',
    Reading: '#3B82F6',
    Science: '#8B5CF6',
    'Social Studies': '#F59E0B'
  };

  const getChartDimensions = () => {
    switch (currentAgeGroup) {
      case 'ages6to9': return { width: 400, height: 300, padding: 60 };
      case 'ages10to13': return { width: 500, height: 320, padding: 50 };
      case 'ages14to16': return { width: 600, height: 350, padding: 40 };
      default: return { width: 500, height: 320, padding: 50 };
    }
  };

  const getTextSizes = () => {
    switch (currentAgeGroup) {
      case 'ages6to9': return {
        title: 'text-xl',
        subtitle: 'text-base',
        body: 'text-sm',
        small: 'text-xs'
      };
      case 'ages10to13': return {
        title: 'text-lg',
        subtitle: 'text-sm',
        body: 'text-xs',
        small: 'text-xs'
      };
      case 'ages14to16': return {
        title: 'text-base',
        subtitle: 'text-sm',
        body: 'text-xs',
        small: 'text-xs'
      };
      default: return {
        title: 'text-lg',
        subtitle: 'text-sm',
        body: 'text-xs',
        small: 'text-xs'
      };
    }
  };

  const chartDimensions = getChartDimensions();
  const textSizes = getTextSizes();

  const getDataValue = (item: WeeklyProgressData | MonthlyProgressData, subject: string) => {
    if (subject === 'overall') {
      return item.data.overallProgress;
    }
    return item.data.subjects[subject] || 0;
  };

  const createChartPath = (subject: string) => {
    const maxValue = 1.0;
    const chartWidth = chartDimensions.width - (chartDimensions.padding * 2);
    const chartHeight = chartDimensions.height - (chartDimensions.padding * 2);

    let path = '';

    data.forEach((item, index) => {
      const x = chartDimensions.padding + (index * (chartWidth / (data.length - 1)));
      const value = getDataValue(item, subject);
      const y = chartDimensions.padding + chartHeight - (value * chartHeight);

      if (index === 0) {
        path += `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
    });

    return path;
  };

  const createPoints = (subject: string) => {
    const maxValue = 1.0;
    const chartWidth = chartDimensions.width - (chartDimensions.padding * 2);
    const chartHeight = chartDimensions.height - (chartDimensions.padding * 2);

    return data.map((item, index) => {
      const x = chartDimensions.padding + (index * (chartWidth / (data.length - 1)));
      const value = getDataValue(item, subject);
      const y = chartDimensions.padding + chartHeight - (value * chartHeight);

      return { x, y, value, index, item };
    });
  };

  const handleTimeRangeChange = (newRange: 'weekly' | 'monthly') => {
    onTimeRangeChange?.(newRange);
  };

  const subjects = ['overall', 'Mathematics', 'Reading', 'Science', 'Social Studies'];

  return (
    <AgeAdaptiveWrapper ageGroup={currentAgeGroup} className={className}>
      <div className="historical-progress-container p-6 bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="mb-6">
          <h2 className={`font-bold text-gray-800 mb-4 ${textSizes.title}`}>
            {currentAgeGroup === 'ages6to9' ? '📈 Progress Over Time' : 'Historical Progress'}
          </h2>

          {/* Time Range Selector */}
          <div className="flex items-center space-x-2 mb-4">
            <span className={`text-gray-700 ${textSizes.body}`}>View:</span>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => handleTimeRangeChange('weekly')}
                className={`px-3 py-1 text-sm font-medium transition-colors ${
                  timeRange === 'weekly'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => handleTimeRangeChange('monthly')}
                className={`px-3 py-1 text-sm font-medium transition-colors ${
                  timeRange === 'monthly'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>

          {/* Subject Selector */}
          <div className="flex flex-wrap gap-2 mb-4">
            {subjects.map((subject) => (
              <button
                key={subject}
                onClick={() => setSelectedSubject(subject)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  selectedSubject === subject
                    ? 'text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={{
                  backgroundColor: selectedSubject === subject ? subjectColors[subject] : undefined
                }}
              >
                {subject === 'overall' ? 'Overall Progress' : subject}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <svg
              width={chartDimensions.width}
              height={chartDimensions.height}
              className="border border-gray-200 rounded-lg bg-gray-50"
            >
              {/* Grid Lines */}
              {[0.25, 0.5, 0.75, 1.0].map((value) => {
                const y = chartDimensions.padding +
                  (chartDimensions.height - chartDimensions.padding * 2) * (1 - value);
                return (
                  <g key={value}>
                    <line
                      x1={chartDimensions.padding}
                      y1={y}
                      x2={chartDimensions.width - chartDimensions.padding}
                      y2={y}
                      stroke="#E5E7EB"
                      strokeWidth="1"
                    />
                    <text
                      x={chartDimensions.padding - 10}
                      y={y}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="text-xs fill-gray-500"
                    >
                      {Math.round(value * 100)}%
                    </text>
                  </g>
                );
              })}

              {/* X-axis labels */}
              {data.map((item, index) => {
                const x = chartDimensions.padding +
                  (index * ((chartDimensions.width - chartDimensions.padding * 2) / (data.length - 1)));
                const label = timeRange === 'weekly'
                  ? (item as WeeklyProgressData).week
                  : (item as MonthlyProgressData).month;

                return (
                  <text
                    key={index}
                    x={x}
                    y={chartDimensions.height - chartDimensions.padding + 20}
                    textAnchor="middle"
                    className="text-xs fill-gray-500"
                  >
                    {label}
                  </text>
                );
              })}

              {/* Progress Line */}
              <path
                d={createChartPath(selectedSubject)}
                fill="none"
                stroke={subjectColors[selectedSubject]}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data Points */}
              {createPoints(selectedSubject).map((point, index) => (
                <circle
                  key={index}
                  cx={point.x}
                  cy={point.y}
                  r={hoveredPoint === index ? 6 : 4}
                  fill={subjectColors[selectedSubject]}
                  stroke="white"
                  strokeWidth="2"
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredPoint(index)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              ))}

              {/* Tooltip */}
              {hoveredPoint !== null && (
                <g>
                  {(() => {
                    const point = createPoints(selectedSubject)[hoveredPoint];
                    const item = point.item;
                    const label = timeRange === 'weekly'
                      ? (item as WeeklyProgressData).weekOf
                      : (item as MonthlyProgressData).monthOf;
                    const progress = Math.round(point.value * 100);

                    return (
                      <g>
                        <rect
                          x={point.x - 40}
                          y={point.y - 35}
                          width="80"
                          height="25"
                          fill="rgba(0, 0, 0, 0.8)"
                          rx="4"
                        />
                        <text
                          x={point.x}
                          y={point.y - 20}
                          textAnchor="middle"
                          className="text-xs fill-white"
                        >
                          {label}
                        </text>
                        <text
                          x={point.x}
                          y={point.y - 8}
                          textAnchor="middle"
                          className="text-xs fill-white font-bold"
                        >
                          {progress}%
                        </text>
                      </g>
                    );
                  })()}
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Progress Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className={`font-semibold text-green-800 mb-2 ${textSizes.subtitle}`}>
              {currentAgeGroup === 'ages6to9' ? '📈 Growth' : 'Progress Trend'}
            </h3>
            {(() => {
              const firstValue = getDataValue(data[0], selectedSubject);
              const lastValue = getDataValue(data[data.length - 1], selectedSubject);
              const growth = ((lastValue - firstValue) * 100);
              const isPositive = growth > 0;

              return (
                <div className="flex items-center">
                  <span className={`text-2xl mr-2 ${textSizes.body}`}>
                    {isPositive ? '↗️' : growth < 0 ? '↘️' : '➡️'}
                  </span>
                  <div>
                    <p className={`font-bold text-green-700 ${textSizes.body}`}>
                      {isPositive ? '+' : ''}{growth.toFixed(1)}%
                    </p>
                    <p className={`text-green-600 ${textSizes.small}`}>
                      Since {timeRange === 'weekly' ? 'first week' : 'first month'}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className={`font-semibold text-blue-800 mb-2 ${textSizes.subtitle}`}>
              {currentAgeGroup === 'ages6to9' ? '🎯 Current' : 'Latest Score'}
            </h3>
            <div className="flex items-center">
              <span className={`text-2xl mr-2 ${textSizes.body}`}>📊</span>
              <div>
                <p className={`font-bold text-blue-700 ${textSizes.body}`}>
                  {Math.round(getDataValue(data[data.length - 1], selectedSubject) * 100)}%
                </p>
                <p className={`text-blue-600 ${textSizes.small}`}>
                  {timeRange === 'weekly'
                    ? (data[data.length - 1] as WeeklyProgressData).weekOf
                    : (data[data.length - 1] as MonthlyProgressData).monthOf
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AgeAdaptiveWrapper>
  );
};

export default HistoricalProgressChart;
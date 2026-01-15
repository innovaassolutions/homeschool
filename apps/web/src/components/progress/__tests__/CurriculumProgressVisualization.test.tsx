import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { CurriculumProgressVisualization } from '../CurriculumProgressVisualization';
import { useAgeAdaptive } from '../../../hooks/useAgeAdaptive';
import { useRealTimeProgress } from '../../../hooks/useRealTimeProgress';

jest.mock('../../../hooks/useAgeAdaptive');
jest.mock('../../../hooks/useRealTimeProgress');

const mockUseAgeAdaptive = useAgeAdaptive as jest.MockedFunction<typeof useAgeAdaptive>;
const mockUseRealTimeProgress = useRealTimeProgress as jest.MockedFunction<typeof useRealTimeProgress>;

describe('CurriculumProgressVisualization', () => {
  const mockProgressData = {
    childId: 'child-123',
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
        completedAt: new Date('2024-09-30'),
        attempts: 3,
        successRate: 0.89
      }
    ],
    nextMilestones: [
      'Master division with remainders',
      'Read chapter books independently'
    ],
    totalLearningTime: 1240,
    lastUpdated: new Date()
  };

  const mockRealTimeProgress = {
    currentProgress: mockProgressData,
    weeklyProgress: [],
    monthlyProgress: [],
    isConnected: true,
    isLoading: false,
    error: null,
    lastSync: new Date(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    refresh: jest.fn(),
    isInitialized: true,
    hasData: true
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAgeAdaptive.mockReturnValue({
      ageGroup: 'ages10to13',
      theme: {
        colors: { primary: '#3B82F6', secondary: '#8B5CF6', background: '#F8FAFC', text: '#1E293B', accent: '#06B6D4' },
        typography: {
          fontSize: { sm: '0.875rem', base: '1rem', lg: '1.25rem', xl: '1.5rem' },
          fontWeight: { normal: '400', medium: '500', bold: '600' }
        },
        spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem' },
        borderRadius: '0.5rem'
      }
    });

    mockUseRealTimeProgress.mockReturnValue(mockRealTimeProgress);
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('should render the component with progress data', () => {
      render(
        <CurriculumProgressVisualization
          childId="child-123"
          progressData={mockProgressData}
        />
      );

      expect(screen.getByText('Learning Progress')).toBeInTheDocument();
      expect(screen.getByText('68%')).toBeInTheDocument();
      expect(screen.getByText('Mathematics')).toBeInTheDocument();
      expect(screen.getByText('Reading')).toBeInTheDocument();
    });

    it('should render with age-appropriate content for ages 6-9', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages6to9',
        theme: {
          colors: { primary: '#F59E0B', secondary: '#EF4444', background: '#FEF3C7', text: '#92400E', accent: '#D97706' },
          typography: {
            fontSize: { sm: '1rem', base: '1.25rem', lg: '1.5rem', xl: '2rem' },
            fontWeight: { normal: '400', medium: '500', bold: '700' }
          },
          spacing: { xs: '0.5rem', sm: '1rem', md: '1.5rem', lg: '2rem', xl: '3rem' },
          borderRadius: '1rem'
        }
      });

      render(
        <CurriculumProgressVisualization
          childId="child-123"
          progressData={mockProgressData}
        />
      );

      expect(screen.getByText('🎓 My Learning Progress')).toBeInTheDocument();
      expect(screen.getByText('🎉 Recent Achievements')).toBeInTheDocument();
      expect(screen.getByText('🎯 What\'s Next')).toBeInTheDocument();
    });

    it('should display connection status indicators', () => {
      render(
        <CurriculumProgressVisualization
          childId="child-123"
          progressData={mockProgressData}
        />
      );

      expect(screen.getByText('Real-time')).toBeInTheDocument();
      expect(screen.getByRole('generic', { description: /green.*rounded-full/ })).toBeInTheDocument();
    });

    it('should show loading state', () => {
      mockUseRealTimeProgress.mockReturnValue({
        ...mockRealTimeProgress,
        isLoading: true,
        isConnected: false
      });

      render(
        <CurriculumProgressVisualization
          childId="child-123"
          progressData={mockProgressData}
        />
      );

      expect(screen.getByText('Syncing...')).toBeInTheDocument();
    });

    it('should show error state with retry button', () => {
      const mockRefresh = jest.fn();
      mockUseRealTimeProgress.mockReturnValue({
        ...mockRealTimeProgress,
        isConnected: false,
        isLoading: false,
        error: 'Connection failed',
        refresh: mockRefresh
      });

      render(
        <CurriculumProgressVisualization
          childId="child-123"
          progressData={mockProgressData}
        />
      );

      expect(screen.getByText('Connection Error')).toBeInTheDocument();

      const retryButton = screen.getByRole('button', { name: 'Retry' });
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('Interactions', () => {
    it('should expand subject details when clicked', () => {
      render(
        <CurriculumProgressVisualization
          childId="child-123"
          progressData={mockProgressData}
        />
      );

      const mathSubject = screen.getByText('Mathematics').closest('div');
      expect(mathSubject).toBeInTheDocument();

      fireEvent.click(mathSubject!);

      expect(screen.getByText('Success Rate:')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('Remaining:')).toBeInTheDocument();
      expect(screen.getByText('7 objectives')).toBeInTheDocument();
    });

    it('should collapse subject details when clicked again', () => {
      render(
        <CurriculumProgressVisualization
          childId="child-123"
          progressData={mockProgressData}
        />
      );

      const mathSubject = screen.getByText('Mathematics').closest('div');

      // Expand
      fireEvent.click(mathSubject!);
      expect(screen.getByText('Success Rate:')).toBeInTheDocument();

      // Collapse
      fireEvent.click(mathSubject!);
      expect(screen.queryByText('Success Rate:')).not.toBeInTheDocument();
    });

    it('should call onObjectiveClick when recent achievement is clicked', () => {
      const mockOnObjectiveClick = jest.fn();

      render(
        <CurriculumProgressVisualization
          childId="child-123"
          progressData={mockProgressData}
          onObjectiveClick={mockOnObjectiveClick}
        />
      );

      const objective = screen.getByText('Multiply two-digit numbers').closest('div');
      fireEvent.click(objective!);

      expect(mockOnObjectiveClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'obj-1',
          description: 'Multiply two-digit numbers'
        })
      );
    });
  });

  describe('Data Display', () => {
    it('should format learning time correctly for different age groups', () => {
      // Test hours and minutes display for ages 6-9
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages6to9',
        theme: {
          colors: { primary: '#F59E0B', secondary: '#EF4444', background: '#FEF3C7', text: '#92400E', accent: '#D97706' },
          typography: {
            fontSize: { sm: '1rem', base: '1.25rem', lg: '1.5rem', xl: '2rem' },
            fontWeight: { normal: '400', medium: '500', bold: '700' }
          },
          spacing: { xs: '0.5rem', sm: '1rem', md: '1.5rem', lg: '2rem', xl: '3rem' },
          borderRadius: '1rem'
        }
      });

      render(
        <CurriculumProgressVisualization
          childId="child-123"
          progressData={mockProgressData}
        />
      );

      expect(screen.getByText('20 hours')).toBeInTheDocument();
    });

    it('should display progress percentages correctly', () => {
      render(
        <CurriculumProgressVisualization
          childId="child-123"
          progressData={mockProgressData}
        />
      );

      // Overall progress
      expect(screen.getByText('68%')).toBeInTheDocument();

      // Subject progress
      expect(screen.getByText('72%')).toBeInTheDocument(); // Mathematics
      expect(screen.getByText('73%')).toBeInTheDocument(); // Reading
    });

    it('should show correct objective counts', () => {
      render(
        <CurriculumProgressVisualization
          childId="child-123"
          progressData={mockProgressData}
        />
      );

      expect(screen.getByText('18/25 objectives')).toBeInTheDocument(); // Mathematics
      expect(screen.getByText('22/30 objectives')).toBeInTheDocument(); // Reading
    });

    it('should display next milestones', () => {
      render(
        <CurriculumProgressVisualization
          childId="child-123"
          progressData={mockProgressData}
        />
      );

      expect(screen.getByText('Master division with remainders')).toBeInTheDocument();
      expect(screen.getByText('Read chapter books independently')).toBeInTheDocument();
    });

    it('should limit displayed items based on age group', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages6to9',
        theme: {
          colors: { primary: '#F59E0B', secondary: '#EF4444', background: '#FEF3C7', text: '#92400E', accent: '#D97706' },
          typography: {
            fontSize: { sm: '1rem', base: '1.25rem', lg: '1.5rem', xl: '2rem' },
            fontWeight: { normal: '400', medium: '500', bold: '700' }
          },
          spacing: { xs: '0.5rem', sm: '1rem', md: '1.5rem', lg: '2rem', xl: '3rem' },
          borderRadius: '1rem'
        }
      });

      const extendedData = {
        ...mockProgressData,
        nextMilestones: [
          'Master division with remainders',
          'Read chapter books independently',
          'Understand photosynthesis process',
          'Learn about ancient civilizations'
        ]
      };

      render(
        <CurriculumProgressVisualization
          childId="child-123"
          progressData={extendedData}
        />
      );

      // For ages 6-9, should only show first 2 milestones
      expect(screen.getByText('Master division with remainders')).toBeInTheDocument();
      expect(screen.getByText('Read chapter books independently')).toBeInTheDocument();
      expect(screen.queryByText('Understand photosynthesis process')).not.toBeInTheDocument();
    });
  });

  describe('Real-time Updates', () => {
    it('should use real-time data when available', () => {
      const realTimeData = {
        ...mockProgressData,
        overallCompletionRate: 0.75
      };

      mockUseRealTimeProgress.mockReturnValue({
        ...mockRealTimeProgress,
        currentProgress: realTimeData
      });

      render(
        <CurriculumProgressVisualization
          childId="child-123"
          progressData={mockProgressData}
        />
      );

      // Should display real-time data (75%) instead of provided data (68%)
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.queryByText('68%')).not.toBeInTheDocument();
    });

    it('should fallback to provided data when real-time data is unavailable', () => {
      mockUseRealTimeProgress.mockReturnValue({
        ...mockRealTimeProgress,
        currentProgress: null
      });

      render(
        <CurriculumProgressVisualization
          childId="child-123"
          progressData={mockProgressData}
        />
      );

      // Should use provided data
      expect(screen.getByText('68%')).toBeInTheDocument();
    });

    it('should display last sync time when connected', () => {
      const syncTime = new Date('2024-09-30T10:30:00');
      mockUseRealTimeProgress.mockReturnValue({
        ...mockRealTimeProgress,
        lastSync: syncTime
      });

      render(
        <CurriculumProgressVisualization
          childId="child-123"
          progressData={mockProgressData}
        />
      );

      expect(screen.getByText(/10:30:00/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(
        <CurriculumProgressVisualization
          childId="child-123"
          progressData={mockProgressData}
        />
      );

      // Progress bars should have proper accessibility
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it('should be keyboard navigable', () => {
      render(
        <CurriculumProgressVisualization
          childId="child-123"
          progressData={mockProgressData}
        />
      );

      const retryButton = screen.queryByRole('button', { name: 'Retry' });
      const subjectCards = screen.getAllByRole('button');

      subjectCards.forEach(button => {
        expect(button).toHaveAttribute('tabIndex');
      });
    });
  });
});
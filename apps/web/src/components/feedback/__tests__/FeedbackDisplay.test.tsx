import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeedbackDisplay, FeedbackContent } from '../FeedbackDisplay';

const mockFeedbackContent: FeedbackContent = {
  feedback: 'Great effort on this addition problem! I notice you wrote 2 + 2 = 5. Let me help you with that - when we add 2 + 2, we get 4.',
  positiveReinforcement: [
    'You showed your work clearly',
    'Your handwriting is neat and easy to read'
  ],
  improvementSuggestions: [
    {
      area: 'basic_addition',
      suggestion: 'Practice counting objects or use your fingers to double-check',
      actionable: true,
      priority: 'high',
      resources: ['Counting exercises', 'Practice worksheets']
    }
  ],
  visualAnnotations: [
    {
      id: '1',
      x: 100,
      y: 50,
      width: 120,
      height: 20,
      type: 'error',
      message: 'This should be 4',
      severity: 'high',
      color: '#ef4444'
    }
  ],
  learningInsights: {
    commonErrorPatterns: ['computational_error'],
    skillsNeedingFocus: ['basic_addition'],
    recommendedActivities: ['Practice with manipulatives', 'Use online math games'],
    progressIndicators: [
      {
        area: 'basic_addition',
        currentLevel: 'developing',
        targetLevel: 'proficient',
        timeframe: '2-3 weeks'
      }
    ],
    motivationalElements: ['Great try!', 'Keep practicing!']
  },
  ageGroup: 'ages6to9',
  voiceFeedbackUrl: 'https://example.com/audio/feedback.mp3'
};

const defaultProps = {
  feedbackContent: mockFeedbackContent,
  analysisImageUrl: '/test-image.jpg',
  onRetryFeedback: vi.fn(),
  onPlayVoiceFeedback: vi.fn()
};

describe('FeedbackDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render feedback content', () => {
    render(<FeedbackDisplay {...defaultProps} />);

    expect(screen.getByText(/Great effort on this addition problem/)).toBeInTheDocument();
    expect(screen.getByText('🌟 Your Learning Adventure!')).toBeInTheDocument();
  });

  it('should display positive reinforcement', () => {
    render(<FeedbackDisplay {...defaultProps} />);

    expect(screen.getByText('⭐ Things You Did Great!')).toBeInTheDocument();
    expect(screen.getByText('You showed your work clearly')).toBeInTheDocument();
    expect(screen.getByText('Your handwriting is neat and easy to read')).toBeInTheDocument();
  });

  it('should display improvement suggestions with priority', () => {
    render(<FeedbackDisplay {...defaultProps} />);

    expect(screen.getByText('🚀 Ways to Get Even Better!')).toBeInTheDocument();
    expect(screen.getByText('Basic Addition')).toBeInTheDocument();
    expect(screen.getByText('Practice counting objects or use your fingers to double-check')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('should display learning insights', () => {
    render(<FeedbackDisplay {...defaultProps} />);

    expect(screen.getByText('🧠 Learning Journey')).toBeInTheDocument();
    expect(screen.getByText('🎯 Fun Activities for You')).toBeInTheDocument();
    expect(screen.getByText('Practice with manipulatives')).toBeInTheDocument();
    expect(screen.getByText('Use online math games')).toBeInTheDocument();
  });

  it('should display progress indicators', () => {
    render(<FeedbackDisplay {...defaultProps} />);

    expect(screen.getByText('📈 Your Progress')).toBeInTheDocument();
    expect(screen.getByText('Basic Addition')).toBeInTheDocument();
    expect(screen.getByText('developing → proficient')).toBeInTheDocument();
    expect(screen.getByText('2-3 weeks')).toBeInTheDocument();
  });

  it('should display motivational elements', () => {
    render(<FeedbackDisplay {...defaultProps} />);

    expect(screen.getByText('💪 You Can Do It!')).toBeInTheDocument();
    expect(screen.getByText('Great try!')).toBeInTheDocument();
    expect(screen.getByText('Keep practicing!')).toBeInTheDocument();
  });

  it('should render photo annotations when available', () => {
    render(<FeedbackDisplay {...defaultProps} />);

    expect(screen.getByText('📸 Your Work with Tips')).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('should show voice feedback button when available', () => {
    render(<FeedbackDisplay {...defaultProps} />);

    const voiceButton = screen.getByText('Listen to Feedback');
    expect(voiceButton).toBeInTheDocument();

    fireEvent.click(voiceButton);
    expect(defaultProps.onPlayVoiceFeedback).toHaveBeenCalledTimes(1);
  });

  it('should show retry button', () => {
    render(<FeedbackDisplay {...defaultProps} />);

    const retryButton = screen.getByText('Try Again');
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(defaultProps.onRetryFeedback).toHaveBeenCalledTimes(1);
  });

  it('should adapt styling for ages10to13', () => {
    const feedbackContent = {
      ...mockFeedbackContent,
      ageGroup: 'ages10to13' as const
    };

    render(<FeedbackDisplay {...defaultProps} feedbackContent={feedbackContent} />);

    expect(screen.getByText('📚 Feedback Report')).toBeInTheDocument();
    expect(screen.getByText('✨ Strengths')).toBeInTheDocument();
    expect(screen.getByText('💡 Improvement Ideas')).toBeInTheDocument();
    expect(screen.getByText('📊 Progress Insights')).toBeInTheDocument();
  });

  it('should adapt styling for ages14to16', () => {
    const feedbackContent = {
      ...mockFeedbackContent,
      ageGroup: 'ages14to16' as const
    };

    render(<FeedbackDisplay {...defaultProps} feedbackContent={feedbackContent} />);

    expect(screen.getByText('📋 Performance Analysis')).toBeInTheDocument();
    expect(screen.getByText('✓ Positive Aspects')).toBeInTheDocument();
    expect(screen.getByText('→ Areas for Improvement')).toBeInTheDocument();
    expect(screen.getByText('📈 Learning Analytics')).toBeInTheDocument();
  });

  it('should handle missing voice feedback URL', () => {
    const feedbackContent = {
      ...mockFeedbackContent,
      voiceFeedbackUrl: undefined
    };

    render(<FeedbackDisplay {...defaultProps} feedbackContent={feedbackContent} />);

    expect(screen.queryByText('Listen to Feedback')).not.toBeInTheDocument();
  });

  it('should handle empty visual annotations', () => {
    const feedbackContent = {
      ...mockFeedbackContent,
      visualAnnotations: []
    };

    render(<FeedbackDisplay {...defaultProps} feedbackContent={feedbackContent} />);

    expect(screen.queryByText('📸 Your Work with Tips')).not.toBeInTheDocument();
  });

  it('should handle empty positive reinforcement', () => {
    const feedbackContent = {
      ...mockFeedbackContent,
      positiveReinforcement: []
    };

    render(<FeedbackDisplay {...defaultProps} feedbackContent={feedbackContent} />);

    expect(screen.queryByText('⭐ Things You Did Great!')).not.toBeInTheDocument();
  });

  it('should handle empty improvement suggestions', () => {
    const feedbackContent = {
      ...mockFeedbackContent,
      improvementSuggestions: []
    };

    render(<FeedbackDisplay {...defaultProps} feedbackContent={feedbackContent} />);

    expect(screen.queryByText('🚀 Ways to Get Even Better!')).not.toBeInTheDocument();
  });

  it('should display suggestion resources when available', () => {
    render(<FeedbackDisplay {...defaultProps} />);

    expect(screen.getByText('Resources:')).toBeInTheDocument();
    expect(screen.getByText('• Counting exercises')).toBeInTheDocument();
    expect(screen.getByText('• Practice worksheets')).toBeInTheDocument();
  });

  it('should apply priority colors correctly', () => {
    const feedbackContent = {
      ...mockFeedbackContent,
      improvementSuggestions: [
        { ...mockFeedbackContent.improvementSuggestions[0], priority: 'high' as const },
        { area: 'test_medium', suggestion: 'Medium priority', actionable: true, priority: 'medium' as const },
        { area: 'test_low', suggestion: 'Low priority', actionable: true, priority: 'low' as const }
      ]
    };

    render(<FeedbackDisplay {...defaultProps} feedbackContent={feedbackContent} />);

    const highPriorityBadge = screen.getByText('high');
    const mediumPriorityBadge = screen.getByText('medium');
    const lowPriorityBadge = screen.getByText('low');

    expect(highPriorityBadge).toHaveClass('text-red-600');
    expect(mediumPriorityBadge).toHaveClass('text-yellow-600');
    expect(lowPriorityBadge).toHaveClass('text-blue-600');
  });
});
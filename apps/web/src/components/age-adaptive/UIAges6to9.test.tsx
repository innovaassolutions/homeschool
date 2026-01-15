import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import {
  UIAges6to9,
  Button6to9,
  Card6to9,
  Navigation6to9,
  ProgressIndicator6to9
} from './UIAges6to9';
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive';

jest.mock('../../hooks/useAgeAdaptive');
jest.mock('./AgeAdaptiveWrapper', () => ({
  AgeAdaptiveWrapper: ({ children, overrideAgeGroup }: any) => (
    <div data-testid="age-adaptive-wrapper" data-age-group={overrideAgeGroup}>
      {children}
    </div>
  )
}));

const mockUseAgeAdaptive = useAgeAdaptive as jest.MockedFunction<typeof useAgeAdaptive>;

describe('UIAges6to9', () => {
  beforeEach(() => {
    mockUseAgeAdaptive.mockReturnValue({
      ageGroup: 'ages6to9',
      theme: {
        colors: { primary: '#10B981', secondary: '#F59E0B', background: '#F0FDF4', text: '#1F2937', accent: '#EC4899' },
        typography: {
          fontSize: { sm: '1rem', base: '1.25rem', lg: '1.5rem', xl: '2rem' },
          fontWeight: { normal: '500', medium: '600', bold: '700' }
        },
        spacing: { buttonPadding: '1rem 2rem', containerPadding: '2rem', elementSpacing: '1.5rem' },
        layout: { buttonMinHeight: '60px', buttonMinWidth: '120px', touchTarget: '48px' }
      },
      interactions: { showHoverStates: false, enableAdvancedGestures: false, animationDuration: '300ms' },
      navigation: { complexity: 'simple', showBreadcrumbs: false, maxNavigationDepth: 2 }
    });
  });

  describe('UIAges6to9 Component', () => {
    it('renders children content', () => {
      render(
        <UIAges6to9>
          <div>Test content</div>
        </UIAges6to9>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('shows visual cues by default', () => {
      render(
        <UIAges6to9>
          <div>Test content</div>
        </UIAges6to9>
      );

      expect(screen.getByText('🌟 Welcome to Learning! 🌟')).toBeInTheDocument();
      expect(screen.getByText('🎨 📚 🎯 🌈 ⭐ 🎪')).toBeInTheDocument();
    });

    it('hides visual cues when showVisualCues is false', () => {
      render(
        <UIAges6to9 showVisualCues={false}>
          <div>Test content</div>
        </UIAges6to9>
      );

      expect(screen.queryByText('🌟 Welcome to Learning! 🌟')).not.toBeInTheDocument();
      expect(screen.queryByText('🎨 📚 🎯 🌈 ⭐ 🎪')).not.toBeInTheDocument();
    });

    it('uses ages6to9 override in AgeAdaptiveWrapper', () => {
      render(
        <UIAges6to9>
          <div>Test content</div>
        </UIAges6to9>
      );

      expect(screen.getByTestId('age-adaptive-wrapper')).toHaveAttribute('data-age-group', 'ages6to9');
    });
  });

  describe('Button6to9 Component', () => {
    it('renders button with children', () => {
      render(<Button6to9>Click me</Button6to9>);

      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('handles click events', () => {
      const handleClick = jest.fn();
      render(<Button6to9 onClick={handleClick}>Click me</Button6to9>);

      fireEvent.click(screen.getByRole('button', { name: /click me/i }));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders with emoji', () => {
      render(
        <Button6to9 emoji="🎉">
          Party Time
        </Button6to9>
      );

      expect(screen.getByText('🎉')).toBeInTheDocument();
      expect(screen.getByText('Party Time')).toBeInTheDocument();
    });

    it('applies different variants correctly', () => {
      const { rerender } = render(<Button6to9 variant="primary">Primary</Button6to9>);
      expect(screen.getByRole('button')).toHaveClass('bg-emerald-500');

      rerender(<Button6to9 variant="secondary">Secondary</Button6to9>);
      expect(screen.getByRole('button')).toHaveClass('bg-amber-500');

      rerender(<Button6to9 variant="success">Success</Button6to9>);
      expect(screen.getByRole('button')).toHaveClass('bg-pink-500');
    });

    it('applies different sizes correctly', () => {
      const { rerender } = render(<Button6to9 size="normal">Normal</Button6to9>);
      expect(screen.getByRole('button')).toHaveClass('text-xl', 'min-h-[60px]');

      rerender(<Button6to9 size="large">Large</Button6to9>);
      expect(screen.getByRole('button')).toHaveClass('text-2xl', 'min-h-[80px]');
    });

    it('handles disabled state', () => {
      const handleClick = jest.fn();
      render(
        <Button6to9 onClick={handleClick} disabled>
          Disabled
        </Button6to9>
      );

      const button = screen.getByRole('button', { name: /disabled/i });
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');

      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Card6to9 Component', () => {
    it('renders card content', () => {
      render(
        <Card6to9>
          <p>Card content</p>
        </Card6to9>
      );

      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('renders with title and emoji', () => {
      render(
        <Card6to9 title="Fun Card" emoji="🎈">
          <p>Card content</p>
        </Card6to9>
      );

      expect(screen.getByText('Fun Card')).toBeInTheDocument();
      expect(screen.getByText('🎈')).toBeInTheDocument();
    });

    it('applies different colors correctly', () => {
      const { rerender } = render(
        <Card6to9 color="green">Content</Card6to9>
      );
      expect(screen.getByText('Content').closest('div')).toHaveClass('bg-green-50', 'border-green-200');

      rerender(<Card6to9 color="blue">Content</Card6to9>);
      expect(screen.getByText('Content').closest('div')).toHaveClass('bg-blue-50', 'border-blue-200');
    });

    it('handles click events when onClick is provided', () => {
      const handleClick = jest.fn();
      render(
        <Card6to9 onClick={handleClick}>
          Clickable card
        </Card6to9>
      );

      const card = screen.getByText('Clickable card').closest('div');
      expect(card).toHaveClass('cursor-pointer');

      fireEvent.click(card!);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Navigation6to9 Component', () => {
    const mockItems = [
      { label: 'Home', emoji: '🏠', active: true, onClick: jest.fn() },
      { label: 'Games', emoji: '🎮', onClick: jest.fn() },
      { label: 'Learn', emoji: '📚', onClick: jest.fn() }
    ];

    it('renders navigation items', () => {
      render(<Navigation6to9 items={mockItems} />);

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Games')).toBeInTheDocument();
      expect(screen.getByText('Learn')).toBeInTheDocument();
    });

    it('renders emojis for each item', () => {
      render(<Navigation6to9 items={mockItems} />);

      expect(screen.getByText('🏠')).toBeInTheDocument();
      expect(screen.getByText('🎮')).toBeInTheDocument();
      expect(screen.getByText('📚')).toBeInTheDocument();
    });

    it('applies active state styling', () => {
      render(<Navigation6to9 items={mockItems} />);

      const homeButton = screen.getByText('Home').closest('button');
      const gamesButton = screen.getByText('Games').closest('button');

      expect(homeButton).toHaveClass('bg-white', 'shadow-lg', 'text-purple-600', 'scale-105');
      expect(gamesButton).not.toHaveClass('scale-105');
    });

    it('handles item clicks', () => {
      render(<Navigation6to9 items={mockItems} />);

      fireEvent.click(screen.getByText('Games'));
      expect(mockItems[1].onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('ProgressIndicator6to9 Component', () => {
    it('renders progress bar', () => {
      render(<ProgressIndicator6to9 currentStep={3} totalSteps={5} />);

      const progressBar = document.querySelector('[style*="width: 60%"]');
      expect(progressBar).toBeInTheDocument();
    });

    it('displays correct percentage', () => {
      render(<ProgressIndicator6to9 currentStep={2} totalSteps={4} />);

      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('renders with step labels', () => {
      render(
        <ProgressIndicator6to9
          currentStep={1}
          totalSteps={3}
          labels={['Start', 'Middle', 'End']}
        />
      );

      // Note: This component shows a simple progress bar, labels would be for display reference
      const progressBar = document.querySelector('[style*="width: 33%"]');
      expect(progressBar).toBeInTheDocument();
    });

    it('handles edge cases for progress calculation', () => {
      const { rerender } = render(
        <ProgressIndicator6to9 currentStep={0} totalSteps={5} />
      );
      expect(screen.getByText('0%')).toBeInTheDocument();

      rerender(<ProgressIndicator6to9 currentStep={5} totalSteps={5} />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });
});
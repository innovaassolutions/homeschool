import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import {
  UIAges10to13,
  Button10to13,
  Card10to13,
  Navigation10to13,
  ProgressIndicator10to13
} from './UIAges10to13';
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

describe('UIAges10to13', () => {
  beforeEach(() => {
    mockUseAgeAdaptive.mockReturnValue({
      ageGroup: 'ages10to13',
      theme: {
        colors: { primary: '#3B82F6', secondary: '#8B5CF6', background: '#F8FAFC', text: '#1E293B', accent: '#06B6D4' },
        typography: {
          fontSize: { sm: '0.875rem', base: '1rem', lg: '1.25rem', xl: '1.5rem' },
          fontWeight: { normal: '400', medium: '500', bold: '600' }
        },
        spacing: { buttonPadding: '0.75rem 1.5rem', containerPadding: '1.5rem', elementSpacing: '1rem' },
        layout: { buttonMinHeight: '48px', buttonMinWidth: '100px', touchTarget: '44px' }
      },
      interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
      navigation: { complexity: 'balanced', showBreadcrumbs: true, maxNavigationDepth: 3 }
    });
  });

  describe('UIAges10to13 Component', () => {
    it('renders children content', () => {
      render(
        <UIAges10to13>
          <div>Test content</div>
        </UIAges10to13>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('shows breadcrumbs by default', () => {
      render(
        <UIAges10to13>
          <div>Test content</div>
        </UIAges10to13>
      );

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Current Page')).toBeInTheDocument();
    });

    it('hides breadcrumbs when showBreadcrumbs is false', () => {
      render(
        <UIAges10to13 showBreadcrumbs={false}>
          <div>Test content</div>
        </UIAges10to13>
      );

      expect(screen.queryByText('Home')).not.toBeInTheDocument();
      expect(screen.queryByText('Current Page')).not.toBeInTheDocument();
    });

    it('uses ages10to13 override in AgeAdaptiveWrapper', () => {
      render(
        <UIAges10to13>
          <div>Test content</div>
        </UIAges10to13>
      );

      expect(screen.getByTestId('age-adaptive-wrapper')).toHaveAttribute('data-age-group', 'ages10to13');
    });
  });

  describe('Button10to13 Component', () => {
    it('renders button with children', () => {
      render(<Button10to13>Click me</Button10to13>);

      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('handles click events', () => {
      const handleClick = jest.fn();
      render(<Button10to13 onClick={handleClick}>Click me</Button10to13>);

      fireEvent.click(screen.getByRole('button', { name: /click me/i }));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders with icon', () => {
      render(
        <Button10to13 icon={<span data-testid="icon">⭐</span>}>
          With Icon
        </Button10to13>
      );

      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByText('With Icon')).toBeInTheDocument();
    });

    it('shows tooltip on hover', async () => {
      render(
        <Button10to13 tooltip="This is a tooltip">
          Hover me
        </Button10to13>
      );

      const button = screen.getByRole('button', { name: /hover me/i });
      expect(button).toHaveAttribute('title', 'This is a tooltip');
    });

    it('applies different variants correctly', () => {
      const { rerender } = render(<Button10to13 variant="primary">Primary</Button10to13>);
      expect(screen.getByRole('button')).toHaveClass('bg-blue-600');

      rerender(<Button10to13 variant="secondary">Secondary</Button10to13>);
      expect(screen.getByRole('button')).toHaveClass('bg-purple-600');

      rerender(<Button10to13 variant="outline">Outline</Button10to13>);
      expect(screen.getByRole('button')).toHaveClass('border-2', 'border-blue-600');

      rerender(<Button10to13 variant="ghost">Ghost</Button10to13>);
      expect(screen.getByRole('button')).toHaveClass('text-gray-600');
    });

    it('applies different sizes correctly', () => {
      const { rerender } = render(<Button10to13 size="small">Small</Button10to13>);
      expect(screen.getByRole('button')).toHaveClass('text-sm', 'min-h-[36px]');

      rerender(<Button10to13 size="normal">Normal</Button10to13>);
      expect(screen.getByRole('button')).toHaveClass('text-base', 'min-h-[44px]');

      rerender(<Button10to13 size="large">Large</Button10to13>);
      expect(screen.getByRole('button')).toHaveClass('text-lg', 'min-h-[48px]');
    });

    it('shows loading state', () => {
      render(
        <Button10to13 loading>
          Loading
        </Button10to13>
      );

      const button = screen.getByRole('button', { name: /loading/i });
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');
      expect(button.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('handles disabled state', () => {
      const handleClick = jest.fn();
      render(
        <Button10to13 onClick={handleClick} disabled>
          Disabled
        </Button10to13>
      );

      const button = screen.getByRole('button', { name: /disabled/i });
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Card10to13 Component', () => {
    it('renders card content', () => {
      render(
        <Card10to13>
          <p>Card content</p>
        </Card10to13>
      );

      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('renders with title, subtitle, and icon', () => {
      render(
        <Card10to13
          title="Card Title"
          subtitle="Card subtitle"
          icon={<span data-testid="card-icon">📄</span>}
        >
          <p>Card content</p>
        </Card10to13>
      );

      expect(screen.getByText('Card Title')).toBeInTheDocument();
      expect(screen.getByText('Card subtitle')).toBeInTheDocument();
      expect(screen.getByTestId('card-icon')).toBeInTheDocument();
    });

    it('renders actions section', () => {
      render(
        <Card10to13
          actions={
            <button data-testid="card-action">Action</button>
          }
        >
          Content
        </Card10to13>
      );

      expect(screen.getByTestId('card-action')).toBeInTheDocument();
    });

    it('handles click events when onClick is provided', () => {
      const handleClick = jest.fn();
      render(
        <Card10to13 onClick={handleClick}>
          Clickable card
        </Card10to13>
      );

      const card = screen.getByText('Clickable card').closest('div');
      expect(card).toHaveClass('cursor-pointer');

      fireEvent.click(card!);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('applies selected state styling', () => {
      render(
        <Card10to13 selected>
          Selected card
        </Card10to13>
      );

      const card = screen.getByText('Selected card').closest('div');
      expect(card).toHaveClass('ring-2', 'ring-blue-500');
    });

    it('disables hover effects when hoverable is false', () => {
      render(
        <Card10to13 hoverable={false}>
          Non-hoverable card
        </Card10to13>
      );

      const card = screen.getByText('Non-hoverable card').closest('div');
      expect(card).not.toHaveClass('hover:shadow-lg');
    });
  });

  describe('Navigation10to13 Component', () => {
    const mockItems = [
      { label: 'Home', icon: <span>🏠</span>, active: true, onClick: jest.fn() },
      {
        label: 'Projects',
        icon: <span>📁</span>,
        badge: 3,
        onClick: jest.fn(),
        submenu: [
          { label: 'Project 1', onClick: jest.fn() },
          { label: 'Project 2', onClick: jest.fn() }
        ]
      },
      { label: 'Settings', icon: <span>⚙️</span>, onClick: jest.fn() }
    ];

    it('renders navigation items horizontally by default', () => {
      render(<Navigation10to13 items={mockItems} />);

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('flex', 'flex-wrap');
    });

    it('renders navigation items vertically when specified', () => {
      render(<Navigation10to13 items={mockItems} orientation="vertical" />);

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('flex', 'flex-col', 'w-64');
    });

    it('shows badges for items', () => {
      render(<Navigation10to13 items={mockItems} />);

      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('applies active state styling', () => {
      render(<Navigation10to13 items={mockItems} />);

      const homeButton = screen.getByText('Home').closest('button');
      const projectsButton = screen.getByText('Projects').closest('button');

      expect(homeButton).toHaveClass('bg-blue-600', 'text-white');
      expect(projectsButton).not.toHaveClass('bg-blue-600');
    });

    it('handles submenu interactions', async () => {
      render(<Navigation10to13 items={mockItems} />);

      // Click on Projects to open submenu
      fireEvent.click(screen.getByText('Projects'));

      await waitFor(() => {
        expect(screen.getByText('Project 1')).toBeInTheDocument();
        expect(screen.getByText('Project 2')).toBeInTheDocument();
      });

      // Click on submenu item
      fireEvent.click(screen.getByText('Project 1'));
      expect(mockItems[1].submenu![0].onClick).toHaveBeenCalledTimes(1);
    });

    it('handles item clicks for non-submenu items', () => {
      render(<Navigation10to13 items={mockItems} />);

      fireEvent.click(screen.getByText('Settings'));
      expect(mockItems[2].onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('ProgressIndicator10to13 Component', () => {
    it('renders progress bar by default', () => {
      render(<ProgressIndicator10to13 currentStep={3} totalSteps={5} />);

      const progressBar = document.querySelector('[style*="width: 60%"]');
      expect(progressBar).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('renders as steps variant', () => {
      render(
        <ProgressIndicator10to13
          currentStep={2}
          totalSteps={4}
          variant="steps"
        />
      );

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('shows labels when provided', () => {
      render(
        <ProgressIndicator10to13
          currentStep={1}
          totalSteps={3}
          labels={['Start', 'End']}
        />
      );

      expect(screen.getByText('Start')).toBeInTheDocument();
      expect(screen.getByText('End')).toBeInTheDocument();
    });

    it('hides percentage when showPercentage is false', () => {
      render(
        <ProgressIndicator10to13
          currentStep={2}
          totalSteps={4}
          showPercentage={false}
        />
      );

      expect(screen.queryByText('50%')).not.toBeInTheDocument();
    });

    it('handles edge cases for progress calculation', () => {
      const { rerender } = render(
        <ProgressIndicator10to13 currentStep={0} totalSteps={5} />
      );
      expect(screen.getByText('0%')).toBeInTheDocument();

      rerender(<ProgressIndicator10to13 currentStep={5} totalSteps={5} />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });
});
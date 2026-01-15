import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import {
  UIAges14to16,
  Button14to16,
  Card14to16,
  Navigation14to16,
  ProgressIndicator14to16
} from './UIAges14to16';
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

// Mock console.log to avoid noise in tests
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

describe('UIAges14to16', () => {
  beforeEach(() => {
    mockUseAgeAdaptive.mockReturnValue({
      ageGroup: 'ages14to16',
      theme: {
        colors: { primary: '#6366F1', secondary: '#64748B', background: '#FFFFFF', text: '#0F172A', accent: '#EF4444' },
        typography: {
          fontSize: { sm: '0.75rem', base: '0.875rem', lg: '1rem', xl: '1.25rem' },
          fontWeight: { normal: '400', medium: '500', bold: '600' }
        },
        spacing: { buttonPadding: '0.5rem 1rem', containerPadding: '1rem', elementSpacing: '0.75rem' },
        layout: { buttonMinHeight: '40px', buttonMinWidth: '80px', touchTarget: '40px' }
      },
      interactions: { showHoverStates: true, enableAdvancedGestures: true, animationDuration: '200ms' },
      navigation: { complexity: 'advanced', showBreadcrumbs: true, maxNavigationDepth: 5 }
    });

    // Clear any event listeners
    document.removeEventListener('keydown', jest.fn());
  });

  describe('UIAges14to16 Component', () => {
    it('renders children content', () => {
      render(
        <UIAges14to16>
          <div>Test content</div>
        </UIAges14to16>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('shows detailed breadcrumbs by default', () => {
      render(
        <UIAges14to16>
          <div>Test content</div>
        </UIAges14to16>
      );

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Section')).toBeInTheDocument();
      expect(screen.getByText('Current Page')).toBeInTheDocument();
    });

    it('hides breadcrumbs when showDetailedBreadcrumbs is false', () => {
      render(
        <UIAges14to16 showDetailedBreadcrumbs={false}>
          <div>Test content</div>
        </UIAges14to16>
      );

      expect(screen.queryByText('Home')).not.toBeInTheDocument();
      expect(screen.queryByText('Section')).not.toBeInTheDocument();
      expect(screen.queryByText('Current Page')).not.toBeInTheDocument();
    });

    it('shows keyboard shortcuts hint by default', () => {
      render(
        <UIAges14to16>
          <div>Test content</div>
        </UIAges14to16>
      );

      expect(screen.getByText(/Press ⌘K for search, ⌘\/ for commands/)).toBeInTheDocument();
    });

    it('hides keyboard shortcuts when enableKeyboardShortcuts is false', () => {
      render(
        <UIAges14to16 enableKeyboardShortcuts={false}>
          <div>Test content</div>
        </UIAges14to16>
      );

      expect(screen.queryByText(/Press ⌘K for search/)).not.toBeInTheDocument();
    });

    it('uses ages14to16 override in AgeAdaptiveWrapper', () => {
      render(
        <UIAges14to16>
          <div>Test content</div>
        </UIAges14to16>
      );

      expect(screen.getByTestId('age-adaptive-wrapper')).toHaveAttribute('data-age-group', 'ages14to16');
    });
  });

  describe('Button14to16 Component', () => {
    it('renders button with children', () => {
      render(<Button14to16>Click me</Button14to16>);

      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('handles click events', () => {
      const handleClick = jest.fn();
      render(<Button14to16 onClick={handleClick}>Click me</Button14to16>);

      fireEvent.click(screen.getByRole('button', { name: /click me/i }));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders with icon on left by default', () => {
      render(
        <Button14to16 icon={<span data-testid="icon">⭐</span>}>
          With Icon
        </Button14to16>
      );

      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByText('With Icon')).toBeInTheDocument();
    });

    it('renders with icon on right when specified', () => {
      render(
        <Button14to16
          icon={<span data-testid="icon">⭐</span>}
          iconPosition="right"
        >
          With Icon
        </Button14to16>
      );

      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });

    it('shows tooltip on hover', () => {
      render(
        <Button14to16 tooltip="This is a tooltip">
          Hover me
        </Button14to16>
      );

      const button = screen.getByRole('button', { name: /hover me/i });
      expect(button).toHaveAttribute('title', 'This is a tooltip');
    });

    it('displays shortcut in button', () => {
      render(
        <Button14to16 shortcut="⌘K">
          Search
        </Button14to16>
      );

      expect(screen.getByText('⌘K')).toBeInTheDocument();
    });

    it('applies different variants correctly', () => {
      const { rerender } = render(<Button14to16 variant="primary">Primary</Button14to16>);
      expect(screen.getByRole('button')).toHaveClass('bg-indigo-600');

      rerender(<Button14to16 variant="secondary">Secondary</Button14to16>);
      expect(screen.getByRole('button')).toHaveClass('bg-slate-600');

      rerender(<Button14to16 variant="outline">Outline</Button14to16>);
      expect(screen.getByRole('button')).toHaveClass('border', 'border-gray-300');

      rerender(<Button14to16 variant="ghost">Ghost</Button14to16>);
      expect(screen.getByRole('button')).toHaveClass('text-gray-600');

      rerender(<Button14to16 variant="danger">Danger</Button14to16>);
      expect(screen.getByRole('button')).toHaveClass('bg-red-600');

      rerender(<Button14to16 variant="success">Success</Button14to16>);
      expect(screen.getByRole('button')).toHaveClass('bg-green-600');
    });

    it('applies different sizes correctly', () => {
      const { rerender } = render(<Button14to16 size="xs">Extra Small</Button14to16>);
      expect(screen.getByRole('button')).toHaveClass('text-xs', 'min-h-[28px]');

      rerender(<Button14to16 size="sm">Small</Button14to16>);
      expect(screen.getByRole('button')).toHaveClass('text-sm', 'min-h-[32px]');

      rerender(<Button14to16 size="md">Medium</Button14to16>);
      expect(screen.getByRole('button')).toHaveClass('text-sm', 'min-h-[36px]');

      rerender(<Button14to16 size="lg">Large</Button14to16>);
      expect(screen.getByRole('button')).toHaveClass('text-base', 'min-h-[40px]');
    });

    it('applies full width when specified', () => {
      render(<Button14to16 fullWidth>Full Width</Button14to16>);

      expect(screen.getByRole('button')).toHaveClass('w-full');
    });

    it('shows loading state', () => {
      render(
        <Button14to16 loading>
          Loading
        </Button14to16>
      );

      const button = screen.getByRole('button', { name: /loading/i });
      expect(button).toBeDisabled();
      expect(button.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('handles disabled state', () => {
      const handleClick = jest.fn();
      render(
        <Button14to16 onClick={handleClick} disabled>
          Disabled
        </Button14to16>
      );

      const button = screen.getByRole('button', { name: /disabled/i });
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Card14to16 Component', () => {
    it('renders card content', () => {
      render(
        <Card14to16>
          <p>Card content</p>
        </Card14to16>
      );

      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('renders with title, subtitle, and icon', () => {
      render(
        <Card14to16
          title="Card Title"
          subtitle="Card subtitle"
          icon={<span data-testid="card-icon">📄</span>}
        >
          <p>Card content</p>
        </Card14to16>
      );

      expect(screen.getByText('Card Title')).toBeInTheDocument();
      expect(screen.getByText('Card subtitle')).toBeInTheDocument();
      expect(screen.getByTestId('card-icon')).toBeInTheDocument();
    });

    it('renders metadata section', () => {
      render(
        <Card14to16
          metadata={<span data-testid="metadata">Created 2 days ago</span>}
        >
          Content
        </Card14to16>
      );

      expect(screen.getByTestId('metadata')).toBeInTheDocument();
    });

    it('renders actions section', () => {
      render(
        <Card14to16
          actions={
            <button data-testid="card-action">Action</button>
          }
        >
          Content
        </Card14to16>
      );

      expect(screen.getByTestId('card-action')).toBeInTheDocument();
    });

    it('applies different variants correctly', () => {
      const { rerender } = render(
        <Card14to16 variant="default">Content</Card14to16>
      );
      let card = screen.getByText('Content').closest('div');
      expect(card).toHaveClass('bg-white', 'border', 'border-gray-200');

      rerender(<Card14to16 variant="elevated">Content</Card14to16>);
      card = screen.getByText('Content').closest('div');
      expect(card).toHaveClass('bg-white', 'shadow-sm');

      rerender(<Card14to16 variant="outlined">Content</Card14to16>);
      card = screen.getByText('Content').closest('div');
      expect(card).toHaveClass('bg-transparent', 'border-2', 'border-gray-300');

      rerender(<Card14to16 variant="filled">Content</Card14to16>);
      card = screen.getByText('Content').closest('div');
      expect(card).toHaveClass('bg-gray-50');
    });

    it('handles click events when onClick is provided', () => {
      const handleClick = jest.fn();
      render(
        <Card14to16 onClick={handleClick}>
          Clickable card
        </Card14to16>
      );

      const card = screen.getByText('Clickable card').closest('div');
      expect(card).toHaveClass('cursor-pointer');

      fireEvent.click(card!);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('applies selected state styling', () => {
      render(
        <Card14to16 selected>
          Selected card
        </Card14to16>
      );

      const card = screen.getByText('Selected card').closest('div');
      expect(card).toHaveClass('ring-2', 'ring-indigo-500');
    });

    it('disables interactive styles when interactive is false', () => {
      render(
        <Card14to16 interactive={false} onClick={jest.fn()}>
          Non-interactive card
        </Card14to16>
      );

      const card = screen.getByText('Non-interactive card').closest('div');
      expect(card).not.toHaveClass('cursor-pointer');
    });
  });

  describe('Navigation14to16 Component', () => {
    const mockItems = [
      { label: 'Dashboard', icon: <span>📊</span>, active: true, shortcut: '⌘1', onClick: jest.fn() },
      {
        label: 'Projects',
        icon: <span>📁</span>,
        badge: 5,
        shortcut: '⌘2',
        onClick: jest.fn(),
        submenu: [
          { label: 'Active Projects', icon: <span>🟢</span>, shortcut: '⌘A', onClick: jest.fn() },
          { label: 'Archived Projects', icon: <span>📦</span>, shortcut: '⌘R', onClick: jest.fn() }
        ]
      },
      { label: 'Settings', icon: <span>⚙️</span>, shortcut: '⌘,', onClick: jest.fn() }
    ];

    it('renders navigation items horizontally by default', () => {
      render(<Navigation14to16 items={mockItems} />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('flex', 'gap-1');
    });

    it('renders navigation items vertically when specified', () => {
      render(<Navigation14to16 items={mockItems} orientation="vertical" />);

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('flex', 'flex-col', 'w-64');
    });

    it('applies compact styling when compact is true', () => {
      render(<Navigation14to16 items={mockItems} compact />);

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('p-1');
    });

    it('shows badges for items', () => {
      render(<Navigation14to16 items={mockItems} />);

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('shows shortcuts when enabled', () => {
      render(<Navigation14to16 items={mockItems} showShortcuts />);

      // Shortcuts are shown on hover or for non-active items
      expect(screen.getByText('⌘2')).toBeInTheDocument();
    });

    it('hides shortcuts when showShortcuts is false', () => {
      render(<Navigation14to16 items={mockItems} showShortcuts={false} />);

      expect(screen.queryByText('⌘2')).not.toBeInTheDocument();
    });

    it('applies active state styling', () => {
      render(<Navigation14to16 items={mockItems} />);

      const dashboardButton = screen.getByText('Dashboard').closest('button');
      const projectsButton = screen.getByText('Projects').closest('button');

      expect(dashboardButton).toHaveClass('bg-indigo-600', 'text-white');
      expect(projectsButton).not.toHaveClass('bg-indigo-600');
    });

    it('handles submenu interactions', async () => {
      render(<Navigation14to16 items={mockItems} />);

      // Click on Projects to open submenu
      fireEvent.click(screen.getByText('Projects'));

      await waitFor(() => {
        expect(screen.getByText('Active Projects')).toBeInTheDocument();
        expect(screen.getByText('Archived Projects')).toBeInTheDocument();
      });

      // Check submenu shortcuts
      expect(screen.getByText('⌘A')).toBeInTheDocument();
      expect(screen.getByText('⌘R')).toBeInTheDocument();

      // Click on submenu item
      fireEvent.click(screen.getByText('Active Projects'));
      expect(mockItems[1].submenu![0].onClick).toHaveBeenCalledTimes(1);
    });

    it('handles item clicks for non-submenu items', () => {
      render(<Navigation14to16 items={mockItems} />);

      fireEvent.click(screen.getByText('Settings'));
      expect(mockItems[2].onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('ProgressIndicator14to16 Component', () => {
    it('renders minimal variant', () => {
      render(
        <ProgressIndicator14to16
          currentStep={3}
          totalSteps={5}
          variant="minimal"
        />
      );

      const progressBar = document.querySelector('[style*="width: 60%"]');
      expect(progressBar).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('renders detailed variant by default', () => {
      render(
        <ProgressIndicator14to16
          currentStep={2}
          totalSteps={4}
          variant="detailed"
        />
      );

      expect(screen.getByText('Progress')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('/4')).toBeInTheDocument();
      expect(screen.getByText('(50%)')).toBeInTheDocument();
    });

    it('renders stepper variant', () => {
      render(
        <ProgressIndicator14to16
          currentStep={2}
          totalSteps={4}
          variant="stepper"
        />
      );

      expect(screen.getByText('✓')).toBeInTheDocument(); // Completed step
      expect(screen.getByText('2')).toBeInTheDocument(); // Current step
      expect(screen.getByText('3')).toBeInTheDocument(); // Pending step
      expect(screen.getByText('4')).toBeInTheDocument(); // Pending step
    });

    it('applies different sizes correctly', () => {
      const { rerender } = render(
        <ProgressIndicator14to16
          currentStep={1}
          totalSteps={3}
          size="sm"
        />
      );
      expect(document.querySelector('.h-2')).toBeInTheDocument();

      rerender(
        <ProgressIndicator14to16
          currentStep={1}
          totalSteps={3}
          size="md"
        />
      );
      expect(document.querySelector('.h-3')).toBeInTheDocument();

      rerender(
        <ProgressIndicator14to16
          currentStep={1}
          totalSteps={3}
          size="lg"
        />
      );
      expect(document.querySelector('.h-4')).toBeInTheDocument();
    });

    it('shows labels when provided', () => {
      render(
        <ProgressIndicator14to16
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
        <ProgressIndicator14to16
          currentStep={2}
          totalSteps={4}
          showPercentage={false}
        />
      );

      expect(screen.queryByText('50%')).not.toBeInTheDocument();
    });

    it('hides details when showDetails is false', () => {
      render(
        <ProgressIndicator14to16
          currentStep={2}
          totalSteps={4}
          showDetails={false}
        />
      );

      expect(screen.queryByText('Progress')).not.toBeInTheDocument();
    });

    it('handles edge cases for progress calculation', () => {
      const { rerender } = render(
        <ProgressIndicator14to16 currentStep={0} totalSteps={5} />
      );
      expect(screen.getByText('0%')).toBeInTheDocument();

      rerender(<ProgressIndicator14to16 currentStep={5} totalSteps={5} />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });
});
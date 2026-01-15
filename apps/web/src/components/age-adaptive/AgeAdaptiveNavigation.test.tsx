import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { AgeAdaptiveNavigation, SimpleNavigation, NavigationItem } from './AgeAdaptiveNavigation';
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive';

jest.mock('../../hooks/useAgeAdaptive');
jest.mock('../../hooks/useTouchGestures', () => ({
  useTouchGestures: jest.fn(() => ({
    isAdvancedGesturesEnabled: false,
    touchSupported: true
  }))
}));

const mockUseAgeAdaptive = useAgeAdaptive as jest.MockedFunction<typeof useAgeAdaptive>;

const mockNavigationItems: NavigationItem[] = [
  {
    id: 'home',
    label: 'Home',
    emoji: '🏠',
    path: '/home'
  },
  {
    id: 'games',
    label: 'Games',
    emoji: '🎮',
    path: '/games',
    badge: 3,
    children: [
      { id: 'puzzle', label: 'Puzzles', emoji: '🧩', path: '/games/puzzle' },
      { id: 'math', label: 'Math Games', emoji: '🔢', path: '/games/math' }
    ]
  },
  {
    id: 'learn',
    label: 'Learn',
    emoji: '📚',
    path: '/learn',
    disabled: true
  },
  {
    id: 'settings',
    label: 'Settings',
    emoji: '⚙️',
    path: '/settings'
  }
];

describe('AgeAdaptiveNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Ages 6-9 Navigation', () => {
    beforeEach(() => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages6to9',
        theme: {} as any,
        interactions: { showHoverStates: false, enableAdvancedGestures: false, animationDuration: '300ms' },
        navigation: { complexity: 'simple', showBreadcrumbs: false, maxNavigationDepth: 2 }
      });
    });

    it('renders navigation items with large, touch-friendly buttons', () => {
      render(<AgeAdaptiveNavigation items={mockNavigationItems} />);

      const homeButton = screen.getByText('Home').closest('button');
      expect(homeButton).toHaveClass('text-lg', 'px-6', 'py-4', 'rounded-2xl', 'min-h-[60px]');
    });

    it('shows emojis for navigation items', () => {
      render(<AgeAdaptiveNavigation items={mockNavigationItems} />);

      expect(screen.getByText('🏠')).toBeInTheDocument();
      expect(screen.getByText('🎮')).toBeInTheDocument();
      expect(screen.getByText('📚')).toBeInTheDocument();
    });

    it('does not show breadcrumbs for simple navigation', () => {
      render(
        <AgeAdaptiveNavigation
          items={mockNavigationItems}
          showBreadcrumbs={true}
        />
      );

      // Breadcrumbs should not appear for ages 6-9
      expect(screen.queryByText('Home')).toBeInTheDocument(); // Navigation item
      expect(screen.queryByRole('navigation', { name: /breadcrumb/i })).not.toBeInTheDocument();
    });

    it('handles item clicks for simple navigation', () => {
      const onNavigate = jest.fn();
      render(
        <AgeAdaptiveNavigation
          items={mockNavigationItems}
          onNavigate={onNavigate}
        />
      );

      fireEvent.click(screen.getByText('Home'));
      expect(onNavigate).toHaveBeenCalledWith(mockNavigationItems[0]);
    });

    it('handles items with children by calling onClick directly', () => {
      const mockItemWithChildren = {
        ...mockNavigationItems[1],
        onClick: jest.fn()
      };

      render(
        <AgeAdaptiveNavigation
          items={[mockItemWithChildren]}
        />
      );

      fireEvent.click(screen.getByText('Games'));
      expect(mockItemWithChildren.onClick).toHaveBeenCalled();
    });

    it('applies gradient background styling', () => {
      render(<AgeAdaptiveNavigation items={mockNavigationItems} />);

      const navContainer = screen.getByRole('navigation');
      expect(navContainer).toHaveClass('bg-gradient-to-r', 'from-purple-100', 'rounded-2xl');
    });

    it('disables navigation for disabled items', () => {
      render(<AgeAdaptiveNavigation items={mockNavigationItems} />);

      const learnButton = screen.getByText('Learn').closest('button');
      expect(learnButton).toBeDisabled();
      expect(learnButton).toHaveClass('opacity-50', 'cursor-not-allowed');
    });
  });

  describe('Ages 10-13 Navigation', () => {
    beforeEach(() => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: { complexity: 'balanced', showBreadcrumbs: true, maxNavigationDepth: 3 }
      });
    });

    it('renders medium-sized navigation buttons', () => {
      render(<AgeAdaptiveNavigation items={mockNavigationItems} />);

      const homeButton = screen.getByText('Home').closest('button');
      expect(homeButton).toHaveClass('text-base', 'px-4', 'py-3', 'rounded-lg', 'min-h-[44px]');
    });

    it('shows submenu dropdowns for items with children', async () => {
      render(<AgeAdaptiveNavigation items={mockNavigationItems} />);

      const gamesButton = screen.getByText('Games');
      fireEvent.click(gamesButton);

      await waitFor(() => {
        expect(screen.getByText('Puzzles')).toBeInTheDocument();
        expect(screen.getByText('Math Games')).toBeInTheDocument();
      });
    });

    it('shows badges for navigation items', () => {
      render(<AgeAdaptiveNavigation items={mockNavigationItems} />);

      expect(screen.getByText('3')).toBeInTheDocument(); // Badge for Games
    });

    it('toggles submenu open and closed', async () => {
      render(<AgeAdaptiveNavigation items={mockNavigationItems} />);

      const gamesButton = screen.getByText('Games');

      // Open submenu
      fireEvent.click(gamesButton);
      await waitFor(() => {
        expect(screen.getByText('Puzzles')).toBeInTheDocument();
      });

      // Close submenu
      fireEvent.click(gamesButton);
      await waitFor(() => {
        expect(screen.queryByText('Puzzles')).not.toBeInTheDocument();
      });
    });

    it('calls onNavigate for submenu items', async () => {
      const onNavigate = jest.fn();
      render(
        <AgeAdaptiveNavigation
          items={mockNavigationItems}
          onNavigate={onNavigate}
        />
      );

      const gamesButton = screen.getByText('Games');
      fireEvent.click(gamesButton);

      await waitFor(() => {
        const puzzleButton = screen.getByText('Puzzles');
        fireEvent.click(puzzleButton);
        expect(onNavigate).toHaveBeenCalledWith(mockNavigationItems[1].children![0]);
      });
    });

    it('shows submenu indicator', () => {
      render(<AgeAdaptiveNavigation items={mockNavigationItems} />);

      const gamesButton = screen.getByText('Games').closest('button');
      expect(gamesButton).toHaveTextContent('▼');
    });
  });

  describe('Ages 14-16 Navigation', () => {
    beforeEach(() => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages14to16',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: true, animationDuration: '200ms' },
        navigation: { complexity: 'advanced', showBreadcrumbs: true, maxNavigationDepth: 5 }
      });
    });

    it('renders compact navigation buttons', () => {
      render(<AgeAdaptiveNavigation items={mockNavigationItems} />);

      const homeButton = screen.getByText('Home').closest('button');
      expect(homeButton).toHaveClass('text-sm', 'px-3', 'py-2', 'rounded-md', 'min-h-[36px]');
    });

    it('applies sophisticated styling', () => {
      render(<AgeAdaptiveNavigation items={mockNavigationItems} />);

      const navContainer = screen.getByRole('navigation');
      expect(navContainer).toHaveClass('bg-gray-50/50', 'backdrop-blur-sm', 'border', 'border-gray-200/50');
    });

    it('shows icons instead of emojis when provided', () => {
      const itemsWithIcons = mockNavigationItems.map(item => ({
        ...item,
        icon: <span data-testid={`icon-${item.id}`}>icon</span>
      }));

      render(<AgeAdaptiveNavigation items={itemsWithIcons} />);

      expect(screen.getByTestId('icon-home')).toBeInTheDocument();
      expect(screen.getByTestId('icon-games')).toBeInTheDocument();
    });
  });

  describe('Breadcrumbs Integration', () => {
    beforeEach(() => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: { complexity: 'balanced', showBreadcrumbs: true, maxNavigationDepth: 3 }
      });
    });

    it('updates navigation history when items are clicked', () => {
      render(
        <AgeAdaptiveNavigation
          items={mockNavigationItems}
          currentPath="/home"
        />
      );

      const homeButton = screen.getByText('Home').closest('button');
      expect(homeButton).toHaveClass('bg-blue-600', 'text-white'); // Active state
    });

    it('identifies active navigation items', () => {
      render(
        <AgeAdaptiveNavigation
          items={mockNavigationItems}
          currentPath="home"
        />
      );

      const homeButton = screen.getByText('Home').closest('button');
      expect(homeButton).toHaveClass('bg-blue-600', 'text-white');

      const gamesButton = screen.getByText('Games').closest('button');
      expect(gamesButton).not.toHaveClass('bg-blue-600');
    });
  });

  describe('Orientation and Layout', () => {
    beforeEach(() => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: { complexity: 'balanced', showBreadcrumbs: true, maxNavigationDepth: 3 }
      });
    });

    it('renders horizontal navigation by default', () => {
      render(<AgeAdaptiveNavigation items={mockNavigationItems} />);

      const navContainer = screen.getByRole('navigation');
      expect(navContainer).toHaveClass('flex', 'flex-wrap');
    });

    it('renders vertical navigation when specified', () => {
      render(
        <AgeAdaptiveNavigation
          items={mockNavigationItems}
          orientation="vertical"
        />
      );

      const navContainer = screen.getByRole('navigation');
      expect(navContainer).toHaveClass('flex', 'flex-col');
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: { complexity: 'balanced', showBreadcrumbs: true, maxNavigationDepth: 3 }
      });
    });

    it('has proper ARIA roles', () => {
      render(<AgeAdaptiveNavigation items={mockNavigationItems} />);

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('provides titles for items with descriptions', () => {
      const itemsWithDescriptions = [
        {
          ...mockNavigationItems[0],
          description: 'Go to the main home page'
        }
      ];

      render(<AgeAdaptiveNavigation items={itemsWithDescriptions} />);

      const homeButton = screen.getByText('Home').closest('button');
      expect(homeButton).toHaveAttribute('title', 'Go to the main home page');
    });

    it('properly disables buttons for disabled items', () => {
      render(<AgeAdaptiveNavigation items={mockNavigationItems} />);

      const learnButton = screen.getByText('Learn').closest('button');
      expect(learnButton).toBeDisabled();
    });
  });
});

describe('SimpleNavigation', () => {
  it('renders items in a grid layout', () => {
    render(
      <SimpleNavigation
        items={mockNavigationItems.slice(0, 4)}
        columns={2}
      />
    );

    const container = screen.getByText('Home').closest('div')?.parentElement;
    expect(container).toHaveClass('grid', 'grid-cols-2');
  });

  it('shows large emojis and descriptions', () => {
    const itemsWithDescriptions = [
      {
        ...mockNavigationItems[0],
        description: 'Your main dashboard'
      }
    ];

    render(<SimpleNavigation items={itemsWithDescriptions} />);

    expect(screen.getByText('🏠')).toHaveClass('text-4xl');
    expect(screen.getByText('Your main dashboard')).toBeInTheDocument();
  });

  it('calls onNavigate when items are clicked', () => {
    const onNavigate = jest.fn();
    render(
      <SimpleNavigation
        items={[mockNavigationItems[0]]}
        onNavigate={onNavigate}
      />
    );

    fireEvent.click(screen.getByText('Home'));
    expect(onNavigate).toHaveBeenCalledWith(mockNavigationItems[0]);
  });

  it('handles disabled items', () => {
    render(
      <SimpleNavigation
        items={[mockNavigationItems[2]]} // Learn item is disabled
      />
    );

    const learnButton = screen.getByText('Learn').closest('button');
    expect(learnButton).toBeDisabled();
  });

  it('applies touch-friendly styling', () => {
    render(
      <SimpleNavigation
        items={[mockNavigationItems[0]]}
      />
    );

    const homeButton = screen.getByText('Home').closest('button');
    expect(homeButton).toHaveClass('hover:scale-105', 'active:scale-95', 'min-h-[120px]');
  });
});
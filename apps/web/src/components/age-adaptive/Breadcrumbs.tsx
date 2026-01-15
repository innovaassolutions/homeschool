import React from 'react';
import { useNavigation } from './NavigationProvider';
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive';

export interface BreadcrumbItem {
  id: string;
  label: string;
  path?: string;
  icon?: React.ReactNode;
  emoji?: string;
  isClickable?: boolean;
}

export interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  maxItems?: number;
  showHomeButton?: boolean;
  homeLabel?: string;
  homeIcon?: React.ReactNode;
  homeEmoji?: string;
  separator?: React.ReactNode;
  className?: string;
  onNavigate?: (item: BreadcrumbItem) => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items: customItems,
  maxItems,
  showHomeButton = true,
  homeLabel = 'Home',
  homeIcon,
  homeEmoji = '🏠',
  separator,
  className = '',
  onNavigate
}) => {
  const { state, navigate, getFilteredRoutes } = useNavigation();
  const { ageGroup, navigation: navConfig } = useAgeAdaptive();

  // Don't show breadcrumbs for simple navigation (ages 6-9)
  if (!navConfig.showBreadcrumbs || navConfig.complexity === 'simple') {
    return null;
  }

  // Use custom items or derive from navigation history
  const breadcrumbItems = customItems || deriveBreadcrumbsFromHistory();

  function deriveBreadcrumbsFromHistory(): BreadcrumbItem[] {
    if (!state.currentRoute) return [];

    // Build breadcrumb trail by finding the path to current route
    const findPathToRoute = (routes: any[], targetId: string, path: BreadcrumbItem[] = []): BreadcrumbItem[] | null => {
      for (const route of routes) {
        const currentPath = [...path, {
          id: route.id,
          label: route.label,
          path: route.path,
          icon: route.icon,
          emoji: route.emoji,
          isClickable: true
        }];

        if (route.id === targetId) {
          return currentPath;
        }

        if (route.children) {
          const found = findPathToRoute(route.children, targetId, currentPath);
          if (found) return found;
        }
      }
      return null;
    };

    const path = findPathToRoute(getFilteredRoutes(), state.currentRoute.id);
    return path || [];
  }

  // Apply age-specific max items if not specified
  const effectiveMaxItems = maxItems || navConfig.maxNavigationDepth;

  // Truncate items if necessary
  const visibleItems = breadcrumbItems.length > effectiveMaxItems
    ? [
        ...breadcrumbItems.slice(0, 1), // Keep first item
        { id: 'ellipsis', label: '...', isClickable: false },
        ...breadcrumbItems.slice(-effectiveMaxItems + 2) // Keep last items
      ]
    : breadcrumbItems;

  // Age-appropriate separator
  const getSeparator = () => {
    if (separator) return separator;

    switch (ageGroup) {
      case 'ages6to9':
        return <span className="text-2xl">👉</span>;
      case 'ages10to13':
        return <span className="text-gray-400 mx-2">›</span>;
      case 'ages14to16':
        return <span className="text-gray-400 mx-1">/</span>;
      default:
        return <span className="text-gray-400 mx-2">›</span>;
    }
  };

  // Age-appropriate styling
  const getContainerClasses = () => {
    const baseClasses = 'flex items-center';

    switch (ageGroup) {
      case 'ages10to13':
        return `${baseClasses} text-sm space-x-1 py-2`;
      case 'ages14to16':
        return `${baseClasses} text-xs space-x-1 py-1`;
      default:
        return baseClasses;
    }
  };

  const getItemClasses = (item: BreadcrumbItem, isLast: boolean) => {
    const baseClasses = 'transition-colors duration-150';

    if (!item.isClickable || item.id === 'ellipsis') {
      return `${baseClasses} text-gray-500`;
    }

    switch (ageGroup) {
      case 'ages10to13':
        return `${baseClasses} ${
          isLast
            ? 'text-blue-600 font-medium'
            : 'text-gray-600 hover:text-blue-600 cursor-pointer'
        }`;
      case 'ages14to16':
        return `${baseClasses} ${
          isLast
            ? 'text-indigo-600 font-medium'
            : 'text-gray-500 hover:text-gray-700 cursor-pointer'
        }`;
      default:
        return baseClasses;
    }
  };

  const handleItemClick = (item: BreadcrumbItem) => {
    if (!item.isClickable || item.id === 'ellipsis') return;

    if (onNavigate) {
      onNavigate(item);
    } else if (item.id) {
      navigate(item.id);
    }
  };

  const handleHomeClick = () => {
    if (onNavigate) {
      onNavigate({
        id: 'home',
        label: homeLabel,
        isClickable: true
      });
    } else {
      navigate('home');
    }
  };

  if (visibleItems.length === 0 && !showHomeButton) {
    return null;
  }

  return (
    <nav
      className={`${getContainerClasses()} ${className}`}
      aria-label="Breadcrumb"
      role="navigation"
    >
      {/* Home button */}
      {showHomeButton && (
        <>
          <button
            className={getItemClasses({ id: 'home', label: homeLabel, isClickable: true }, false)}
            onClick={handleHomeClick}
            aria-label={`Navigate to ${homeLabel}`}
          >
            <span className="flex items-center gap-1">
              {ageGroup === 'ages10to13' && homeEmoji && (
                <span>{homeEmoji}</span>
              )}
              {ageGroup === 'ages14to16' && homeIcon && (
                <span>{homeIcon}</span>
              )}
              <span>{homeLabel}</span>
            </span>
          </button>
          {visibleItems.length > 0 && getSeparator()}
        </>
      )}

      {/* Breadcrumb items */}
      {visibleItems.map((item, index) => {
        const isLast = index === visibleItems.length - 1;

        return (
          <React.Fragment key={item.id}>
            <button
              className={getItemClasses(item, isLast)}
              onClick={() => handleItemClick(item)}
              disabled={!item.isClickable}
              aria-current={isLast ? 'page' : undefined}
              title={item.label}
            >
              <span className="flex items-center gap-1">
                {ageGroup === 'ages10to13' && item.emoji && (
                  <span>{item.emoji}</span>
                )}
                {ageGroup === 'ages14to16' && item.icon && (
                  <span>{item.icon}</span>
                )}
                <span className="truncate max-w-[120px]">{item.label}</span>
              </span>
            </button>

            {!isLast && getSeparator()}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

// Wayfinding component for complex navigation
export interface WayfindingProps {
  showCurrentLocation?: boolean;
  showQuickActions?: boolean;
  showSearchSuggestions?: boolean;
  maxSuggestions?: number;
  className?: string;
}

export const Wayfinding: React.FC<WayfindingProps> = ({
  showCurrentLocation = true,
  showQuickActions = true,
  showSearchSuggestions = true,
  maxSuggestions = 3,
  className = ''
}) => {
  const { state, routes, searchRoutes, navigate, canGoBack, canGoForward, goBack, goForward } = useNavigation();
  const { ageGroup, navigation: navConfig } = useAgeAdaptive();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<any[]>([]);

  // Only show for advanced navigation
  if (navConfig.complexity !== 'advanced') {
    return null;
  }

  React.useEffect(() => {
    if (searchQuery.trim()) {
      const results = searchRoutes(searchQuery).slice(0, maxSuggestions);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchRoutes, maxSuggestions]);

  const quickActions = [
    {
      id: 'back',
      label: 'Back',
      icon: '←',
      action: goBack,
      disabled: !canGoBack,
      shortcut: 'Alt+←'
    },
    {
      id: 'forward',
      label: 'Forward',
      icon: '→',
      action: goForward,
      disabled: !canGoForward,
      shortcut: 'Alt+→'
    }
  ];

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Breadcrumbs */}
      <Breadcrumbs />

      {/* Current location */}
      {showCurrentLocation && state.currentRoute && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <span>📍</span>
            <span>You are in:</span>
          </span>
          <span className="font-medium text-gray-900">
            {state.currentRoute.label}
          </span>
          {state.currentRoute.description && (
            <span className="text-gray-500">
              — {state.currentRoute.description}
            </span>
          )}
        </div>
      )}

      {/* Quick actions */}
      {showQuickActions && (
        <div className="flex items-center gap-2">
          {quickActions.map(action => (
            <button
              key={action.id}
              className={`
                flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors
                ${action.disabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }
              `}
              onClick={action.action}
              disabled={action.disabled}
              title={`${action.label} (${action.shortcut})`}
            >
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search suggestions */}
      {showSearchSuggestions && (
        <div className="relative">
          <input
            type="text"
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />

          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10">
              {searchResults.map(route => (
                <button
                  key={route.id}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    navigate(route.id);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                >
                  <div className="flex items-center gap-2">
                    {route.icon && <span>{route.icon}</span>}
                    <span className="font-medium">{route.label}</span>
                  </div>
                  {route.description && (
                    <div className="text-xs text-gray-500 mt-1">
                      {route.description}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
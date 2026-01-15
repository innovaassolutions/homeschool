import React, { useState, useRef } from 'react';
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive';
import { useTouchGestures } from '../../hooks/useTouchGestures';
import { useInteractionStates } from '../../hooks/useInteractionStates';

export interface NavigationItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  emoji?: string;
  path?: string;
  onClick?: () => void;
  children?: NavigationItem[];
  badge?: string | number;
  disabled?: boolean;
  description?: string;
}

export interface AgeAdaptiveNavigationProps {
  items: NavigationItem[];
  currentPath?: string;
  onNavigate?: (item: NavigationItem) => void;
  orientation?: 'horizontal' | 'vertical';
  showBreadcrumbs?: boolean;
  maxDepth?: number;
  className?: string;
}

export const AgeAdaptiveNavigation: React.FC<AgeAdaptiveNavigationProps> = ({
  items,
  currentPath,
  onNavigate,
  orientation = 'horizontal',
  showBreadcrumbs = true,
  maxDepth,
  className = ''
}) => {
  const { ageGroup, navigation: navConfig } = useAgeAdaptive();
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [navigationHistory, setNavigationHistory] = useState<NavigationItem[]>([]);

  // Use age-specific navigation configuration
  const effectiveMaxDepth = maxDepth ?? navConfig.maxNavigationDepth;
  const shouldShowBreadcrumbs = showBreadcrumbs && navConfig.showBreadcrumbs;

  const handleItemClick = (item: NavigationItem) => {
    if (item.disabled) return;

    // Handle submenu toggle
    if (item.children && item.children.length > 0) {
      if (navConfig.complexity === 'simple') {
        // For simple navigation, don't use dropdowns - navigate directly or show children inline
        if (item.onClick) {
          item.onClick();
        }
        if (onNavigate) {
          onNavigate(item);
        }
      } else {
        setOpenSubmenu(openSubmenu === item.id ? null : item.id);
      }
    } else {
      // Handle regular navigation
      if (item.onClick) {
        item.onClick();
      }
      if (onNavigate) {
        onNavigate(item);
      }

      // Update navigation history for breadcrumbs
      if (shouldShowBreadcrumbs) {
        setNavigationHistory(prev => [...prev.slice(-effectiveMaxDepth + 1), item]);
      }

      // Close any open submenu
      setOpenSubmenu(null);
    }
  };

  const isItemActive = (item: NavigationItem): boolean => {
    return currentPath === item.path || item.id === currentPath;
  };

  const renderNavigationItem = (item: NavigationItem, depth: number = 0) => {
    const isActive = isItemActive(item);
    const hasSubmenu = item.children && item.children.length > 0;
    const isSubmenuOpen = openSubmenu === item.id;

    // Age-specific styling
    const getItemClasses = () => {
      const baseClasses = 'flex items-center gap-2 font-medium transition-all duration-200 focus:outline-none';

      switch (ageGroup) {
        case 'ages6to9':
          return `${baseClasses} text-lg px-6 py-4 rounded-2xl min-h-[60px] ${
            isActive
              ? 'bg-emerald-500 text-white shadow-lg scale-105'
              : 'bg-white/80 text-gray-700 hover:bg-white hover:shadow-md'
          } ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`;

        case 'ages10to13':
          return `${baseClasses} text-base px-4 py-3 rounded-lg min-h-[44px] ${
            isActive
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-700 hover:bg-gray-100 hover:shadow-sm'
          } ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`;

        case 'ages14to16':
          return `${baseClasses} text-sm px-3 py-2 rounded-md min-h-[36px] ${
            isActive
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          } ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`;

        default:
          return baseClasses;
      }
    };

    return (
      <div key={item.id} className="relative">
        <button
          className={getItemClasses()}
          onClick={() => handleItemClick(item)}
          disabled={item.disabled}
          title={item.description}
        >
          {/* Icon or Emoji */}
          {ageGroup === 'ages6to9' && item.emoji && (
            <span className="text-2xl">{item.emoji}</span>
          )}
          {ageGroup !== 'ages6to9' && item.icon && (
            <span className="flex-shrink-0">{item.icon}</span>
          )}

          {/* Label */}
          <span className={ageGroup === 'ages6to9' ? 'font-bold' : ''}>{item.label}</span>

          {/* Badge */}
          {item.badge && (
            <span className={`
              bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center ml-auto
              ${ageGroup === 'ages6to9' ? 'text-sm' : 'text-xs'}
            `}>
              {item.badge}
            </span>
          )}

          {/* Submenu indicator */}
          {hasSubmenu && navConfig.complexity !== 'simple' && (
            <span className={`transition-transform ${isSubmenuOpen ? 'rotate-180' : ''}`}>
              {ageGroup === 'ages6to9' ? '🔽' : '▼'}
            </span>
          )}
        </button>

        {/* Submenu */}
        {hasSubmenu && isSubmenuOpen && navConfig.complexity !== 'simple' && (
          <div className={`
            absolute z-10 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg
            ${orientation === 'vertical' ? 'left-full top-0 ml-1' : 'top-full left-0'}
            min-w-[200px]
          `}>
            <div className="py-1">
              {item.children!.map(child => (
                <button
                  key={child.id}
                  className={`
                    block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors
                    ${isItemActive(child) ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}
                    ${child.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  onClick={() => handleItemClick(child)}
                  disabled={child.disabled}
                >
                  <div className="flex items-center gap-2">
                    {child.icon && <span>{child.icon}</span>}
                    {child.emoji && <span>{child.emoji}</span>}
                    <span>{child.label}</span>
                    {child.badge && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 ml-auto">
                        {child.badge}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBreadcrumbs = () => {
    if (!shouldShowBreadcrumbs || navigationHistory.length === 0) return null;

    return (
      <nav className="mb-4" aria-label="Breadcrumb">
        <div className={`
          flex items-center space-x-2
          ${ageGroup === 'ages6to9' ? 'text-lg' : ageGroup === 'ages10to13' ? 'text-sm' : 'text-xs'}
        `}>
          <button
            className="text-gray-500 hover:text-gray-700 transition-colors"
            onClick={() => setNavigationHistory([])}
          >
            {ageGroup === 'ages6to9' ? '🏠 Home' : 'Home'}
          </button>

          {navigationHistory.map((item, index) => (
            <React.Fragment key={item.id}>
              <span className="text-gray-400">
                {ageGroup === 'ages6to9' ? '👉' : '›'}
              </span>
              <button
                className={`
                  transition-colors
                  ${index === navigationHistory.length - 1
                    ? 'text-blue-600 font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                  }
                `}
                onClick={() => {
                  setNavigationHistory(prev => prev.slice(0, index + 1));
                  handleItemClick(item);
                }}
              >
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      </nav>
    );
  };

  const containerClasses = `
    ${orientation === 'horizontal' ? 'flex flex-wrap gap-2' : 'flex flex-col gap-2'}
    ${ageGroup === 'ages6to9' ? 'p-4 bg-gradient-to-r from-purple-100 via-pink-100 to-blue-100 rounded-2xl' :
      ageGroup === 'ages10to13' ? 'p-3 bg-gray-50 rounded-lg' :
      'p-2 bg-gray-50/50 backdrop-blur-sm rounded-lg border border-gray-200/50'
    }
    ${className}
  `;

  return (
    <div>
      {renderBreadcrumbs()}
      <nav className={containerClasses} role="navigation">
        {items.map(item => renderNavigationItem(item))}
      </nav>
    </div>
  );
};

// Touch-friendly navigation for youngest users
export const SimpleNavigation: React.FC<{
  items: NavigationItem[];
  onNavigate?: (item: NavigationItem) => void;
  columns?: number;
}> = ({ items, onNavigate, columns = 2 }) => {
  const navigationRef = useRef<HTMLDivElement>(null);

  useTouchGestures(navigationRef, {
    onTap: () => {}, // Individual items handle their own taps
    onSwipeLeft: () => {
      // Could implement page navigation here
    },
    onSwipeRight: () => {
      // Could implement page navigation here
    }
  });

  return (
    <div
      ref={navigationRef}
      className={`
        grid gap-6 p-6 bg-gradient-to-br from-yellow-100 via-pink-100 to-blue-100 rounded-3xl
        grid-cols-${columns}
      `}
    >
      {items.map(item => (
        <button
          key={item.id}
          className="
            flex flex-col items-center gap-3 p-6 bg-white/90 rounded-2xl shadow-lg
            hover:shadow-xl hover:scale-105 active:scale-95
            transition-all duration-200 min-h-[120px]
          "
          onClick={() => {
            if (item.onClick) item.onClick();
            if (onNavigate) onNavigate(item);
          }}
          disabled={item.disabled}
        >
          {item.emoji && (
            <span className="text-4xl">{item.emoji}</span>
          )}
          <span className="text-xl font-bold text-gray-800 text-center">
            {item.label}
          </span>
          {item.description && (
            <span className="text-sm text-gray-600 text-center">
              {item.description}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};
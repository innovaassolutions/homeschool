import React from 'react';
import { AgeAdaptiveWrapper } from './AgeAdaptiveWrapper';

interface UIAges14to16Props {
  children: React.ReactNode;
  enableAdvancedFeatures?: boolean;
  showDetailedBreadcrumbs?: boolean;
  enableKeyboardShortcuts?: boolean;
}

export const UIAges14to16: React.FC<UIAges14to16Props> = ({
  children,
  enableAdvancedFeatures = true,
  showDetailedBreadcrumbs = true,
  enableKeyboardShortcuts = true
}) => {
  React.useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'k':
            e.preventDefault();
            console.log('Quick search triggered');
            break;
          case '/':
            e.preventDefault();
            console.log('Command palette triggered');
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyboardShortcuts);
    return () => document.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [enableKeyboardShortcuts]);

  return (
    <AgeAdaptiveWrapper overrideAgeGroup="ages14to16">
      <div className="ui-ages-14to16">
        {showDetailedBreadcrumbs && (
          <nav className="breadcrumb-nav mb-6">
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-gray-500 hover:text-indigo-600 cursor-pointer transition-colors">Home</span>
              <span className="text-gray-400">›</span>
              <span className="text-gray-500 hover:text-indigo-600 cursor-pointer transition-colors">Section</span>
              <span className="text-gray-400">›</span>
              <span className="text-indigo-600 font-medium">Current Page</span>
            </div>
          </nav>
        )}

        <div className="content-area">
          {children}
        </div>

        {enableKeyboardShortcuts && (
          <div className="fixed bottom-4 right-4 text-xs text-gray-400 bg-white/80 backdrop-blur-sm px-2 py-1 rounded border">
            Press ⌘K for search, ⌘/ for commands
          </div>
        )}
      </div>
    </AgeAdaptiveWrapper>
  );
};

export const Button14to16: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  tooltip?: string;
  shortcut?: string;
}> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  tooltip,
  shortcut
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500 shadow-sm hover:shadow',
    secondary: 'bg-slate-600 hover:bg-slate-700 text-white focus:ring-slate-500 shadow-sm hover:shadow',
    outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 focus:ring-indigo-500',
    ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-sm hover:shadow',
    success: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500 shadow-sm hover:shadow'
  };

  const sizeClasses = {
    xs: 'px-2 py-1 text-xs rounded min-h-[28px]',
    sm: 'px-3 py-1.5 text-sm rounded-md min-h-[32px]',
    md: 'px-4 py-2 text-sm rounded-md min-h-[36px]',
    lg: 'px-6 py-2.5 text-base rounded-lg min-h-[40px]'
  };

  const widthClasses = fullWidth ? 'w-full' : '';

  return (
    <div className="relative group">
      <button
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClasses}`}
        onClick={disabled || loading ? undefined : onClick}
        disabled={disabled || loading}
        title={tooltip}
      >
        {loading && (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        )}

        {icon && iconPosition === 'left' && !loading && (
          <span className="mr-2">{icon}</span>
        )}

        <span>{children}</span>

        {icon && iconPosition === 'right' && !loading && (
          <span className="ml-2">{icon}</span>
        )}

        {shortcut && (
          <span className="ml-2 text-xs opacity-70 bg-white/20 px-1.5 py-0.5 rounded">
            {shortcut}
          </span>
        )}
      </button>

      {tooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
          {tooltip}
          {shortcut && <span className="ml-2 text-gray-300">({shortcut})</span>}
        </div>
      )}
    </div>
  );
};

export const Card14to16: React.FC<{
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'elevated' | 'outlined' | 'filled';
  interactive?: boolean;
  selected?: boolean;
  metadata?: React.ReactNode;
}> = ({
  children,
  title,
  subtitle,
  icon,
  actions,
  onClick,
  variant = 'default',
  interactive = true,
  selected = false,
  metadata
}) => {
  const baseClasses = 'rounded-lg transition-all duration-200';

  const variantClasses = {
    default: 'bg-white border border-gray-200',
    elevated: 'bg-white shadow-sm hover:shadow-md border border-gray-100',
    outlined: 'bg-transparent border-2 border-gray-300',
    filled: 'bg-gray-50 border border-gray-200'
  };

  const interactiveClasses = interactive && onClick
    ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5'
    : '';

  const selectedClasses = selected
    ? 'ring-2 ring-indigo-500 shadow-lg border-indigo-200'
    : '';

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${interactiveClasses} ${selectedClasses} p-5`}
      onClick={onClick}
    >
      {(title || subtitle || icon || actions || metadata) && (
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {icon && (
              <div className="flex-shrink-0 mt-0.5 text-indigo-600">
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {title && (
                <h3 className="font-semibold text-gray-900 truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-sm text-gray-600 mt-1">
                  {subtitle}
                </p>
              )}
              {metadata && (
                <div className="mt-2 text-xs text-gray-500">
                  {metadata}
                </div>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex-shrink-0 ml-4">
              {actions}
            </div>
          )}
        </div>
      )}

      <div className="text-gray-700 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
};

export const Navigation14to16: React.FC<{
  items: Array<{
    label: string;
    icon?: React.ReactNode;
    active?: boolean;
    badge?: string | number;
    onClick?: () => void;
    shortcut?: string;
    submenu?: Array<{
      label: string;
      icon?: React.ReactNode;
      onClick?: () => void;
      shortcut?: string;
    }>;
  }>;
  orientation?: 'horizontal' | 'vertical';
  compact?: boolean;
  showShortcuts?: boolean;
}> = ({ items, orientation = 'horizontal', compact = false, showShortcuts = true }) => {
  const [openSubmenu, setOpenSubmenu] = React.useState<number | null>(null);

  const containerClasses = orientation === 'horizontal'
    ? `flex gap-1 ${compact ? 'p-1' : 'p-2'} bg-gray-50/50 backdrop-blur-sm rounded-lg border border-gray-200/50`
    : `flex flex-col gap-1 ${compact ? 'p-1' : 'p-2'} bg-gray-50/50 backdrop-blur-sm rounded-lg border border-gray-200/50 w-64`;

  return (
    <nav className={containerClasses}>
      {items.map((item, index) => (
        <div key={index} className="relative">
          <button
            className={`
              group flex items-center gap-2 font-medium text-sm transition-all duration-150 relative
              ${compact ? 'px-2 py-1.5 rounded-md' : 'px-3 py-2 rounded-md'}
              ${item.active
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-700 hover:bg-white hover:shadow-sm hover:text-gray-900'
              }
              ${orientation === 'vertical' ? 'w-full justify-start' : ''}
            `}
            onClick={() => {
              if (item.submenu) {
                setOpenSubmenu(openSubmenu === index ? null : index);
              } else {
                item.onClick?.();
              }
            }}
          >
            {item.icon && (
              <span className={compact ? 'text-sm' : ''}>
                {item.icon}
              </span>
            )}
            <span className={compact ? 'text-xs' : ''}>{item.label}</span>

            {item.badge && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[18px] text-center">
                {item.badge}
              </span>
            )}

            {showShortcuts && item.shortcut && !item.active && (
              <span className="ml-auto text-xs opacity-0 group-hover:opacity-70 bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded transition-opacity">
                {item.shortcut}
              </span>
            )}

            {item.submenu && (
              <span className={`ml-1 text-xs transition-transform ${openSubmenu === index ? 'rotate-180' : ''}`}>
                ▼
              </span>
            )}
          </button>

          {item.submenu && openSubmenu === index && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[180px] py-1">
              {item.submenu.map((subItem, subIndex) => (
                <button
                  key={subIndex}
                  className="flex items-center justify-between w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors group"
                  onClick={() => {
                    subItem.onClick?.();
                    setOpenSubmenu(null);
                  }}
                >
                  <div className="flex items-center gap-2">
                    {subItem.icon && <span className="text-gray-500">{subItem.icon}</span>}
                    <span>{subItem.label}</span>
                  </div>
                  {showShortcuts && subItem.shortcut && (
                    <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {subItem.shortcut}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
};

export const ProgressIndicator14to16: React.FC<{
  currentStep: number;
  totalSteps: number;
  labels?: string[];
  showPercentage?: boolean;
  showDetails?: boolean;
  variant?: 'minimal' | 'detailed' | 'stepper';
  size?: 'sm' | 'md' | 'lg';
}> = ({
  currentStep,
  totalSteps,
  labels,
  showPercentage = true,
  showDetails = true,
  variant = 'detailed',
  size = 'md'
}) => {
  const percentage = (currentStep / totalSteps) * 100;

  const sizeClasses = {
    sm: { bar: 'h-2', step: 'w-6 h-6 text-xs', text: 'text-xs' },
    md: { bar: 'h-3', step: 'w-8 h-8 text-sm', text: 'text-sm' },
    lg: { bar: 'h-4', step: 'w-10 h-10 text-base', text: 'text-base' }
  };

  if (variant === 'minimal') {
    return (
      <div className="w-full">
        <div className={`w-full bg-gray-200 rounded-full ${sizeClasses[size].bar} overflow-hidden`}>
          <div
            className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        {showPercentage && (
          <div className={`text-right mt-1 ${sizeClasses[size].text} text-gray-600 font-medium`}>
            {Math.round(percentage)}%
          </div>
        )}
      </div>
    );
  }

  if (variant === 'stepper') {
    return (
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isPending = index > currentStep;

          return (
            <div key={index} className="flex items-center">
              <div
                className={`
                  ${sizeClasses[size].step} rounded-full flex items-center justify-center font-medium transition-all duration-200
                  ${isCompleted
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isCurrent
                    ? 'bg-indigo-100 text-indigo-600 border-2 border-indigo-600'
                    : 'bg-gray-200 text-gray-400 border-2 border-gray-200'
                  }
                `}
              >
                {isCompleted ? '✓' : index + 1}
              </div>
              {index < totalSteps - 1 && (
                <div
                  className={`w-8 h-0.5 mx-1 transition-colors duration-200 ${
                    isCompleted ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}

        {showDetails && (
          <div className={`ml-3 ${sizeClasses[size].text} text-gray-600`}>
            <span className="font-medium">{currentStep}</span> of {totalSteps}
            {showPercentage && (
              <span className="text-gray-400 ml-2">({Math.round(percentage)}%)</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {showDetails && (
        <div className="flex justify-between items-center">
          <span className={`${sizeClasses[size].text} font-medium text-gray-900`}>
            Progress
          </span>
          <div className={`${sizeClasses[size].text} text-gray-600`}>
            <span className="font-medium">{currentStep}</span>/{totalSteps}
            {showPercentage && (
              <span className="ml-2 text-gray-500">({Math.round(percentage)}%)</span>
            )}
          </div>
        </div>
      )}

      <div className={`w-full bg-gray-200 rounded-full ${sizeClasses[size].bar} overflow-hidden`}>
        <div
          className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-500 ease-out relative"
          style={{ width: `${percentage}%` }}
        >
          <div className="absolute inset-0 bg-white/20 animate-pulse" />
        </div>
      </div>

      {labels && labels.length >= 2 && (
        <div className="flex justify-between text-xs text-gray-500">
          <span>{labels[0]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
};
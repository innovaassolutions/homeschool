import React from 'react';
import { AgeAdaptiveWrapper } from './AgeAdaptiveWrapper';

interface UIAges10to13Props {
  children: React.ReactNode;
  showBreadcrumbs?: boolean;
  enableTooltips?: boolean;
}

export const UIAges10to13: React.FC<UIAges10to13Props> = ({
  children,
  showBreadcrumbs = true,
  enableTooltips = true
}) => {
  return (
    <AgeAdaptiveWrapper overrideAgeGroup="ages10to13">
      <div className="ui-ages-10to13">
        {showBreadcrumbs && (
          <nav className="breadcrumb-nav mb-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span className="hover:text-blue-600 cursor-pointer">Home</span>
              <span>›</span>
              <span className="text-blue-600 font-medium">Current Page</span>
            </div>
          </nav>
        )}

        <div className="content-area">
          {children}
        </div>
      </div>
    </AgeAdaptiveWrapper>
  );
};

export const Button10to13: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'normal' | 'large';
  disabled?: boolean;
  icon?: React.ReactNode;
  tooltip?: string;
  loading?: boolean;
}> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'normal',
  disabled = false,
  icon,
  tooltip,
  loading = false
}) => {
  const baseClasses = 'age-adaptive-button font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 shadow-sm hover:shadow-md',
    secondary: 'bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-500 shadow-sm hover:shadow-md',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500',
    ghost: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-500'
  };

  const sizeClasses = {
    small: 'text-sm px-3 py-2 min-h-[36px] min-w-[80px]',
    normal: 'text-base px-4 py-2.5 min-h-[44px] min-w-[100px]',
    large: 'text-lg px-6 py-3 min-h-[48px] min-w-[120px]'
  };

  const disabledClasses = disabled || loading ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <div className="relative group">
      <button
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses}`}
        onClick={disabled || loading ? undefined : onClick}
        disabled={disabled || loading}
        title={tooltip}
      >
        <span className="flex items-center justify-center gap-2">
          {loading ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            icon && <span>{icon}</span>
          )}
          <span>{children}</span>
        </span>
      </button>

      {tooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
          {tooltip}
        </div>
      )}
    </div>
  );
};

export const Card10to13: React.FC<{
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  onClick?: () => void;
  hoverable?: boolean;
  selected?: boolean;
}> = ({
  children,
  title,
  subtitle,
  icon,
  actions,
  onClick,
  hoverable = true,
  selected = false
}) => {
  const clickableClasses = onClick ? 'cursor-pointer' : '';
  const hoverClasses = hoverable ? 'hover:shadow-lg hover:-translate-y-1' : '';
  const selectedClasses = selected ? 'ring-2 ring-blue-500 shadow-lg' : '';

  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm transition-all duration-200 ${clickableClasses} ${hoverClasses} ${selectedClasses}`}
      onClick={onClick}
    >
      {(title || icon || actions) && (
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {icon && <div className="text-blue-600">{icon}</div>}
            <div>
              {title && <h3 className="font-semibold text-gray-900">{title}</h3>}
              {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}

      <div className="text-gray-700">
        {children}
      </div>
    </div>
  );
};

export const Navigation10to13: React.FC<{
  items: Array<{
    label: string;
    icon?: React.ReactNode;
    active?: boolean;
    badge?: string | number;
    onClick?: () => void;
    submenu?: Array<{
      label: string;
      onClick?: () => void;
    }>;
  }>;
  orientation?: 'horizontal' | 'vertical';
}> = ({ items, orientation = 'horizontal' }) => {
  const [openSubmenu, setOpenSubmenu] = React.useState<number | null>(null);

  const containerClasses = orientation === 'horizontal'
    ? 'flex flex-wrap gap-1 p-2 bg-gray-50 rounded-lg'
    : 'flex flex-col gap-1 p-2 bg-gray-50 rounded-lg w-64';

  return (
    <nav className={containerClasses}>
      {items.map((item, index) => (
        <div key={index} className="relative">
          <button
            className={`
              flex items-center gap-2 px-3 py-2 rounded-md font-medium text-sm transition-all duration-150
              ${item.active
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-700 hover:bg-white hover:shadow-sm'
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
            {item.icon && <span>{item.icon}</span>}
            <span>{item.label}</span>
            {item.badge && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                {item.badge}
              </span>
            )}
            {item.submenu && (
              <span className={`ml-1 transition-transform ${openSubmenu === index ? 'rotate-180' : ''}`}>
                ▼
              </span>
            )}
          </button>

          {item.submenu && openSubmenu === index && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[160px]">
              {item.submenu.map((subItem, subIndex) => (
                <button
                  key={subIndex}
                  className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-md last:rounded-b-md"
                  onClick={() => {
                    subItem.onClick?.();
                    setOpenSubmenu(null);
                  }}
                >
                  {subItem.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
};

export const ProgressIndicator10to13: React.FC<{
  currentStep: number;
  totalSteps: number;
  labels?: string[];
  showPercentage?: boolean;
  variant?: 'bar' | 'steps' | 'circular';
}> = ({ currentStep, totalSteps, labels, showPercentage = true, variant = 'bar' }) => {
  const percentage = (currentStep / totalSteps) * 100;

  if (variant === 'steps') {
    return (
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, index) => (
          <div key={index} className="flex items-center">
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors duration-200
                ${index < currentStep
                  ? 'bg-blue-600 text-white'
                  : index === currentStep
                  ? 'bg-blue-100 text-blue-600 border-2 border-blue-600'
                  : 'bg-gray-200 text-gray-500'
                }
              `}
            >
              {index + 1}
            </div>
            {index < totalSteps - 1 && (
              <div
                className={`w-8 h-1 mx-1 transition-colors duration-200 ${
                  index < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
        {showPercentage && (
          <span className="ml-2 text-sm font-medium text-gray-600">
            {Math.round(percentage)}%
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700">Progress</span>
        {showPercentage && (
          <span className="text-sm font-medium text-gray-600">
            {Math.round(percentage)}%
          </span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {labels && (
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>{labels[0]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
};
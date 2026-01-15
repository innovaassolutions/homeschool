import React from 'react';
import { AgeAdaptiveWrapper } from './AgeAdaptiveWrapper';

interface UIAges6to9Props {
  children: React.ReactNode;
  showVisualCues?: boolean;
  enableSounds?: boolean;
}

export const UIAges6to9: React.FC<UIAges6to9Props> = ({
  children,
  showVisualCues = true,
  enableSounds = true
}) => {
  return (
    <AgeAdaptiveWrapper overrideAgeGroup="ages6to9">
      <div className="ui-ages-6to9">
        {showVisualCues && (
          <div className="visual-cues">
            <div className="fun-border">
              🌟 Welcome to Learning! 🌟
            </div>
          </div>
        )}

        <div className="content-area">
          {children}
        </div>

        {showVisualCues && (
          <div className="bottom-decoration">
            <div className="emoji-trail">
              🎨 📚 🎯 🌈 ⭐ 🎪
            </div>
          </div>
        )}
      </div>
    </AgeAdaptiveWrapper>
  );
};

export const Button6to9: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'success';
  size?: 'normal' | 'large';
  disabled?: boolean;
  emoji?: string;
}> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'normal',
  disabled = false,
  emoji
}) => {
  const baseClasses = 'age-adaptive-button font-bold rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl active:scale-95 focus:outline-none focus:ring-4';

  const variantClasses = {
    primary: 'bg-emerald-500 hover:bg-emerald-600 text-white focus:ring-emerald-300',
    secondary: 'bg-amber-500 hover:bg-amber-600 text-white focus:ring-amber-300',
    success: 'bg-pink-500 hover:bg-pink-600 text-white focus:ring-pink-300'
  };

  const sizeClasses = {
    normal: 'text-xl px-8 py-4 min-h-[60px] min-w-[120px]',
    large: 'text-2xl px-12 py-6 min-h-[80px] min-w-[160px]'
  };

  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed hover:scale-100 active:scale-100' : '';

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <span className="flex items-center justify-center gap-3">
        {emoji && <span className="text-2xl">{emoji}</span>}
        <span>{children}</span>
      </span>
    </button>
  );
};

export const Card6to9: React.FC<{
  children: React.ReactNode;
  title?: string;
  emoji?: string;
  color?: 'green' | 'blue' | 'purple' | 'pink' | 'yellow';
  onClick?: () => void;
}> = ({
  children,
  title,
  emoji,
  color = 'green',
  onClick
}) => {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 hover:bg-green-100',
    blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    purple: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
    pink: 'bg-pink-50 border-pink-200 hover:bg-pink-100',
    yellow: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
  };

  const clickableClasses = onClick ? 'cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-[0.98]' : '';

  return (
    <div
      className={`rounded-3xl border-4 p-6 shadow-md ${colorClasses[color]} ${clickableClasses}`}
      onClick={onClick}
    >
      {(title || emoji) && (
        <div className="flex items-center gap-3 mb-4">
          {emoji && <span className="text-3xl">{emoji}</span>}
          {title && <h3 className="text-2xl font-bold text-gray-800">{title}</h3>}
        </div>
      )}
      <div className="text-lg leading-relaxed">
        {children}
      </div>
    </div>
  );
};

export const Navigation6to9: React.FC<{
  items: Array<{
    label: string;
    emoji?: string;
    active?: boolean;
    onClick?: () => void;
  }>;
}> = ({ items }) => {
  return (
    <nav className="flex flex-wrap gap-4 p-4 bg-gradient-to-r from-purple-100 via-pink-100 to-blue-100 rounded-2xl">
      {items.map((item, index) => (
        <button
          key={index}
          className={`
            flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-lg transition-all duration-200
            ${item.active
              ? 'bg-white shadow-lg text-purple-600 scale-105'
              : 'bg-white/70 hover:bg-white hover:shadow-md text-gray-700 hover:scale-102'
            }
          `}
          onClick={item.onClick}
        >
          {item.emoji && <span className="text-xl">{item.emoji}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

export const ProgressIndicator6to9: React.FC<{
  currentStep: number;
  totalSteps: number;
  labels?: string[];
}> = ({ currentStep, totalSteps, labels }) => {
  return (
    <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden shadow-inner">
      <div
        className="bg-gradient-to-r from-green-400 to-blue-500 h-full rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-2"
        style={{ width: `${(currentStep / totalSteps) * 100}%` }}
      >
        <span className="text-white font-bold text-sm">
          {Math.round((currentStep / totalSteps) * 100)}%
        </span>
      </div>
    </div>
  );
};
import React, { useEffect } from 'react';
import { useAgeAdaptive, AgeGroup } from '../../hooks/useAgeAdaptive';

interface AgeAdaptiveWrapperProps {
  children: React.ReactNode;
  overrideAgeGroup?: AgeGroup;
  className?: string;
}

export const AgeAdaptiveWrapper: React.FC<AgeAdaptiveWrapperProps> = ({
  children,
  overrideAgeGroup,
  className = ''
}) => {
  const { ageGroup, theme } = useAgeAdaptive(overrideAgeGroup);

  useEffect(() => {
    const root = document.documentElement;

    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    Object.entries(theme.typography.fontSize).forEach(([key, value]) => {
      root.style.setProperty(`--font-size-${key}`, value);
    });

    Object.entries(theme.typography.fontWeight).forEach(([key, value]) => {
      root.style.setProperty(`--font-weight-${key}`, value);
    });

    Object.entries(theme.spacing).forEach(([key, value]) => {
      const cssKey = key
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase();
      root.style.setProperty(`--${cssKey}`, value);
    });

    Object.entries(theme.layout).forEach(([key, value]) => {
      const cssKey = key
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase();
      root.style.setProperty(`--${cssKey}`, value);
    });

    const ageGroupClass = `age-theme-${ageGroup.replace('ages', '').replace('to', 'to')}`;
    document.body.className = document.body.className
      .replace(/age-theme-\w+/g, '')
      .trim();
    document.body.classList.add(ageGroupClass);

    return () => {
      document.body.classList.remove(ageGroupClass);
    };
  }, [ageGroup, theme]);

  const combinedClassName = `age-adaptive-container ${className}`.trim();

  return (
    <div className={combinedClassName}>
      {children}
    </div>
  );
};
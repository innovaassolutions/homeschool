import { useEffect, useState, useCallback } from 'react';
import { useAgeAdaptive } from './useAgeAdaptive';

export interface InteractionStatesConfig {
  enableHover?: boolean;
  enableFocus?: boolean;
  enableActive?: boolean;
  hoverDelay?: number;
  focusVisible?: boolean;
}

export interface InteractionStates {
  isHovered: boolean;
  isFocused: boolean;
  isActive: boolean;
  isPressed: boolean;
  isTouchDevice: boolean;
  shouldShowHover: boolean;
}

export const useInteractionStates = (
  elementRef: React.RefObject<HTMLElement>,
  config: InteractionStatesConfig = {}
): InteractionStates => {
  const { interactions } = useAgeAdaptive();
  const [states, setStates] = useState<InteractionStates>({
    isHovered: false,
    isFocused: false,
    isActive: false,
    isPressed: false,
    isTouchDevice: false,
    shouldShowHover: false
  });

  const {
    enableHover = true,
    enableFocus = true,
    enableActive = true,
    hoverDelay = 0,
    focusVisible = true
  } = config;

  // Detect if device supports touch
  useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setStates(prev => ({ ...prev, isTouchDevice }));
  }, []);

  // Determine if hover states should be shown based on age group and device
  const shouldShowHoverStates = useCallback(() => {
    // Ages 6-9: No hover states to avoid confusion
    if (!interactions.showHoverStates) {
      return false;
    }

    // On touch devices, be more conservative with hover states
    if (states.isTouchDevice) {
      // Ages 14-16: Show subtle hover states even on touch devices
      return interactions.enableAdvancedGestures;
    }

    // On desktop, show hover states for ages 10+
    return enableHover;
  }, [interactions.showHoverStates, interactions.enableAdvancedGestures, states.isTouchDevice, enableHover]);

  // Mouse event handlers
  const handleMouseEnter = useCallback(() => {
    if (!shouldShowHoverStates()) return;

    if (hoverDelay > 0) {
      setTimeout(() => {
        setStates(prev => ({
          ...prev,
          isHovered: true,
          shouldShowHover: true
        }));
      }, hoverDelay);
    } else {
      setStates(prev => ({
        ...prev,
        isHovered: true,
        shouldShowHover: true
      }));
    }
  }, [shouldShowHoverStates, hoverDelay]);

  const handleMouseLeave = useCallback(() => {
    setStates(prev => ({
      ...prev,
      isHovered: false,
      shouldShowHover: false
    }));
  }, []);

  const handleMouseDown = useCallback(() => {
    if (!enableActive) return;

    setStates(prev => ({
      ...prev,
      isActive: true,
      isPressed: true
    }));
  }, [enableActive]);

  const handleMouseUp = useCallback(() => {
    setStates(prev => ({
      ...prev,
      isActive: false,
      isPressed: false
    }));
  }, []);

  // Focus event handlers
  const handleFocus = useCallback(() => {
    if (!enableFocus) return;

    setStates(prev => ({
      ...prev,
      isFocused: true
    }));
  }, [enableFocus]);

  const handleBlur = useCallback(() => {
    setStates(prev => ({
      ...prev,
      isFocused: false
    }));
  }, []);

  // Touch event handlers for touch devices
  const handleTouchStart = useCallback(() => {
    setStates(prev => ({
      ...prev,
      isActive: true,
      isPressed: true
    }));
  }, []);

  const handleTouchEnd = useCallback(() => {
    setStates(prev => ({
      ...prev,
      isActive: false,
      isPressed: false
    }));
  }, []);

  // Keyboard handlers for accessibility
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      setStates(prev => ({
        ...prev,
        isActive: true,
        isPressed: true
      }));
    }
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      setStates(prev => ({
        ...prev,
        isActive: false,
        isPressed: false
      }));
    }
  }, []);

  // Set up event listeners
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Mouse events
    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);
    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('mouseup', handleMouseUp);

    // Focus events
    element.addEventListener('focus', handleFocus);
    element.addEventListener('blur', handleBlur);

    // Touch events
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Keyboard events
    element.addEventListener('keydown', handleKeyDown);
    element.addEventListener('keyup', handleKeyUp);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      element.removeEventListener('mousedown', handleMouseDown);
      element.removeEventListener('mouseup', handleMouseUp);
      element.removeEventListener('focus', handleFocus);
      element.removeEventListener('blur', handleBlur);
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('keydown', handleKeyDown);
      element.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    elementRef,
    handleMouseEnter,
    handleMouseLeave,
    handleMouseDown,
    handleMouseUp,
    handleFocus,
    handleBlur,
    handleTouchStart,
    handleTouchEnd,
    handleKeyDown,
    handleKeyUp
  ]);

  // Update shouldShowHover when dependencies change
  useEffect(() => {
    setStates(prev => ({
      ...prev,
      shouldShowHover: prev.isHovered && shouldShowHoverStates()
    }));
  }, [shouldShowHoverStates]);

  return states;
};

// Utility function to generate age-appropriate CSS classes
export const getInteractionClasses = (
  states: InteractionStates,
  baseClasses: string = '',
  options: {
    hoverClasses?: string;
    focusClasses?: string;
    activeClasses?: string;
    disabledClasses?: string;
  } = {}
): string => {
  const {
    hoverClasses = 'hover:shadow-md hover:scale-105',
    focusClasses = 'focus:outline-none focus:ring-2 focus:ring-blue-500',
    activeClasses = 'active:scale-95',
    disabledClasses = 'disabled:opacity-50 disabled:cursor-not-allowed'
  } = options;

  let classes = baseClasses;

  // Only add hover classes if they should be shown
  if (states.shouldShowHover) {
    classes += ` ${hoverClasses}`;
  }

  if (states.isFocused) {
    classes += ` ${focusClasses}`;
  }

  if (states.isActive) {
    classes += ` ${activeClasses}`;
  }

  return classes.trim();
};
import { useEffect, useRef, useCallback } from 'react';
import { useAgeAdaptive } from './useAgeAdaptive';

export interface TouchGestureConfig {
  onTap?: (event: TouchEvent) => void;
  onDoubleTap?: (event: TouchEvent) => void;
  onLongPress?: (event: TouchEvent) => void;
  onSwipeLeft?: (event: TouchEvent) => void;
  onSwipeRight?: (event: TouchEvent) => void;
  onSwipeUp?: (event: TouchEvent) => void;
  onSwipeDown?: (event: TouchEvent) => void;
  onPinch?: (event: TouchEvent, scale: number) => void;
  longPressDelay?: number;
  swipeThreshold?: number;
  doubleTapDelay?: number;
}

interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

export const useTouchGestures = (
  elementRef: React.RefObject<HTMLElement>,
  config: TouchGestureConfig
) => {
  const { interactions } = useAgeAdaptive();
  const touchStartRef = useRef<TouchPoint | null>(null);
  const lastTapRef = useRef<TouchPoint | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialPinchDistanceRef = useRef<number | null>(null);

  const {
    onTap,
    onDoubleTap,
    onLongPress,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onPinch,
    longPressDelay = 800,
    swipeThreshold = 50,
    doubleTapDelay = 300
  } = config;

  const getDistance = useCallback((touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    const touch = event.touches[0];
    const now = Date.now();

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: now
    };

    // Handle pinch gestures for advanced age groups
    if (interactions.enableAdvancedGestures && event.touches.length === 2) {
      event.preventDefault();
      initialPinchDistanceRef.current = getDistance(event.touches[0], event.touches[1]);
      return;
    }

    // Set up long press timer
    if (onLongPress) {
      clearLongPressTimer();
      longPressTimerRef.current = setTimeout(() => {
        onLongPress(event);
        touchStartRef.current = null; // Prevent other gestures
      }, longPressDelay);
    }
  }, [interactions.enableAdvancedGestures, onLongPress, longPressDelay, clearLongPressTimer, getDistance]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    // Handle pinch gestures for advanced age groups
    if (interactions.enableAdvancedGestures && event.touches.length === 2 && initialPinchDistanceRef.current && onPinch) {
      event.preventDefault();
      const currentDistance = getDistance(event.touches[0], event.touches[1]);
      const scale = currentDistance / initialPinchDistanceRef.current;
      onPinch(event, scale);
      return;
    }

    // Cancel long press if user moves finger
    if (touchStartRef.current) {
      const touch = event.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

      if (deltaX > 10 || deltaY > 10) {
        clearLongPressTimer();
      }
    }
  }, [interactions.enableAdvancedGestures, onPinch, getDistance, clearLongPressTimer]);

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    clearLongPressTimer();

    // Reset pinch state
    if (event.touches.length === 0) {
      initialPinchDistanceRef.current = null;
    }

    if (!touchStartRef.current) return;

    const touch = event.changedTouches[0];
    const now = Date.now();
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = now - touchStartRef.current.timestamp;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Check for swipe gestures
    if (distance > swipeThreshold && deltaTime < 500) {
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      if (absDeltaX > absDeltaY) {
        // Horizontal swipe
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight(event);
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft(event);
        }
      } else {
        // Vertical swipe
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown(event);
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp(event);
        }
      }
      touchStartRef.current = null;
      return;
    }

    // Check for tap gestures (if movement is minimal)
    if (distance < 10 && deltaTime < 500) {
      const currentTap: TouchPoint = {
        x: touch.clientX,
        y: touch.clientY,
        timestamp: now
      };

      // Check for double tap
      if (lastTapRef.current && onDoubleTap) {
        const timeSinceLastTap = now - lastTapRef.current.timestamp;
        const distanceFromLastTap = Math.sqrt(
          Math.pow(currentTap.x - lastTapRef.current.x, 2) +
          Math.pow(currentTap.y - lastTapRef.current.y, 2)
        );

        if (timeSinceLastTap < doubleTapDelay && distanceFromLastTap < 50) {
          onDoubleTap(event);
          lastTapRef.current = null;
          touchStartRef.current = null;
          return;
        }
      }

      // Store tap for potential double tap
      lastTapRef.current = currentTap;

      // Trigger single tap after delay to allow for double tap
      setTimeout(() => {
        if (lastTapRef.current === currentTap && onTap) {
          onTap(event);
        }
      }, doubleTapDelay);
    }

    touchStartRef.current = null;
  }, [onTap, onDoubleTap, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, swipeThreshold, doubleTapDelay, clearLongPressTimer]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Add touch event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      clearLongPressTimer();
    };
  }, [elementRef, handleTouchStart, handleTouchMove, handleTouchEnd, clearLongPressTimer]);

  return {
    isAdvancedGesturesEnabled: interactions.enableAdvancedGestures,
    touchSupported: 'ontouchstart' in window
  };
};
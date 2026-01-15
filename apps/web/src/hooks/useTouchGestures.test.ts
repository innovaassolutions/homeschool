import { renderHook } from '@testing-library/react';
import { useTouchGestures } from './useTouchGestures';
import { useAgeAdaptive } from './useAgeAdaptive';

jest.mock('./useAgeAdaptive');

const mockUseAgeAdaptive = useAgeAdaptive as jest.MockedFunction<typeof useAgeAdaptive>;

// Mock touch events
class MockTouchEvent {
  touches: Touch[];
  changedTouches: Touch[];
  type: string;
  preventDefault = jest.fn();

  constructor(type: string, touches: Touch[] = [], changedTouches: Touch[] = []) {
    this.type = type;
    this.touches = touches;
    this.changedTouches = changedTouches;
  }
}

// Mock Touch interface
const createMockTouch = (clientX: number, clientY: number): Touch => ({
  clientX,
  clientY,
  identifier: 0,
  pageX: clientX,
  pageY: clientY,
  radiusX: 1,
  radiusY: 1,
  rotationAngle: 0,
  screenX: clientX,
  screenY: clientY,
  target: document.createElement('div'),
  force: 1
});

describe('useTouchGestures', () => {
  let mockElement: HTMLDivElement;
  let mockRef: React.RefObject<HTMLDivElement>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockElement = document.createElement('div');
    mockRef = { current: mockElement };

    // Mock addEventListener/removeEventListener
    jest.spyOn(mockElement, 'addEventListener');
    jest.spyOn(mockElement, 'removeEventListener');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic Setup', () => {
    it('should set up touch event listeners', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      renderHook(() => useTouchGestures(mockRef, {}));

      expect(mockElement.addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: false });
      expect(mockElement.addEventListener).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: false });
      expect(mockElement.addEventListener).toHaveBeenCalledWith('touchend', expect.any(Function), { passive: false });
    });

    it('should clean up event listeners on unmount', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { unmount } = renderHook(() => useTouchGestures(mockRef, {}));

      unmount();

      expect(mockElement.removeEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith('touchmove', expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith('touchend', expect.any(Function));
    });

    it('should return touch support information', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages14to16',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: true, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() => useTouchGestures(mockRef, {}));

      expect(result.current.isAdvancedGesturesEnabled).toBe(true);
      expect(typeof result.current.touchSupported).toBe('boolean');
    });
  });

  describe('Tap Gestures', () => {
    it('should trigger onTap for simple tap', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages6to9',
        theme: {} as any,
        interactions: { showHoverStates: false, enableAdvancedGestures: false, animationDuration: '300ms' },
        navigation: {} as any
      });

      const onTap = jest.fn();
      renderHook(() => useTouchGestures(mockRef, { onTap }));

      const touch = createMockTouch(100, 100);

      // Simulate touchstart
      const touchStartEvent = new MockTouchEvent('touchstart', [touch]);
      mockElement.dispatchEvent(touchStartEvent as any);

      // Simulate touchend at same position
      const touchEndEvent = new MockTouchEvent('touchend', [], [touch]);
      mockElement.dispatchEvent(touchEndEvent as any);

      jest.advanceTimersByTime(300); // Wait for double tap delay

      expect(onTap).toHaveBeenCalledWith(touchEndEvent);
    });

    it('should trigger onDoubleTap for quick successive taps', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const onDoubleTap = jest.fn();
      renderHook(() => useTouchGestures(mockRef, { onDoubleTap }));

      const touch = createMockTouch(100, 100);

      // First tap
      const touchStartEvent1 = new MockTouchEvent('touchstart', [touch]);
      mockElement.dispatchEvent(touchStartEvent1 as any);
      const touchEndEvent1 = new MockTouchEvent('touchend', [], [touch]);
      mockElement.dispatchEvent(touchEndEvent1 as any);

      jest.advanceTimersByTime(100); // Short delay

      // Second tap
      const touchStartEvent2 = new MockTouchEvent('touchstart', [touch]);
      mockElement.dispatchEvent(touchStartEvent2 as any);
      const touchEndEvent2 = new MockTouchEvent('touchend', [], [touch]);
      mockElement.dispatchEvent(touchEndEvent2 as any);

      expect(onDoubleTap).toHaveBeenCalledWith(touchEndEvent2);
    });

    it('should trigger onLongPress after delay', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages6to9',
        theme: {} as any,
        interactions: { showHoverStates: false, enableAdvancedGestures: false, animationDuration: '300ms' },
        navigation: {} as any
      });

      const onLongPress = jest.fn();
      renderHook(() => useTouchGestures(mockRef, { onLongPress, longPressDelay: 500 }));

      const touch = createMockTouch(100, 100);

      // Simulate touchstart
      const touchStartEvent = new MockTouchEvent('touchstart', [touch]);
      mockElement.dispatchEvent(touchStartEvent as any);

      // Advance time to trigger long press
      jest.advanceTimersByTime(500);

      expect(onLongPress).toHaveBeenCalledWith(touchStartEvent);
    });
  });

  describe('Swipe Gestures', () => {
    it('should trigger onSwipeRight for right swipe', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const onSwipeRight = jest.fn();
      renderHook(() => useTouchGestures(mockRef, { onSwipeRight, swipeThreshold: 50 }));

      const startTouch = createMockTouch(100, 100);
      const endTouch = createMockTouch(200, 100); // 100px right

      // Simulate touchstart
      const touchStartEvent = new MockTouchEvent('touchstart', [startTouch]);
      mockElement.dispatchEvent(touchStartEvent as any);

      // Simulate touchend
      const touchEndEvent = new MockTouchEvent('touchend', [], [endTouch]);
      mockElement.dispatchEvent(touchEndEvent as any);

      expect(onSwipeRight).toHaveBeenCalledWith(touchEndEvent);
    });

    it('should trigger onSwipeLeft for left swipe', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const onSwipeLeft = jest.fn();
      renderHook(() => useTouchGestures(mockRef, { onSwipeLeft, swipeThreshold: 50 }));

      const startTouch = createMockTouch(200, 100);
      const endTouch = createMockTouch(100, 100); // 100px left

      // Simulate touchstart
      const touchStartEvent = new MockTouchEvent('touchstart', [startTouch]);
      mockElement.dispatchEvent(touchStartEvent as any);

      // Simulate touchend
      const touchEndEvent = new MockTouchEvent('touchend', [], [endTouch]);
      mockElement.dispatchEvent(touchEndEvent as any);

      expect(onSwipeLeft).toHaveBeenCalledWith(touchEndEvent);
    });

    it('should trigger onSwipeUp for upward swipe', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const onSwipeUp = jest.fn();
      renderHook(() => useTouchGestures(mockRef, { onSwipeUp, swipeThreshold: 50 }));

      const startTouch = createMockTouch(100, 200);
      const endTouch = createMockTouch(100, 100); // 100px up

      // Simulate touchstart
      const touchStartEvent = new MockTouchEvent('touchstart', [startTouch]);
      mockElement.dispatchEvent(touchStartEvent as any);

      // Simulate touchend
      const touchEndEvent = new MockTouchEvent('touchend', [], [endTouch]);
      mockElement.dispatchEvent(touchEndEvent as any);

      expect(onSwipeUp).toHaveBeenCalledWith(touchEndEvent);
    });

    it('should trigger onSwipeDown for downward swipe', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const onSwipeDown = jest.fn();
      renderHook(() => useTouchGestures(mockRef, { onSwipeDown, swipeThreshold: 50 }));

      const startTouch = createMockTouch(100, 100);
      const endTouch = createMockTouch(100, 200); // 100px down

      // Simulate touchstart
      const touchStartEvent = new MockTouchEvent('touchstart', [startTouch]);
      mockElement.dispatchEvent(touchStartEvent as any);

      // Simulate touchend
      const touchEndEvent = new MockTouchEvent('touchend', [], [endTouch]);
      mockElement.dispatchEvent(touchEndEvent as any);

      expect(onSwipeDown).toHaveBeenCalledWith(touchEndEvent);
    });
  });

  describe('Pinch Gestures', () => {
    it('should trigger onPinch for two-finger gestures when advanced gestures enabled', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages14to16',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: true, animationDuration: '200ms' },
        navigation: {} as any
      });

      const onPinch = jest.fn();
      renderHook(() => useTouchGestures(mockRef, { onPinch }));

      const touch1Start = createMockTouch(100, 100);
      const touch2Start = createMockTouch(200, 100); // 100px apart
      const touch1Move = createMockTouch(50, 100);
      const touch2Move = createMockTouch(250, 100); // 200px apart (scale 2.0)

      // Simulate touchstart with two fingers
      const touchStartEvent = new MockTouchEvent('touchstart', [touch1Start, touch2Start]);
      mockElement.dispatchEvent(touchStartEvent as any);

      // Simulate touchmove with fingers spread apart
      const touchMoveEvent = new MockTouchEvent('touchmove', [touch1Move, touch2Move]);
      mockElement.dispatchEvent(touchMoveEvent as any);

      expect(onPinch).toHaveBeenCalledWith(touchMoveEvent, 2.0);
    });

    it('should not trigger pinch gestures when advanced gestures disabled', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages6to9',
        theme: {} as any,
        interactions: { showHoverStates: false, enableAdvancedGestures: false, animationDuration: '300ms' },
        navigation: {} as any
      });

      const onPinch = jest.fn();
      renderHook(() => useTouchGestures(mockRef, { onPinch }));

      const touch1 = createMockTouch(100, 100);
      const touch2 = createMockTouch(200, 100);

      // Simulate touchstart with two fingers
      const touchStartEvent = new MockTouchEvent('touchstart', [touch1, touch2]);
      mockElement.dispatchEvent(touchStartEvent as any);

      expect(onPinch).not.toHaveBeenCalled();
    });
  });

  describe('Age-specific Behavior', () => {
    it('should handle basic gestures for ages 6-9', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages6to9',
        theme: {} as any,
        interactions: { showHoverStates: false, enableAdvancedGestures: false, animationDuration: '300ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() => useTouchGestures(mockRef, {}));

      expect(result.current.isAdvancedGesturesEnabled).toBe(false);
    });

    it('should enable swipe gestures for ages 10-13', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const onSwipeRight = jest.fn();
      renderHook(() => useTouchGestures(mockRef, { onSwipeRight }));

      const startTouch = createMockTouch(100, 100);
      const endTouch = createMockTouch(200, 100);

      const touchStartEvent = new MockTouchEvent('touchstart', [startTouch]);
      mockElement.dispatchEvent(touchStartEvent as any);

      const touchEndEvent = new MockTouchEvent('touchend', [], [endTouch]);
      mockElement.dispatchEvent(touchEndEvent as any);

      expect(onSwipeRight).toHaveBeenCalled();
    });

    it('should enable all advanced gestures for ages 14-16', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages14to16',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: true, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() => useTouchGestures(mockRef, {}));

      expect(result.current.isAdvancedGesturesEnabled).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should handle null element ref gracefully', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const nullRef = { current: null };

      expect(() => {
        renderHook(() => useTouchGestures(nullRef, {}));
      }).not.toThrow();
    });

    it('should prevent default for pinch gestures to avoid browser zoom', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages14to16',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: true, animationDuration: '200ms' },
        navigation: {} as any
      });

      renderHook(() => useTouchGestures(mockRef, {}));

      const touch1 = createMockTouch(100, 100);
      const touch2 = createMockTouch(200, 100);

      const touchStartEvent = new MockTouchEvent('touchstart', [touch1, touch2]);
      mockElement.dispatchEvent(touchStartEvent as any);

      expect(touchStartEvent.preventDefault).toHaveBeenCalled();
    });

    it('should cancel long press on finger movement', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages6to9',
        theme: {} as any,
        interactions: { showHoverStates: false, enableAdvancedGestures: false, animationDuration: '300ms' },
        navigation: {} as any
      });

      const onLongPress = jest.fn();
      renderHook(() => useTouchGestures(mockRef, { onLongPress, longPressDelay: 500 }));

      const startTouch = createMockTouch(100, 100);
      const moveTouch = createMockTouch(120, 120); // Moved 20px

      // Start touch
      const touchStartEvent = new MockTouchEvent('touchstart', [startTouch]);
      mockElement.dispatchEvent(touchStartEvent as any);

      // Move finger
      const touchMoveEvent = new MockTouchEvent('touchmove', [moveTouch]);
      mockElement.dispatchEvent(touchMoveEvent as any);

      // Wait for long press delay
      jest.advanceTimersByTime(500);

      expect(onLongPress).not.toHaveBeenCalled();
    });
  });
});
import { renderHook, act } from '@testing-library/react';
import { useInteractionStates, getInteractionClasses } from './useInteractionStates';
import { useAgeAdaptive } from './useAgeAdaptive';

jest.mock('./useAgeAdaptive');

const mockUseAgeAdaptive = useAgeAdaptive as jest.MockedFunction<typeof useAgeAdaptive>;

describe('useInteractionStates', () => {
  let mockElement: HTMLDivElement;
  let mockRef: React.RefObject<HTMLDivElement>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockElement = document.createElement('div');
    mockRef = { current: mockElement };

    // Mock addEventListener/removeEventListener
    jest.spyOn(mockElement, 'addEventListener');
    jest.spyOn(mockElement, 'removeEventListener');

    // Mock window properties
    Object.defineProperty(window, 'ontouchstart', {
      writable: true,
      value: undefined
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      value: 0
    });
  });

  describe('Setup and Cleanup', () => {
    it('should set up event listeners', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      renderHook(() => useInteractionStates(mockRef));

      expect(mockElement.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
      expect(mockElement.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
      expect(mockElement.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(mockElement.addEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(mockElement.addEventListener).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(mockElement.addEventListener).toHaveBeenCalledWith('blur', expect.any(Function));
      expect(mockElement.addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: true });
      expect(mockElement.addEventListener).toHaveBeenCalledWith('touchend', expect.any(Function), { passive: true });
      expect(mockElement.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(mockElement.addEventListener).toHaveBeenCalledWith('keyup', expect.any(Function));
    });

    it('should clean up event listeners on unmount', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { unmount } = renderHook(() => useInteractionStates(mockRef));

      unmount();

      expect(mockElement.removeEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith('blur', expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith('touchend', expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith('keyup', expect.any(Function));
    });

    it('should handle null element ref gracefully', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const nullRef = { current: null };

      expect(() => {
        renderHook(() => useInteractionStates(nullRef));
      }).not.toThrow();
    });
  });

  describe('Touch Device Detection', () => {
    it('should detect touch devices', () => {
      Object.defineProperty(window, 'ontouchstart', {
        value: true
      });

      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() => useInteractionStates(mockRef));

      expect(result.current.isTouchDevice).toBe(true);
    });

    it('should detect non-touch devices', () => {
      Object.defineProperty(window, 'ontouchstart', {
        value: undefined
      });
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 0
      });

      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() => useInteractionStates(mockRef));

      expect(result.current.isTouchDevice).toBe(false);
    });
  });

  describe('Mouse Interactions', () => {
    it('should handle mouse enter and leave events', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() => useInteractionStates(mockRef));

      expect(result.current.isHovered).toBe(false);

      act(() => {
        mockElement.dispatchEvent(new MouseEvent('mouseenter'));
      });

      expect(result.current.isHovered).toBe(true);
      expect(result.current.shouldShowHover).toBe(true);

      act(() => {
        mockElement.dispatchEvent(new MouseEvent('mouseleave'));
      });

      expect(result.current.isHovered).toBe(false);
      expect(result.current.shouldShowHover).toBe(false);
    });

    it('should handle mouse down and up events', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() => useInteractionStates(mockRef));

      expect(result.current.isActive).toBe(false);
      expect(result.current.isPressed).toBe(false);

      act(() => {
        mockElement.dispatchEvent(new MouseEvent('mousedown'));
      });

      expect(result.current.isActive).toBe(true);
      expect(result.current.isPressed).toBe(true);

      act(() => {
        mockElement.dispatchEvent(new MouseEvent('mouseup'));
      });

      expect(result.current.isActive).toBe(false);
      expect(result.current.isPressed).toBe(false);
    });
  });

  describe('Focus Interactions', () => {
    it('should handle focus and blur events', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() => useInteractionStates(mockRef));

      expect(result.current.isFocused).toBe(false);

      act(() => {
        mockElement.dispatchEvent(new FocusEvent('focus'));
      });

      expect(result.current.isFocused).toBe(true);

      act(() => {
        mockElement.dispatchEvent(new FocusEvent('blur'));
      });

      expect(result.current.isFocused).toBe(false);
    });

    it('should respect enableFocus configuration', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() =>
        useInteractionStates(mockRef, { enableFocus: false })
      );

      act(() => {
        mockElement.dispatchEvent(new FocusEvent('focus'));
      });

      expect(result.current.isFocused).toBe(false);
    });
  });

  describe('Touch Interactions', () => {
    it('should handle touch start and end events', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() => useInteractionStates(mockRef));

      expect(result.current.isActive).toBe(false);
      expect(result.current.isPressed).toBe(false);

      act(() => {
        mockElement.dispatchEvent(new TouchEvent('touchstart'));
      });

      expect(result.current.isActive).toBe(true);
      expect(result.current.isPressed).toBe(true);

      act(() => {
        mockElement.dispatchEvent(new TouchEvent('touchend'));
      });

      expect(result.current.isActive).toBe(false);
      expect(result.current.isPressed).toBe(false);
    });
  });

  describe('Keyboard Interactions', () => {
    it('should handle Enter key press', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() => useInteractionStates(mockRef));

      act(() => {
        mockElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      });

      expect(result.current.isActive).toBe(true);
      expect(result.current.isPressed).toBe(true);

      act(() => {
        mockElement.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
      });

      expect(result.current.isActive).toBe(false);
      expect(result.current.isPressed).toBe(false);
    });

    it('should handle Space key press', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() => useInteractionStates(mockRef));

      act(() => {
        mockElement.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      });

      expect(result.current.isActive).toBe(true);
      expect(result.current.isPressed).toBe(true);

      act(() => {
        mockElement.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
      });

      expect(result.current.isActive).toBe(false);
      expect(result.current.isPressed).toBe(false);
    });

    it('should ignore other keys', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() => useInteractionStates(mockRef));

      act(() => {
        mockElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      });

      expect(result.current.isActive).toBe(false);
      expect(result.current.isPressed).toBe(false);
    });
  });

  describe('Age-specific Hover Behavior', () => {
    it('should disable hover states for ages 6-9', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages6to9',
        theme: {} as any,
        interactions: { showHoverStates: false, enableAdvancedGestures: false, animationDuration: '300ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() => useInteractionStates(mockRef));

      act(() => {
        mockElement.dispatchEvent(new MouseEvent('mouseenter'));
      });

      expect(result.current.isHovered).toBe(false);
      expect(result.current.shouldShowHover).toBe(false);
    });

    it('should enable hover states for ages 10-13 on desktop', () => {
      Object.defineProperty(window, 'ontouchstart', {
        value: undefined
      });

      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() => useInteractionStates(mockRef));

      act(() => {
        mockElement.dispatchEvent(new MouseEvent('mouseenter'));
      });

      expect(result.current.isHovered).toBe(true);
      expect(result.current.shouldShowHover).toBe(true);
    });

    it('should be conservative with hover states on touch devices for ages 10-13', () => {
      Object.defineProperty(window, 'ontouchstart', {
        value: true
      });

      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() => useInteractionStates(mockRef));

      act(() => {
        mockElement.dispatchEvent(new MouseEvent('mouseenter'));
      });

      expect(result.current.isHovered).toBe(false);
      expect(result.current.shouldShowHover).toBe(false);
    });

    it('should enable hover states for ages 14-16 even on touch devices', () => {
      Object.defineProperty(window, 'ontouchstart', {
        value: true
      });

      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages14to16',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: true, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() => useInteractionStates(mockRef));

      act(() => {
        mockElement.dispatchEvent(new MouseEvent('mouseenter'));
      });

      expect(result.current.isHovered).toBe(true);
      expect(result.current.shouldShowHover).toBe(true);
    });
  });

  describe('Configuration Options', () => {
    it('should respect enableHover configuration', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() =>
        useInteractionStates(mockRef, { enableHover: false })
      );

      act(() => {
        mockElement.dispatchEvent(new MouseEvent('mouseenter'));
      });

      expect(result.current.isHovered).toBe(false);
      expect(result.current.shouldShowHover).toBe(false);
    });

    it('should respect enableActive configuration', () => {
      mockUseAgeAdaptive.mockReturnValue({
        ageGroup: 'ages10to13',
        theme: {} as any,
        interactions: { showHoverStates: true, enableAdvancedGestures: false, animationDuration: '200ms' },
        navigation: {} as any
      });

      const { result } = renderHook(() =>
        useInteractionStates(mockRef, { enableActive: false })
      );

      act(() => {
        mockElement.dispatchEvent(new MouseEvent('mousedown'));
      });

      expect(result.current.isActive).toBe(false);
      expect(result.current.isPressed).toBe(false);
    });
  });
});

describe('getInteractionClasses', () => {
  it('should return base classes when no states are active', () => {
    const states = {
      isHovered: false,
      isFocused: false,
      isActive: false,
      isPressed: false,
      isTouchDevice: false,
      shouldShowHover: false
    };

    const result = getInteractionClasses(states, 'base-class');
    expect(result).toBe('base-class');
  });

  it('should add hover classes when shouldShowHover is true', () => {
    const states = {
      isHovered: true,
      isFocused: false,
      isActive: false,
      isPressed: false,
      isTouchDevice: false,
      shouldShowHover: true
    };

    const result = getInteractionClasses(states, 'base-class');
    expect(result).toBe('base-class hover:shadow-md hover:scale-105');
  });

  it('should add focus classes when focused', () => {
    const states = {
      isHovered: false,
      isFocused: true,
      isActive: false,
      isPressed: false,
      isTouchDevice: false,
      shouldShowHover: false
    };

    const result = getInteractionClasses(states, 'base-class');
    expect(result).toBe('base-class focus:outline-none focus:ring-2 focus:ring-blue-500');
  });

  it('should add active classes when active', () => {
    const states = {
      isHovered: false,
      isFocused: false,
      isActive: true,
      isPressed: false,
      isTouchDevice: false,
      shouldShowHover: false
    };

    const result = getInteractionClasses(states, 'base-class');
    expect(result).toBe('base-class active:scale-95');
  });

  it('should combine multiple state classes', () => {
    const states = {
      isHovered: true,
      isFocused: true,
      isActive: true,
      isPressed: false,
      isTouchDevice: false,
      shouldShowHover: true
    };

    const result = getInteractionClasses(states, 'base-class');
    expect(result).toBe('base-class hover:shadow-md hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 active:scale-95');
  });

  it('should use custom classes when provided', () => {
    const states = {
      isHovered: true,
      isFocused: true,
      isActive: false,
      isPressed: false,
      isTouchDevice: false,
      shouldShowHover: true
    };

    const result = getInteractionClasses(states, 'base-class', {
      hoverClasses: 'custom-hover',
      focusClasses: 'custom-focus'
    });

    expect(result).toBe('base-class custom-hover custom-focus');
  });

  it('should handle empty base classes', () => {
    const states = {
      isHovered: true,
      isFocused: false,
      isActive: false,
      isPressed: false,
      isTouchDevice: false,
      shouldShowHover: true
    };

    const result = getInteractionClasses(states, '', {
      hoverClasses: 'hover-class'
    });

    expect(result).toBe('hover-class');
  });
});
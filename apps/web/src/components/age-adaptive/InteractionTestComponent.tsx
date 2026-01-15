import React, { useRef, useState } from 'react';
import { useTouchGestures } from '../../hooks/useTouchGestures';
import { useInteractionStates } from '../../hooks/useInteractionStates';
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive';

interface InteractionTestComponentProps {
  ageGroupOverride?: 'ages6to9' | 'ages10to13' | 'ages14to16';
}

export const InteractionTestComponent: React.FC<InteractionTestComponentProps> = ({
  ageGroupOverride
}) => {
  const { ageGroup, interactions } = useAgeAdaptive(ageGroupOverride);
  const [events, setEvents] = useState<string[]>([]);
  const testElementRef = useRef<HTMLDivElement>(null);

  const addEvent = (eventName: string) => {
    setEvents(prev => [`${new Date().toLocaleTimeString()}: ${eventName}`, ...prev.slice(0, 9)]);
  };

  // Set up touch gestures
  useTouchGestures(testElementRef, {
    onTap: () => addEvent('Tap'),
    onDoubleTap: () => addEvent('Double Tap'),
    onLongPress: () => addEvent('Long Press'),
    onSwipeLeft: () => addEvent('Swipe Left'),
    onSwipeRight: () => addEvent('Swipe Right'),
    onSwipeUp: () => addEvent('Swipe Up'),
    onSwipeDown: () => addEvent('Swipe Down'),
    onPinch: (_, scale) => addEvent(`Pinch (scale: ${scale.toFixed(2)})`),
  });

  // Set up interaction states
  const interactionStates = useInteractionStates(testElementRef, {
    enableHover: true,
    enableFocus: true,
    enableActive: true,
    hoverDelay: ageGroup === 'ages6to9' ? 0 : 100
  });

  const clearEvents = () => setEvents([]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">
          Interaction Test - {ageGroup.replace('ages', 'Ages ').replace('to', '-')}
        </h2>
        <div className="bg-gray-100 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Age Group Configuration:</h3>
          <ul className="text-sm space-y-1">
            <li>Show Hover States: {interactions.showHoverStates ? '✅' : '❌'}</li>
            <li>Advanced Gestures: {interactions.enableAdvancedGestures ? '✅' : '❌'}</li>
            <li>Animation Duration: {interactions.animationDuration}</li>
            <li>Touch Device: {interactionStates.isTouchDevice ? '✅' : '❌'}</li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interactive Test Area */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Test Area</h3>

          <div
            ref={testElementRef}
            className={`
              w-full h-48 bg-gradient-to-br from-blue-100 to-purple-100
              border-2 border-dashed border-gray-300 rounded-lg
              flex items-center justify-center text-center p-4
              cursor-pointer select-none
              transition-all duration-200
              ${interactionStates.shouldShowHover ? 'hover:shadow-lg hover:scale-105' : ''}
              ${interactionStates.isFocused ? 'ring-2 ring-blue-500' : ''}
              ${interactionStates.isActive ? 'scale-95 bg-gradient-to-br from-blue-200 to-purple-200' : ''}
            `}
            tabIndex={0}
            onClick={() => addEvent('Click')}
            onMouseEnter={() => addEvent('Mouse Enter')}
            onMouseLeave={() => addEvent('Mouse Leave')}
            onFocus={() => addEvent('Focus')}
            onBlur={() => addEvent('Blur')}
          >
            <div>
              <p className="text-lg font-medium mb-2">
                Interactive Test Area
              </p>
              <p className="text-sm text-gray-600">
                Try different interactions:
              </p>
              <ul className="text-xs mt-2 space-y-1">
                <li>• Click/Tap</li>
                <li>• Hover (mouse)</li>
                <li>• Focus (keyboard)</li>
                {ageGroup !== 'ages6to9' && <li>• Double tap</li>}
                {ageGroup !== 'ages6to9' && <li>• Swipe gestures</li>}
                {interactions.enableAdvancedGestures && <li>• Pinch/zoom</li>}
                <li>• Long press</li>
              </ul>
            </div>
          </div>

          {/* Device-specific buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`
                px-4 py-2 rounded-lg font-medium transition-all duration-200
                bg-green-500 text-white
                ${interactionStates.isTouchDevice ? 'opacity-100' : 'opacity-50'}
                ${interactions.showHoverStates && !interactionStates.isTouchDevice ? 'hover:bg-green-600 hover:shadow-md' : ''}
                active:scale-95 focus:outline-none focus:ring-2 focus:ring-green-300
              `}
              onClick={() => addEvent('Touch-optimized Button')}
            >
              Touch Button
            </button>

            <button
              className={`
                px-4 py-2 rounded-lg font-medium transition-all duration-200
                bg-purple-500 text-white
                ${!interactionStates.isTouchDevice ? 'opacity-100' : 'opacity-50'}
                ${interactions.showHoverStates ? 'hover:bg-purple-600 hover:shadow-md' : ''}
                active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-300
              `}
              onClick={() => addEvent('Mouse-optimized Button')}
            >
              Mouse Button
            </button>
          </div>

          {/* Age-specific interaction examples */}
          <div className="space-y-2">
            <h4 className="font-medium">Age-Appropriate Interactions:</h4>

            {ageGroup === 'ages6to9' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm">
                  <strong>Ages 6-9:</strong> Large touch targets, no hover states,
                  simple tap and long press gestures only.
                </p>
              </div>
            )}

            {ageGroup === 'ages10to13' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm">
                  <strong>Ages 10-13:</strong> Hover states enabled, swipe gestures,
                  double tap, balanced interaction complexity.
                </p>
              </div>
            )}

            {ageGroup === 'ages14to16' && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm">
                  <strong>Ages 14-16:</strong> All advanced gestures including pinch/zoom,
                  sophisticated hover states, keyboard shortcuts.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Event Log */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Event Log</h3>
            <button
              onClick={clearEvents}
              className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition-colors"
            >
              Clear
            </button>
          </div>

          <div className="bg-gray-50 border rounded-lg p-4 h-64 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-gray-500 text-sm italic">
                No events yet. Start interacting with the test area above.
              </p>
            ) : (
              <div className="space-y-1">
                {events.map((event, index) => (
                  <div
                    key={index}
                    className={`text-sm font-mono ${
                      index === 0 ? 'text-blue-600 font-medium' : 'text-gray-700'
                    }`}
                  >
                    {event}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current State Display */}
          <div className="bg-gray-50 border rounded-lg p-4">
            <h4 className="font-medium mb-2">Current States:</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Hovered: {interactionStates.isHovered ? '✅' : '❌'}</div>
              <div>Focused: {interactionStates.isFocused ? '✅' : '❌'}</div>
              <div>Active: {interactionStates.isActive ? '✅' : '❌'}</div>
              <div>Pressed: {interactionStates.isPressed ? '✅' : '❌'}</div>
              <div>Should Show Hover: {interactionStates.shouldShowHover ? '✅' : '❌'}</div>
              <div>Touch Device: {interactionStates.isTouchDevice ? '✅' : '❌'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
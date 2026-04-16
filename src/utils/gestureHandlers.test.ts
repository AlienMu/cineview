/**
 * Gesture Handlers Tests
 * Tests for wheel event and text selection prevention
 */

import { createSnapGestureHandlers } from './gestureHandlers';

describe('createSnapGestureHandlers', () => {
  let touchStartRef: React.MutableRefObject<{ x: number; y: number } | null>;
  let onSceneChange: jest.Mock;
  let onAnimatingChange: jest.Mock;

  beforeEach(() => {
    touchStartRef = { current: null };
    onSceneChange = jest.fn();
    onAnimatingChange = jest.fn();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('handleWheel', () => {
    it('should trigger forward scene change on downward wheel', () => {
      const handlers = createSnapGestureHandlers(touchStartRef, {
        slideDirection: 'y',
        slideDuration: 500,
        isAnimating: false,
        onSceneChange,
        onAnimatingChange,
      });

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: 100,
        deltaX: 0,
      });

      Object.defineProperty(wheelEvent, 'preventDefault', {
        value: jest.fn(),
        writable: true,
      });

      handlers.handleWheel(wheelEvent);

      expect(wheelEvent.preventDefault).toHaveBeenCalled();
      expect(onAnimatingChange).toHaveBeenCalledWith(true);
      expect(onSceneChange).toHaveBeenCalledWith('forward');

      jest.advanceTimersByTime(500);
      expect(onAnimatingChange).toHaveBeenCalledWith(false);
    });

    it('should trigger backward scene change on upward wheel', () => {
      const handlers = createSnapGestureHandlers(touchStartRef, {
        slideDirection: 'y',
        slideDuration: 500,
        isAnimating: false,
        onSceneChange,
        onAnimatingChange,
      });

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100,
        deltaX: 0,
      });

      Object.defineProperty(wheelEvent, 'preventDefault', {
        value: jest.fn(),
        writable: true,
      });

      handlers.handleWheel(wheelEvent);

      expect(wheelEvent.preventDefault).toHaveBeenCalled();
      expect(onAnimatingChange).toHaveBeenCalledWith(true);
      expect(onSceneChange).toHaveBeenCalledWith('backward');
    });

    it('should throttle rapid wheel events', () => {
      const handlers = createSnapGestureHandlers(touchStartRef, {
        slideDirection: 'y',
        slideDuration: 500,
        isAnimating: false,
        onSceneChange,
        onAnimatingChange,
      });

      const createWheelEvent = () => {
        const event = new WheelEvent('wheel', { deltaY: 100 });
        Object.defineProperty(event, 'preventDefault', {
          value: jest.fn(),
          writable: true,
        });
        return event;
      };

      // First wheel event should trigger
      handlers.handleWheel(createWheelEvent());
      expect(onSceneChange).toHaveBeenCalledTimes(1);

      // Second wheel event within throttle period should be ignored
      jest.advanceTimersByTime(400);
      handlers.handleWheel(createWheelEvent());
      expect(onSceneChange).toHaveBeenCalledTimes(1);

      // Third wheel event after throttle period should trigger
      jest.advanceTimersByTime(500);
      handlers.handleWheel(createWheelEvent());
      expect(onSceneChange).toHaveBeenCalledTimes(2);
    });

    it('should ignore small wheel deltas below threshold', () => {
      const handlers = createSnapGestureHandlers(touchStartRef, {
        slideDirection: 'y',
        slideDuration: 500,
        isAnimating: false,
        onSceneChange,
        onAnimatingChange,
      });

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: 20, // Below 30 threshold
        deltaX: 0,
      });

      Object.defineProperty(wheelEvent, 'preventDefault', {
        value: jest.fn(),
        writable: true,
      });

      handlers.handleWheel(wheelEvent);

      expect(onSceneChange).not.toHaveBeenCalled();
    });

    it('should not trigger when already animating', () => {
      const handlers = createSnapGestureHandlers(touchStartRef, {
        slideDirection: 'y',
        slideDuration: 500,
        isAnimating: true, // Already animating
        onSceneChange,
        onAnimatingChange,
      });

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: 100,
        deltaX: 0,
      });

      Object.defineProperty(wheelEvent, 'preventDefault', {
        value: jest.fn(),
        writable: true,
      });

      handlers.handleWheel(wheelEvent);

      expect(onSceneChange).not.toHaveBeenCalled();
    });

    it('should handle horizontal wheel events when slideDirection is x', () => {
      const handlers = createSnapGestureHandlers(touchStartRef, {
        slideDirection: 'x',
        slideDuration: 500,
        isAnimating: false,
        onSceneChange,
        onAnimatingChange,
      });

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: 0,
        deltaX: 100,
      });

      Object.defineProperty(wheelEvent, 'preventDefault', {
        value: jest.fn(),
        writable: true,
      });

      handlers.handleWheel(wheelEvent);

      expect(wheelEvent.preventDefault).toHaveBeenCalled();
      expect(onSceneChange).toHaveBeenCalledWith('forward');
    });
  });
});

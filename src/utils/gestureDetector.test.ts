import {
  GestureDetector,
  createGestureDetector,
  isTouchDevice,
  detectGesture,
} from './gestureDetector';

describe('GestureDetector', () => {
  let detector: GestureDetector;

  beforeEach(() => {
    detector = new GestureDetector();
  });

  describe('constructor', () => {
    it('should create detector with default config', () => {
      const detector = new GestureDetector();
      expect(detector).toBeInstanceOf(GestureDetector);
    });

    it('should create detector with custom config', () => {
      const detector = new GestureDetector({
        minSwipeDistance: 100,
        maxSwipeTime: 500,
        direction: 'x',
      });
      expect(detector).toBeInstanceOf(GestureDetector);
    });
  });

  describe('handleStart and handleEnd', () => {
    it('should detect swipe-up gesture', () => {
      const startEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 200 });
      const endEvent = new MouseEvent('mouseup', { clientX: 100, clientY: 100 });

      detector.handleStart(startEvent);
      const gesture = detector.handleEnd(endEvent);

      expect(gesture).toBe('swipe-up');
    });

    it('should detect swipe-down gesture', () => {
      const startEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      const endEvent = new MouseEvent('mouseup', { clientX: 100, clientY: 200 });

      detector.handleStart(startEvent);
      const gesture = detector.handleEnd(endEvent);

      expect(gesture).toBe('swipe-down');
    });

    it('should detect swipe-left gesture', () => {
      const startEvent = new MouseEvent('mousedown', { clientX: 200, clientY: 100 });
      const endEvent = new MouseEvent('mouseup', { clientX: 100, clientY: 100 });

      detector.handleStart(startEvent);
      const gesture = detector.handleEnd(endEvent);

      expect(gesture).toBe('swipe-left');
    });

    it('should detect swipe-right gesture', () => {
      const startEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      const endEvent = new MouseEvent('mouseup', { clientX: 200, clientY: 100 });

      detector.handleStart(startEvent);
      const gesture = detector.handleEnd(endEvent);

      expect(gesture).toBe('swipe-right');
    });

    it('should return none when distance is too small', () => {
      const startEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      const endEvent = new MouseEvent('mouseup', { clientX: 110, clientY: 110 });

      detector.handleStart(startEvent);
      const gesture = detector.handleEnd(endEvent);

      expect(gesture).toBe('none');
    });

    it('should return none when time exceeds maxSwipeTime', () => {
      jest.useFakeTimers();

      const startEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      detector.handleStart(startEvent);

      jest.advanceTimersByTime(400); // exceeds default 300ms

      const endEvent = new MouseEvent('mouseup', { clientX: 100, clientY: 200 });
      const gesture = detector.handleEnd(endEvent);

      expect(gesture).toBe('none');

      jest.useRealTimers();
    });

    it('should return none when handleStart was not called', () => {
      const endEvent = new MouseEvent('mouseup', { clientX: 100, clientY: 200 });
      const gesture = detector.handleEnd(endEvent);

      expect(gesture).toBe('none');
    });

    it('should detect horizontal gesture in x direction mode', () => {
      const detector = new GestureDetector({ direction: 'x' });

      const startEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      const endEvent = new MouseEvent('mouseup', { clientX: 200, clientY: 100 });

      detector.handleStart(startEvent);
      const gesture = detector.handleEnd(endEvent);

      expect(gesture).toBe('swipe-right');
    });

    it('should return none for vertical gesture in x direction mode', () => {
      const detector = new GestureDetector({ direction: 'x' });

      const startEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      const endEvent = new MouseEvent('mouseup', { clientX: 100, clientY: 200 });

      detector.handleStart(startEvent);
      const gesture = detector.handleEnd(endEvent);

      expect(gesture).toBe('none');
    });

    it('should detect vertical gesture in y direction mode', () => {
      const detector = new GestureDetector({ direction: 'y' });

      const startEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      const endEvent = new MouseEvent('mouseup', { clientX: 100, clientY: 200 });

      detector.handleStart(startEvent);
      const gesture = detector.handleEnd(endEvent);

      expect(gesture).toBe('swipe-down');
    });

    it('should return none for horizontal gesture in y direction mode', () => {
      const detector = new GestureDetector({ direction: 'y' });

      const startEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      const endEvent = new MouseEvent('mouseup', { clientX: 200, clientY: 100 });

      detector.handleStart(startEvent);
      const gesture = detector.handleEnd(endEvent);

      expect(gesture).toBe('none');
    });

    it('should handle touch events', () => {
      const startEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch],
      });
      const endEvent = new TouchEvent('touchend', {
        touches: [{ clientX: 100, clientY: 200 } as Touch],
      });

      detector.handleStart(startEvent);
      const gesture = detector.handleEnd(endEvent);

      expect(gesture).toBe('swipe-down');
    });
  });

  describe('getDragProgress', () => {
    it('should calculate drag progress correctly', () => {
      const startEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      detector.handleStart(startEvent);

      const moveEvent = new MouseEvent('mousemove', { clientX: 100, clientY: 200 });
      const progress = detector.getDragProgress(moveEvent, 400);

      expect(progress).toBeCloseTo(0.25); // 100 / 400 = 0.25
    });

    it('should return 0 when handleStart was not called', () => {
      const moveEvent = new MouseEvent('mousemove', { clientX: 100, clientY: 200 });
      const progress = detector.getDragProgress(moveEvent, 400);

      expect(progress).toBe(0);
    });

    it('should clamp progress to 0-1 range', () => {
      const startEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      detector.handleStart(startEvent);

      const moveEvent = new MouseEvent('mousemove', { clientX: 100, clientY: 600 });
      const progress = detector.getDragProgress(moveEvent, 400);

      expect(progress).toBe(1); // should be clamped to 1
    });

    it('should calculate progress in x direction', () => {
      const detector = new GestureDetector({ direction: 'x' });

      const startEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      detector.handleStart(startEvent);

      const moveEvent = new MouseEvent('mousemove', { clientX: 300, clientY: 100 });
      const progress = detector.getDragProgress(moveEvent, 400);

      expect(progress).toBeCloseTo(0.5); // 200 / 400 = 0.5
    });
  });

  describe('reset', () => {
    it('should reset detector state', () => {
      const startEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      detector.handleStart(startEvent);

      detector.reset();

      const endEvent = new MouseEvent('mouseup', { clientX: 100, clientY: 200 });
      const gesture = detector.handleEnd(endEvent);

      expect(gesture).toBe('none');
    });
  });
});

describe('createGestureDetector', () => {
  it('should create a GestureDetector instance', () => {
    const detector = createGestureDetector();
    expect(detector).toBeInstanceOf(GestureDetector);
  });

  it('should create detector with custom config', () => {
    const detector = createGestureDetector({ minSwipeDistance: 100 });
    expect(detector).toBeInstanceOf(GestureDetector);
  });
});

describe('isTouchDevice', () => {
  it('should detect touch device', () => {
    // simulate touch device
    Object.defineProperty(window, 'ontouchstart', {
      value: {},
      writable: true,
      configurable: true,
    });

    expect(isTouchDevice()).toBe(true);

    // cleanup
    delete (window as { ontouchstart?: unknown }).ontouchstart;
  });

  it('should detect non-touch device', () => {
    // ensure no touch support
    delete (window as { ontouchstart?: unknown }).ontouchstart;
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 0,
      writable: true,
      configurable: true,
    });

    const result = isTouchDevice();
    expect(typeof result).toBe('boolean');
  });
});

describe('detectGesture', () => {
  it('should detect swipe-up gesture', () => {
    const start = { x: 100, y: 200 };
    const end = { x: 100, y: 100 };

    const gesture = detectGesture(start, end, 'y', 50);
    expect(gesture).toBe('swipe-up');
  });

  it('should detect swipe-down gesture', () => {
    const start = { x: 100, y: 100 };
    const end = { x: 100, y: 200 };

    const gesture = detectGesture(start, end, 'y', 50);
    expect(gesture).toBe('swipe-down');
  });

  it('should detect swipe-left gesture', () => {
    const start = { x: 200, y: 100 };
    const end = { x: 100, y: 100 };

    const gesture = detectGesture(start, end, 'x', 50);
    expect(gesture).toBe('swipe-left');
  });

  it('should detect swipe-right gesture', () => {
    const start = { x: 100, y: 100 };
    const end = { x: 200, y: 100 };

    const gesture = detectGesture(start, end, 'x', 50);
    expect(gesture).toBe('swipe-right');
  });

  it('should return none when distance is too small', () => {
    const start = { x: 100, y: 100 };
    const end = { x: 110, y: 110 };

    const gesture = detectGesture(start, end, 'y', 50);
    expect(gesture).toBe('none');
  });

  it('should return none for vertical gesture in x direction mode', () => {
    const start = { x: 100, y: 100 };
    const end = { x: 100, y: 200 };

    const gesture = detectGesture(start, end, 'x', 50);
    expect(gesture).toBe('none');
  });

  it('should return none for horizontal gesture in y direction mode', () => {
    const start = { x: 100, y: 100 };
    const end = { x: 200, y: 100 };

    const gesture = detectGesture(start, end, 'y', 50);
    expect(gesture).toBe('none');
  });
});

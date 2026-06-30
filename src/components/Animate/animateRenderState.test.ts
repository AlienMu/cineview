import {
  IDLE_RENDER_STATE,
  normalizeDragPhase,
  resolveDragRenderState,
  resolveScrollEnterProgress,
  resolveScrollRenderState,
} from './animateRenderState';

// Deterministic guards for the render-prop state normalization. These pin the
// exact mapping so a regression in either driver's phase vocabulary turns red.

describe('resolveScrollEnterProgress — signed visualMotion → 0..1 enter', () => {
  it('clamps the exit range (<0) to 0', () => {
    expect(resolveScrollEnterProgress(-1)).toBe(0);
    expect(resolveScrollEnterProgress(-0.4)).toBe(0);
  });

  it('passes the enter range through', () => {
    expect(resolveScrollEnterProgress(0)).toBe(0);
    expect(resolveScrollEnterProgress(0.37)).toBeCloseTo(0.37);
    expect(resolveScrollEnterProgress(1)).toBe(1);
  });

  it('clamps overshoot above 1', () => {
    expect(resolveScrollEnterProgress(1.2)).toBe(1);
  });
});

describe('normalizeDragPhase — mode + localProgress → unified phase', () => {
  it('hidden → idle', () => {
    expect(normalizeDragPhase('hidden', 0)).toBe('idle');
  });

  it('outgoing → exiting', () => {
    expect(normalizeDragPhase('outgoing', 0.5)).toBe('exiting');
  });

  it('rest → entered', () => {
    expect(normalizeDragPhase('rest', 1)).toBe('entered');
  });

  it('enter mid-flight → entering', () => {
    expect(normalizeDragPhase('enter', 0)).toBe('entering');
    expect(normalizeDragPhase('enter', 0.5)).toBe('entering');
    expect(normalizeDragPhase('enter', 0.99)).toBe('entering');
  });

  it('enter settled (progress≈1) → entered', () => {
    expect(normalizeDragPhase('enter', 1)).toBe('entered');
    expect(normalizeDragPhase('enter', 0.9999)).toBe('entered');
  });
});

describe('resolveScrollRenderState / resolveDragRenderState — full assembly', () => {
  it('scroll assembles progress + passthrough phase', () => {
    expect(resolveScrollRenderState('entering', 0.4)).toEqual({
      enterProgress: 0.4,
      phase: 'entering',
    });
    expect(resolveScrollRenderState('exiting', -0.5)).toEqual({
      enterProgress: 0,
      phase: 'exiting',
    });
  });

  it('drag clamps localProgress and derives phase', () => {
    expect(resolveDragRenderState('enter', 0.3)).toEqual({
      enterProgress: 0.3,
      phase: 'entering',
    });
    expect(resolveDragRenderState('enter', 1)).toEqual({
      enterProgress: 1,
      phase: 'entered',
    });
    expect(resolveDragRenderState('hidden', -0.2)).toEqual({
      enterProgress: 0,
      phase: 'idle',
    });
  });
});

describe('IDLE_RENDER_STATE — no-animation early-return', () => {
  it('is progress 0 / phase idle', () => {
    expect(IDLE_RENDER_STATE).toEqual({ enterProgress: 0, phase: 'idle' });
  });
});

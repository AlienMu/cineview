import {
  apertureGeometry,
  EXIT_OPEN_FRACTION,
  RESTING_CLOSURE,
  shutterCycle,
  shutterExitCycle,
  shutterExitOpacity,
} from '../../../site/src/components/temporal-drag/aperture/apertureBlades';

describe('/drag act 4 shutter contract', () => {
  it('closes fully, settles at 80% closure, and holds there', () => {
    expect(shutterCycle(0)).toBe(0);
    expect(shutterCycle(0.24)).toBe(1);
    expect(shutterCycle(0.32)).toBe(1);
    expect(shutterCycle(0.6)).toBe(RESTING_CLOSURE);
    expect(shutterCycle(0.8)).toBe(RESTING_CLOSURE);
    expect(shutterCycle(1)).toBe(RESTING_CLOSURE);
  });

  it('starts exit continuously at 80%, opens fully, then fades', () => {
    expect(shutterExitCycle(0)).toBe(RESTING_CLOSURE);
    expect(shutterExitOpacity(0)).toBe(1);
    expect(shutterExitCycle(EXIT_OPEN_FRACTION)).toBe(0);
    expect(shutterExitOpacity(EXIT_OPEN_FRACTION)).toBe(1);
    expect(shutterExitCycle(1)).toBe(0);
    expect(shutterExitOpacity(1)).toBe(0);

    const enterEnd = apertureGeometry(1, 200);
    const exitStart = apertureGeometry(0, 200, true);
    expect(exitStart.stop).toBeCloseTo(enterEnd.stop, 12);
    expect(exitStart.spin).toBeCloseTo(enterEnd.spin, 12);
    expect(exitStart.inradius).toBeCloseTo(enterEnd.inradius, 12);
    expect(exitStart.vertexRadius).toBeCloseTo(enterEnd.vertexRadius, 12);
  });

  it('keeps closure exact through the crank projection', () => {
    expect(apertureGeometry(0.24, 200).stop).toBeCloseTo(1, 12);
    expect(apertureGeometry(1, 200).stop).toBeCloseTo(RESTING_CLOSURE, 12);
    expect(apertureGeometry(EXIT_OPEN_FRACTION, 200, true).stop).toBeCloseTo(0, 12);
  });
});

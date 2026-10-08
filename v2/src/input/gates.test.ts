import { gateAction, gates, type GateInput } from './gates';

const at = (top: number, height: number, over: Partial<GateInput> = {}) =>
  gates({
    top,
    bottom: top + height,
    vh: 800,
    enterMargin: 50,
    exitMargin: 50,
    eye: false,
    ...over,
  });

describe('gates (1.x geometry)', () => {
  it('enters when fully in view and clear of the bottom margin', () => {
    expect(at(100, 200).enter).toBe(true);
    expect(at(560, 200).enter).toBe(false); // bottom 760 > 750
    expect(at(-1, 200).enter).toBe(false);
  });

  it('exits near either edge', () => {
    expect(at(40, 200).exit).toBe(true); // top within 50 of the top
    expect(at(560, 200).exit).toBe(true); // bottom within 50 of the bottom
    expect(at(100, 200).exit).toBe(false);
  });

  it('overlaps in the top band, where the phase must hold', () => {
    const g = at(20, 200);
    expect(g.enter && g.exit).toBe(true);
    expect(gateAction('idle', g.enter, g.exit, { hasExit: true, replay: true })).toBeNull();
    expect(gateAction('entered', g.enter, g.exit, { hasExit: true, replay: true })).toBeNull();
  });

  it('uses the middle and 70% lines for oversized elements, exit winning', () => {
    expect(at(390, 1000)).toMatchObject({ oversized: true, enter: true, exit: false });
    expect(at(-500, 1000)).toMatchObject({ enter: false, exit: true }); // bottom 500 <= 560
  });

  it('reports above and on-screen', () => {
    expect(at(-300, 200)).toMatchObject({ above: true, onScreen: false });
    expect(at(700, 200)).toMatchObject({ above: false, onScreen: true });
    expect(at(900, 200).onScreen).toBe(false);
  });

  it('eye: enters while straddling 45% of the viewport', () => {
    expect(at(300, 100, { eye: true }).enter).toBe(true); // 300..400 holds 360
    expect(at(370, 100, { eye: true })).toMatchObject({ enter: false, exit: true });
  });
});

describe('gateAction', () => {
  const o = { hasExit: true, replay: true };
  it('idle only enters', () => {
    expect(gateAction('idle', true, false, o)).toBe('enter');
    expect(gateAction('idle', false, true, o)).toBeNull();
  });
  it('only a declared exit exits', () => {
    expect(gateAction('entered', false, true, o)).toBe('exit');
    expect(gateAction('entered', false, true, { hasExit: false, replay: true })).toBeNull();
    expect(gateAction('entering', false, true, o)).toBe('exit');
  });
  it('re-enters after an exit when replaying', () => {
    expect(gateAction('exited', true, false, o)).toBe('enter');
    expect(gateAction('exiting', true, false, o)).toBe('enter');
    expect(gateAction('exited', true, false, { hasExit: true, replay: false })).toBeNull();
  });
});

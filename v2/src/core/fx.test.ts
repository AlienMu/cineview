import { easeOut, evaluate, frameCss, identityFrame, parseFromTo, parseFx, usedProps } from './fx';

describe('parseFx', () => {
  it('parses presets with word arguments and ranges', () => {
    const errors: string[] = [];
    const effects = parseFx('rise, reveal(left) 0% 50%, drift(strong)', (m) => errors.push(m));
    expect(errors).toEqual([]);
    expect(effects).toHaveLength(3);
    expect(effects[1]!.range).toEqual([0, 0.5]);
    expect(effects[2]!.tracks.yp).toEqual([14, -14]);
  });

  it('reports unknown presets and unparsable items, keeping the rest', () => {
    const errors: string[] = [];
    const effects = parseFx('rise, nope, ???', (m) => errors.push(m));
    expect(effects).toHaveLength(1);
    expect(errors).toEqual(['Unknown preset "nope"', 'Cannot parse fx item "???"']);
  });
});

describe('evaluate', () => {
  it('adds translations and multiplies opacity across effects of one source', () => {
    const a = parseFromTo('opacity:0.5; y:10', null)!;
    const b = parseFromTo('opacity:0.5; y:30', null)!;
    const frame = identityFrame();
    evaluate([a, b], 0, frame, false);
    expect(frame.opacity).toBeCloseTo(0.25);
    expect(frame.y).toBe(40);
    evaluate([a, b], 1, frame, false);
    expect(frame.opacity).toBe(1);
    expect(frame.y).toBe(0);
  });

  it('emits only the properties the effects touch', () => {
    const e = parseFromTo('opacity:0', null)!;
    const frame = identityFrame();
    evaluate([e], 0.5, frame, false);
    expect(frameCss(frame, usedProps([e], false))).toEqual({ opacity: String(easeOut(0.5) * 1) });
  });
});

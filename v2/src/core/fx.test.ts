import { cubicBezier, EASES, parseEase, settle } from './ease';
import {
  asExit,
  defineEffect,
  evaluate,
  parseExit,
  parseFromTo,
  parseFx,
  parseItems,
  usedProps,
  type Effect,
} from './fx';
import { frameCss, identityFrame, parseDeclarations, parseInset } from './props';

const collect = (): { report: (m: string) => void; messages: string[] } => {
  const messages: string[] = [];
  return { report: (m) => messages.push(m), messages };
};
const at = (effects: Effect[], p: number, clipOnly = false) => {
  const frame = identityFrame();
  evaluate(effects, p, frame, clipOnly);
  return frame;
};

describe('ease', () => {
  it('matches cubic-bezier endpoints and the CSS keywords', () => {
    const e = cubicBezier(0.42, 0, 0.58, 1);
    expect(e(0)).toBe(0);
    expect(e(1)).toBe(1);
    expect(e(0.5)).toBeCloseTo(0.5, 5);
    expect(EASES.linear!(0.3)).toBe(0.3);
    expect(settle(0.5)).toBeGreaterThan(0.8);
  });

  it('parses names and cubic-bezier(), rejecting non-functions of time', () => {
    expect(parseEase('pan')).toBe(EASES.pan);
    expect(parseEase('cubic-bezier(.2, 0, 0, 1)')!(1)).toBe(1);
    expect(parseEase('cubic-bezier(1.2, 0, 0, 1)')).toBeNull();
    expect(parseEase('bouncy')).toBeNull();
    expect(parseEase(null)).toBeNull();
  });
});

describe('fx grammar', () => {
  it('splits items with word arguments, numbers and ranges', () => {
    const { report, messages } = collect();
    const items = parseItems(
      'rise, reveal(left, strong) 0% 60%, push(1, 1.16, 30% 40%), drift',
      report
    );
    expect(messages).toEqual([]);
    expect(items.map((i) => i.name)).toEqual(['rise', 'reveal', 'push', 'drift']);
    expect(items[1]!.args).toEqual(['left', 'strong']);
    expect(items[1]!.range.range).toEqual([0, 0.6]);
    expect(items[2]!.args).toEqual(['1', '1.16', '30% 40%']);
  });

  it('reads named view ranges like animation-range', () => {
    const { report } = collect();
    const [a, b, c] = parseItems(
      'drift entry 10% cover 50%, focus(band) cover 20% 80%, drift exit',
      report
    );
    expect(a!.range.view).toEqual([
      { name: 'entry', offset: 0.1 },
      { name: 'cover', offset: 0.5 },
    ]);
    expect(b!.range.view).toEqual([
      { name: 'cover', offset: 0.2 },
      { name: 'cover', offset: 0.8 },
    ]);
    expect(c!.range.view).toEqual([
      { name: 'exit', offset: 0 },
      { name: 'exit', offset: 1 },
    ]);
  });

  it('reports unknown presets and unparsable items, keeping the rest', () => {
    const { report, messages } = collect();
    const effects = parseFx('rise, nope, rise(soft) sideways', report);
    expect(effects).toHaveLength(1);
    expect(messages).toEqual([
      'Unknown preset "nope"',
      'Cannot parse fx item "rise(soft) sideways"',
    ]);
  });

  it('reports bad preset arguments and falls back to the default', () => {
    const { report, messages } = collect();
    const [e] = parseFx('rise(huge)', report);
    expect(messages[0]).toMatch(/rise\(huge\)/);
    expect(e!.tracks.y).toEqual([40, 0]);
  });
});

describe('presets', () => {
  const one = (fx: string): Effect[] => parseFx(fx, () => undefined);

  it('carries lexicon craft numbers', () => {
    expect(one('rise')[0]!.tracks).toEqual({ opacity: [0, 1], y: [40, 0] });
    expect(one('rise(10%)')[0]!.tracks).toEqual({ opacity: [0, 1], yp: [10, 0] });
    expect(one('focus')[0]!.tracks).toEqual({ blur: [4.5, 0], opacity: [0.34, 1] });
    expect(one('wipe')[0]!.tracks.clip).toEqual([
      [0, 100, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(one('wipe(up)')[0]!.tracks.clip![0]).toEqual([100, 0, 0, 0]);
    expect(one('drift')[0]!.tracks).toEqual({ yp: [-10, 10] });
    expect(one('drift(-24px)')[0]!.tracks).toEqual({ y: [24, -24] });
    expect(one('push(in, 30% 40%)')[0]).toMatchObject({
      tracks: { scale: [1, 1.16] },
      origin: '30% 40%',
    });
    expect(one('push(1.2)')[0]!.tracks).toEqual({ scale: [1.2, 1] });
    expect(one('grow(strong)')[0]!.tracks).toEqual({ opacity: [0, 1], scale: [0.8, 1] });
  });

  it('keeps the five 1.x presets at their 1.x values', () => {
    expect(one('slide-up')[0]!.tracks).toEqual({ yp: [100, 0], opacity: [0, 1] });
    expect(one('zoom-in')[0]!.tracks).toEqual({ scale: [0, 1], opacity: [0, 1] });
    expect(one('rotate-in')[0]!.tracks).toEqual({
      rotate: [-180, 0],
      scale: [0, 1],
      opacity: [0, 1],
    });
    expect(one('blur-in')[0]!.tracks).toEqual({ blur: [10, 0], opacity: [0, 1] });
    expect(one('fade-in')[0]!.duration).toBe(600);
  });

  it('reveal = focus + wipe + push, with clip on its own track', () => {
    const effects = one('reveal(right)');
    expect(effects).toHaveLength(3);
    expect(usedProps(effects, true)).toEqual(new Set(['clip']));
    expect(usedProps(effects, false)).toEqual(new Set(['blur', 'opacity', 'scale']));
    expect(at(effects, 0, true).clip).toEqual([0, 0, 0, 100]);
  });

  it('focus(band) is sharp only in the middle of the passage, on its own view source', () => {
    const band = one('focus(band)');
    expect(band.every((e) => e.own === 'view')).toBe(true);
    expect(at(band, 0)).toMatchObject({ blur: 4.5, opacity: 0.34 });
    expect(at(band, 0.5)).toMatchObject({ blur: 0, opacity: 1 });
    expect(at(band, 1).blur).toBeCloseTo(4.5);
    expect(at(band, 1).opacity).toBeCloseTo(0.34);
  });

  it('narrows a multi-part preset proportionally inside an item range', () => {
    const band = one('focus(band) 0% 50%');
    expect(band[0]!.range).toEqual([0, 0.23]);
    expect(band[1]!.range).toEqual([0.27, 0.5]);
  });
});

describe('composition within one source', () => {
  it('adds translation and multiplies opacity and scale', () => {
    const { report } = collect();
    const a = parseFromTo('opacity:.5; y:10; scale:.5', null, EASES.linear!, report)!;
    const b = parseFromTo('opacity:.5; y:30; scale:.5', null, EASES.linear!, report)!;
    expect(at([a, b], 0)).toMatchObject({ opacity: 0.25, y: 40, scale: 0.25 });
    expect(at([a, b], 1)).toMatchObject({ opacity: 1, y: 0, scale: 1 });
  });

  it('places each effect inside its own range', () => {
    const [e] = parseFx('fade 50% 100%', () => undefined);
    expect(at([e!], 0.25).opacity).toBe(0);
    expect(at([e!], 1).opacity).toBe(1);
  });
});

describe('exit', () => {
  it('plays an entrance preset backwards: identity at 0, hidden at 1', () => {
    const [rise] = parseExit('rise', null, () => undefined);
    expect(at([rise!], 0)).toMatchObject({ opacity: 1, y: 0 });
    expect(at([rise!], 1)).toMatchObject({ opacity: 0, y: 40 });
  });

  it('takes raw target values', () => {
    const [e] = parseExit('opacity:0; y:-40', null, () => undefined);
    expect(at([e!], 0)).toMatchObject({ opacity: 1, y: 0 });
    expect(at([e!], 1)).toMatchObject({ opacity: 0, y: -40 });
  });

  it('reverses the curve in time', () => {
    const [enter] = parseFx('fade', () => undefined);
    const exit = asExit(enter!);
    expect(at([exit], 0.3).opacity).toBeCloseTo(at([enter!], 0.7).opacity, 10);
  });
});

describe('declarations', () => {
  it('reads units, axes and kebab or camel keys', () => {
    const { report, messages } = collect();
    expect(
      parseDeclarations(
        'opacity:40%; y:100%; x:-20px; scale-x:.4; rotateY:.25turn; blur:6; clip:inset(0 100% 0 0)',
        report
      )
    ).toEqual({ opacity: 0.4, yp: 100, x: -20, sx: 0.4, ry: 90, blur: 6, clip: [0, 100, 0, 0] });
    expect(messages).toEqual([]);
  });

  it('reports unknown keys and units', () => {
    const { report, messages } = collect();
    expect(parseDeclarations('color:red; x:3em; opacity', report)).toEqual({});
    expect(messages).toHaveLength(3);
  });

  it('expands inset shorthand', () => {
    expect(parseInset('10%')).toEqual([10, 10, 10, 10]);
    expect(parseInset('inset(0 50%)')).toEqual([0, 50, 0, 50]);
    expect(parseInset('inset(nope)')).toBeNull();
  });
});

describe('frameCss', () => {
  it('writes only touched properties, with perspective for 3D turns', () => {
    const frame = identityFrame();
    frame.ry = 30;
    frame.yp = 10;
    frame.y = 4;
    expect(frameCss(frame, new Set(['ry', 'yp', 'y']))).toEqual({
      translate: '0px calc(4px + 10%)',
      transform: 'perspective(1000px) rotateY(30deg)',
    });
  });

  it('writes per-axis scale and a clip window', () => {
    const frame = identityFrame();
    frame.scale = 2;
    frame.sx = 0.5;
    frame.clip = [0, 25, 0, 0];
    expect(frameCss(frame, new Set(['scale', 'sx', 'clip']))).toEqual({
      scale: '1 2',
      clipPath: 'inset(0% 25% 0% 0%)',
    });
  });
});

describe('defineEffect', () => {
  it('registers a preset from declarations, with arguments', () => {
    defineEffect('swing-test', (args) => ({
      from: { rotate: Number(args[0] ?? 8), opacity: 0 },
      ease: 'pan',
      duration: 700,
    }));
    const [e] = parseFx('swing-test(12)', () => undefined);
    expect(e).toMatchObject({ tracks: { rotate: [12, 0], opacity: [0, 1] }, duration: 700 });
  });

  it('refuses invalid names and built-ins', () => {
    expect(() => defineEffect('Swing', {})).toThrow(TypeError);
    expect(() => defineEffect('rise', {})).toThrow(/built-in/);
  });
});

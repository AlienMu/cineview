import { cubicBezier, EASES, parseEase, settle } from './ease';
import type { ErrorCode } from './errors';
import {
  asExit,
  defineEffect,
  evaluate,
  parseExit,
  parseFromTo,
  parseFx,
  parseItem,
  parseItems,
  turned,
  usedProps,
  withOwnAxes,
  type Effect,
} from './fx';
import { frameCss, identityFrame, mirrorFrame, parseDeclarations, parseInset } from './props';

const collect = (): { report: (m: string) => void; messages: string[] } => {
  const messages: string[] = [];
  return { report: (m) => messages.push(m), messages };
};
const at = (effects: Effect[], p: number, clip = false) => {
  const frame = identityFrame();
  evaluate(effects, p, frame, clip ? 'clip' : 'rest');
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

  it('codes unknown presets as unknown-effect; parse failures carry no code (invalid-attribute)', () => {
    const codes: Array<ErrorCode | undefined> = [];
    parseFx('nope, rise(soft) sideways, rise(huge)', (_m, code) => codes.push(code));
    expect(codes).toEqual(['unknown-effect', undefined, undefined]);
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
    // Lexicon #32: a split line rises 105% and untilts 2.5deg about its bottom-left corner.
    const [line] = one('rise(line)');
    expect(line!.tracks).toEqual({ yp: [105, 0], rotate: [2.5, 0] });
    expect([line!.origin, line!.duration, line!.ease.css]).toEqual([
      'left bottom',
      950,
      'cubic-bezier(0.19, 0.8, 0.22, 1)',
    ]);
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
    expect(usedProps(effects, 'clip')).toEqual(new Set(['clip']));
    expect(usedProps(effects, 'rest')).toEqual(new Set(['blur', 'opacity', 'scale']));
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

  it('skew leans with velocity, mirrored backward, and is dropped under reduced motion', () => {
    const [skew] = one('skew');
    expect(skew).toMatchObject({
      own: 'velocity',
      reducible: true,
      tracks: { sky: [0, -4], sy: [1, 1.1] },
    });
    expect(one('skew(strong)')[0]!.tracks).toEqual({ sky: [0, -8], sy: [1, 1.2] });
    expect(one('skew(2deg)')[0]!.tracks).toEqual({ sky: [0, -2], sy: [1, 1.05] });
    const frame = at([skew!], 0.5);
    expect(frame.sky).toBe(-2);
    mirrorFrame(frame);
    expect(frame.sky).toBe(2);
    expect(frame.sy).toBeCloseTo(1.05);
    expect(frameCss(frame, new Set(['sky'])).transform).toBe('skew(0deg, 2deg)');
  });

  it('narrows a multi-part preset proportionally inside an item range', () => {
    const band = one('focus(band) 0% 50%');
    expect(band[0]!.range).toEqual([0, 0.23]);
    expect(band[1]!.range).toEqual([0.27, 0.5]);
  });

  it('develop is an asset marker, not a track (lexicon #25)', () => {
    const [develop, fade] = one('develop, fade');
    expect(develop!.asset).toBe('develop');
    expect(develop!.entries).toEqual([]);
    expect(fade!.asset).toBeNull();
  });

  it('draw is a dash offset over strokes that measure 1 (lexicon #9)', () => {
    const [draw] = one('draw');
    expect(draw).toMatchObject({ tracks: { draw: [0, 1] }, duration: 1400 });
    const used = new Set(['draw'] as const);
    expect(frameCss(at([draw!], 0), used)).toEqual({ strokeDashoffset: '1.001' });
    expect(frameCss(at([draw!], 1), used)).toEqual({ strokeDashoffset: '0' });
    expect(parseDeclarations('draw:25%', () => undefined)).toEqual({ draw: 0.25 });
  });

  it('count is a track for the wheels, writing no CSS itself (lexicon #13)', () => {
    const [count] = one('count');
    expect(count).toMatchObject({ tracks: { count: [0, 1] }, reducible: true });
    expect(at([count!], 0.5).count).toBe(0.5);
    expect(frameCss(at([count!], 0.5), new Set(['count'] as const))).toEqual({});
  });

  it('axis moves variable-font axes; one value starts there and ends at the text (lexicon #33)', () => {
    const { report, messages } = collect();
    const [axis] = parseFx('axis', report);
    expect(axis!.vars).toEqual([{ name: '--cv-axis-wght', from: 200, to: NaN, unit: '' }]);
    expect([axis!.duration, axis!.ease.css]).toEqual([1100, 'cubic-bezier(0.45, 0, 0.2, 1)']);
    const own = withOwnAxes(axis!, (tag) => (tag === 'wght' ? 700 : 0));
    expect(frameCss(at([own], 0), new Set())).toEqual({
      fontVariationSettings: '"wght" 200',
      '--cv-axis-wght': '200',
    });
    expect(frameCss(at([own], 1), new Set())).toEqual({
      fontVariationSettings: '"wght" 700',
      '--cv-axis-wght': '700',
    });
    const [both] = parseFx('axis(wght 300 800, wdth 75 100)', report);
    expect(withOwnAxes(both!, () => 0)).toBe(both);
    expect(frameCss(at([both!], 1), new Set())).toEqual({
      fontVariationSettings: '"wght" 800, "wdth" 100',
      '--cv-axis-wght': '800',
      '--cv-axis-wdth': '100',
    });
    // from/to take axes too.
    const raw = parseFromTo('--cv-axis-opsz:12', '--cv-axis-opsz:48', null, report);
    expect(frameCss(at([raw!], 1), new Set())).toEqual({
      fontVariationSettings: '"opsz" 48',
      '--cv-axis-opsz': '48',
    });
    parseFx('axis(GRAD 50), axis(wght), axis(wght 1 2 3), axis(weight 300 900)', report);
    expect(messages).toEqual([
      'axis(GRAD 50): GRAD needs a start and an end value',
      'axis(wght): expected an axis and one or two numbers, such as wght 300 800',
      'axis(wght 1 2 3): expected an axis and one or two numbers, such as wght 300 800',
      'axis(weight 300 900): expected an axis and one or two numbers, such as wght 300 800',
    ]);
  });

  it('duotone presses two inks on as opacity, kept by its exit (lexicon #27)', () => {
    const { report, messages } = collect();
    const [plain, named, own] = parseFx('duotone, duotone(orange), duotone(#123, red)', report);
    expect(plain).toMatchObject({ tracks: { opacity: [0, 1] }, duration: 900 });
    expect(plain!.inks).toEqual([
      'var(--cv-duotone-dark,#0f1d45)',
      'var(--cv-duotone-light,#a9cfea)',
    ]);
    expect(named!.inks).toEqual(['#1a120e', '#f08a2c']);
    expect(own!.inks).toEqual(['#123', 'red']);
    expect(asExit(own!).inks).toEqual(['#123', 'red']);
    expect(one('fade')[0]!.inks).toBeNull();
    parseFx('duotone(navy), duotone(#123, 4px)', report);
    expect(messages).toEqual([
      'duotone(navy): expected blue, orange, terracotta, mono, or a dark and a light colour',
      'duotone(#123, 4px): expected blue, orange, terracotta, mono, or a dark and a light colour',
    ]);
  });

  it('unroll moves a strip from 100cqw − 100% to its place, turned for a left start (lexicon #35)', () => {
    const [unroll] = one('unroll');
    expect(unroll).toMatchObject({
      tracks: { xw: [100, 0], xp: [-100, 0] },
      own: 'view',
      flow: true,
      reducible: false,
    });
    const used = usedProps([unroll!], 'rest');
    expect(frameCss(at([unroll!], 0), used)).toEqual({ translate: 'calc(-100% + 100cqw) 0px' });
    expect(frameCss(at([unroll!], 0.75), used)).toEqual({ translate: 'calc(-25% + 25cqw) 0px' });
    expect(frameCss(at([unroll!], 1), used)).toEqual({ translate: '0px 0px' });
    const left = turned(unroll!);
    expect(left.tracks).toEqual({ xw: [0, 100], xp: [0, -100] });
    expect(frameCss(at([left], 1), used)).toEqual({ translate: 'calc(-100% + 100cqw) 0px' });
    expect([left.range, left.ease, left.flow]).toEqual([unroll!.range, unroll!.ease, true]);
    expect(one('fade')[0]!.flow).toBe(false);
  });

  it('invert is an asset marker, not a track (lexicon #40)', () => {
    const [invert] = one('invert');
    expect([invert!.asset, invert!.entries, invert!.inks]).toEqual(['invert', [], null]);
  });

  it("keyframes names the page's rule, linear unless the element eases it (plan v3 §3.3)", () => {
    const { report, messages } = collect();
    const [plain, quoted, ranged] = parseFx(
      'keyframes(spin), keyframes("my spin"), keyframes(-x_1) 20% 60%',
      report
    );
    expect([plain!.keyframes, plain!.entries, plain!.ease.css]).toEqual(['spin', [], 'linear']);
    expect(quoted!.keyframes).toBe('my spin');
    expect([ranged!.keyframes, ranged!.range]).toEqual(['-x_1', [0.2, 0.6]]);
    expect(one('fade')[0]!.keyframes).toBeNull();
    expect(parseFx('keyframes(), keyframes(a, b), keyframes(1x)', report)).toEqual([]);
    expect(messages).toEqual([
      'keyframes(): expected the name of an @keyframes rule',
      'keyframes(a, b): expected the name of an @keyframes rule',
      'keyframes(1x): expected the name of an @keyframes rule',
    ]);
  });

  it('keyframes plays in fx only: exit reports it and keeps the rest', () => {
    const { report, messages } = collect();
    const exits = parseExit('keyframes(spin), fade', null, report);
    expect(exits.map((e) => e.tracks)).toEqual([{ opacity: [1, 0] }]);
    expect(messages).toEqual(['keyframes(spin) plays in fx, not exit']);
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
    expect(parseDeclarations('x:50cqw', report)).toEqual({ xw: 50 });
    expect(messages).toEqual([]);
  });

  it('reports unknown keys and units', () => {
    const { report, messages } = collect();
    expect(parseDeclarations('color:red; x:3em; opacity; y:5cqw', report)).toEqual({});
    expect(messages).toHaveLength(4);
    expect([messages[1], messages[3]]).toEqual([
      'x accepts px, % or cqw, not "em"',
      'y accepts px or %, not "cqw"',
    ]);
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

  it('adds the window term (cqw) to x, and mirrors it', () => {
    const frame = identityFrame();
    frame.x = 3;
    frame.xp = -50;
    frame.xw = 20;
    expect(frameCss(frame, new Set(['xw'])).translate).toBe('calc(3px + -50% + 20cqw) 0px');
    mirrorFrame(frame);
    expect(frame.xw).toBe(-20);
    frame.x = frame.xp = 0;
    expect(frameCss(frame, new Set(['xw'])).translate).toBe('-20cqw 0px');
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

describe('custom properties', () => {
  const vars = (effects: Effect[], p: number) => Object.fromEntries(at(effects, p).vars);

  it("interpolates numbers with their unit; a bare number takes the other side's unit", () => {
    const { report, messages } = collect();
    const e = parseFromTo(
      '--glow:0; --r:4px; opacity:0',
      '--glow:1; --r:12; --a:.5turn',
      null,
      report
    )!;
    expect(messages).toEqual([]);
    expect(e.vars).toEqual([
      { name: '--glow', from: 0, to: 1, unit: '' },
      { name: '--r', from: 4, to: 12, unit: 'px' },
      { name: '--a', from: 0, to: 0.5, unit: 'turn' },
    ]);
    const linear = [{ ...e, ease: (t: number) => t }];
    expect(vars(linear, 0.25)).toEqual({ '--glow': '0.25', '--r': '6px', '--a': '0.125turn' });
    expect(frameCss(at(linear, 0.25), new Set(['opacity']))).toEqual({
      opacity: '0.25',
      '--glow': '0.25',
      '--r': '6px',
      '--a': '0.125turn',
    });
  });

  it('turns colours around the OKLCH hue circle, exact at both ends (lexicon #39)', () => {
    const e = parseFromTo('--tint:#e33', '--tint: oklch(.6 .12 250)', null, () => undefined)!;
    const linear = [{ ...e, ease: (t: number) => t }];
    expect(vars(linear, 0)).toEqual({ '--tint': '#e33' });
    expect(vars(linear, 0.4)).toEqual({
      '--tint': 'color-mix(in oklch, #e33, oklch(.6 .12 250) 40%)',
    });
    expect(vars(linear, 1)).toEqual({ '--tint': 'oklch(.6 .12 250)' });
    // An ease that overshoots holds the colour at its end.
    expect(vars([{ ...e, ease: () => 1.2 }], 1)).toEqual({ '--tint': 'oklch(.6 .12 250)' });
  });

  it('reports what it cannot interpolate, and from/to with only custom properties is an effect', () => {
    const { report, messages } = collect();
    const e = parseFromTo('--a:2px; --c:red; --d:big deal', '--a:1em; --e:blue', null, report);
    expect(messages).toEqual([
      'Cannot read "--d:big deal": a custom property takes a number or a colour',
      '--a changes unit (px to em); use the same unit on both sides',
      '--c needs a colour on both sides',
      '--e needs a colour on both sides',
    ]);
    expect(e).toBeNull();
    // Custom property keys are not reported as unknown properties.
    const quiet = collect();
    expect(parseDeclarations('--glow:1; y:4', quiet.report)).toEqual({ y: 4 });
    expect(quiet.messages).toEqual([]);
    expect(parseFromTo(null, '--glow:1', null, quiet.report)!.vars).toEqual([
      { name: '--glow', from: 0, to: 1, unit: '' },
    ]);
  });

  it('exits run custom properties backwards; raw exits start numbers at 0', () => {
    const e = parseFromTo('--glow:1', '--glow:0.2', null, () => undefined)!;
    expect(asExit(e).vars).toEqual([{ name: '--glow', from: 0.2, to: 1, unit: '' }]);
    const [raw] = parseExit('--glow:1; opacity:0', null, () => undefined);
    expect(raw!.vars).toEqual([{ name: '--glow', from: 0, to: 1, unit: '' }]);
  });

  it('are not written on clip layers; the last effect owns a property', () => {
    const a = parseFromTo('--glow:0', '--glow:1', null, () => undefined)!;
    const b = parseFromTo('--glow:10', '--glow:20', null, () => undefined)!;
    expect(at([a, b], 1).vars.get('--glow')).toBe('20');
    expect(at([a], 1, true).vars.size).toBe(0);
  });

  it('hue turns one shared angle with the passage, a full turn by default (lexicon #37)', () => {
    const { report, messages } = collect();
    const [hue] = parseFx('hue', report);
    expect(hue).toMatchObject({ own: 'view', reducible: false, tracks: {} });
    expect(hue!.vars).toEqual([{ name: '--cv-hue', from: 0, to: 360, unit: 'deg' }]);
    expect(vars([hue!], 0.5)).toEqual({ '--cv-hue': '180deg' });
    expect(parseFx('hue(180deg)', report)[0]!.vars[0]).toMatchObject({ from: 0, to: 180 });
    expect(parseFx('hue(90, .5turn)', report)[0]!.vars[0]).toMatchObject({ from: 90, to: 180 });
    expect(messages).toEqual([]);
    parseFx('hue(red)', report);
    expect(messages).toEqual(['hue(red): expected an angle such as 180deg or .5turn']);
  });

  it('defineEffect takes custom properties in objects', () => {
    defineEffect('tint-test', { from: { '--tint': '#e33' }, to: { '--tint': '#36c', y: 10 } });
    const [e] = parseFx('tint-test', () => undefined);
    expect(e!.vars).toEqual([{ name: '--tint', from: '#e33', to: '#36c', unit: null }]);
    expect(e!.tracks).toEqual({ y: [0, 10] });
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

  it('keeps one level of nested parentheses in a preset argument', () => {
    const item = parseItem('duotone(oklch(.2 .05 250), oklch(.9 .05 250))');
    expect(item?.name).toBe('duotone');
    expect(item?.args).toEqual(['oklch(.2 .05 250)', 'oklch(.9 .05 250)']);
  });
});

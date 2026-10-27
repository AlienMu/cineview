import { identityFrame } from './props';
import { easeInOut, linear, pan } from './ease';
import { evaluateLoops, loopsOverlap, parseLoop } from './loop';

const quiet = (): void => undefined;
const props = (k: Keyframe): string[] =>
  Object.keys(k).filter((p) => p !== 'offset' && p !== 'easing');

describe('parseLoop', () => {
  it('reads raw keyframe lists, units and custom properties (1.x loopAnimation arrays)', () => {
    const [item, glow] = parseLoop(
      'opacity: 1 .45 1; scale: 1 1.45 1; --glow: 0 1 0',
      1600,
      null,
      quiet
    );
    expect(item!.duration).toBe(1600);
    expect(item!.keyframes.map((k) => k.opacity)).toEqual(['1', '0.45', '1']);
    expect(item!.keyframes.map((k) => k.scale)).toEqual(['1', '1.45', '1']);
    expect(item!.keyframes.map((k) => k.offset)).toEqual([0, 0.5, 1]);
    expect(item!.vars).toEqual([]);
    // Custom properties: their own item, one keyframe per 60 Hz frame, eased per segment.
    expect(glow!.duration).toBe(1600);
    expect(glow!.vars).toEqual(['--glow']);
    expect(glow!.keyframes).toHaveLength(2 * 48 + 1);
    expect(glow!.keyframes.every((k) => props(k).join() === '--glow')).toBe(true);
    const value = (offset: number): unknown =>
      glow!.keyframes.find((k) => k.offset === offset)?.['--glow'];
    expect([value(0), value(0.5), value(1)]).toEqual(['0', '1', '0']);
    expect(Number(value(0.125))).toBeCloseTo(easeInOut(0.25), 3);
  });

  it('turns colour lists around the hue circle; lists it cannot interpolate stay as written', () => {
    const [tint] = parseLoop('--tint: #e33 oklch(.6 .12 250) #e33', 1000, null, quiet);
    expect(tint!.keyframes[0]!['--tint']).toBe('#e33');
    expect(tint!.keyframes.find((k) => k.offset === 0.5)!['--tint']).toBe('oklch(.6 .12 250)');
    expect(String(tint!.keyframes[5]!['--tint'])).toMatch(
      /^color-mix\(in oklch, #e33, oklch\(\.6 \.12 250\) [\d.]+%\)$/
    );
    const [mixed] = parseLoop('--m: 0px 1em 0px', 1000, null, quiet);
    expect(mixed!.keyframes.map((k) => k['--m'])).toEqual(['0px', '1em', '0px']);
    expect(mixed!.vars).toEqual(['--m']);
  });

  it('plays an fx preset with custom properties there and back', () => {
    const [hue] = parseLoop('hue(90deg)', 1000, null, quiet);
    expect(hue!.vars).toEqual(['--cv-hue']);
    expect(hue!.keyframes.find((k) => k.offset === 0.5)!['--cv-hue']).toBe('90deg');
    expect(hue!.keyframes.at(-1)!['--cv-hue']).toBe('0deg');
  });

  it('writes font axes as font-variation-settings; a loop needs both ends of an axis', () => {
    const messages: string[] = [];
    const items = parseLoop('axis(wght 300 700), axis(wght 100)', 1000, null, (m) =>
      messages.push(m)
    );
    const [weight] = items;
    const [raw] = parseLoop('--cv-axis-wdth: 75 100 75', 1000, null, quiet);
    expect(items).toHaveLength(1);
    expect(weight!.keyframes[0]!.fontVariationSettings).toBe('"wght" 300');
    expect(weight!.keyframes.find((k) => k.offset === 0.5)!.fontVariationSettings).toBe(
      '"wght" 700'
    );
    expect(weight!.keyframes[0]!['--cv-axis-wght']).toBe('300');
    expect(raw!.keyframes.at(-1)!.fontVariationSettings).toBe('"wdth" 75');
    expect(messages).toEqual(['axis(wght 100): a loop needs both values of each axis']);
  });

  it('holds the last value when lists differ in length', () => {
    const [item] = parseLoop('x: 0 -100%; opacity: 0 1 1 0', null, null, quiet);
    expect(item!.keyframes).toHaveLength(4);
    expect(item!.keyframes.map((k) => k.translate)).toEqual([
      '0px 0px',
      '-100% 0px',
      '-100% 0px',
      '-100% 0px',
    ]);
  });

  it('builds loop presets with their own durations, one animation each', () => {
    const items = parseLoop('float, pulse(strong), spin(left)', null, null, quiet);
    expect(items.map((i) => i.duration)).toEqual([4000, 2000, 8000]);
    expect(items[0]!.keyframes.map((k) => k.translate)).toEqual(['0px 0px', '0px -8px', '0px 0px']);
    expect(items[1]!.keyframes.map((k) => k.scale)).toEqual(['1', '1.08', '1']);
    expect(items[2]!.keyframes.map((k) => k.rotate)).toEqual(['0deg', '-360deg']);
    expect(items[2]!.keyframes[0]!.easing).toBe('linear');
    expect(props(items[0]!.keyframes[0]!)).toEqual(['translate']);
  });

  it('plays any fx preset there and back, with the element ease per segment', () => {
    const [item] = parseLoop('push(in)', null, pan, quiet);
    expect(item!.keyframes.map((k) => k.scale)).toEqual(['1', '1.16', '1']);
    expect(item!.duration).toBe(2400);
    expect(item!.keyframes[0]!.easing).toBe(pan.css);
  });

  it('reports unknown items and keeps the rest', () => {
    const messages: string[] = [];
    const items = parseLoop('float, wobble', null, null, (m) => messages.push(m));
    expect(items).toHaveLength(1);
    expect(messages).toEqual(['Unknown preset "wobble"']);
  });

  it('reports keyframes(), which plays in fx only', () => {
    const messages: string[] = [];
    expect(parseLoop('keyframes(spin)', null, null, (m) => messages.push(m))).toEqual([]);
    expect(messages).toEqual(['keyframes(spin) plays in fx, not loop']);
  });
});

describe('loop composition', () => {
  const frame = (text: string, time: number, duration: number | null = 1000) =>
    evaluateLoops(parseLoop(text, duration, linear, quiet), time, identityFrame(), identityFrame());

  it.each([0, -1])(
    'rejects a nonpositive loop period (%s) before native or direct playback',
    (period) => {
      const messages: string[] = [];
      expect(
        parseLoop('float, float(strong)', period, linear, (message) => messages.push(message))
      ).toEqual([]);
      expect(messages).toEqual(['loop-duration must be greater than 0']);
    }
  );

  it('adds translations/rotations and multiplies opacity/scale independently of declaration order', () => {
    const text = 'float, float(strong), pulse, pulse(strong), breathe, breathe(strong), sway, spin';
    for (const source of [text, text.split(', ').reverse().join(', ')]) {
      const f = frame(source, 500);
      expect(f.y).toBeCloseTo(-24);
      expect(f.scale).toBeCloseTo(1.04 * 1.08);
      expect(f.opacity).toBeCloseTo(0.6 * 0.4);
      expect(f.rotate).toBeCloseTo(180);
    }
  });

  it('keeps independent periods and uses native output only when properties do not overlap', () => {
    expect(frame('sway, spin', 1000, null).rotate).toBeCloseTo(47.4);
    expect(frame('sway, spin', 10000, null).rotate).toBeCloseTo(90);
    expect(loopsOverlap(parseLoop('float, pulse, breathe', null, null, quiet))).toBe(false);
    expect(loopsOverlap(parseLoop('float, float(strong)', null, null, quiet))).toBe(true);
    expect(
      loopsOverlap(parseLoop('axis(wght 300 700), axis(wdth 75 100)', null, null, quiet))
    ).toBe(true);
  });

  it('retains mixed units, independent font axes and later-owner variables/clip', () => {
    const items = [
      ...parseLoop('x: 0 -100% 0', 1000, linear, quiet),
      ...parseLoop('x: 0 20px 0', 1000, linear, quiet),
    ];
    const f = evaluateLoops(items, 250, identityFrame(), identityFrame());
    expect(f.x).toBe(10);
    expect(f.xp).toBe(-50);
    const axes = frame('axis(wght 300 700), axis(wdth 75 100)', 250);
    expect(axes.vars.get('--cv-axis-wght')).toBe('500');
    expect(axes.vars.get('--cv-axis-wdth')).toBe('87.5');
    expect(frame('hue(90deg), hue(180deg)', 250).vars.get('--cv-hue')).toBe('90deg');
    expect(frame('wipe(left), wipe(right)', 250).clip).toEqual([0, 0, 0, 50]);
  });
});

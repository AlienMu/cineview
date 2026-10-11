import { evaluate, parseExit, parseFromTo, parseFx, type Effect, type Source } from '../core/fx';
import { identityFrame, isRest } from '../core/props';
import { solveScene } from '../core/time';
import {
  assignWindows,
  buildFadeLayer,
  buildLayers,
  buildPieceLayers,
  buildTargetLayers,
  clearLayer,
  compositorLayer,
  layerKeyframes,
  planLayers,
  samplesFor,
  writeLayer,
} from './layers';

const fx = (text: string): Effect[] => parseFx(text, () => undefined);
const groups = (entries: Array<[Source, Effect[], Effect[]?]>) =>
  new Map(entries.map(([s, effects, exits]) => [s, { effects, exits: exits ?? [] }]));

describe('planLayers', () => {
  it('nests space → time → clock, with clip layers innermost', () => {
    const plans = planLayers(
      groups([
        ['clock', fx('fade')],
        ['scene', fx('reveal')],
        ['view', fx('drift, wipe')],
      ]),
      'scene'
    );
    expect(plans.map((p) => `${p.kind}:${p.source}`)).toEqual([
      'space:view',
      'time:scene',
      'clock:clock',
      'clip:view',
      'clip:scene',
    ]);
  });

  it('gives view effects one layer per named range, in order of first use', () => {
    const plans = planLayers(
      groups([['view', fx('drift, fade entry, focus(band), wipe exit, grow entry')]]),
      '#hero'
    );
    expect(plans.map((p) => `${p.kind}:${p.range?.[0].name ?? 'all'}:${p.effects.length}`)).toEqual(
      ['space:all:3', 'space:entry:2', 'clip:exit:1']
    );
    expect(plans.every((p) => p.subject === '#hero')).toBe(true);
  });

  it('gives custom properties a layer of their own source, kept off the compositor', () => {
    const vars = parseFromTo('--glow:0', '--glow:1', null, () => undefined)!;
    const plans = planLayers(
      groups([
        ['view', [vars]],
        ['scene', fx('wipe')],
      ]),
      'scene'
    );
    expect(plans.map((p) => `${p.kind}:${p.source}`)).toEqual(['space:view', 'clip:scene']);
    const host = document.createElement('div');
    const [space, clip] = buildLayers(host, plans);
    expect([...space!.vars]).toEqual(['--glow']);
    expect(clip!.vars.size).toBe(0);
    expect(compositorLayer(space!)).toBe(false);
    expect(
      compositorLayer(buildLayers(host, planLayers(groups([['view', fx('drift')]]), 'scene'))[0]!)
    ).toBe(true);
    // Clock-played: a keyframe per 60 Hz frame (an unregistered property steps between them).
    expect(samplesFor(space!, 600)).toBe(36);
    expect(samplesFor(space!, 100)).toBe(12);
    writeLayer(space!, 0.5, 0);
    expect(space!.el.style.getPropertyValue('--glow')).toBe('0.5');
    clearLayer(space!);
    expect(space!.el.style.getPropertyValue('--glow')).toBe('');
  });

  it('puts clip-only exits on a clip layer of the time source', () => {
    const plans = planLayers(
      groups([['scene', fx('fade'), parseExit('wipe', null, () => undefined)]]),
      'scene'
    );
    expect(plans.map((p) => p.kind)).toEqual(['time', 'clip']);
  });
});

describe('buildLayers', () => {
  it('nests layer divs around a slot, applying a push focus as transform-origin', () => {
    const host = document.createElement('div');
    const layers = buildLayers(
      host,
      planLayers(groups([['scene', fx('push(in, 20% 30%)')]]), 'scene')
    );
    expect(layers).toHaveLength(1);
    expect(layers[0]!.el.style.transformOrigin).toBe('20% 30%');
    expect(host.shadowRoot!.querySelector('.l > slot')).not.toBeNull();
  });
});

describe('stagger targets', () => {
  const setup = () => {
    const children = [0, 1, 2].map(() => document.createElement('span'));
    const [plan] = planLayers(groups([['scene', fx('reveal')]]), 'scene');
    const layers = buildTargetLayers(children, plan!);
    const solved = solveScene([
      {
        name: null,
        duration: 400,
        delay: 100,
        after: null,
        at: null,
        exitDuration: 200,
        stagger: { each: 100, from: 'first', count: 3 },
      },
    ]).byIndex[0]!;
    assignWindows(layers, solved);
    return { children, layers };
  };

  it('gives each child its slice of the element window, exits included', () => {
    const { layers } = setup();
    // Element: [100, 700] entrance, [700, 900] exit; span 600 = tail 200 + item 400.
    // Child k occupies [k/6, (k + 4)/6] of each window.
    const want = [0, 1, 2].map((k) => [
      100 + (600 * k) / 6,
      100 + (600 * (k + 4)) / 6,
      700 + (200 * k) / 6,
      700 + (200 * (k + 4)) / 6,
    ]);
    layers.forEach((l, k) => {
      const w = l.window!;
      [w.start, w.end, w.exitStart, w.exitEnd].forEach((v, i) =>
        expect(v).toBeCloseTo(want[k]![i]!, 9)
      );
    });
  });

  it('writes only safe properties on author elements; the rest as variables, all undoable', () => {
    const { children, layers } = setup();
    writeLayer(layers[0]!, 0.5, 0);
    const style = children[0]!.style;
    expect(style.getPropertyValue('--cv-filter')).toMatch(/^blur\(/);
    expect(style.getPropertyValue('--cv-clip-path')).toMatch(/^inset\(/);
    expect(style.filter).toBe('');
    expect(style.opacity).not.toBe('');
    clearLayer(layers[0]!);
    expect(children[0]!.getAttribute('style') ?? '').toBe('');
  });
});

describe('split pieces', () => {
  const pieces = (n: number): HTMLElement[] =>
    Array.from({ length: n }, () => document.createElement('span'));

  it('gives progress-driven pieces overlapping windows of five units, one apart (lexicon #10)', () => {
    const [plan] = planLayers(groups([['view', fx('fade')]]), 'scene');
    const els = pieces(6);
    const layers = buildPieceLayers(els, [plan!], false);
    // n = 6: a unit is 1/10; piece k spans [k, k + 5] units.
    expect(layers.map((l) => l.effects[0]!.range.map((v) => Math.round(v * 100)))).toEqual(
      [0, 1, 2, 3, 4, 5].map((k) => [k * 10, (k + 5) * 10])
    );
    expect(layers.every((l) => l.piece && !compositorLayer(l))).toBe(true);
    writeLayer(layers[2]!, 0.3, 0);
    expect(Number(els[2]!.style.opacity)).toBeGreaterThan(0);
    expect(Number(els[2]!.style.opacity)).toBeLessThan(1);
    writeLayer(layers[5]!, 0.3, 0);
    expect(els[5]!.style.opacity).toBe('0');
  });

  it('makes time-driven pieces stagger items, with the effect origin on each piece', () => {
    const plan = {
      ...planLayers(groups([['scene', fx('rise(line)')]]), 'scene')[0]!,
      select: 'all' as const,
    };
    const els = pieces(3);
    const layers = buildPieceLayers(els, [plan], true);
    expect(layers.map((l) => l.item)).toEqual([0, 1, 2]);
    expect(els.every((el) => el.style.transformOrigin === 'left bottom')).toBe(true);
    let seen = -1;
    layers[0]!.watch = (p) => (seen = p);
    writeLayer(layers[0]!, 0.25, 0);
    expect(seen).toBe(0.25);
  });

  it('knows which end states leave the text as it is', () => {
    const end = identityFrame();
    expect(isRest(end)).toBe(true);
    for (const [text, rest] of [
      ['rise(line)', true],
      ['fade', true],
      ['wipe', true],
      ['drift', false],
    ] as const) {
      const frame = identityFrame();
      for (const e of fx(text)) {
        evaluate([e], 1, frame, 'all');
        expect([text, isRest(frame)]).toEqual([text, rest]);
      }
    }
  });
});

describe('fade layers (F12)', () => {
  const blurOnly = (text: string): ReturnType<typeof planLayers>[number] => {
    const [plan] = planLayers(groups([['view', fx(text)]]), 'scene');
    return {
      ...plan!,
      effects: plan!.effects.map((e) => ({
        ...e,
        tracks: { blur: e.tracks.blur! },
        entries: e.entries.filter(([p]) => p === 'blur'),
      })),
    };
  };

  it('shows the blur as opacity of the copy, full at the most blur, on the compositor', () => {
    const el = document.createElement('div');
    const layer = buildFadeLayer(blurOnly('focus(band)'), el, 4.5);
    expect([...layer.used]).toEqual(['opacity']);
    expect(compositorLayer(layer)).toBe(true);
    // Blurred at both ends of the passage, sharp in the middle.
    const opacity = (p: number): number => (writeLayer(layer, p, 0), Number(el.style.opacity));
    expect(opacity(0)).toBe(1);
    expect(opacity(0.23)).toBeCloseTo(0.5, 1);
    expect(opacity(0.5)).toBe(0);
    expect(opacity(1)).toBe(1);
    expect(el.style.filter).toBe('');
    const frames = layerKeyframes(layer);
    expect(frames.every((k) => Object.keys(k).sort().join() === 'offset,opacity')).toBe(true);
  });
});

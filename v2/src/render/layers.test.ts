import { linear } from '../core/ease';
import {
  evaluate,
  makeEffect,
  parseExit,
  parseFromTo,
  parseFx,
  type Effect,
  type Source,
} from '../core/fx';
import { identityFrame, isRest } from '../core/props';
import { solveScene } from '../core/time';
import {
  assignWindows,
  buildAdaptedLayer,
  buildFadeLayer,
  buildLayers,
  buildPieceLayers,
  buildTargetLayers,
  clearLayer,
  compositorLayer,
  exitKeyframes,
  layerKeyframes,
  placeKeyframes,
  planLayers,
  samplesFor,
  sceneKeyframes,
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

  it('orders different sources canonically when declarations arrive in reverse order', () => {
    const source = [
      ['view', fx('drift')],
      ['page', [makeEffect({ tracks: { rotate: [0, 90] }, ease: linear })]],
    ] as Array<[Source, Effect[]]>;
    const a = planLayers(groups(source), 'scene');
    const b = planLayers(groups([...source].reverse()), 'scene');
    expect(a.map((p) => p.source)).toEqual(b.map((p) => p.source));
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

  it('publishes animated axes for split fragments without losing individual axis values', () => {
    const [plan] = planLayers(
      groups([
        [
          'scene',
          fx('axis(wght 300 700), axis(wdth 75 100)').map((effect) => ({
            ...effect,
            ease: linear,
          })),
        ],
      ]),
      'scene'
    );
    const [layer] = buildPieceLayers(pieces(1), [plan!], true);
    writeLayer(layer!, 0.5, 0);
    expect(layer!.el.style.getPropertyValue('--cv-axis-wght')).toBe('500');
    expect(layer!.el.style.getPropertyValue('--cv-axis-wdth')).toBe('87.5');
    expect(layerKeyframes(layer!, 12)[6]!['--cv-axis-wght']).toBe('500');
  });

  it('composes different view ranges once on the same piece and ordinary element', () => {
    const entry = makeEffect({ tracks: { y: [0, 20], opacity: [1, 0.5] }, ease: linear });
    const exit = makeEffect({ tracks: { y: [0, 10], opacity: [1, 0.2] }, ease: linear });
    for (const reversed of [false, true]) {
      const plans = [
        { ...planLayers(groups([['view', [entry]]]), 'scene')[0]! },
        { ...planLayers(groups([['view', [exit]]]), 'scene')[0]! },
      ];
      if (reversed) plans.reverse();
      const layers = buildPieceLayers(pieces(1), plans, false);
      for (const l of layers) writeLayer(l, 0.5, 0);
      // One piece spans the entire progress; both tracks are at their midpoint.
      expect(layers[0]!.el.style.translate).toBe('0px 15px');
      expect(+layers[0]!.el.style.opacity).toBeCloseTo(0.75 * 0.6);
      const whole = buildLayers(document.createElement('div'), plans);
      for (const l of whole) writeLayer(l, 0.5, 0);
      expect(whole[0]!.el).toBe(whole[1]!.el);
      expect(whole[0]!.el.style.translate).toBe('0px 15px');
      expect(+whole[0]!.el.style.opacity).toBeCloseTo(0.75 * 0.6);
      expect(compositorLayer(whole[0]!)).toBe(false);
    }
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

describe('main-thread layers', () => {
  it('draw writes a dash offset that the strokes inherit, off the compositor (lexicon #9)', () => {
    const host = document.createElement('div');
    const [layer] = buildLayers(host, planLayers(groups([['view', fx('draw')]]), 'scene'));
    expect(compositorLayer(layer!)).toBe(false);
    writeLayer(layer!, 0.5, 0);
    expect(layer!.el.style.strokeDashoffset).toBe('0.5005');
    expect(layerKeyframes(layer!)[0]).toEqual({ offset: 0, strokeDashoffset: '1.001' });
    writeLayer(layer!, 1, 0);
    expect(layer!.el.style.strokeDashoffset).toBe('0');
  });

  it('adapted layers rewrite each frame into their custom properties', () => {
    const el = document.createElement('div');
    const [plan] = planLayers(groups([['scene', fx('count')]]), 'scene');
    const layer = buildAdaptedLayer(
      plan!,
      el,
      (frame) => frame.vars.set('--n', String(frame.count * 10)),
      ['--n']
    );
    expect(compositorLayer(layer)).toBe(false);
    expect(samplesFor(layer, 1000)).toBe(60);
    writeLayer(layer, 0.5, 0);
    expect(el.style.getPropertyValue('--n')).toBe('5');
    expect(layerKeyframes(layer).at(-1)).toEqual({ offset: 1, '--n': '10' });
  });

  it('axes are written as font-variation-settings, for the text to inherit (lexicon #33)', () => {
    const host = document.createElement('div');
    const [layer] = buildLayers(
      host,
      planLayers(groups([['view', fx('axis(wght 300 800)')]]), 'scene')
    );
    expect(compositorLayer(layer!)).toBe(false);
    writeLayer(layer!, 1, 0);
    expect(layer!.el.style.fontVariationSettings).toBe('"wght" 800');
    expect(layer!.el.style.getPropertyValue('--cv-axis-wght')).toBe('800');
    clearLayer(layer!);
    expect(layer!.el.getAttribute('style') ?? '').toBe('');
  });
});

describe('sampled effect timing', () => {
  const opacityAt = (frames: Keyframe[], p: number): number => {
    const after = frames.findIndex((f) => f.offset! > p);
    if (after < 0) return Number(frames[frames.length - 1]!.opacity);
    const a = frames[Math.max(0, after - 1)]!;
    const b = frames[after]!;
    const k = (p - a.offset!) / (b.offset! - a.offset!);
    return Number(a.opacity) + (Number(b.opacity) - Number(a.opacity)) * k;
  };
  const layerFor = (source: Source, effects: Effect[], exits: Effect[] = []) =>
    buildLayers(
      document.createElement('div'),
      planLayers(groups([[source, effects, exits]]), 'scene')
    )[0]!;
  const fade = (range: readonly [number, number], ease = linear) =>
    makeEffect({ tracks: { opacity: [0, 1] }, range, ease });

  it.each(['view', 'clock'] as const)(
    'holds a narrow %s effect until its authored start',
    (source) => {
      const frames = layerKeyframes(layerFor(source, [fade([0.49, 0.5])]));
      for (const [p, opacity] of [
        [0.45, 0],
        [0.49, 0],
        [0.495, 0.5],
        [0.5, 1],
        [0.7, 1],
      ]) {
        expect(opacityAt(frames, p!)).toBeCloseTo(opacity!, 8);
      }
    }
  );

  it('samples easing inside a short interval and composes overlapping effects there', () => {
    const curve = layerKeyframes(layerFor('view', [fade([0.49, 0.5], (t) => t * t)]));
    expect(opacityAt(curve, 0.495)).toBeCloseTo(0.25, 8);
    const combined = layerKeyframes(layerFor('view', [fade([0.49, 0.5]), fade([0.495, 0.505])]));
    expect(opacityAt(combined, 0.49)).toBe(0);
    expect(opacityAt(combined, 0.4975)).toBeCloseTo(0.75 * 0.25, 8);
  });

  it('starts an interrupted clock exit at the displayed entrance value and reaches its authored end', () => {
    const layer = layerFor(
      'enter',
      [makeEffect({ tracks: { opacity: [0, 1], y: [20, 0] }, ease: linear })],
      parseExit('opacity:0; y:-16', linear, () => undefined)
    );
    const frames = exitKeyframes(layer, 12, 0.5);
    expect(+frames[0]!.opacity!).toBeCloseTo(0.5);
    expect(frames[0]!.translate).toBe('0px 10px');
    expect(+frames.at(-1)!.opacity!).toBe(0);
    expect(frames.at(-1)!.translate).toBe('0px -16px');
  });

  it('retains the boundary of an exit played on a clock', () => {
    const layer = layerFor(
      'enter',
      [fade([0, 1])],
      parseExit('fade 49% 50%', linear, () => undefined)
    );
    const frames = exitKeyframes(layer);
    expect(opacityAt(frames, 0.49)).toBe(1);
    expect(opacityAt(frames, 0.505)).toBeCloseTo(0.5, 8);
    expect(opacityAt(frames, 0.6)).toBe(0);
  });

  it('maps effect boundaries into entrance and exit scene windows', () => {
    const layer = layerFor(
      'scene',
      [fade([0.49, 0.5])],
      parseExit('fade 49% 50%', linear, () => undefined)
    );
    const frames = sceneKeyframes(
      layer,
      { start: 100, end: 300, exitStart: 400, exitEnd: 600 },
      800
    );
    expect(opacityAt(frames, 190 / 800)).toBe(0);
    expect(opacityAt(frames, 199 / 800)).toBeCloseTo(0.5, 8);
    expect(opacityAt(frames, 490 / 800)).toBe(1);
    expect(opacityAt(frames, 501 / 800)).toBeCloseTo(0.5, 8);
  });

  it('keeps a zero-length effect as a step instead of interpolating toward it', () => {
    const frames = layerKeyframes(layerFor('view', [fade([0.49, 0.49])]));
    expect(frames.filter((f) => f.offset === 0.49).map((f) => Number(f.opacity))).toEqual([0, 1]);
    expect(opacityAt(frames, 0.48)).toBe(0);
    expect(opacityAt(frames, 0.49)).toBe(1);
  });

  it('keeps an exit step without undoing an entrance that completed at a step', () => {
    const layer = layerFor(
      'scene',
      [fade([1, 1])],
      parseExit('fade 50% 50%', linear, () => undefined)
    );
    const frames = sceneKeyframes(
      layer,
      { start: 100, end: 300, exitStart: 400, exitEnd: 600 },
      800
    );
    expect(opacityAt(frames, 299 / 800)).toBe(0);
    expect(opacityAt(frames, 300 / 800)).toBe(1);
    expect(frames.filter((f) => f.offset === 500 / 800).map((f) => Number(f.opacity))).toEqual([
      1, 0,
    ]);
    expect(opacityAt(frames, 499 / 800)).toBe(1);
    expect(opacityAt(frames, 500 / 800)).toBe(0);
  });

  it.each([0.37, 0.49, 1 / 3])('keeps step values when scene mapping rounds progress %s', (p) => {
    const layer = layerFor('scene', [fade([p, p])]);
    const start = 53.7,
      end = 690.9,
      total = 1000;
    const offset = (start + (end - start) * p) / total;
    const frames = sceneKeyframes(layer, { start, end, exitStart: end, exitEnd: end }, total);
    expect(frames.filter((f) => f.offset === offset).map((f) => Number(f.opacity))).toEqual([0, 1]);
  });
});

describe('keyframes layers (keyframes(name))', () => {
  const rule: Keyframe[] = [
    { easing: 'linear', opacity: '0', offset: 0 },
    { easing: 'steps(2)', opacity: '.5', offset: 0.5 },
    { easing: 'linear', opacity: '1', offset: 1 },
  ];

  it('places a rule on part of the progress, holding its ends outside it', () => {
    expect(placeKeyframes(rule, 0, 1)).toEqual(rule);
    const placed = placeKeyframes(rule, 0.2, 0.6);
    expect(placed.map((k) => [+k.offset!.toFixed(4), k.opacity, k.easing])).toEqual([
      [0, '0', 'linear'],
      [0.2, '0', 'linear'],
      [0.4, '.5', 'steps(2)'],
      [0.6, '1', 'linear'],
      [1, '1', 'linear'],
    ]);
    // A property the rule leaves to the element at an end is not held there.
    const open = [{ opacity: '.5', offset: 0.5 }];
    expect(placeKeyframes(open, 0.5, 1)).toEqual([{ opacity: '.5', offset: 0.75 }]);
  });

  it('plays the rule outermost, on its part of the scene, holding its end on exit', () => {
    const host = document.createElement('div');
    const [effect] = parseFx('keyframes(pop) 50% 100%', () => undefined);
    const plan = {
      kind: 'keyframes' as const,
      source: 'scene' as const,
      subject: 'scene' as const,
      range: null,
      effects: [effect!],
      exitEffects: [],
      select: 'rest' as const,
    };
    const [layer, time] = buildLayers(host, planLayers(groups([['scene', fx('fade')]]), 'scene'), [
      { plan, keyframes: rule },
    ]);
    expect(layer!.el.parentNode).toBe(host.shadowRoot);
    expect(layer!.el.getAttribute('part')).toBe('layer keyframes');
    expect(time!.el.parentNode).toBe(layer!.el);
    expect([layer!.rule !== null, time!.rule, layer!.used.size, compositorLayer(layer!)]).toEqual([
      true,
      null,
      0,
      true,
    ]);
    expect(layerKeyframes(layer!).map((k) => k.offset)).toEqual([0, 0.5, 0.75, 1]);
    const window = { start: 100, end: 300, exitStart: 300, exitEnd: 400 };
    // The layer's own holds (at 0 and its part, 50%) are placed with it: 0 → 25%, 50% → 50%.
    expect(sceneKeyframes(layer!, window, 400).map((k) => k.offset)).toEqual([
      0, 0.25, 0.5, 0.625, 0.75, 1,
    ]);
    expect(exitKeyframes(layer!)).toEqual([
      { easing: 'linear', opacity: '1', offset: 0 },
      { easing: 'linear', opacity: '1', offset: 1 },
    ]);
  });
});

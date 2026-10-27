import { CvAnimate } from './animate';
import { CvScene } from './scene';
import { CvStage } from './stage';
import { CvStack } from './stack';
import { CvFixed } from './fixed';
import { defineEffect } from '../core/fx';
import { platform } from '../platform';

class Observer {
  static all: Observer[] = [];
  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit
  ) {
    Observer.all.push(this);
  }
  observe(): void {}
  disconnect(): void {}
  deliver(target: Element): void {
    this.callback(
      [{ target, isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await jest.advanceTimersByTimeAsync(20);
};
const nativeWindow = (stage: CvStage) => {
  const observer = [...Observer.all]
    .reverse()
    .find((o) => o.options?.rootMargin === '200% 0px 200% 0px')!;
  for (const scene of stage.ordered) observer.deliver(scene);
};
const stageWith = async (input: 'drag' | 'scroll', content: string) => {
  const stage = document.createElement('cv-stage') as CvStage;
  stage.input = input;
  stage.innerHTML = content;
  document.body.append(stage);
  await settle();
  return stage;
};

beforeAll(() => {
  customElements.define('cv-stage', CvStage);
  customElements.define('cv-scene', CvScene);
  customElements.define('cv-animate', CvAnimate);
  customElements.define('cv-stack', CvStack);
  customElements.define('cv-fixed', CvFixed);
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: Observer });
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe(): void {}
      disconnect(): void {}
    },
  });
});

beforeEach(() => {
  jest.useFakeTimers();
  Observer.all = [];
  platform.ViewTimeline = undefined;
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value: jest.fn(() => {
      const animation = {
        playState: 'running',
        ready: Promise.resolve(),
        pause: jest.fn(() => {
          animation.playState = 'paused';
        }),
        play: jest.fn(() => {
          animation.playState = 'running';
        }),
        cancel: jest.fn(() => {
          animation.playState = 'idle';
        }),
        finished: new Promise(() => undefined),
      };
      return animation;
    }),
  });
});

afterEach(() => {
  document.body.replaceChildren();
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('stage rebuild identity', () => {
  it('keeps the current scene through insertion, deletion before it and reorder', async () => {
    const stage = await stageWith(
      'drag',
      '<cv-scene id="a"></cv-scene><cv-scene id="b"></cv-scene><cv-scene id="c"></cv-scene>'
    );
    stage.goTo('b', { animated: false });
    const changes = jest.fn();
    stage.addEventListener('cv-enter', changes);
    stage.addEventListener('cv-leave', changes);
    const b = stage.querySelector('#b')!;
    stage.prepend(document.createElement('cv-scene'));
    await settle();
    expect(stage.ordered[stage.current]).toBe(b);
    expect(changes).not.toHaveBeenCalled();
    expect(stage.shadowRoot!.querySelector('.live')!.textContent).toBe('3 / 4');
    stage.firstElementChild!.remove();
    await settle();
    expect(stage.ordered[stage.current]).toBe(b);
    expect(changes).not.toHaveBeenCalled();
    stage.append(b);
    await settle();
    expect(stage.ordered[stage.current]).toBe(b);
    expect(changes).not.toHaveBeenCalled();
    expect(stage.shadowRoot!.querySelector('.live')!.textContent).toBe('3 / 3');
  });

  it('uses the nearest remaining index only when the current scene was removed', async () => {
    const stage = await stageWith(
      'drag',
      '<cv-scene id="a"></cv-scene><cv-scene id="b"></cv-scene><cv-scene id="c"></cv-scene>'
    );
    stage.goTo('b', { animated: false });
    stage.querySelector('#b')!.remove();
    await settle();
    expect(stage.ordered[stage.current]!.id).toBe('c');
    stage.querySelector('#c')!.remove();
    await settle();
    expect(stage.ordered[stage.current]!.id).toBe('a');
  });
});

describe('scroll input lifetime', () => {
  const view =
    '<cv-scene><cv-animate fx="fade" on="view(self)" ease="linear">Content</cv-animate></cv-scene>';

  it('projects a direct fixed child outside the moving row and restores its original slot on removal', async () => {
    const stage = await stageWith(
      'scroll',
      '<cv-scene track="x"><div>Moving</div><cv-fixed slot=""><span>Fixed</span></cv-fixed></cv-scene>'
    );
    const scene = stage.ordered[0]!;
    const fixed = scene.querySelector('cv-fixed')!;
    const slot = scene.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="cv-fixed"]')!;
    expect(fixed.slot).toBe('cv-fixed');
    expect(slot.parentElement).toBe(scene.shell);
    expect(scene.track!.contains(slot)).toBe(false);
    fixed.remove();
    expect(fixed.getAttribute('slot')).toBe('');
    scene.append(fixed);
    expect(fixed.slot).toBe('cv-fixed');
    fixed.slot = 'author-slot';
    fixed.remove();
    expect(fixed.slot).toBe('author-slot');
  });

  it('returns to a sticky Scene using its document position, including fractional pixels', async () => {
    const stage = await stageWith(
      'scroll',
      '<cv-scene id="held" stack></cv-scene><cv-scene id="next"></cv-scene>'
    );
    const held = stage.ordered[0]!;
    held.docTop = 800.25;
    jest.spyOn(held, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1280, 800));
    const scroll = jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    stage.goTo('held', { animated: false });
    expect(scroll).toHaveBeenLastCalledWith({ top: 800.25, behavior: 'instant' });
    stage.goTo(0);
    expect(scroll).toHaveBeenLastCalledWith({ top: 800.25, behavior: 'smooth' });
    stage.goTo('missing');
    expect(scroll).toHaveBeenCalledTimes(2);
  });

  it('cancels a queued scroll frame and ignores a late fonts-ready callback after removal', async () => {
    let fontsReady!: () => void;
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        ready: new Promise<void>((resolve) => {
          fontsReady = resolve;
        }),
      },
    });
    const stage = await stageWith('scroll', view);
    const refresh = jest.spyOn(stage.engine!, 'refresh');
    window.dispatchEvent(new Event('scroll'));
    stage.remove();
    const before = stage.innerHTML + stage.querySelector('cv-animate')!.shadowRoot!.innerHTML;
    jest
      .spyOn(stage.querySelector('cv-animate')!, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(0, 1000, 200, 200));
    fontsReady();
    await settle();
    expect(stage.innerHTML + stage.querySelector('cv-animate')!.shadowRoot!.innerHTML).toBe(before);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('reattaches native animations after an authored effect changes and the stage reconnects', async () => {
    platform.ViewTimeline = class {
      currentTime = null;
    };
    const stage = await stageWith('scroll', view);
    nativeWindow(stage);
    await settle();
    const a = stage.querySelector('cv-animate') as CvAnimate;
    expect(a.layers[0]!.native).not.toBeNull();
    a.setAttribute('fx', 'fade 10% 90%');
    await settle();
    nativeWindow(stage);
    await settle();
    expect(a.layers[0]!.native).not.toBeNull();
    stage.remove();
    document.body.append(stage);
    await settle();
    nativeWindow(stage);
    await settle();
    expect(a.layers[0]!.native).not.toBeNull();
  });

  it('prevents an idle attach from the old input running after a rebuild', async () => {
    platform.ViewTimeline = class {
      currentTime = null;
    };
    const stage = await stageWith('scroll', view);
    nativeWindow(stage);
    stage.setAttribute('fallback', '');
    await settle();
    expect(HTMLElement.prototype.animate).not.toHaveBeenCalled();
    const scene = stage.ordered[0]!;
    expect(scene.nativeAttached).toBe(false);
    expect(scene.nativePending).toBe(false);
  });
});

describe('autonomous Scene clocks', () => {
  it('solves clock timing and stagger separately from a scroll-zone budget', async () => {
    const stage = await stageWith(
      'scroll',
      `<cv-scene zone>
      <cv-animate fx="fade" duration="400">Scene</cv-animate>
      <cv-animate id="clock" on="clock" fx="fade" duration="5000">Clock</cv-animate>
    </cv-scene>`
    );
    const scene = stage.ordered[0]!,
      a = stage.querySelector('#clock') as CvAnimate;
    expect(scene.solution.total).toBe(400);
    expect(a.solved).toBeNull();
    expect(a.clockSolved?.end).toBe(5000);
    expect(a.layers.find((l) => l.source === 'clock')?.window?.end).toBe(5000);
  });

  it('keeps a long clock preset out of a mixed element’s Scene duration', async () => {
    defineEffect('test-long-clock', {
      from: { rotate: 0 },
      to: { rotate: 90 },
      on: 'clock',
      duration: 5000,
    });
    const stage = await stageWith(
      'scroll',
      '<cv-scene zone><cv-animate id="mixed" fx="fade, test-long-clock">Mixed</cv-animate></cv-scene>'
    );
    const a = stage.querySelector('#mixed') as CvAnimate;
    expect(a.timeSpec().duration).toBe(600);
    expect(a.timeSpec('clock').duration).toBe(5000);
    expect(stage.ordered[0]!.solution.total).toBe(600);
    expect(a.clockSolved?.end).toBe(5000);
  });

  it('preserves the current Scene clock through a structural rebuild', async () => {
    const stage = await stageWith(
      'scroll',
      '<cv-scene><cv-animate id="clock" on="clock" fx="fade" duration="1000">Clock</cv-animate></cv-scene>'
    );
    stage.setCurrent(0);
    await jest.advanceTimersByTimeAsync(200);
    const a = stage.querySelector('#clock') as CvAnimate,
      before = a.timeline.progress;
    stage.append(document.createElement('cv-scene'));
    await settle();
    expect(a.timeline.progress).toBeGreaterThanOrEqual(before);
    expect(a.timeline.progress - before).toBeCloseTo(0.1);
  });

  it('restores a completed clock and its loop synchronously while paused', async () => {
    const stage = await stageWith(
      'scroll',
      '<cv-scene><cv-animate on="clock" fx="fade" duration="120" loop="float, float(strong)">Clock</cv-animate></cv-scene>'
    );
    stage.setCurrent(0);
    await jest.advanceTimersByTimeAsync(200);
    stage.pause();
    stage.append(document.createElement('cv-scene'));
    await settle();
    const a = stage.querySelector('cv-animate') as CvAnimate;
    expect(a.timeline.phase).toBe('entered');
    expect(a.getAttribute('data-cv-phase')).toBe('entered');
    expect(a.clockComplete).toBe(true);
    expect(a.looping).toBe(true);
  });

  it('starts at current-Scene entry, follows pause, ends on departure and restarts on reentry', async () => {
    const stage = await stageWith(
      'scroll',
      `<cv-scene><cv-animate id="clock" on="clock" fx="fade" duration="1000">Clock</cv-animate></cv-scene><cv-scene>Next</cv-scene>`
    );
    const a = stage.querySelector('#clock') as CvAnimate;
    stage.setCurrent(0);
    const initial = a.timeline.progress;
    await jest.advanceTimersByTimeAsync(200);
    expect(a.timeline.progress - initial).toBeCloseTo(0.2);
    expect(a.timeline.source).toBe('clock');
    stage.pause();
    const held = a.timeline.progress;
    await jest.advanceTimersByTimeAsync(1000);
    expect(a.timeline.progress).toBe(held);
    stage.play();
    await jest.advanceTimersByTimeAsync(100);
    expect(a.timeline.progress - held).toBeCloseTo(0.1);
    stage.setCurrent(1);
    expect(a.timeline.phase).toBe('idle');
    stage.setCurrent(0);
    expect(a.timeline.progress).toBe(0);
    expect(a.timeline.phase).toBe('entering');
  });
});

describe('explicit source contexts', () => {
  let errors: Array<{ code: string; message: string; element: Element }>;
  const record = (event: Event) => {
    event.preventDefault();
    errors.push((event as CustomEvent).detail);
  };
  beforeEach(() => {
    errors = [];
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    document.body.addEventListener('cv-error', record);
  });
  afterEach(() => document.body.removeEventListener('cv-error', record));

  it.each([
    ['', 'scene'],
    ['zone', 'enter'],
    ['zone', 'eye'],
    ['track="x"', 'enter'],
    ['track="x"', 'eye'],
  ])('rejects scroll Scene %s with on=%s without rejecting a valid sibling', async (attrs, on) => {
    const stage = await stageWith(
      'scroll',
      `<cv-scene ${attrs}>
      <cv-animate id="bad" on=" ${on} " fx="fade" duration="9000">Author content</cv-animate>
      <cv-animate id="good" fx="fade" duration="400">Valid</cv-animate>
    </cv-scene>`
    );
    const bad = stage.querySelector('#bad') as CvAnimate;
    const good = stage.querySelector('#good') as CvAnimate;
    const scene = stage.ordered[0]!;
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: 'invalid-attribute', element: bad });
    expect(errors[0]!.message).toContain(`on="${on}"`);
    expect(scene.ordered).toEqual([good]);
    expect(scene.solution.total).toBe(400);
    expect(bad.layers).toHaveLength(0);
    expect(bad.solved).toBeNull();
    expect(bad.looping).toBe(false);
    expect(bad.timeline.phase).toBe('idle');
    expect(bad.textContent).toBe('Author content');
    expect(bad.shadowRoot!.querySelector('slot')).not.toBeNull();
    expect(good.layers.length).toBeGreaterThan(0);
    await stage.ready;
  });

  it.each([
    'from="opacity:0" to="opacity:1"',
    'fx="fade, skew"',
    'fx="skew"',
    'loop="sway, spin"',
    'duration="1000"',
    'exit="fade"',
    'fx="rise" split="words"',
  ])('rejects the explicit declaration regardless of its effects: %s', async (attrs) => {
    const stage = await stageWith(
      'scroll',
      `<cv-scene><cv-animate on="scene" ${attrs}>Text</cv-animate></cv-scene>`
    );
    const a = stage.querySelector('cv-animate') as CvAnimate;
    expect(errors.map((e) => e.code)).toEqual(['invalid-attribute']);
    expect(stage.ordered[0]!.ordered).toEqual([]);
    expect(a.layers).toEqual([]);
    expect(a.loopItems).toEqual([]);
    expect(a.timeline.phase).toBe('idle');
  });

  it.each(['enter', 'eye'])('preserves drag on=%s as Scene time', async (on) => {
    const stage = await stageWith(
      'drag',
      `<cv-scene><cv-animate on="${on}" fx="fade" duration="1000">Alias</cv-animate></cv-scene>`
    );
    const a = stage.querySelector('cv-animate') as CvAnimate;
    expect(errors).toEqual([]);
    expect(a.layers[0]!.source).toBe(on);
    expect(a.solved?.end).toBe(1000);
    expect(stage.ordered[0]!.ordered).toContain(a);
  });

  it('retains supported and implicit sources and signal priority', async () => {
    const stage = await stageWith(
      'scroll',
      `<cv-scene>
      <cv-animate fx="fade">Default</cv-animate>
      <cv-animate on="enter" fx="fade">Enter</cv-animate>
      <cv-animate on="eye" fx="fade">Eye</cv-animate>
      <cv-animate on="clock" fx="fade">Clock</cv-animate>
      <cv-animate on="view(self)" fx="fade">View</cv-animate>
      <cv-animate on="page" fx="fade">Page</cv-animate>
      <cv-animate on="enter" fx="skew">Signal</cv-animate>
    </cv-scene><cv-scene zone><cv-animate on="scene" fx="fade">Zone</cv-animate></cv-scene>`
    );
    expect(errors).toEqual([]);
    expect(stage.ordered.map((s) => s.ordered.length)).toEqual([7, 1]);
    expect(stage.ordered[0]!.ordered[6]!.layers[0]!.source).toBe('velocity');
  });

  it('clears old layers and loops, deduplicates errors and recovers after on/input/zone changes', async () => {
    const stage = await stageWith(
      'drag',
      '<cv-scene><cv-animate on="scene" fx="fade" loop="sway, spin">Text</cv-animate></cv-scene>'
    );
    const a = stage.querySelector('cv-animate') as CvAnimate;
    const old = [...a.shadowRoot!.querySelectorAll('.l')];
    stage.input = 'scroll';
    await settle();
    expect(errors).toHaveLength(1);
    expect(a.layers).toEqual([]);
    expect(old.every((el) => !el.isConnected)).toBe(true);
    expect(a.looping).toBe(false);
    expect(a.timed).toBe(false);
    expect(a.timeline.phase).toBe('idle');
    stage.refresh();
    await settle();
    expect(errors).toHaveLength(1);
    a.setAttribute('on', 'enter');
    await settle();
    expect(a.layers.length).toBeGreaterThan(0);
    stage.ordered[0]!.setAttribute('zone', '');
    await settle();
    expect(errors).toHaveLength(2);
    expect(a.layers).toEqual([]);
    a.setAttribute('on', 'scene');
    await settle();
    expect(a.layers.length).toBeGreaterThan(0);
    stage.ordered[0]!.removeAttribute('zone');
    await settle();
    expect(errors).toHaveLength(3);
    expect(a.layers).toEqual([]);
    stage.input = 'drag';
    await settle();
    expect(a.layers.length).toBeGreaterThan(0);
  });

  it('removes a rejected predecessor from timing and keeps existing missing-after recovery', async () => {
    const stage = await stageWith(
      'scroll',
      `<cv-scene zone>
      <cv-animate name="bad" on="enter" fx="fade" duration="9000">Bad</cv-animate>
      <cv-animate after="bad" fx="fade" duration="300">Follower</cv-animate>
      <cv-animate fx="fade" duration="400">Independent</cv-animate>
    </cv-scene>`
    );
    expect(errors.map((e) => e.code).sort()).toEqual(['invalid-attribute', 'missing-after']);
    expect(stage.ordered[0]!.ordered).toHaveLength(2);
    expect(stage.ordered[0]!.solution.total).toBe(400);
  });

  it('rejects a stack before building cards and clears an already-built stack', async () => {
    const stage = await stageWith(
      'drag',
      '<cv-scene><cv-stack on="enter"><div>A</div><div>B</div></cv-stack></cv-scene>'
    );
    const stack = stage.querySelector('cv-stack') as CvStack;
    expect((stack.children[1] as HTMLElement).style.position).toBe('relative');
    stage.input = 'scroll';
    stage.ordered[0]!.setAttribute('zone', '');
    await settle();
    expect(errors.map((e) => e.code)).toEqual(['invalid-attribute']);
    expect(stage.ordered[0]!.ordered).toEqual([]);
    expect(stack.hasAttribute('data-cv-dealt')).toBe(false);
    expect((stack.children[1] as HTMLElement).style.translate).toBe('');
    expect((stack.children[1] as HTMLElement).style.position).toBe('');
    expect(stack.textContent).toBe('AB');
  });
});

describe('operation boundaries', () => {
  let errors: Array<{ code: string; message: string; element: Element }>;
  const record = (event: Event) => {
    event.preventDefault();
    errors.push((event as CustomEvent).detail);
  };
  const pointer = (target: Element, type: string, y: number) => {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 100,
      clientY: y,
    });
    Object.defineProperties(event, {
      pointerId: { value: 1 },
      pointerType: { value: 'touch' },
      isPrimary: { value: true },
    });
    target.dispatchEvent(event);
  };
  const content =
    '<cv-scene id="s0"><div id="surface">Drag here</div><button id="action">Action</button></cv-scene><cv-scene id="s1">Next</cv-scene>';
  beforeEach(() => {
    errors = [];
    document.body.addEventListener('cv-error', record);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => document.body.removeEventListener('cv-error', record));

  it.each([
    ['', 'bad-at'],
    ['on="clock"', 'bad-at'],
  ])('forwards parser error codes through %s timing', async (attrs, code) => {
    const stage = await stageWith(
      'scroll',
      `<cv-scene zone><cv-animate id="bad" ${attrs} fx="fade" at="20% 30">Bad</cv-animate><cv-animate id="good" fx="fade" duration="400">Good</cv-animate></cv-scene>`
    );
    expect(errors).toEqual([
      expect.objectContaining({ code, element: stage.querySelector('#bad') }),
    ]);
    expect(Number.isFinite(stage.ordered[0]!.solution.total)).toBe(true);
    expect(stage.querySelector<CvAnimate>('#good')!.layers.length).toBeGreaterThan(0);
  });

  it.each(['after="leader + nope"', 'loop="sway" loop-duration="fast"'])(
    'reports %s and preserves valid siblings',
    async (attrs) => {
      const stage = await stageWith(
        'scroll',
        `<cv-scene zone><cv-animate id="bad" fx="fade" ${attrs}>Bad</cv-animate><cv-animate id="good" fx="fade">Good</cv-animate></cv-scene>`
      );
      expect(errors).toEqual([
        expect.objectContaining({
          code: 'invalid-attribute',
          element: stage.querySelector('#bad'),
        }),
      ]);
      expect(stage.querySelector<CvAnimate>('#good')!.layers.length).toBeGreaterThan(0);
    }
  );

  it('reports an explicit invalid input without changing its scroll fallback', async () => {
    const stage = await stageWith('scroll', '<cv-scene>Content</cv-scene>');
    stage.setAttribute('input', 'drga');
    await settle();
    expect(stage.input).toBe('scroll');
    expect(errors).toEqual([
      expect.objectContaining({ code: 'invalid-attribute', element: stage }),
    ]);
  });

  it('reports malformed Scene thresholds when building instead of waiting for release', async () => {
    const stage = await stageWith(
      'drag',
      '<cv-scene id="s0" threshold="long:35%">Content</cv-scene>'
    );
    expect(errors).toEqual([
      expect.objectContaining({ code: 'invalid-attribute', element: stage.querySelector('#s0') }),
    ]);
  });

  it('reports a Scene threshold changed between gestures when it is read at release', async () => {
    const stage = await stageWith('drag', content);
    stage.ordered[0]!.setAttribute('threshold', 'long:35%');
    const surface = stage.querySelector('#surface')!;
    pointer(surface, 'pointerdown', 600);
    pointer(surface, 'pointermove', 450);
    pointer(surface, 'pointerup', 450);
    expect(errors).toEqual([
      expect.objectContaining({ code: 'invalid-attribute', element: stage.ordered[0] }),
    ]);
  });

  it.each(['zone', 'track'])('restores authored height after disabling %s', async (attr) => {
    const stage = await stageWith(
      'scroll',
      `<cv-scene ${attr === 'zone' ? 'zone' : 'track="x"'} style="height:950px!important"><cv-animate fx="fade" duration="1000">Content</cv-animate></cv-scene>`
    );
    const scene = stage.ordered[0]!;
    expect(scene.style.height).toContain('1000px');
    scene.removeAttribute(attr);
    await settle();
    expect(scene.style.height).toBe('950px');
    expect(scene.style.getPropertyPriority('height')).toBe('important');
  });

  it('restores drag geometry and accessibility state when switching to scroll', async () => {
    const stage = await stageWith(
      'drag',
      '<cv-scene style="height:950px;position:relative;top:12px!important;overflow-x:auto" aria-hidden="false">A</cv-scene><cv-scene>B</cv-scene>'
    );
    stage.ordered[0]!.style.color = 'red';
    stage.input = 'scroll';
    await settle();
    expect(stage.ordered[0]!.style.height).toBe('950px');
    expect(stage.ordered[0]!.style.position).toBe('relative');
    expect(stage.ordered[0]!.style.top).toBe('12px');
    expect(stage.ordered[0]!.style.getPropertyPriority('top')).toBe('important');
    expect(stage.ordered[0]!.style.left).toBe('');
    expect(stage.ordered[0]!.style.overflowX).toBe('auto');
    expect(stage.ordered[0]!.style.color).toBe('red');
    expect(stage.ordered[0]!.getAttribute('aria-hidden')).toBe('false');
    expect(stage.ordered[1]!.style.translate).toBe('');
    expect(stage.ordered[1]!.hasAttribute('inert')).toBe(false);
    expect(stage.ordered[1]!.hasAttribute('aria-hidden')).toBe(false);
  });

  it.each([
    [0, true],
    [1, false],
  ])('preserves click detail=%s after a cancelled drag', async (detail, allowed) => {
    const stage = await stageWith('drag', content);
    const surface = stage.querySelector('#surface')!;
    const click = jest.fn();
    stage.querySelector('#action')!.addEventListener('click', click);
    const start = jest.fn();
    stage.addEventListener('cv-dragstart', start);
    pointer(surface, 'pointerdown', 600);
    pointer(surface, 'pointermove', 450);
    pointer(surface, 'pointercancel', 450);
    await jest.advanceTimersByTimeAsync(400);
    expect(start).toHaveBeenCalledTimes(1);
    const accepted = stage
      .querySelector('#action')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }));
    expect(accepted).toBe(allowed);
    expect(click).toHaveBeenCalledTimes(allowed ? 1 : 0);
  });

  it('closes an interrupted gesture exactly once before another gesture', async () => {
    const stage = await stageWith('drag', content);
    const surface = stage.querySelector('#surface')!;
    const cancel = jest.fn();
    stage.addEventListener('cv-dragcancel', cancel);
    pointer(surface, 'pointerdown', 600);
    pointer(surface, 'pointermove', 450);
    stage.setAttribute('transition-duration', '500');
    await settle();
    pointer(surface, 'pointerup', 450);
    await settle();
    expect(cancel).toHaveBeenCalledTimes(1);
    pointer(surface, 'pointerdown', 600);
    pointer(surface, 'pointermove', 450);
    pointer(surface, 'pointercancel', 450);
    await jest.advanceTimersByTimeAsync(400);
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it('does not recreate an input when a cancellation listener removes the Stage', async () => {
    const stage = await stageWith('drag', content);
    const cancel = jest.fn(() => stage.remove());
    stage.addEventListener('cv-dragcancel', cancel);
    const surface = stage.querySelector('#surface')!;
    pointer(surface, 'pointerdown', 600);
    pointer(surface, 'pointermove', 450);
    stage.setAttribute('transition-duration', '500');
    await settle();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(stage.isConnected).toBe(false);
    expect(stage.engine).toBeNull();
  });

  it.each(['drag', 'landing'])(
    'stops old %s writes when a progress listener removes the Stage',
    async (phase) => {
      const stage = await stageWith(
        'drag',
        '<cv-scene style="position:relative;top:12px"><div id="surface">Drag here</div></cv-scene><cv-scene>Next</cv-scene>'
      );
      const scene = stage.ordered[0]!;
      let atRemoval: string | undefined;
      stage.addEventListener('cv-progress', (event) => {
        const detail = (event as CustomEvent).detail;
        if (detail.kind !== 'page' || (phase === 'landing' && detail.progress < 1)) return;
        stage.remove();
        atRemoval = scene.style.cssText;
      });
      if (phase === 'drag') {
        const surface = stage.querySelector('#surface')!;
        pointer(surface, 'pointerdown', 600);
        pointer(surface, 'pointermove', 400);
      } else stage.goTo(1);
      await jest.advanceTimersByTimeAsync(1000);
      expect(atRemoval).toBeDefined();
      expect(scene.style.cssText).toBe(atRemoval);
      expect(stage.current).toBe(-1);
      expect(stage.engine).toBeNull();
    }
  );
});

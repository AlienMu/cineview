/**
 * <cv-animate>: one element's effects. Attributes are read into layer plans; the shadow layers
 * themselves are built by render/layers.ts and written by whichever input drives the stage.
 */
import { parseFromTo, parseFx, type Effect, type Source } from '../core/fx';
import {
  parseAfter,
  parseAt,
  parseMs,
  parseStagger,
  type Solved,
  type TimeSpec,
} from '../core/time';
import { warn } from '../dev/warn';
import { ElementBase } from '../platform';
import { buildLayers, type Layer, type LayerKind, type LayerPlan } from '../render/layers';
import { CvScene } from './scene';

/** Time sources: their effects sit on the scene timeline (plan v3 §3.5). */
const ON_TIMELINE: ReadonlySet<Source> = new Set<Source>(['scene', 'enter']);
const TIMING_ATTRIBUTES = ['duration', 'delay', 'after', 'at', 'stagger'];

export interface AnimatePlan {
  layers: LayerPlan[];
  /** Takes part in the scene timeline (counts toward the total, can be an `after` target). */
  timed: boolean;
}

export class CvAnimate extends ElementBase {
  scene: CvScene | null = null;
  layers: Layer[] = [];
  timed = true;
  solved: Solved | null = null;
  natives: Animation[] = [];
  /** Effects that play on a clock once the element enters (normal flow). */
  enterLayers: Layer[] = [];
  entered = false;

  connectedCallback(): void {
    const scene = this.closest('cv-scene');
    if (!scene) return;
    if (scene instanceof CvScene) {
      this.scene = scene;
      scene.registerAnimate(this);
    } else {
      // Parent not upgraded yet (defined later): register once it is.
      void customElements.whenDefined('cv-scene').then(() => {
        if (this.isConnected && !this.scene) this.connectedCallback();
      });
    }
  }

  disconnectedCallback(): void {
    this.cancelNatives();
    this.scene?.unregisterAnimate(this);
    this.scene = null;
  }

  get hasExit(): boolean {
    return this.hasAttribute('exit') || this.hasAttribute('exit-to');
  }

  timeSpec(): TimeSpec {
    const stagger = parseStagger(this.getAttribute('stagger'));
    return {
      name: this.getAttribute('name'),
      duration: parseMs(this.getAttribute('duration'), 600),
      delay: Math.max(0, parseMs(this.getAttribute('delay'), 0)),
      after: parseAfter(this.getAttribute('after')),
      at: parseAt(this.getAttribute('at')),
      // 1.x default: 600 ms, counted only when an exit is declared.
      exitDuration: this.hasExit ? parseMs(this.getAttribute('exit-duration'), 600) : 0,
      stagger: stagger && { ...stagger, count: this.staggerTargets().length },
    };
  }

  /**
   * Elements a stagger spreads over: `target` matches, else the children of a single container
   * child (1.x: `<Animate stagger><ul><li>…`), else the direct children.
   */
  staggerTargets(): Element[] {
    const target = this.getAttribute('target');
    if (target) return [...this.querySelectorAll(target)];
    const children = [...this.children];
    return children.length === 1 ? [...children[0]!.children] : children;
  }

  /** Decide layers from attributes and context (plan v3 §3.5 precedence). */
  plan(context: { timeSource: Source }, report: (m: string) => void): AnimatePlan {
    const effects: Effect[] = parseFx(this.getAttribute('fx'), report);
    const raw = parseFromTo(this.getAttribute('from'), this.getAttribute('to'));
    if (raw) effects.push(raw);
    const exitRaw = parseFromTo(null, this.getAttribute('exit-to'));
    const explicit = this.getAttribute('on');
    const explicitSource = explicit?.startsWith('view') ? 'view' : (explicit as Source | null);
    const subject: 'scene' | 'self' = explicit === 'view(self)' ? 'self' : 'scene';

    const bySource = new Map<Source, Effect[]>();
    for (const e of effects) {
      const source: Source = explicitSource ?? (e.rate ? e.defaultSource : context.timeSource);
      const list = bySource.get(source) ?? [];
      list.push(e);
      bySource.set(source, list);
    }

    const plans: LayerPlan[] = [];
    for (const [source, list] of bySource) {
      const kind: LayerKind = source === 'view' ? 'space' : 'time';
      const nonClip = list.filter((e) => Object.keys(e.tracks).some((k) => k !== 'clip'));
      const clips = list.filter((e) => e.tracks.clip);
      const exits = kind === 'time' && exitRaw ? [exitRaw] : [];
      if (nonClip.length || exits.length) {
        plans.push({
          kind,
          source,
          subject,
          effects: nonClip,
          exitEffects: exits,
          clipOnly: false,
        });
      }
      if (clips.length) {
        plans.push({
          kind: 'clip',
          source,
          subject,
          effects: clips,
          exitEffects: [],
          clipOnly: true,
        });
      }
    }
    // No effects at all still makes a timeline (progress for el.timeline, a video, an anchor).
    const timed =
      plans.length === 0
        ? !explicitSource || ON_TIMELINE.has(explicitSource)
        : plans.some((p) => ON_TIMELINE.has(p.source));
    if (__DEV__ && !timed) {
      const ignored = TIMING_ATTRIBUTES.filter((a) => this.hasAttribute(a));
      if (ignored.length) {
        warn(
          this,
          `${ignored.join(', ')} ${ignored.length > 1 ? 'have' : 'has'} no effect: nothing on this element follows time. Use a named view range for view-driven effects.`
        );
      }
    }
    return { layers: plans, timed };
  }

  build(plan: AnimatePlan): void {
    this.cancelNatives();
    this.timed = plan.timed;
    this.layers = buildLayers(this, plan.layers);
    this.enterLayers = this.layers.filter((l) => l.source === 'enter');
    this.entered = false;
  }

  cancelNatives(): void {
    for (const a of this.natives) a.cancel();
    this.natives = [];
  }
}

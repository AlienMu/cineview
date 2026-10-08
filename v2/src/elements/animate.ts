/**
 * <cv-animate>: one element's effects. Attributes are read into layer plans; the shadow layers
 * themselves are built by output/layers.ts and written by whichever input drives the stage.
 */
import { parseFromTo, parseFx, type Effect, type Source } from '../core/fx';
import { parseAfter, type Solved, type TimeSpec } from '../core/time';
import { buildLayers, type Layer, type LayerKind, type LayerPlan } from '../render/layers';
import { ElementBase } from '../platform';
import { CvScene } from './scene';

const num = (el: Element, name: string, fallback: number): number => {
  const v = el.getAttribute(name);
  if (v === null || v === '') return fallback;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

export class CvAnimate extends ElementBase {
  scene: CvScene | null = null;
  layers: Layer[] = [];
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

  timeSpec(): TimeSpec {
    return {
      name: this.getAttribute('name'),
      duration: num(this, 'duration', 600),
      delay: num(this, 'delay', 0),
      after: parseAfter(this.getAttribute('after')),
      exitDuration: this.hasAttribute('exit-to') ? num(this, 'exit-duration', 300) : 0,
    };
  }

  /** Decide layers from attributes and context (plan v3 §3.5 precedence). */
  plan(context: { timeSource: Source }, report: (m: string) => void): LayerPlan[] {
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
    return plans;
  }

  build(plans: LayerPlan[]): void {
    this.cancelNatives();
    this.layers = buildLayers(this, plans);
    this.enterLayers = this.layers.filter((l) => l.source === 'enter');
    this.entered = false;
  }

  cancelNatives(): void {
    for (const a of this.natives) a.cancel();
    this.natives = [];
  }
}

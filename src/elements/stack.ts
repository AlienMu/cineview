/**
 * <cv-stack>: cards that stack (plan v3 §9.3, lexicon #6); its element children are the cards.
 *
 * Scroll input outside zones: each card sticks `step` px lower than the one before (from
 * `--cv-stack-top`), so later cards scroll over earlier ones: native sticky. Zones and drag scenes
 * do not scroll: there the cards after the first come up from below the screen one after another
 * along the scene timeline (`duration` each) and settle on the deck.
 *
 * `covered="dim|recede"`: how a card looks while the next one covers it. A card the next one
 * hides entirely (`step` 0, at least as large) is not painted.
 */
import { parseEase, settle, type Ease } from '../core/ease';
import type { Report } from '../core/errors';
import type { TimeSpec } from '../core/time';
import { warn } from '../dev/warn';
import { parseCovered, writeCardCover, type CoverLook } from '../render/covered';
import { coverProgress, hides, type CardBox } from '../render/deck';
import { progressIn } from '../render/layers';
import { CvAnimate, type AnimatePlan, type PlanContext } from './animate';

// A receding card shrinks toward its top edge, so the `step` edge above the next card stays shown.
// With `--cv-veil`, a covered card is tinted by a layer over it (its `--cv-cover` is the progress).
const DECK_STYLE =
  ':host([data-cv-dealt]){display:grid}:host([data-cv-dealt]) ::slotted(*){grid-area:1/1}' +
  ':host([covered=recede]) ::slotted(*){transform-origin:50% 0}' +
  ':host([data-cv-veil]) ::slotted(*){position:relative}' +
  ':host([data-cv-veil]) ::slotted(*)::after{content:"";position:absolute;inset:0;border-radius:inherit;' +
  'background:var(--cv-veil);opacity:var(--cv-cover,0);pointer-events:none}';

interface CardState {
  box: CardBox;
  /** Dealt: how far below its slot the card starts (to the screen's bottom edge). */
  travel: number;
  /** Sticking: the card's top in the document flow. */
  flow: number;
  /** The next card hides this one once it rests. */
  hidden: boolean;
  /** Last written translate, cover progress and visibility. */
  shift: number;
  cover: number;
  off: boolean;
}

export class CvStack extends CvAnimate {
  static override readonly observedAttributes = [
    ...CvAnimate.observedAttributes,
    'step',
    'covered',
  ];

  /** Cards come up along scene time (zones, drag); otherwise they stick as the page scrolls. */
  dealt = false;
  cards: Array<HTMLElement | SVGElement> = [];
  private look: CoverLook | null = null;
  /** `--cv-veil` on the stack or above it, read at build: the covered cards' colour. */
  private veil = '';
  private step = 0;
  private curve: Ease = settle;
  private state: CardState[] = [];
  private mo: MutationObserver | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.mo ??= new MutationObserver(() => this.scene?.stage?.invalidate());
    this.mo.observe(this, { childList: true });
  }

  override disconnectedCallback(): void {
    this.mo?.disconnect();
    super.disconnectedCallback();
  }

  /** `duration` is each card's; the first card is there from the start. */
  override timeSpec(): TimeSpec {
    const spec = super.timeSpec();
    return {
      ...spec,
      duration: spec.duration * Math.max(0, this.cards.length - 1),
      exitDuration: 0,
      stagger: null,
    };
  }

  override plan(context: PlanContext, report: Report): AnimatePlan {
    this.dealt = context.timeSource === 'scene';
    const easeText = this.getAttribute('ease');
    const ease = parseEase(easeText);
    if (easeText !== null && !ease) report(`Unknown ease "${easeText}"`);
    this.curve = ease ?? settle;
    this.look = parseCovered(this.getAttribute('covered'), context.reducedMotion, report);
    this.veil = this.look ? getComputedStyle(this).getPropertyValue('--cv-veil').trim() : '';
    const step = this.getAttribute('step');
    this.step = step === null ? 0 : parseFloat(step);
    if (!(this.step >= 0)) {
      report(`step="${step}": expected a distance in px such as 8`);
      this.step = 0;
    }
    return {
      layers: [],
      rules: [],
      fades: [],
      inks: [],
      counts: [],
      develop: null,
      invert: false,
      staggered: null,
      split: null,
      whole: null,
      timed: this.dealt,
      clocked: false,
      duration: 600,
      clockDuration: null,
      clockMaxDuration: Number.POSITIVE_INFINITY,
      maxDuration: Number.POSITIVE_INFINITY,
      hasExit: false,
      loops: [],
    };
  }

  override build(plan: AnimatePlan): void {
    super.build(plan);
    // After release() (which clears it): the tint layer over covered cards (DECK_STYLE).
    this.toggleAttribute('data-cv-veil', this.veil !== '');
    const style = document.createElement('style');
    style.textContent = DECK_STYLE;
    this.shadowRoot!.append(style);
    this.cards = [...this.children].filter(
      (el): el is HTMLElement | SVGElement => el instanceof HTMLElement || el instanceof SVGElement
    );
    if (__DEV__ && this.cards.length < 2) {
      warn(this, 'a stack needs two or more cards (its element children) to stack.');
    }
    this.toggleAttribute('data-cv-dealt', this.dealt);
    this.cards.forEach((card, i) => {
      if (this.dealt) {
        card.style.position = 'relative';
        card.style.top = `${i * this.step}px`;
        // Below the screen until the input has measured and placed it.
        if (i > 0) card.style.translate = '0 100vh';
      } else {
        card.style.position = 'sticky';
        card.style.top = `calc(var(--cv-stack-top, 0px) + ${i * this.step}px)`;
      }
    });
  }

  override release(): void {
    super.release();
    for (const card of this.cards) {
      for (const p of [
        'position',
        'top',
        'translate',
        'scale',
        'filter',
        '--cv-cover',
        'visibility',
      ]) {
        card.style.removeProperty(p);
      }
    }
    this.removeAttribute('data-cv-dealt');
    this.removeAttribute('data-cv-veil');
    this.state = [];
  }

  /** Sticking decks need frames only for looks and hidden cards. */
  get followsScroll(): boolean {
    return !this.dealt && (this.look !== null || this.state.some((c) => c.hidden));
  }

  /** Dealt deck: each card's slot against the screen's top edge (`top`, viewport px). */
  measureDealt(top: number, vh: number): void {
    this.clearWrites();
    this.state = this.cards.map((card) => {
      const r = card.getBoundingClientRect();
      const box = { rest: r.top - top, height: r.height, left: r.left, width: r.width };
      return cardState(box, Math.max(0, vh - box.rest), 0);
    });
    this.link();
  }

  /** Sticking deck: each card's place in the flow (document px, scroll offset y) and sticky top. */
  measureFlow(y: number): void {
    this.clearWrites();
    for (const card of this.cards) card.style.position = 'static';
    const rects = this.cards.map((card) => card.getBoundingClientRect());
    for (const card of this.cards) card.style.position = 'sticky';
    this.state = this.cards.map((card, i) => {
      const r = rects[i]!;
      const rest = parseFloat(getComputedStyle(card).top) || 0;
      return cardState({ rest, height: r.height, left: r.left, width: r.width }, 0, r.top + y);
    });
    this.link();
  }

  /** Dealt deck at scene time t: each card after the first comes up over its share of the window. */
  writeTime(t: number): void {
    const w = this.solved;
    const n = this.state.length;
    if (!w || n < 2 || n !== this.cards.length) return;
    const each = (w.end - w.start) / (n - 1);
    this.place(
      this.state.map((c, k) => {
        if (k === 0) return c.box.rest;
        const e = this.curve(progressIn(t, w.start + (k - 1) * each, w.start + k * each));
        return c.box.rest + (1 - e) * c.travel;
      }),
      true
    );
  }

  /** Sticking deck at scroll offset y: each card's top on screen (sticky moves them). */
  writeScroll(y: number): void {
    if (this.state.length !== this.cards.length) return;
    this.place(
      this.state.map((c) => Math.max(c.flow - y, c.box.rest)),
      false
    );
  }

  /** Undo the input's writes (before measuring, and when the input goes). */
  clearWrites(): void {
    for (const card of this.cards) {
      for (const p of ['translate', 'scale', 'filter', '--cv-cover', 'visibility'])
        card.style.removeProperty(p);
    }
    for (const c of this.state) {
      c.shift = c.cover = Number.NaN;
      c.off = false;
    }
  }

  private link(): void {
    this.state.forEach((c, k) => {
      const next = this.state[k + 1];
      c.hidden = next ? hides(c.box, next.box) : false;
    });
  }

  /** Cards at these tops (screen px): translate (dealt), cover looks, hidden cards. */
  private place(tops: readonly number[], move: boolean): void {
    this.state.forEach((c, k) => {
      const card = this.cards[k]!;
      if (move) {
        const shift = tops[k]! - c.box.rest;
        if (shift !== c.shift) {
          c.shift = shift;
          card.style.translate = shift ? `0 ${shift}px` : '';
        }
      }
      const next = this.state[k + 1];
      const nextTop = tops[k + 1] ?? Number.POSITIVE_INFINITY;
      const cover = next ? coverProgress(c.box, next.box.rest, nextTop) : 0;
      if (this.look && cover !== c.cover) {
        c.cover = cover;
        writeCardCover(card, this.look, cover, this.veil !== '');
      }
      const off = !!next && c.hidden && nextTop <= next.box.rest + 0.5;
      if (off !== c.off) {
        c.off = off;
        card.style.visibility = off ? 'hidden' : '';
      }
    });
  }
}

const cardState = (box: CardBox, travel: number, flow: number): CardState => ({
  box,
  travel,
  flow,
  hidden: false,
  shift: Number.NaN,
  cover: Number.NaN,
  off: false,
});

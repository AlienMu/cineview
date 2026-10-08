/**
 * <cv-pause>: pauses and resumes a stage's motion played on time (entrances and loops), for
 * WCAG 2.2.2. Scroll and drag keep working: that motion is the reader's own.
 *
 *   <cv-pause>Pause motion</cv-pause>          the closest stage, else the first in the document
 *   <cv-pause for="story">…</cv-pause>         the stage with id="story"
 *
 * It is a toggle button for the keyboard and assistive technology (`aria-pressed` follows the
 * stage). Without content it shows "Pause motion" / "Play motion"; style it via
 * `cv-pause[aria-pressed="true"]`.
 */
import { ElementBase } from '../platform';
import type { CvStage } from './stage';

export class CvPause extends ElementBase {
  static readonly observedAttributes = ['for'];
  private label: Text | null = null;
  private watched: CvStage | null = null;

  connectedCallback(): void {
    if (!this.shadowRoot) {
      const root = this.attachShadow({ mode: 'open' });
      const slot = document.createElement('slot');
      this.label = document.createTextNode('');
      slot.append(this.label);
      root.append(slot);
    }
    if (!this.hasAttribute('role')) this.setAttribute('role', 'button');
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    this.addEventListener('click', this.toggle);
    this.addEventListener('keydown', this.onKey);
    this.watch();
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this.toggle);
    this.removeEventListener('keydown', this.onKey);
    this.watch(null);
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.watch();
  }

  /** The stage this toggle controls. */
  get stage(): CvStage | null {
    const id = this.getAttribute('for');
    const found = id
      ? document.getElementById(id)
      : (this.closest('cv-stage') ?? document.querySelector('cv-stage'));
    return found && found.localName === 'cv-stage' ? (found as CvStage) : null;
  }

  private watch(stage: CvStage | null = this.stage): void {
    if (this.watched === stage) return this.sync();
    this.watched?.removeEventListener('cv-pause', this.sync);
    this.watched?.removeEventListener('cv-play', this.sync);
    this.watched = stage;
    stage?.addEventListener('cv-pause', this.sync);
    stage?.addEventListener('cv-play', this.sync);
    this.sync();
  }

  private sync = (): void => {
    const paused = this.watched?.hasAttribute('paused') ?? false;
    this.setAttribute('aria-pressed', String(paused));
    if (this.label) this.label.data = paused ? 'Play motion' : 'Pause motion';
  };

  private toggle = (): void => {
    const stage = this.stage;
    if (!stage) return;
    stage.toggleAttribute('paused');
  };

  private onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    this.toggle();
  };
}

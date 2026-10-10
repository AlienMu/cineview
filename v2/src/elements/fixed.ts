/**
 * <cv-fixed>: the scene's fixed layer (1.x scene fixed layer; plan v3 §8, F11). Its content holds
 * still on the screen while the scene passes, and shows only within the scene.
 *
 * The element is a frame over the whole scene (`position: absolute; inset: 0`), always clipped;
 * inside it the content sticks to the top of the screen, one screen high. The scene itself is
 * never clipped. The frame takes no pointer events, its content does. `will-change: transform`
 * on the frame works around a Firefox paint bug before version 147.
 *
 * Unlike 1.x, which clipped the layer in place, the layer arrives and leaves with the scene's
 * edges (sticky): it sits at the scene's top until that reaches the top of the screen, and the
 * scene's bottom edge carries it away.
 */
import { ElementBase } from '../platform';

const STYLE =
  ':host{display:block;position:absolute;inset:0;overflow:clip;will-change:transform;pointer-events:none}' +
  '.layer{position:sticky;top:0;height:100svh}' +
  '::slotted(*){pointer-events:auto}';

export class CvFixed extends ElementBase {
  connectedCallback(): void {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    const layer = document.createElement('div');
    layer.className = 'layer';
    layer.setAttribute('part', 'layer');
    layer.append(document.createElement('slot'));
    root.append(style, layer);
  }
}

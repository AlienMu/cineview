/**
 * Craft checks (plan v3 §3.6): things that work but probably not as the author meant. Development
 * build only: every caller is behind `if (__DEV__)`, so this module is not in the production
 * bundle. Authoring errors that break something are not here; they are `cv-error` (core/errors).
 *
 * Per element, at plan time (elements/animate.ts): timing attributes on untimed sources, `exit`
 * with a signal source, `stagger` without time-driven effects, properties that `stagger` can only
 * pass on as custom properties, sticky or fixed content inside a layer.
 * Per stage, after a build (checkStage): elements outside their parents, drag scenes taller than
 * the screen (also as each becomes current), in-page links to nothing, `stack` with nothing to
 * cover the scene, `covered` without `stack`. Media: slow seeks (media/driver.ts).
 */
import type { LayerPlan } from '../render/layers';
import { warn } from './warn';

const UNSAFE_ON_TARGETS: ReadonlyArray<[string, string]> = [
  ['blur', '--cv-filter'],
  ['clip', '--cv-clip-path'],
  ['rx', '--cv-transform'],
  ['ry', '--cv-transform'],
  ['skx', '--cv-transform'],
  ['sky', '--cv-transform'],
];

/** stagger writes on author elements only the properties they own (plan v3 §5). */
export function warnUnsafeStagger(el: Element, plan: LayerPlan): void {
  const used = new Set(
    [...plan.effects, ...plan.exitEffects].flatMap((e) => e.entries.map(([p]) => p as string))
  );
  const vars = [...new Set(UNSAFE_ON_TARGETS.filter(([p]) => used.has(p)).map(([, v]) => v))];
  if (vars.length) {
    warn(
      el,
      `stagger writes only translate, rotate, scale and opacity on your elements; the rest arrives as ${vars.join(', ')}. Use them in your CSS, e.g. filter: var(--cv-filter).`
    );
  }
}

/** Layers carry a transform, which scopes sticky, fixed and z-index of everything inside (§4.3). */
export function warnScopedPositioning(el: Element): void {
  const nested = el.querySelector('cv-fixed, cv-stack');
  if (nested) {
    warn(
      el,
      `<${nested.localName}> inside <cv-animate> cannot stick to the viewport: the animation layers scope it. Move it outside.`
    );
    return;
  }
  for (const child of el.children) {
    const position = getComputedStyle(child).position;
    if (position === 'sticky' || position === 'fixed') {
      warn(
        el,
        `position: ${position} inside <cv-animate> is scoped by the animation layers and will not stick to the viewport.`
      );
      return;
    }
  }
}

/**
 * A drag scene is one screen; taller content is cut off (1.x), it never scrolls. Only rendered
 * scenes can be measured (the rest are content-visibility: hidden): the stage also checks each
 * scene as it becomes current.
 */
export function checkDragScene(scene: HTMLElement): void {
  if (scene.style.contentVisibility === 'hidden') return;
  if (scene.scrollHeight > scene.clientHeight + 1) {
    warn(
      scene,
      `content is ${scene.scrollHeight - scene.clientHeight}px taller than the screen; drag scenes are one screen high and cut off the rest.`
    );
  }
}

/** Scene `stack` holds a scene until the next one covers it (plan v3 §8, §9.3). */
function checkStacks(stage: CraftStage): void {
  stage.ordered.forEach((scene, i) => {
    if (!scene.hasAttribute('stack')) {
      if (scene.hasAttribute('covered')) {
        warn(
          scene,
          'covered is how a stacked scene looks while the next one covers it; add stack.'
        );
      }
      return;
    }
    const next = stage.ordered[i + 1];
    if (!next) {
      warn(scene, 'stack holds a scene until the next one covers it; the last scene has none.');
    } else if (stage.input === 'scroll' && scene.nextElementSibling !== next) {
      warn(
        scene,
        'content between a stacked scene and the next scene scrolls underneath the held scene. Put it inside a scene.'
      );
    }
  });
}

export interface CraftStage extends HTMLElement {
  readonly input: 'scroll' | 'drag';
  readonly ordered: readonly HTMLElement[];
}

/** Stage-wide checks. Reads layout: run after the build has rendered, never in a frame loop. */
export function checkStage(stage: CraftStage): void {
  for (const el of document.querySelectorAll('cv-animate, cv-video')) {
    if (!el.parentElement?.closest('cv-scene')) {
      warn(el, `<${el.localName}> outside a <cv-scene> has no timeline and never animates.`);
    }
  }
  for (const el of document.querySelectorAll('cv-scene')) {
    if (!el.parentElement?.closest('cv-stage')) {
      warn(el, '<cv-scene> outside a <cv-stage> is not part of any stage.');
    }
  }
  if (stage.input === 'drag') for (const scene of stage.ordered) checkDragScene(scene);
  checkStacks(stage);
  for (const a of stage.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    const id = decodeURIComponent(a.getAttribute('href')!.slice(1));
    if (id && !document.getElementById(id)) warn(a, `href="#${id}" points to no element.`);
  }
}

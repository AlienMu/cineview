/**
 * `fx="keyframes(name)"` (plan v3 §3.3): the page's own @keyframes rule, read into keyframe data
 * and played on a shadow layer of its own, outside the element's other layers (§4.2). A shadow tree
 * does not see the document's @keyframes by name in Chrome and Firefox (F6), but data needs no
 * name. Not on the <cv-animate> itself: a transform there would move the box its entrance and its
 * view(self) progress are measured by (a rule that flies in from below would never be in view).
 *
 * Every input plays the same data (render/layers.ts): scroll-driven and clock animations take it as
 * their keyframes; drag and the main-thread path seek a paused animation of it to the progress, so
 * any value the browser can interpolate follows, not only the ones the framework writes itself.
 *
 * A chunk of its own (load-keyframes.ts): only pages that use keyframes() load it.
 */
import type { Report } from '../core/errors';

// CSSRule types (CSSOM): named in every engine, unlike the rule classes (jsdom has few).
const STYLE_RULE = 1;
const IMPORT_RULE = 3;
const MEDIA_RULE = 4;
const KEYFRAMES_RULE = 7;
const SUPPORTS_RULE = 12;

interface Search {
  name: string;
  rule: CSSKeyframesRule | null;
  /** Stylesheets that cannot be read (another origin without CORS). */
  unreadable: number;
}

/** Whether a media list holds (none, or no way to ask: jsdom has neither). */
const matches = (media: MediaList | undefined): boolean =>
  !media?.mediaText || typeof matchMedia !== 'function' || matchMedia(media.mediaText).matches;

function scanSheet(sheet: CSSStyleSheet, search: Search): void {
  if (sheet.disabled || !matches(sheet.media)) return;
  let rules: CSSRuleList;
  try {
    rules = sheet.cssRules;
  } catch {
    search.unreadable++;
    return;
  }
  scan(rules, search);
}

/** The last rule of that name wins, as in CSS; conditions that do not hold are skipped. */
function scan(rules: CSSRuleList, search: Search): void {
  for (const rule of Array.from(rules)) {
    if (rule.type === KEYFRAMES_RULE) {
      if ((rule as CSSKeyframesRule).name === search.name) search.rule = rule as CSSKeyframesRule;
    } else if (rule.type === IMPORT_RULE) {
      const { styleSheet, media } = rule as CSSImportRule;
      if (styleSheet && matches(media)) scanSheet(styleSheet, search);
    } else if (rule.type === MEDIA_RULE) {
      if (matches((rule as CSSMediaRule).media)) scan((rule as CSSMediaRule).cssRules, search);
    } else if (rule.type === SUPPORTS_RULE) {
      const { conditionText, cssRules } = rule as CSSSupportsRule;
      if (typeof CSS === 'undefined' || CSS.supports(conditionText)) scan(cssRules, search);
    } else if (rule.type !== STYLE_RULE && 'cssRules' in rule) {
      // Layers (and containers, which cannot be asked from here).
      scan((rule as CSSGroupingRule).cssRules, search);
    }
  }
}

/** A CSS property as a keyframe key (Web Animations: camel case, cssFloat, cssOffset). */
const keyOf = (property: string): string =>
  property.startsWith('--')
    ? property
    : property === 'float'
      ? 'cssFloat'
      : property === 'offset'
        ? 'cssOffset'
        : property
            .replace(/^-webkit-/, 'webkit-')
            .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** `from`, `to`, `40%`; null for a timeline range (`entry 20%`). */
function offsetOf(selector: string): number | null {
  if (selector === 'from') return 0;
  if (selector === 'to') return 1;
  const m = /^(\d*\.?\d+)%$/.exec(selector);
  return m ? Number(m[1]) / 100 : null;
}

/**
 * The rule as keyframes, by offset. Keyframes at the same offset merge, later declarations
 * winning; a keyframe's animation-timing-function times its segment, else `easing`;
 * animation-composition is its composite. !important is ignored, as CSS ignores it there.
 */
export function toKeyframes(rule: CSSKeyframesRule, easing: string, report: Report): Keyframe[] {
  const at = new Map<number, Keyframe>();
  for (const frame of Array.from(rule.cssRules) as CSSKeyframeRule[]) {
    const style = frame.style;
    const values: Keyframe = {};
    for (let i = 0; i < style.length; i++) {
      const property = style[i]!;
      const value = style.getPropertyValue(property);
      if (!value || style.getPropertyPriority(property)) continue;
      if (property === 'animation-timing-function') values.easing = value;
      else if (property === 'animation-composition') {
        values.composite = value as CompositeOperationOrAuto;
      } else if (!property.startsWith('animation')) values[keyOf(property)] = value;
    }
    for (const selector of frame.keyText.split(',')) {
      const offset = offsetOf(selector.trim());
      if (offset === null) {
        report(
          `keyframes(${rule.name}): "${selector.trim()}" names a timeline range; give the fx item a range instead`
        );
        continue;
      }
      at.set(offset, { ...at.get(offset), ...values });
    }
  }
  return [...at]
    .sort(([a], [b]) => a - b)
    .map(([offset, values]) => ({ easing, ...values, offset }));
}

/**
 * The keyframes of the rule named `name` for `el`: the document's stylesheets, then those of the
 * shadow root it lives in, if any. Null, reported as `unknown-keyframes`, when there is none; a
 * stylesheet from another origin cannot be read unless it is loaded with CORS.
 */
export function readKeyframes(
  el: Element,
  name: string,
  easing: string,
  report: Report
): Keyframe[] | null {
  const search: Search = { name, rule: null, unreadable: 0 };
  const scopes: Array<Document | ShadowRoot> = [document];
  const root = el.getRootNode();
  if (root instanceof ShadowRoot) scopes.push(root);
  for (const scope of scopes) {
    for (const sheet of Array.from(scope.styleSheets)) scanSheet(sheet, search);
    const adopted = scope.adoptedStyleSheets as CSSStyleSheet[] | undefined;
    for (const sheet of adopted ?? []) scanSheet(sheet, search);
  }
  if (!search.rule) {
    const n = search.unreadable;
    const unread = n
      ? `; ${n} stylesheet${n > 1 ? 's' : ''} from another origin could not be read: load ${n > 1 ? 'them' : 'it'} with crossorigin (and CORS), or move the rule`
      : '';
    report(
      `keyframes(${name}): no @keyframes ${name} in the page's stylesheets${unread}`,
      'unknown-keyframes'
    );
    return null;
  }
  return toKeyframes(search.rule, easing, report);
}

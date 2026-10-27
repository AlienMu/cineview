/**
 * Craft warnings: development build only (plan v3 §3.6). Every call site is guarded with
 * `if (__DEV__)` so the message text is dropped from the production build, not just the call.
 * Each element gets a given message once, however often the stage rebuilds.
 */
const said = new WeakMap<Element, Set<string>>();

export function warn(element: Element, message: string): void {
  let seen = said.get(element);
  if (!seen) said.set(element, (seen = new Set()));
  if (seen.has(message)) return;
  seen.add(message);
  console.warn(`[cineview] ${message}`, element);
}

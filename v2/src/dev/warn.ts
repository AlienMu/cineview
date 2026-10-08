/**
 * Craft warnings: development build only (plan v3 §3.6). Every call site is guarded with
 * `if (__DEV__)` so the message text is dropped from the production build, not just the call.
 */
export function warn(element: Element, message: string): void {
  console.warn(`[cineview] ${message}`, element);
}

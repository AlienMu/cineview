/** Runs inside page.evaluate after drag navigation has settled. */
export function inspectCurrentSceneAccessibility() {
  const root = document.querySelector('[data-cineview-container="true"]');
  const announcement = root?.querySelector('[role="status"]')?.textContent ?? '';
  const match = /^\s*(\d+)\s*\/\s*\d+\s*$/.exec(announcement);
  const index = match ? Number(match[1]) - 1 : null;
  const wrapper = index === null ? null : root?.querySelector(`[data-scene-index="${index}"]`);
  const scene = wrapper?.firstElementChild;

  // A missing current Scene is a failure, not an empty collection that passes.
  return {
    currentIndex: index,
    currentSceneFound: Boolean(scene),
    currentSceneHidden: !scene || Boolean(scene.closest('[inert], [aria-hidden="true"]')),
  };
}

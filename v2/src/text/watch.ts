/**
 * A copy drawn from an element's text (text/split.ts, text/count.ts) may be out of date when the
 * element's size or text changes, fonts load, a `lang` or the stage's `data-cv-theme` changes, or
 * a colour-scheme media query flips: `again` runs then. Returns the undo.
 */
export function watchText(host: HTMLElement, again: () => void): () => void {
  let first = true;
  const ro = new ResizeObserver(() => {
    // The first callback reports the size just measured.
    if (first) first = false;
    else again();
  });
  ro.observe(host);
  const text = new MutationObserver(again);
  text.observe(host, { childList: true, characterData: true, subtree: true });
  const attrs = new MutationObserver(again);
  attrs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang', 'data-cv-theme'],
    subtree: true,
  });
  const media = [
    '(prefers-color-scheme: dark)',
    '(forced-colors: active)',
    '(prefers-contrast: more)',
  ]
    .map((q) => matchMedia(q))
    .filter((m) => typeof m.addEventListener === 'function');
  for (const m of media) m.addEventListener('change', again);
  const fonts = document.fonts as FontFaceSet | undefined;
  if (fonts?.addEventListener) fonts.addEventListener('loadingdone', again);
  return (): void => {
    ro.disconnect();
    text.disconnect();
    attrs.disconnect();
    for (const m of media) m.removeEventListener('change', again);
    fonts?.removeEventListener?.('loadingdone', again);
  };
}

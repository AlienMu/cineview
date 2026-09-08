import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { lutAt } from '../design/lut';

/**
 * Site-wide background ribbon layer + current scene accent color driver (original mechanism restored, 2026-08-13).
 *
 * Originated from the locked-in design in task-flow 2026-06-30-official-site-docs.md: "site-wide total progress drives
 * top/bottom dual-endpoint linear-gradient interpolation + configurable anchor array" (snapshot f164470 of the
 * same-named component is the implementation). User decision 2026-08-13: "restore only this one."
 * The C1 approach (600vh ribbon + luminance scrim in HomeBackdrop) was retired wholesale due to reported issues:
 * gray-pink alternating flicker, 30MB layer promotion, no accent flow, etc.
 *
 * Consumes the scrollTop of the CineView internal scroll container (A1/A2 decision: scroll-mode scroll source is the
 * internal container, not window/document), interpolates top/bottom gradient endpoints + current scene accent color
 * between LUT anchors, writes them into :root CSS variables:
 *   --bg-grad-top / --bg-grad-bot — fixed fullscreen gradient layer endpoints
 *   --accent / --accent-ink       — scroll-driven "current scene color" (scrollbar/button/selection)
 *
 * ⚠️ Differences from original implementation (current structure adaptation):
 *   - Original implementation used React state with per-frame setProgress re-renders — violates current CLAUDE.md rule 2
 *     (per-frame setState prohibited). Now changed to quantized CSS variable projection on scroll event, zero React renders,
 *     zero custom DOM animation frame loop; LUT key deduplication makes events within the same anchor point no-ops.
 *   - `.bg-ribbon`'s `transition: background 0.18s linear` is preserved (consistent with original structure);
 *     ⚠️ Acceptance testing revealed Chromium treats gradient transition as inert CSS (no interpolation) — the real
 *     anti-flicker factor is the LUT's shallow slope (entire page 33700px span has only ~26 lum swing, wheel events
 *     at -120/-400 deltas measured at ≤1.67 lum per frame); instantaneous large jumps (End key/programmatic) can
 *     reach ~21 lum per frame, a known residual, deferred to real browser acceptance confirmation, no separate
 *     animation frame loop added here.
 *   - Quantization deduplication: variables not written when all four color values unchanged (adjacent LUT anchors change only once per ~60-100px).
 */
export function BackgroundRibbon(): import('react').JSX.Element {
  const { pathname } = useLocation();

  useEffect(() => {
    let scroller: HTMLElement | null = null;
    let disposed = false;
    let lastKey = '';
    let resizeObserver: ResizeObserver | null = null;

    const write = (): void => {
      if (scroller === null) return;
      // ResizeObserver on the scroll container only observes its border/content
      // box. Async descendants can grow scrollHeight without changing that box,
      // so the scroll event itself must refresh the denominator before projecting
      // the LUT. Read metrics before writing root styles to avoid read-after-write
      // layout work in the same handler.
      const maxScroll = Math.max(scroller.scrollHeight - scroller.clientHeight, 0);
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / maxScroll)) : 0;
      const { top, bot, accent, accentInk } = lutAt(progress, pathname === '/');
      const key = `${top}|${bot}|${accent}|${accentInk}`;
      if (key === lastKey) return;
      lastKey = key;
      const root = document.documentElement;
      root.style.setProperty('--bg-grad-top', top);
      root.style.setProperty('--bg-grad-bot', bot);
      root.style.setProperty('--accent', accent);
      root.style.setProperty('--accent-ink', accentInk);
    };

    const clearRootLut = (): void => {
      const root = document.documentElement;
      root.style.removeProperty('--bg-grad-top');
      root.style.removeProperty('--bg-grad-bot');
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-ink');
      lastKey = '';
    };

    const refreshMetrics = (): void => {
      if (scroller === null) return;
      write();
    };

    const detach = (): void => {
      if (scroller !== null) {
        scroller.removeEventListener('scroll', write);
      }
      resizeObserver?.disconnect();
      resizeObserver = null;
      scroller = null;
      clearRootLut();
    };

    const attach = (next: HTMLElement | null): void => {
      if (disposed || next === scroller) return;
      detach();
      if (next === null) return;

      scroller = next;
      scroller.addEventListener('scroll', write, { passive: true });
      refreshMetrics();
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(refreshMetrics);
        resizeObserver.observe(scroller);
      }
    };

    const reconcile = (): void => {
      if (disposed) return;
      const next = document.querySelector<HTMLElement>('[data-cineview-container="true"]');
      if (next === null) {
        if (scroller !== null) detach();
        else clearRootLut();
        return;
      }
      if (next !== scroller || (scroller !== null && !scroller.isConnected)) {
        attach(next);
        return;
      }
      // A same-container DOM mutation may change overflow without changing the
      // container's own observed box. Re-project immediately at the current offset.
      refreshMetrics();
    };

    let mutationObserver: MutationObserver | null = null;
    const observationRoot = document.body ?? document.documentElement;
    if (typeof MutationObserver !== 'undefined' && observationRoot !== null) {
      mutationObserver = new MutationObserver(reconcile);
      mutationObserver.observe(observationRoot, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-cineview-container'],
      });
    }
    reconcile();

    return (): void => {
      disposed = true;
      mutationObserver?.disconnect();
      mutationObserver = null;
      detach();
    };
  }, [pathname]);

  return <div className="bg-ribbon" aria-hidden="true" />;
}

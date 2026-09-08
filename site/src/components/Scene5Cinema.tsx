import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Animate, useAnimateTimeline } from 'cineview';
import { useI18n } from '../i18n';
import { PhoneMockup } from './PhoneMockup';
import { createLastWinsTimerSequence, type LastWinsTimerSequence } from './lastWinsTimerSequence';
import {
  createScene5LifecycleState,
  freezeScene5Element,
  reduceScene5Lifecycle,
  scene5TabIndex,
  SCENE5_SPLIT_SCRUB_START,
  type Scene5LifecycleEffect,
  type Scene5LifecycleEvent,
  type Scene5LifecycleState,
} from './scene5Lifecycle';
import './Scene5Cinema.css';

const GITHUB_URL = 'https://github.com/AlienMu/cineview';

/**
 * Act 5: Cinema Entrance (screen-off entry).
 *
 * Three sequential stages (zone budget fractional windows, task-flow 2026-08-02-scene5-cinema-entrance):
 *   0.02–1.0 Lights off (black overlay linear to black, reversible both ways, ramp spans entire zone)
 *   0.4–0.7 Phone appears (mockup opacity/scale/blur scrub)
 *   0.7–1.0 Reveal (iframe opacity/blur scrub + postMessage activates /drag cold-start entry)
 *
 * Total budget uniquely decided by cinema-clock lane (2200ms → 2200px locked scroll).
 * iframe lifecycle is forward-only latch: progress ≥0.4 creates deferred iframe, ≥0.7 activates;
 * rollback only reverses scrub visuals, doesn't re-freeze. Scene entirely leaves viewport (last act's only exit path = scroll up,
 * at which point progress already back to 0) then freeze + unmount + reset, re-entry replays from start.
 */

/* Budget 1600 → 2200 (2026-08-04, D4): title upgraded from corner 13px single line to projector subtitle card
 * (defocus→focus + beam + shadow pulse), needs dedicated window to finish entry, then hands to phone appearance.
 * Phone/reveal still occupy same 0.4→0.7 and 0.7→1 fractional windows, absolute duration proportionally lengthens with total budget. */
const TOTAL_MS = 2200;
const CREATE_AT = 0.4;
const REVEAL_AT = 0.7;
/* ⚠️ Title's phase window and two persistent lanes (TITLE_START/TITLE_END/TITLE_LOOP_*,
 * titleVariant, TITLE_BEAM_LOOP, TITLE_SHADOW_LOOP) all deleted 2026-08-06.
 * Title no longer driven by zone progress entry, but appears with right column in **split state** (triggered by child page
 * `cineview-embed-finished` event) — user-specified timing is "phone enters first, scroll to end and
 * commit completes then title appears", that's not a function of progress, so can no longer express with phase window. */
/** Lights-off endpoint 0.94 not 1.0: leaves extremely faint warm backdrop showing through, avoiding act 5 becoming pure black (user explicit requirement). */
const LIGHTS_OFF_MAX = 0.94;
// Interaction opens later than activation (review suggestion): activate sent at 0.7 (entry chain plays during reveal blur-in),
// but pointer-events opens near reveal completion — otherwise 0.7–0.98 locked segment touch-dragging on phone would be
// swallowed by semi-transparent iframe, unable to advance outer reveal; reverse-scrolling away from segment end then withdraws interaction (with hysteresis debounce).
const INTERACT_AT = 0.98;
const INTERACT_OFF_BELOW = 0.92;

/* ── Closing layer exit semantics: scrub (2026-08-15 user decision, replaces 2026-08-14 manual control track) ──
 * Old approach (enterRef/exitRef manual control track + SPLIT_ENTER / SPLIT_EXIT timer
 * choreography) entirely deleted: event-driven exit doesn't follow finger — user scrolling up text/CTA doesn't move,
 * waits for message/timer to exit. New semantics three things:
 *   1. Text/CTA/footer **opacity = pure function of zone progress**, scrub window
 *      0.85→1 (SPLIT_SCRUB_* below): scrolling up follows finger fade-out, scroll back returns as-is.
 *   2. Element **mount gating on finished latch** (only latch renders): under framework track system
 *      same lane cannot "manual entry + scrub exit" (scrub track manual write gets overwritten next frame
 *      by scroll), so sequential entry changed to child element's **one-time CSS transform/visibility animation**
 *      (`animation: … both` + delay 0/0.25s/0.6s/0.9s, see Scene5Cinema.css;
 *      CLAUDE.md rule 6 allows one-time interpolation, forbids infinite). Scroll opacity written by outer scrub owner;
 *      unfinished enables independent manual-opacity channel.
 *   3. Column collapse threshold 0.85: progress < 0.85 → collapse columns (phone returns center, CSS 1.1s displacement segment as usual);
 *      progress rises back to 0.95 to reopen, and increments replay generation to re-walk four beats, avoiding
 *      0.85 critical threshold back-and-forth jitter and skipping entry during hidden period.
 * unfinished message first drives one-time manual-opacity in sequence, then same-generation sequence collapses columns;
 * manual-opacity only handles message timing, doesn't also write framework progress. */
const SPLIT_SCRUB_END = 1;
/* ── Strict sequential timing (2026-08-16 user directive, returns to 08-09 ruling semantics) ───────────────
 * Entry: phone displacement 1.1s (CSS gap/basis/width transition) **completes then** title starts
 * (1.1s), subtitle 1.35s, CTA 1.7s, footer 2.0s — CSS animation delay aligned.
 * unfinished path exit: **first** drive child nodes' manual-opacity channel in sequence (footer 0 /
 * cta 0.15 / subtitle 0.35 / title 0.55s), **then** collapse columns (phone displacement) — outer scrub
 * still monopolizes scroll opacity, JS only choreographs one-time event timing (not per-frame; scroll wheel path unaffected). */
const SPLIT_EXIT_DONE_MS = 1050;
const SPLIT_EXIT_DELAYS_MS: Array<[className: string, delay: number]> = [
  ['scene5-cinema__footer', 0],
  ['scene5-cinema__cta', 150],
  ['scene5-cinema__subtitle-text', 350],
  ['scene5-cinema__title-text', 550],
];
/** freeze path's two-level sequential (final cleanup outside viewport, semantics preserved): t=700ms collapse columns
 * (at this point progress≈0, text opacity already zeroed by scrub, collapse just layout reset),
 * t=1400ms unmount iframe + reset latch. */
const FREEZE_COLLAPSE_MS = 700;
const FREEZE_UNMOUNT_MS = 1400;

/** Closing scrub variant: pure opacity 0→1 (y does not participate — exit only does opacity follow-finger,
 * displacement component all handed to child element's one-time CSS entry animation, two-layer responsibilities don't overlap). */
const closingFadeVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0 } },
} as const;

type CinemaStage = 'idle' | 'mounted' | 'revealed';

function clockVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { opacity: 1 },
    animate: { opacity: 1, transition: { duration: 0 } },
  };
}

/**
 * Lights off: black overlay linearly pulled by zone progress to `LIGHTS_OFF_MAX`.
 *
 * ⚠️ **Start must be 0** (2026-08-09 user directive, **intentionally reversing** the 2026-08-08 ISSUE-B fix).
 * History: Act 4 content completes at its own axis end, but this act's slot takeover is ~900px later ⇒ that slide-in
 * travel exposed a milk-white empty screen. The 08-08 fix started overlay from 0.62 (screen already darkened before takeover,
 * seam covered by this act itself). User rejected this on 08-09: "Scene 5 background cannot be black during transition;
 * currently the screen turns black before scene 5 takes over."
 *
 * Current ruling: slide-in travel before takeover shows **gradient tail warm color** (container background fallback #f7dfcc, see global.css
 * seamless gradient), warm-to-warm with no layering seam; lights-off ramp spans entire zone after lock (0.02→1, see
 * `LIGHTS_OFF_RAMP_END`).
 * Known cost (user informed and accepted): that ~900px returns to "warm empty screen"—flat but not black,
 * matching the visual of inter-act transitions from first four acts.
 */
const LIGHTS_OFF_MIN = 0;

/**
 * ── Lights off must actually go black, and once black stays black (2026-08-12 real-device test fix) ──────────────
 * User reported: "I requested the background to be black; the background appeared then disappeared." Probe
 * `site/scripts/rv-20260812-sweep.mjs` (130px small-step wheel sweep through segment, sweep.json) measured:
 *   y=30450 → 0.256, 30840 → 0.392, 31100 → 0.439, **31230 peak 0.442**,
 *   then 31360 → 0.434, 31490 → 0.415, 31600 (page bottom) → **0.388**.
 * Two conclusions, both contrary to old implementation intent:
 *   1. **Never reaches black**. Measured slope ~3.5e-4 /px, pulling 0→0.94 requires ~2700px,
 *      but this act from lights-off start to document end doesn't have this much scrollable distance ⇒ peak stuck at 0.44.
 *      Old approach spread 0→0.94 across phase 0→0.4, effectively compressing all blackness into a travel segment that never completes.
 *   2. **At bottom still brightening back up**. Old four-point mirrored keyframes `[0,.94,.94,0]` @ `[0,.4,.6,1]`
 *      linear back to 0 in later phase segment — forward scroll to bottom and curtain fades away on its own, which is user's "appeared then disappeared".
 *
 * Now changed: **single linear ramp across entire zone to full black** (`times:[0,1]` / `opacity:[0,0.94]`,
 *   `LIGHTS_OFF_RAMP_END=1`), ramp spans entire zone. After reaching 0.94 **never brightens back**.
 *   times    [0,   1   ]
 *   opacity  [0,   0.94]
 *
 * "Exit matches entry" still holds, and in a more essential way: this lane's opacity is a **pure function** of zone
 * progress; reverse scrolling decrements progress, curtain brightens back along same curve identically —
 * mirroring is free, doesn't need (and shouldn't have) an artificial brightening segment at forward travel end.
 *
 * Start must still be 0 (2026-08-09 user directive unchanged): slide-in travel before takeover shows gradient tail warm color,
 * can't be black right at transition start.
 */
/* Ramp length (2026-08-13 user ruling reset): ramp = **entire zone** (RAMP_END = 1).
 * History: 0.029 too short (instant change), 0.12 incomplete (peak 0.44), 0.17 compromise (600px ramp + 1700px
 * constant black). But 0.17 has two flaws user rulings couldn't suppress:
 *   1. Screen flashing (N13 regression): after removing 1.05s anti-flash transition (user 2026-08-13 ruling
 *      "black screen completely disappears before scroll intercept ends" priority), 600px ramp under discrete wheel notches
 *      each notch Δopacity ≈ 0.19 (-120px notch) ≈ 40+ lum single-frame jump—flicker recurs (user reported).
 *   2. Entire zone linear ramp compresses each notch Δ to ≈ 0.032 (-120px notch) ≈ 7 lum/frame, below
 *      N13's 15 lum threshold; -400px fast-fling notch Δ ≈ 0.107 ≈ 25 lum—during rapid fling
 *      masked by motion itself (known residual, user informed).
 * Cost: lights-off changes from "rapid early blackout + constant black" to "slow dimming spanning entire scroll" (cinema tone,
 * forward monotonic non-increasing, 08-12 "once black stays black" still holds); black screen still completely disappears
 * before unpin (phase window start 0.02 see JSX comment). */
const LIGHTS_OFF_RAMP_END = 1;

function lightsOffVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { opacity: LIGHTS_OFF_MIN },
    animate: {
      opacity: [LIGHTS_OFF_MIN, LIGHTS_OFF_MAX],
      transition: { duration: 0, times: [0, LIGHTS_OFF_RAMP_END] },
    },
  };
}

/* ── Starlight entirely retired (2026-08-19 user directive: "remove stars from black background,
 *    add subtle black-gold gradient background + continuous animation"). All 9 twinkle channel lanes,
 *    54 individual star DOM nodes, and buildStars seed randomization deleted; atmosphere now carried by
 *    two layers of black-gold gradient mist (see JSX below and CSS `.scene5-cinema__gold-mist-*`).
 *    Historical per-star twinkle implementation and performance ablation records are in git history
 *    and 2026-08-08/09 versions of this file, not preserved here. */
function phoneVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { opacity: 0, scale: 0.92, filter: 'blur(14px)' },
    animate: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 0 } },
  };
}

function revealVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { opacity: 0, filter: 'blur(12px)' },
    animate: { opacity: 1, filter: 'blur(0px)', transition: { duration: 0 } },
  };
}

/** Read-only projection of zone progress for stage latching; each frame only numeric comparison, setState only fires on threshold crossing. */
function CinemaLatchProjection({ onProgress }: { onProgress: (value: number) => void }): null {
  const { progress } = useAnimateTimeline();

  useEffect(() => {
    onProgress(progress.get());
    return progress.on('change', onProgress);
  }, [onProgress, progress]);

  return null;
}

export function Scene5Cinema(): import('react').JSX.Element {
  const { t, lang } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const stageRef = useRef<CinemaStage>('idle');
  const embedReadyRef = useRef(false);
  const liveRef = useRef(false);
  const interactiveRef = useRef(false);
  const [stage, setStage] = useState<CinemaStage>('idle');
  const [live, setLive] = useState(false);
  const [interactive, setInteractive] = useState(false);
  /** Latest value mirror of zone progress (for reading current progress when message handler arrives). */
  const progressRef = useRef(0);
  const textColRef = useRef<HTMLDivElement>(null);
  /**
   * Scene5's discrete lifecycle has only one owner. Messages, progress, and
   * IntersectionObserver all enter through this reducer; React state is merely the render projection of that state.
   */
  const [lifecycle, setLifecycle] = useState<Scene5LifecycleState>(() =>
    createScene5LifecycleState()
  );
  const lifecycleRef = useRef<Scene5LifecycleState>(lifecycle);
  const lifecycleSequenceRef = useRef<LastWinsTimerSequence | null>(null);
  const lifecycleDispatchRef = useRef<(event: Scene5LifecycleEvent) => void>(() => undefined);

  const getLifecycleSequence = useCallback((): LastWinsTimerSequence => {
    if (!lifecycleSequenceRef.current) {
      lifecycleSequenceRef.current = createLastWinsTimerSequence({
        setTimeout: (callback, delay) => window.setTimeout(callback, delay),
        clearTimeout: (id) => window.clearTimeout(id),
      });
    }
    return lifecycleSequenceRef.current;
  }, []);

  const resetClosingElementStyles = useCallback((): void => {
    for (const [cls] of SPLIT_EXIT_DELAYS_MS) {
      const element = rootRef.current?.querySelector<HTMLElement>(`.${cls}`) ?? null;
      if (!element) continue;
      element.style.animation = '';
      element.style.transform = '';
      element.style.visibility = '';
      element.style.removeProperty('--scene5-manual-opacity');
    }
  }, []);

  const freezeClosingElements = useCallback((): void => {
    for (const [cls] of SPLIT_EXIT_DELAYS_MS) {
      const element = rootRef.current?.querySelector<HTMLElement>(`.${cls}`) ?? null;
      if (!element) continue;
      // Capture the keyframe's current transform before taking opacity ownership. Without this,
      // cancelling a delayed/running entrance snaps the node to the CSS rule's static transform.
      freezeScene5Element(element);
    }
  }, []);

  /** Apply reducer effects. All finite callbacks use the same last-wins sequence owner. */
  const applyLifecycleEffect = useCallback(
    (effect: Scene5LifecycleEffect): void => {
      const sequence = getLifecycleSequence();
      switch (effect.type) {
        case 'cancel-sequence':
          sequence.cancel();
          return;
        case 'start-freeze':
          sequence.start(
            [
              {
                delay: FREEZE_COLLAPSE_MS,
                run: () =>
                  lifecycleDispatchRef.current({
                    type: 'freeze-collapse',
                    generation: effect.generation,
                  }),
              },
            ],
            () =>
              lifecycleDispatchRef.current({
                type: 'freeze-complete',
                generation: effect.generation,
              }),
            FREEZE_UNMOUNT_MS
          );
          return;
        case 'start-exit':
          freezeClosingElements();
          sequence.start(
            SPLIT_EXIT_DELAYS_MS.map(([cls, delay]) => ({
              delay,
              run: (): void => {
                const element = rootRef.current?.querySelector<HTMLElement>(`.${cls}`) ?? null;
                if (element) element.style.setProperty('--scene5-manual-opacity', '0');
              },
            })),
            () =>
              lifecycleDispatchRef.current({
                type: 'exit-complete',
                generation: effect.generation,
              }),
            SPLIT_EXIT_DONE_MS
          );
          return;
        case 'replay-closing':
          // The keyed Fragment below remounts the four beats. Clear imperative residue from the
          // old DOM before React commits the new generation, so a cancelled exit cannot leak in.
          resetClosingElementStyles();
          return;
        case 'freeze-reset':
          iframeRef.current?.contentWindow?.postMessage('cineview-freeze', window.location.origin);
          stageRef.current = 'idle';
          embedReadyRef.current = false;
          liveRef.current = false;
          interactiveRef.current = false;
          setStage('idle');
          setLive(false);
          setInteractive(false);
          resetClosingElementStyles();
          return;
        case 'exit-reset':
          resetClosingElementStyles();
          return;
      }
    },
    [freezeClosingElements, getLifecycleSequence, resetClosingElementStyles]
  );

  const dispatchLifecycle = useCallback(
    (event: Scene5LifecycleEvent): void => {
      const current = lifecycleRef.current;
      const transition = reduceScene5Lifecycle(current, event);
      if (transition.state === current && transition.effects.length === 0) return;
      lifecycleRef.current = transition.state;
      setLifecycle(transition.state);
      for (const effect of transition.effects) applyLifecycleEffect(effect);
    },
    [applyLifecycleEffect]
  );
  // Timer callbacks intentionally dereference the latest dispatch function; queued callbacks may
  // outlive a React render, while the reducer generation still rejects stale work.
  lifecycleDispatchRef.current = dispatchLifecycle;

  const split = lifecycle.split;
  const closing = lifecycle.closing;
  const closingReplayKey = lifecycle.replayKey;

  useLayoutEffect(() => {
    // `inert` covers future focusable descendants; explicit tabIndex on current links below also
    // closes the pre-layout-effect commit window and works in older engines without inert support.
    const textColumn = textColRef.current;
    if (!textColumn) return;
    textColumn.inert = !split;
    if (
      !split &&
      document.activeElement instanceof HTMLElement &&
      textColumn.contains(document.activeElement)
    ) {
      document.activeElement.blur();
    }
  }, [split]);

  useEffect(
    () => () => {
      getLifecycleSequence().cancel();
    },
    [getLifecycleSequence]
  );

  const sendActivate = useCallback((): void => {
    const target = iframeRef.current?.contentWindow;
    if (!target || liveRef.current) return;
    target.postMessage('cineview-activate', window.location.origin);
    liveRef.current = true;
    setLive(true);
  }, []);

  const handleProgress = useCallback(
    (value: number): void => {
      progressRef.current = value;
      if (value >= REVEAL_AT) {
        if (stageRef.current !== 'revealed') {
          stageRef.current = 'revealed';
          setStage('revealed');
          if (embedReadyRef.current) sendActivate();
        }
      } else if (value >= CREATE_AT && stageRef.current === 'idle') {
        stageRef.current = 'mounted';
        setStage('mounted');
      }
      // Interaction gate (not latch, with hysteresis): opens iframe pointer only near reveal completion, withdrawn when reverse-scrolling away from segment end
      if (value >= INTERACT_AT) {
        if (!interactiveRef.current) {
          interactiveRef.current = true;
          setInteractive(true);
        }
      } else if (value < INTERACT_OFF_BELOW && interactiveRef.current) {
        interactiveRef.current = false;
        setInteractive(false);
      }
      /* Column collapse/reopen: reducer performs discrete transitions only at 0.85/0.95 thresholds; reopening
       * increments replayKey, so the keyed Fragment below replays the four-beat CSS entrance instead of revealing an already-completed frame. */
      dispatchLifecycle({ type: 'progress', value });
    },
    [dispatchLifecycle, sendActivate]
  );

  // deferred iframe ready handshake: only "ready received + progress passed reveal threshold" triggers activate,
  // avoiding iframe load race losing messages. Both directions validate same-origin + message source.
  useEffect(() => {
    const origin = window.location.origin;
    const handleMessage = (event: MessageEvent): void => {
      if (event.origin !== origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data === 'cineview-embed-ready') {
        embedReadyRef.current = true;
        if (stageRef.current === 'revealed') sendActivate();
        return;
      }
      /* Fourth message (2026-08-06): child page reached final scene and commit completed ⇒ enter split state:
         phone moves to left, right column closing layer mounts. User-specified timing is exactly this moment,
         not progress reaching 1, not during drag (at those two points the finger may not have released yet).
         2026-08-15 scrub semantics + 2026-08-16 strict sequential revision (see SPLIT_EXIT_* comments):
         finished ⇒ latch sets (closing layer mounts + CSS sequential entrance) + open columns;
         unfinished ⇒ **first text exits in sequence (SPLIT_EXIT_DELAYS_MS), columns collapse only after exit completes** —
         no longer instant unmount. Repeated messages are idempotent/last-wins. */
      if (event.data === 'cineview-embed-finished') {
        // An offscreen/cleanup generation is authoritative: the reducer ignores this late
        // message instead of cancelling the freeze that owns resource release.
        dispatchLifecycle({ type: 'finished', progress: progressRef.current });
      } else if (event.data === 'cineview-embed-unfinished') {
        dispatchLifecycle({ type: 'unfinished' });
      }
    };
    window.addEventListener('message', handleMessage);
    return (): void => window.removeEventListener('message', handleMessage);
  }, [dispatchLifecycle, sendActivate]);

  // Scene entirely leaves viewport → freeze + unmount iframe + reset latch (replay from start on re-entry).
  // Final act has no downward successor, only exit path is scrolling up. Visible exit = closing layer scrub fade-out
  // (progress pure function, plays out follow-finger while in viewport) + zone three-phase reverse scrub; this effect is
  // final cleanup outside viewport (wasteful for iframe to keep running in background after user scrolls away), doesn't
  // change exitAnimation ruling (architecture refinement #5).
  //
  // Two-level sequential under 2026-08-15 scrub semantics (freeze's iframe cleanup responsibility unchanged):
  //   t=700ms  Collapse columns (at this point progress≈0, text opacity already zeroed by scrub, collapse just
  //            layout reset, no text exit choreography — old exitRef chain deleted)
  //   t=1400ms Unmount iframe + reset latch/stage
  // Scrolling back within <1.4s after scrolling out (adversarial review R6-1 scenario): cancel timers —latch still holds,
  // closing layer still mounted, opacity returns as-is with scrub window when scrolling back to segment end; when progress
  // reaches 0.95, lifecycle replay generation re-walks the four beats.
  useEffect(() => {
    const node = rootRef.current;
    if (node === null || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      dispatchLifecycle({
        type: 'visibility',
        visible: entry.isIntersecting,
        stageActive: stageRef.current !== 'idle',
      });
    });
    observer.observe(node);
    return (): void => observer.disconnect();
  }, [dispatchLifecycle]);

  return (
    <div ref={rootRef} className="scene5-cinema" data-cinema-stage={stage} data-lang={lang}>
      {/* Lights-off overlay: Animate drives opacity curve (2026-08-13 user ruling A:
          black overlay stays within scene, keeps Animate; black screen must completely disappear before scroll intercept ends).
          ⚠️ Phase window starts at 0.02 not 0: when zone progress < 0.02 this lane stops at initial
          (opacity 0)— when reverse-scrolling out, black overlay completely disappears ~44px before unpin (progress 0),
          "black screen completely disappears before scroll intercept ends" holds (overlay already transparent, invisible when unpin slide happens).
          ⚠️ 1.05s anti-flash transition removed per user ruling (original N13 fix): during fast scrolling fade-in/fade-out
          ramp returns to notch-by-notch jumps, a cost the user knowingly accepted (user chose "complete disappearance"
          priority over "no flicker" on 2026-08-13). */}
      <Animate
        animateId="cinema-lightsoff"
        enterAnimation={lightsOffVariant()}
        duration={{ enter: 640 }}
        /* Full act phase (C-act5): exit must mirror entry, so can't cover only 0→CREATE_AT.
           lightsOffVariant is entire zone single-segment linear ramp (see its comments), phase window 0.02→1. */
        timeline={{ phase: { start: 0.02, end: 1 } }}
      >
        <div className="scene5-cinema__overlay" aria-hidden="true" />
      </Animate>

      {/* Black-gold gradient atmosphere (2026-08-19 rework: starfield retired, user directive "remove stars,
          subtle black-gold gradient + continuous animation"). Two layers of large radial gold mist (alpha ≤0.055, subtle not prominent),
          each with one infinite lane writing CSS variable (--gold-drift-1/2, periods 9s/14s coprime ⇒ two layers breathe
          out of phase, composite wave doesn't repeat) mapped to its own opacity for extremely slow breathing ⇒ "background continuous animation"
          and not in-phase with title/phone effects competing for attention. Nested structure isomorphic to old starlight: each Animate layer only writes
          its own variable, mist layers as innermost child nodes inherit and consume.
          ⚠️ infinite lane can only write CSS variables not opacity whitelist properties
          (memory `infinite-lane-cannot-drive-whitelist-props`).
          ⚠️ Full-screen gradient + per-frame variable rewrite causes full-screen repaint (memory
          `css-var-opacity-repaints-fullscreen`)— both layers translateZ(0) promoted to
          compositing layers, opacity breathing handed to compositor, same fix as old three-layer starfield approach. */}
      <div className="scene5-cinema__gold-mist" aria-hidden="true">
        <Animate
          animateId="cinema-gold-mist-a"
          loopAnimation={{
            animate: {
              '--gold-drift-1': [0.55, 1, 0.55],
              transition: { duration: 9, ease: 'easeInOut', repeat: Infinity },
            },
          }}
          timeline={{ phase: { start: 0, end: 1 } }}
        >
          <Animate
            animateId="cinema-gold-mist-b"
            loopAnimation={{
              animate: {
                '--gold-drift-2': [1, 0.5, 1],
                transition: { duration: 14, ease: 'easeInOut', repeat: Infinity },
              },
            }}
            timeline={{ phase: { start: 0, end: 1 } }}
          >
            <div className="scene5-cinema__gold-mist-layer scene5-cinema__gold-mist-layer--a" />
            <div className="scene5-cinema__gold-mist-layer scene5-cinema__gold-mist-layer--b" />
          </Animate>
        </Animate>
      </div>

      {/* Viewport ribbon: strictly coincides with viewport when center-locked (architecture refinement #6)
          ── Layout and timing (2026-08-06 user directive) ────────────────────────────
          Horizontal two columns: phone on left, title+subtitle on right (originally vertical: title above phone,
          user judged "takes up too much space").
          Two states switched by `split`:
            default   phone centered, right column width:0 doesn't occupy space (user: "phone enters first on entry")
            split     receives child page `cineview-embed-finished` (reached final scene and commit completed)
                      ⇒ phone moves left, right column appears
          Displacement and expansion carried by CSS transition (one-time state switch, not persistent animation,
          not constrained by CLAUDE.md rule 6 first clause `animation: infinite`). */}
      <div className="scene5-cinema__stage">
        <div className={`scene5-cinema__phone-slot${split ? ' is-split' : ''}`}>
          <div className="scene5-cinema__phone-col">
            <Animate
              animateId="cinema-phone"
              enterAnimation={phoneVariant()}
              duration={{ enter: 480 }}
              timeline={{ phase: { start: CREATE_AT, end: REVEAL_AT } }}
            >
              <PhoneMockup>
                <Animate
                  animateId="cinema-reveal"
                  enterAnimation={revealVariant()}
                  duration={{ enter: 480 }}
                  timeline={{ phase: { start: REVEAL_AT, end: 1 } }}
                >
                  <div
                    className={`scene5-cinema__iframe-slot${live && interactive ? ' is-live' : ''}`}
                  >
                    {stage !== 'idle' ? (
                      <iframe
                        ref={iframeRef}
                        className="scene5-cinema__iframe"
                        src="/drag?deferred=true"
                        title={t('scene5.frameTitle')}
                      />
                    ) : null}
                  </div>
                </Animate>
              </PhoneMockup>
            </Animate>
          </div>

          {/* Right column closing layer: title + subtitle + CTA + footer (2026-08-15 scrub semantics).
              - Mount gating on finished latch (closing): only renders when latched, sequential entrance
                carried by child element one-time CSS animation (delay 0/0.25s/0.6s/0.9s,
                Scene5Cinema.css `scene5-closing-*`, rule 6 allows one-time interpolation).
              - Each element one scrub lane: timeline.phase window 0.85→1 (driver defaults to 'scene',
                binds this zone's takeover timeline)— wrapper layer opacity is pure function of progress,
                scrolling up follows finger fade-out, scrolling back returns as-is, no messages/timers participate.
              - FOUC: when latch mounts progress is already 1, wrapper layer opacity immediately
                resolved to 1 by scrub, child element CSS animation `both` stops at opacity 0 during delay—
                both layers won't flash half-finished product. */}
          <div ref={textColRef} className="scene5-cinema__text-col" aria-hidden={!split}>
            {closing ? (
              <Fragment key={closingReplayKey}>
                <Animate
                  animateId="cinema-split-title"
                  enterAnimation={closingFadeVariant}
                  duration={{ enter: 480 }}
                  timeline={{ phase: { start: SCENE5_SPLIT_SCRUB_START, end: SPLIT_SCRUB_END } }}
                >
                  <p className="scene5-cinema__title-text">{t('scene5.title')}</p>
                </Animate>
                <Animate
                  animateId="cinema-split-subtitle"
                  enterAnimation={closingFadeVariant}
                  duration={{ enter: 480 }}
                  timeline={{ phase: { start: SCENE5_SPLIT_SCRUB_START, end: SPLIT_SCRUB_END } }}
                >
                  <p className="scene5-cinema__subtitle-text">{t('scene5.subtitle')}</p>
                </Animate>
                {/* Closing CTA (third beat). Button uses this act's scoped class (black scene cinema context:
                    light text/solid bone-white primary button + outline secondary button, no box-shadow— column container
                    overflow:hidden would clip shadow, brightness hierarchy replaces glow). */}
                <Animate
                  animateId="cinema-split-cta"
                  enterAnimation={closingFadeVariant}
                  duration={{ enter: 480 }}
                  timeline={{ phase: { start: SCENE5_SPLIT_SCRUB_START, end: SPLIT_SCRUB_END } }}
                >
                  <div className="scene5-cinema__cta">
                    <p className="scene5-cinema__cta-lead">{t('cta.title')}</p>
                    <div className="scene5-cinema__cta-buttons">
                      <Link
                        className="scene5-cinema__btn scene5-cinema__btn--primary"
                        to="/docs/03-quickstart"
                        tabIndex={scene5TabIndex(split)}
                      >
                        {t('cta.start')}
                      </Link>
                      <a
                        className="scene5-cinema__btn scene5-cinema__btn--ghost"
                        href={GITHUB_URL}
                        target="_blank"
                        rel="noreferrer"
                        tabIndex={scene5TabIndex(split)}
                      >
                        {t('cta.github')}
                      </a>
                    </div>
                    <p className="scene5-cinema__cta-body">{t('cta.body')}</p>
                  </div>
                </Animate>
                {/* footer (fourth beat): moved from viewport bottom absolute into right column on 2026-08-15,
                    positioned below cta.body— same column context, same scrub window. */}
                <Animate
                  animateId="cinema-footer"
                  enterAnimation={closingFadeVariant}
                  duration={{ enter: 480 }}
                  timeline={{ phase: { start: SCENE5_SPLIT_SCRUB_START, end: SPLIT_SCRUB_END } }}
                >
                  <div className="scene5-cinema__footer" aria-hidden={!split}>
                    <span className="scene5-cinema__footer-tagline">{t('footer.tagline')}</span>
                    <nav className="scene5-cinema__footer-links" aria-label={t('footer.tagline')}>
                      <Link to="/docs" tabIndex={scene5TabIndex(split)}>
                        {t('footer.docs')}
                      </Link>
                      <span className="scene5-cinema__footer-sep" aria-hidden="true" />
                      <span>{t('footer.license')}</span>
                    </nav>
                  </div>
                </Animate>
              </Fragment>
            ) : null}
          </div>
        </div>
      </div>

      {/* Budget clock: uniquely decides zone total budget (2200px locked scroll), and projects progress for stage latching */}
      <Animate
        animateId="cinema-clock"
        enterAnimation={clockVariant()}
        duration={{ enter: TOTAL_MS }}
      >
        <CinemaLatchProjection onProgress={handleProgress} />
      </Animate>
    </div>
  );
}

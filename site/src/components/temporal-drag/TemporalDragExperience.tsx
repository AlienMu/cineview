import { Animate, CineView, Scene } from 'cineview';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { SceneCut } from './SceneCut';
import { SceneFlux } from './SceneFlux';
import { SceneRolling } from './SceneRolling';
import { SceneSlate } from './SceneSlate';
import { SceneSync } from './SceneSync';
import { TemporalMotionProvider, useTemporalMotion } from './TemporalMotion';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import '../../styles/temporal-drag.css';
import '../../styles/temporal-scenes-03-05.css';

const GRAIN_TIMES = [0, 0.249, 0.25, 0.499, 0.5, 0.749, 0.75, 0.999, 1];

function SceneTexture({ id }: { id: string }): import('react').JSX.Element {
  const timing = useTemporalMotion();

  return (
    <div className="tp-texture" aria-hidden="true">
      {timing.reduced ? (
        <div className="tp-texture__grain" />
      ) : (
        <Animate
          animateId={`${id}-grain`}
          loopAnimation={{
            animate: {
              x: ['0%', '0%', '-3%', '-3%', '2%', '2%', '-1%', '-1%', '0%'],
              y: ['0%', '0%', '1%', '1%', '-2%', '-2%', '2%', '2%', '0%'],
              transition: {
                duration: timing.seconds(0.5),
                ease: 'linear',
                times: GRAIN_TIMES,
                repeat: Infinity,
              },
            },
          }}
        >
          <div className="tp-texture__grain" />
        </Animate>
      )}
      <div className="tp-texture__scanline" />
      <div className="tp-texture__vignette" />
    </div>
  );
}

type TemporalDragExperienceProps = {
  /** Preload shell: only lets the hidden iframe pull this page's HTML/JS/CSS into cache
   *  and evaluate modules, without mounting CineView—zero animation, zero rAF; the iframe's
   *  onLoad completes its mission. */
  preload?: boolean;
  /** Deferred start (embedded in Homepage scene5): first renders a dark shell and announces
   *  'cineview-embed-ready' to the parent window; only mounts the full CineView on receiving
   *  'cineview-activate' (cold start—the first act's entrance chain plays from zero at the
   *  reveal moment); 'cineview-freeze' unmounts back to shell.
   *  Shell state consumes zero CPU and doesn't compete with outer scroll for the main thread
   *  (task-flow 2026-08-02 architecture refinement #1/#2).
   *  Note: internal protocol URL—directly opening /drag?deferred=true in a tab has no parent
   *  window response, so it stays in the dark shell, which is expected behavior. */
  deferred?: boolean;
};

/** Final act index (five acts: rolling/slate/sync/flux/cut). Reaching it means "scrolled to end". */
const LAST_SCENE_INDEX = 4;

export const TemporalDragExperience = memo(function TemporalDragExperience({
  preload = false,
  deferred = false,
}: TemporalDragExperienceProps): import('react').JSX.Element {
  const [stage, setStage] = useState<'frozen' | 'live'>(deferred ? 'frozen' : 'live');
  const reduced = usePrefersReducedMotion();

  /* Fourth message: `cineview-embed-finished` / `cineview-embed-unfinished` (2026-08-06;
   * 2026-08-09 added reverse direction—user interview verdict: "exit = complete reverse choreography").
   * The timing users want is "only let the outer phone slide left when the user has scrolled to the end
   * in the /drag page AND the commit is complete".
   * The criterion must be **commit complete** not mid-drag—`onSceneLeave` fires exactly after the
   * transition settles and carries toIndex, so use it instead of `onDragProgress` (which reaches 1
   * before the finger releases).
   * Reverse is the same: committing away from the final act (toIndex < LAST_SCENE_INDEX) sends unfinished,
   * and the outer title/subtitle mirrors the exit, phone returns to center (split changes from one-way
   * latch to bidirectional). Both directions are idempotent: the parent layer's repeated finished/unfinished
   * messages just setSplit to the same value, no side effects.
   * Only sent when deferred (embedded in homepage): when /drag is opened independently there's no parent
   * window, sending has no recipient.
   * Same-origin validation follows the existing convention. */
  const notifySceneSettled = useCallback(
    (detail: { toIndex: number }): void => {
      if (!deferred) return;
      window.parent?.postMessage(
        detail.toIndex === LAST_SCENE_INDEX
          ? 'cineview-embed-finished'
          : 'cineview-embed-unfinished',
        window.location.origin
      );
    },
    [deferred]
  );

  /* Fifth act black curtain + scene texture choreography (2026-08-13, task-flow 2026-08-13-act5-black-exit-bg-follow;
   * code-review found issues 1/2/4 fixed). The black curtain background has moved from .tp-scene--05 to .tp-act5-black
   * (temporal-drag.css), this component manages opacity for two surfaces:
   *   - `.tp-act5-black`: fifth act black background (z1 root-level layer, doesn't slide with scene frame).
   *   - `.tp-scene--05 .tp-texture`: grain/scanline/vignette. After the scene background becomes transparent, if these
   *     overlay layers don't exit they'll slide over act four content with the scene frame (review found issue 1)—must
   *     fade out in sync with the black layer.
   * Three-state choreography (zero React state, direct DOM writes):
   *   1. Gesture phase: per-tick direct write + transition:none—fully finger-tracking, no lag (review found issue 4
   *      rejected the "reapply 250ms transition every frame" approach; drag's progress is already a per-frame smooth
   *      value, doesn't need further smoothing).
   *   2. Release (pointerup, within session): transition linearly to terminal value, duration = |terminal − current|
   *      × slideDuration(800ms) (same speed as remaining slide distance, fade completes simultaneously with commit)—during
   *      settle tween the black curtain/texture fade smoothly, no longer freeze at release value waiting for commit to
   *      snap (review found issue 2).
   *      Bounce return ticks immediately reclaim gesture state, unaffected.
   *   3. commit/cancel: snap to terminal value (act four frame is already full-bleed, snap is invisible).
   * Latch (resisting acceptance criteria A3/S2): established by the first tick matching "enter/exit fifth act", doesn't
   * re-check direction within this session—mid-gesture forward↔reverse flips still follow sceneIndex and shrink by |progress|;
   * sessions starting in ambiguous direction match per-tick to fill in. Reset on commit/cancel (DESIGN.md: exactly one
   * commit|cancel per session, no cross-session residue). */
  const blackRef = useRef<HTMLDivElement | null>(null);
  const textureRef = useRef<HTMLElement | null>(null);
  const blackSessionRef = useRef<number | null>(null);
  /** Black layer current value tracking: settle duration is calculated from "remaining slide distance" (see pointerup handler). */
  const lastBlackRef = useRef(1);

  const applyBlack = useCallback(
    (opacity: number, mode: 'gesture' | 'settle' | 'snap', settleMs?: number): void => {
      // freeze/activate shell switching unmounts and remounts CineView (blackRef is auto-remounted by React),
      // manually cached textureRef will point to old nodes detached from the document—isConnected validates and re-parses
      // (resisting acceptance criteria T4 actual test: stale reference caused texture to freeze at 1).
      if (!textureRef.current?.isConnected) {
        textureRef.current = document.querySelector<HTMLElement>('.tp-scene--05 .tp-texture');
      }
      const transition = mode === 'settle' ? `opacity ${settleMs ?? 700}ms linear` : 'none';
      for (const node of [blackRef.current, textureRef.current]) {
        if (!node) continue;
        if (node.style.transition !== transition) node.style.transition = transition;
        node.style.opacity = String(opacity);
      }
      lastBlackRef.current = opacity;
    },
    []
  );

  const handleBlackOpacity = useCallback(
    (detail: {
      sceneIndex: number;
      direction?: 'forward' | 'backward' | null;
      progress: number;
    }): void => {
      if (blackSessionRef.current === null && detail.direction) {
        if (detail.sceneIndex === LAST_SCENE_INDEX - 1 && detail.direction === 'forward') {
          blackSessionRef.current = LAST_SCENE_INDEX - 1;
        } else if (detail.sceneIndex === LAST_SCENE_INDEX && detail.direction === 'backward') {
          blackSessionRef.current = LAST_SCENE_INDEX;
        }
      }
      if (blackSessionRef.current === null) return;
      const opacity =
        blackSessionRef.current === LAST_SCENE_INDEX - 1 ? detail.progress : 1 - detail.progress;
      applyBlack(opacity, 'gesture');
    },
    [applyBlack]
  );
  const handleBlackSessionEnd = useCallback((): void => {
    blackSessionRef.current = null;
  }, []);
  const handleSceneSettled = useCallback(
    (detail: { toIndex: number }): void => {
      notifySceneSettled(detail);
      blackSessionRef.current = null;
      applyBlack(detail.toIndex === LAST_SCENE_INDEX ? 1 : 0, 'snap');
    },
    [applyBlack, notifySceneSettled]
  );

  // Release → settle fade in/out (three-state phase 2). Use capture phase to prevent framework pointer path from intercepting bubbling.
  // Duration calculated from remaining slide distance: |terminal − current| × slideDuration(800ms), fade completes simultaneously
  // with commit, snap has zero jump (resisting acceptance "entrance side commit pop" suggestion).
  useEffect(() => {
    const onPointerUp = (): void => {
      if (blackSessionRef.current === null) return;
      const terminal = blackSessionRef.current === LAST_SCENE_INDEX ? 0 : 1;
      const settleMs = Math.min(
        800,
        Math.max(reduced ? 80 : 120, Math.abs(terminal - lastBlackRef.current) * 800)
      );
      applyBlack(terminal, 'settle', settleMs);
    };
    window.addEventListener('pointerup', onPointerUp, true);
    return (): void => window.removeEventListener('pointerup', onPointerUp, true);
  }, [applyBlack, reduced]);

  useEffect(() => {
    if (!deferred) return;
    const origin = window.location.origin;
    const handleMessage = (event: MessageEvent): void => {
      if (event.origin !== origin) return;
      if (event.data === 'cineview-activate') {
        setStage('live');
      } else if (event.data === 'cineview-freeze') {
        setStage('frozen');
      }
    };
    window.addEventListener('message', handleMessage);
    // Only announce ready after listener is in place; parent only sends activate after receiving ready, avoiding load race.
    window.parent?.postMessage('cineview-embed-ready', origin);
    return (): void => window.removeEventListener('message', handleMessage);
  }, [deferred]);

  if (preload || stage === 'frozen') {
    return <div className="drag-temporal" data-embed={preload ? 'preload' : 'deferred-frozen'} />;
  }

  return (
    <div className="drag-temporal" data-embed={deferred ? 'deferred-live' : undefined}>
      {/* Fifth act black curtain root-level layer: must come before CineView (DOM order) + z-index 1,
          above container background, below all scene frames (see temporal-drag.css .tp-act5-black). */}
      <div ref={blackRef} className="tp-act5-black" aria-hidden="true" />
      <TemporalMotionProvider>
        <CineView
          designWidth={390}
          mode="drag"
          direction="y"
          transitionDuration={720}
          unit="time"
          threshold={{
            minVelocity: 0,
            maxVelocity: 1200,
            minRatio: 0.15,
            maxRatio: 0.32,
          }}
          callbacks={{
            onSceneLeave: handleSceneSettled,
            onDragProgress: handleBlackOpacity,
            onDragCancel: handleBlackSessionEnd,
          }}
        >
          <Scene
            sceneId="rolling"
            className="tp-scene tp-scene--01"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneRolling />
            <SceneTexture id="s01-texture" />
          </Scene>
          <Scene
            sceneId="slate"
            className="tp-scene tp-scene--02"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneSlate />
            <SceneTexture id="s02-texture" />
          </Scene>
          <Scene
            sceneId="sync"
            className="tp-scene tp-scene--03"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneSync />
            <SceneTexture id="s03-texture" />
          </Scene>
          <Scene
            sceneId="flux"
            className="tp-scene tp-scene--04"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneFlux />
            <SceneTexture id="s04-texture" />
          </Scene>
          <Scene
            sceneId="cut"
            className="tp-scene tp-scene--05"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneCut />
            <SceneTexture id="s05-texture" />
          </Scene>
        </CineView>
      </TemporalMotionProvider>
    </div>
  );
});

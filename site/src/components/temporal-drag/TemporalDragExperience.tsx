import { CineView, Scene } from 'cineview';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { animate, useMotionValue, type AnimationPlaybackControls } from 'framer-motion';
import type { DragCommitDetail, DragDetail, SceneChangeDetail } from 'cineview';
import { AmbientStage } from './AmbientStage';
import { SceneCut } from './SceneCut';
import { SceneFlux } from './SceneFlux';
import { SceneRolling } from './SceneRolling';
import { SceneSlate } from './SceneSlate';
import { SceneSync } from './SceneSync';
import { TemporalMotionProvider } from './TemporalMotion';
import '../../styles/temporal-drag.css';
import '../../styles/temporal-scenes-03-05.css';

export const TemporalDragExperience = memo(function TemporalDragExperience(): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const directionRef = useRef<DragDetail['direction']>(null);
  const dragProgress = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  // The root is the ONLY place that knows which act is live, so it owns the ambient
  // gate: the rig is mounted outside the CineView tree (it is chrome, not scene
  // content) and therefore has no framework phase to be gated against. Locked spec
  // is 环境光只在第一屏 — acts 2-5 must keep their own lighting unflattened.
  const activeSceneIndexRef = useRef(0);
  const handleSceneWillChange = useCallback(({ toIndex }: SceneChangeDetail): void => {
    activeSceneIndexRef.current = toIndex;
  }, []);
  // Sink-on-drag: 0 = full room light, 1 = light has sunk into the scene. Driven
  // only by a FORWARD drag on act 1 (dragging act 1 away). Kept separate from
  // dragProgress because that value is reused by act 4's tick bar and would make
  // the rig react to drags it has nothing to do with.
  const ambientSink = useMotionValue(0);
  // Mount lifetime of the ambient rig, deliberately DECOUPLED from which act is
  // live. Gating mount on `activeSceneIndex === 0` produced a hard cut: the scene
  // index flips at the START of the 720ms transition, and commit fires as low as
  // minRatio 0.15, so the rig was yanked from ~87% opacity to nothing in one frame.
  // The light must finish sinking first, so unmount is owned by the tween below,
  // not by the scene index.
  const [ambientMounted, setAmbientMounted] = useState(true);
  // Mirror of `ambientMounted` for the drag callbacks: they are recreated per render but
  // capture the state value from the render that made them, so reading the state directly
  // inside a gesture gives a stale answer.
  const ambientMountedRef = useRef(true);
  ambientMountedRef.current = ambientMounted;
  const sinkTweenRef = useRef<AnimationPlaybackControls | null>(null);
  const pendingUnmountRef = useRef(false);
  // unmountWhenDark needs to be able to START a sink (see its comment), but driveSink is
  // declared below it and the two would otherwise form a dependency cycle. A ref breaks it.
  const driveSinkRef = useRef<((to: number, mount?: boolean) => void) | null>(null);
  // Is a finger actually down RIGHT NOW. Deliberately tracked from raw pointer events
  // rather than the framework's drag session: `data-dragging` stays true for ~275ms of
  // snap-back after pointerup, and treating those frames as a live drag is what left the
  // ambient rig mounted forever on acts 2-5 (see handleDragProgress).
  const pointerDownRef = useRef(false);
  // Run the sink to `to`. Duration matches the scene transition (720ms) so the room
  // light lands as the next act settles. Unmount is NOT a parameter here: it is
  // requested separately (see unmountWhenDark) because the sink has to START at the
  // release and the decision to unmount only arrives later, at the commit.
  //
  // `mount` is explicit rather than unconditional. An unconditional setAmbientMounted(true)
  // here re-opened the very hole the act-1 gate exists to close: handleDragCancel calls
  // this on ANY act, so a tap or aborted drag on acts 2-5 mounted the rig and faded act
  // 1's room light up over that act, permanently (+36% frame luminance on act 2). Only
  // callers that know act 1 owns the frame may mount.
  const driveSink = useCallback(
    (to: number, mount = false): void => {
      // stop() does NOT fire onComplete, so the ref must be cleared by hand at every
      // stop site — a stale non-null ref makes unmountWhenDark believe a tween is
      // still flying and park pendingUnmountRef forever (rig never unmounts). Here
      // the ref is reassigned immediately below, but the null keeps the invariant
      // ("ref non-null ⇔ tween live") true at every instant.
      sinkTweenRef.current?.stop();
      sinkTweenRef.current = null;
      if (mount) setAmbientMounted(true);
      sinkTweenRef.current = animate(ambientSink, to, {
        duration: 0.72,
        ease: [0.16, 1, 0.3, 1],
        onComplete: () => {
          sinkTweenRef.current = null;
          if (pendingUnmountRef.current) {
            pendingUnmountRef.current = false;
            setAmbientMounted(false);
          }
        },
      });
    },
    [ambientSink]
  );
  driveSinkRef.current = driveSink;
  // Tear the rig down, but never while it is still visibly lit.
  //
  // This used to check only "is a tween in flight", which is not the same question and
  // made the function's name a lie. Two defects came out of that gap:
  //  - With NO tween, it unmounted immediately at whatever brightness the rig had. A
  //    natural correction (return to act 1, then re-commit forward 160-320ms later,
  //    mid-transition) left the light at a full 1.0 with no tween running, and the rig
  //    was removed in ONE frame from 100% — worse than the original D0 hard cut at 87%.
  //  - With a STOPPED-but-non-null tween it deferred forever. The framework keeps
  //    emitting progress for ~275ms of snap-back after pointerup, so the act-2 branch
  //    re-mounted and stopped the cancel tween each frame, leaving sinkTweenRef non-null
  //    and this function permanently parked on `pending`. The rig then never unmounted
  //    at all: three CSS loops and a 1.2Mpx canvas rAF ran forever on acts 2-5.
  // So: darkness is decided by the VALUE, and a sink is started if one is needed.
  const unmountWhenDark = useCallback((): void => {
    if (ambientSink.get() >= 0.94) {
      pendingUnmountRef.current = false;
      sinkTweenRef.current?.stop();
      sinkTweenRef.current = null;
      setAmbientMounted(false);
      return;
    }
    // Still lit. Make sure something is actually driving it to dark before deferring —
    // otherwise "pending" is a promise nothing will keep.
    pendingUnmountRef.current = true;
    if (!sinkTweenRef.current) driveSinkRef.current?.(1);
  }, [ambientSink]);
  const cancelPendingUnmount = useCallback((): void => {
    pendingUnmountRef.current = false;
  }, []);

  const updateDirection = useCallback((direction: DragDetail['direction']): void => {
    if (!direction || directionRef.current === direction) return;
    directionRef.current = direction;
    const root = rootRef.current;
    if (root) root.dataset.dragDirection = direction;
  }, []);

  const handleDragStart = useCallback(
    ({ direction }: DragDetail): void => {
      dragProgress.set(0);
      // A new grab always wins over an in-flight sink tween: without this, grabbing
      // act 1 again mid-transition leaves the tween writing to the same value the
      // finger is writing to, and the light fights the pointer.
      //
      // stop() never fires onComplete, so the ref must be nulled here or the killed
      // tween's stale handle makes unmountWhenDark defer forever (rig stuck lit over
      // acts 2-5). Any pending unmount that was riding on that tween is cleared with
      // it: the deferral has lost its executor, and every way this new gesture can
      // end (handleDragCancel / handleDragCommit) re-decides the rig's fate anyway —
      // holding a stale pending here only races those decisions (e.g. a release
      // tween completing against commit(0)'s cancelPendingUnmount).
      sinkTweenRef.current?.stop();
      sinkTweenRef.current = null;
      pendingUnmountRef.current = false;
      if (activeSceneIndexRef.current === 0) setAmbientMounted(true);
      updateDirection(direction);
      setIsDragging(true);
    },
    [dragProgress, updateDirection]
  );
  const handleDragProgress = useCallback(
    ({ direction, progress }: DragDetail): void => {
      dragProgress.set(progress);
      // Act 1 forward: dragging act 1 away sinks the room light. A backward drag on
      // act 1 is a rubber-band at the top of the reel, so the light must stay up
      // rather than dim on a gesture that goes nowhere.
      if (activeSceneIndexRef.current === 0) {
        ambientSink.set(direction === 'backward' ? 0 : progress);
      } else if (activeSceneIndexRef.current === 1) {
        // Act 2 dragged BACKWARD = act 1 is being pulled back into frame, so the room
        // light has to rise WITH the finger. Without this the rig stayed unmounted for
        // the whole gesture and only faded in at commit — act 1 arrived on screen dark
        // and lit up ~450ms later, behind a scene that had already settled. That is the
        // mirror image of the commit-side stall, and just as visible.
        //
        // The FORWARD case here is not a no-op: this branch used to be gated on
        // `direction === 'backward'`, so reversing mid-gesture (drag act 1 partway back,
        // then flick forward to commit to act 3) simply stopped writing ambientSink and
        // left the rig frozen at whatever brightness it had reached — measured 0.555 held
        // for 483ms, then a one-frame cut to nothing. That is act 1's room light washing
        // acts 2 and 3 plus a hard cut, i.e. D1 and D0 at once. Whoever owns the value
        // must keep owning it for the whole gesture, so a forward drag drives it back
        // down toward dark instead of abandoning it.
        // Gated on the finger STILL BEING DOWN. The framework keeps emitting progress for
        // ~275ms of snap-back after pointerup, and this branch treated those frames as a
        // live drag: it re-mounted the rig and killed the cancel tween on every one of
        // them, so an abandoned backward twitch on act 2 left the rig mounted at 0.04
        // forever — three CSS loops plus a 1.2Mpx canvas rAF running for the rest of the
        // session on acts 2-5. Snap-back frames belong to handleDragCancel, not here.
        if (!pointerDownRef.current) {
          updateDirection(direction);
          return;
        }
        if (direction === 'backward') {
          sinkTweenRef.current?.stop();
          sinkTweenRef.current = null;
          setAmbientMounted(true);
          ambientSink.set(1 - progress);
        } else if (ambientMountedRef.current) {
          // Only relevant once a backward drag has already mounted the rig; a plain
          // forward drag on act 2 must not summon act 1's light in the first place.
          sinkTweenRef.current?.stop();
          sinkTweenRef.current = null;
          ambientSink.set(1);
        }
      }
      updateDirection(direction);
    },
    [ambientSink, dragProgress, updateDirection]
  );
  const finishDrag = useCallback((): void => {
    dragProgress.set(0);
    directionRef.current = null;
    const root = rootRef.current;
    if (root) delete root.dataset.dragDirection;
    setIsDragging(false);
  }, [dragProgress]);
  // Cancelled drag = the act snaps back, so the room light rises back up with it.
  // Tweened, not .set(): a snap back to full brightness is the same hard cut as the
  // commit bug, just in the other direction.
  //
  // Gated on act 1. A cancel is also what a plain TAP produces (sub-threshold release),
  // and taps happen on every act — ungated, this raised act 1's room light over acts 2-5
  // and left it there. `mount: true` is safe here precisely because of that guard.
  //
  // Act 2 needs its own branch: handleDragProgress MOUNTS the rig when act 2 is dragged
  // backward (act 1 coming back into frame). If that gesture is then abandoned below the
  // commit threshold, act 1 never arrives — so the light this act does not own must sink
  // back out and unmount. Returning early here, as this did, left the rig parked at
  // `1 - progress` brightness over act 2 with no path to ever remove it: the exact D1
  // failure mode, re-entered through the D2 fix.
  const handleDragCancel = useCallback((): void => {
    const act = activeSceneIndexRef.current;
    if (act === 0) {
      cancelPendingUnmount();
      driveSink(0, true);
    } else if (act === 1) {
      // Sink to fully-dark and unmount: the aborted gesture leaves act 2 owning the frame.
      driveSink(1, false);
      unmountWhenDark();
    }
    finishDrag();
  }, [cancelPendingUnmount, driveSink, finishDrag, unmountWhenDark]);
  const handleDragCommit = useCallback(
    ({ targetSceneIndex }: DragCommitDetail): void => {
      // By the time commit lands, the sink has ALREADY been running since the finger
      // lifted (see the pointerup listener) — commit only reconciles the destination.
      // Driving the sink from here instead was the 480ms stall: commit is gated on the
      // page-slide finishing (useDragSceneEngine's commitRelease), so the light held
      // still through the whole release settle and only began sinking as the next act
      // arrived. Sinking must overlap the transition, not follow it.
      if (targetSceneIndex === 0) {
        cancelPendingUnmount();
        driveSink(0, true);
      } else {
        unmountWhenDark();
      }
      finishDrag();
    },
    [cancelPendingUnmount, driveSink, finishDrag, unmountWhenDark]
  );
  const callbacks = useMemo(
    () => ({
      onDragStart: handleDragStart,
      onDragProgress: handleDragProgress,
      onDragCancel: handleDragCancel,
      onDragCommit: handleDragCommit,
      onSceneWillChange: handleSceneWillChange,
    }),
    [handleDragCancel, handleDragCommit, handleDragProgress, handleDragStart, handleSceneWillChange]
  );

  // Start the sink the instant the finger LIFTS, not at commit. The framework's
  // public callback surface has no release event (Scene's internal onDragRelease
  // fires at the right moment but is not exposed), and onDragCommit is gated on the
  // page-slide finishing — measured at ~480ms after release, which read on device as
  // the light freezing mid-sink and then dropping after the next act had arrived.
  // pointerup on the root IS the release instant, so the sink overlaps the transition
  // the way "沉入场景" requires. The destination is not known yet here (commit decides
  // whether act 1 stays or goes), so this drives toward fully-sunk and commit
  // reconciles: back to act 1 → tween returns to 0, left act 1 → unmount once dark.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const handleDown = (): void => {
      pointerDownRef.current = true;
    };
    const handleRelease = (): void => {
      // Cleared FIRST: handleDragProgress reads this to tell a live drag from the
      // framework's ~275ms of post-release snap-back, and the framework may emit
      // progress synchronously from within this same event.
      pointerDownRef.current = false;
      const act = activeSceneIndexRef.current;
      // NO act-2 branch here, deliberately. One was added to close the D7 abandon leak,
      // driving the sink toward DARK on any backward release from act 2. It was both
      // redundant and harmful: a control run showed `handleDragCancel`'s act-2 branch
      // already closes that leak on its own, while this branch fired on the COMMITTING
      // backward drag too — sinking the light to 0.09 over ~340ms just as act 1 landed,
      // then commit re-targeted the tween and jumped it back +0.324 in one frame. The
      // user saw the room go black and flare back at ~0.9Hz while dragging act 1 in.
      // The finger was pulling act 1 back; the light must not run the other way.
      //
      // What this DOES do for act 2 is keep the light moving the way the finger was
      // already moving it. Without it the rig simply held at its release value (~0.82)
      // for the ~330ms until commit fires, which is the same stall that made the
      // forward sink look frozen. Abandoned gestures are not this handler's problem:
      // handleDragCancel fires for those and sinks/unmounts.
      if (act === 1) {
        if (directionRef.current === 'backward' && ambientSink.get() > 0.001) {
          driveSink(0, false);
        }
        return;
      }
      if (act !== 0) return;
      // Only a forward drag is carrying act 1 away; a backward rubber-band released
      // at the head of the reel must leave the room light where it is (up).
      if (directionRef.current === 'backward') return;
      if (ambientSink.get() <= 0.001) return;
      // mount:false — act 1 is live, so the rig is already up; this only continues
      // the sink the finger started.
      driveSink(1, false);
    };
    // pointerdown is capture-phase so the flag is set before the framework's own handlers
    // can emit a progress frame for this gesture.
    root.addEventListener('pointerdown', handleDown, true);
    root.addEventListener('pointerup', handleRelease);
    root.addEventListener('pointercancel', handleRelease);
    return () => {
      root.removeEventListener('pointerdown', handleDown, true);
      root.removeEventListener('pointerup', handleRelease);
      root.removeEventListener('pointercancel', handleRelease);
    };
  }, [ambientSink, driveSink]);

  useEffect(
    () => () => {
      // The sink tween outlives the drag by design (it runs across the scene
      // transition), so it has to be stopped here or it keeps ticking — and its
      // onComplete calls setState — after the experience is gone.
      sinkTweenRef.current?.stop();
      sinkTweenRef.current = null;
    },
    []
  );

  return (
    <div ref={rootRef} className="drag-temporal" data-dragging={isDragging}>
      <TemporalMotionProvider>
        <CineView
          config={{ size: 390 }}
          mode="drag"
          modes={{
            drag: {
              direction: 'y',
              transitionDuration: 720,
              // Authored time advances with the gesture at the framework default
              // scale (10ms of scene clock per 1% drag), so the same clock follows
              // both forward and reverse gestures.
              unit: 'time',
              threshold: {
                minVelocity: 0,
                maxVelocity: 1200,
                minRatio: 0.15,
                maxRatio: 0.32,
              },
            },
          }}
          callbacks={callbacks}
        >
          <Scene
            sceneId="rolling"
            className="tp-scene tp-scene--01"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneRolling />
          </Scene>
          <Scene
            sceneId="slate"
            className="tp-scene tp-scene--02"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneSlate />
          </Scene>
          <Scene
            sceneId="sync"
            className="tp-scene tp-scene--03"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneSync />
          </Scene>
          <Scene
            sceneId="flux"
            className="tp-scene tp-scene--04"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneFlux />
          </Scene>
          <Scene
            sceneId="cut"
            className="tp-scene tp-scene--05"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneCut />
          </Scene>
        </CineView>
        {/* Ambient light layer: drifting key-light, projector ray sweep, and dust
            motes. Sits ABOVE the opaque scenes but BELOW the grain texture, using
            mix-blend-mode:screen so it only adds light (center type stays crisp).
            NOT inside the CineView tree, so the framework has no phase to gate it —
            hence the explicit act-1 gate. It used to render unconditionally and wash
            all five acts, which flattened each act's own lighting. */}
        {/* Ambient light rig — act 1 only (locked spec 第 12 行). Mount lifetime is
            owned by the sink tween, NOT by the live scene index: the index flips at
            the start of the 720ms transition, so gating mount on it cut the light
            off mid-sink. It now unmounts only once the sink has reached 1. */}
        {ambientMounted ? <AmbientStage sink={ambientSink} /> : null}
        {/* Texture layer (v3 §3): film grain + scanline + vignette. Sits above the
            scenes, pointer-events:none, NOT inside the CineView tree — pure decoration. */}
        <div className="tp-texture" aria-hidden="true">
          <div className="tp-texture__grain" />
          <div className="tp-texture__scanline" />
          <div className="tp-texture__vignette" />
        </div>
      </TemporalMotionProvider>
    </div>
  );
});

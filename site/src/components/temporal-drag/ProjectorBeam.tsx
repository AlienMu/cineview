import { Animate } from 'cineview';
import { memo } from 'react';
import { useTemporalMotion } from './TemporalMotion';

// Act 05 — the projector beam. It rises from the projection port and carries the only
// non-text visual in the final scene: warm light with dust drifting through it.
//
// Framework-owned motion only (AGENTS.md rule 6):
//   - the bloom is an `<Animate>` enter/exit lane, so it scrubs with the finger and
//     reverses on a backward drag;
//   - the drifting dust is `infiniteAnimation`, i.e. the framework's infinite lane, gated
//     by `shouldRunInfinite`. It stops the moment act 5 stops being the live phase. A CSS
//     `animation: … infinite` would keep drifting through exit and after the act is gone.
// Nothing here imports framer-motion, opens a rAF, or holds per-frame React state — so no
// canvas exemption is needed or claimed (act 5 lives INSIDE a <Scene> and therefore has no
// right to one).

const BEAM_START_MS = 1400;
const BEAM_ENTER_MS = 2200;
// The beam extinguishes before the typography finishes fading. It holds its geometry while
// opacity falls, so exit reads as the lamp switching off rather than the cone retracting.
const BEAM_EXIT_MS = 560;

const DUST_DRIFT_SECONDS = 9;
const DUST_COUNT = 18;

type Mote = { left: number; top: number; size: number; dim: number };

// Deterministic scatter. A seeded LCG rather than Math.random() so the layout is identical
// on every render and across reloads — random positions would reshuffle the beam's dust on
// any re-render, which reads as a glitch rather than as drift.
function buildMotes(count: number): Mote[] {
  let seed = 0x5f3a;
  const random = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  return Array.from({ length: count }, () => ({
    left: 8 + random() * 84,
    // Only the FIRST half of the drift track. The second copy below is offset by exactly
    // 50%, which is what makes the -50% loop seamless (see the drift note).
    top: random() * 50,
    size: 1 + random() * 1.8,
    dim: 0.25 + random() * 0.55,
  }));
}

const MOTES = buildMotes(DUST_COUNT);

export const ProjectorBeam = memo(function ProjectorBeam(): JSX.Element {
  const timing = useTemporalMotion();

  return (
    <Animate
      animateId="s05-beam"
      // opacity + scale only. scaleX/scaleY are silently dropped by the drag lane (it
      // animates opacity, x, y, scale, rotate, rotateX/Y, skewX/Y, filter and nothing
      // else — useAnimateDrag.ts:711-720), which is why the OLD spotlight never actually
      // widened: both of its lanes were pure opacity fades on screen. The throw of the
      // beam is carried by CSS geometry with transform-origin pinned at the port, so a
      // uniform scale reads as the beam reaching further into the room.
      enterAnimation={{
        initial: { opacity: 0, scale: 0.62 },
        animate: { opacity: 1, scale: 1 },
      }}
      exitAnimation={{ exit: { opacity: 0, scale: 1 } }}
      duration={{ enter: timing.duration(BEAM_ENTER_MS), exit: timing.duration(BEAM_EXIT_MS) }}
      timeline={{ delay: timing.delay(BEAM_START_MS) }}
    >
      <div className="s05-beam" aria-hidden="true">
        <span className="s05-beam__port" />
        <span className="s05-beam__cone" />

        {/* Dust is its OWN lane, not a loop bolted onto the beam lane above. If the loop
            rode the beam's Animate, the framework's single anonymous infinite wrapper
            would translate the cone gradient too and the whole beam would slide. */}
        <Animate
          animateId="s05-beam-dust"
          // Fades in on the same schedule as the beam it lives in, so the dust is already
          // present when the loop takes over rather than appearing after it.
          enterAnimation={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
          // No exitAnimation on purpose: with an empty exit target the drag lane holds the
          // element at its animate value through `outgoing` (useAnimateDrag.ts:340-343),
          // so the parent beam owns the single fade-out. Two nested fades would multiply
          // and the dust would vanish well before the beam did.
          duration={{ enter: timing.duration(BEAM_ENTER_MS) }}
          timeline={{ delay: timing.delay(BEAM_START_MS) }}
          infiniteAnimation={
            timing.reduced
              ? undefined
              : {
                  animate: {
                    // Starts at the ENTER LANDING POINT ('0%'), not at some mid-drift
                    // offset. The infinite lane starts from keyframe[0], so authoring
                    // ['-20%','-70%'] would jump the layer on the handoff frame — the
                    // documented act-2 defect.
                    //
                    // -50% is one full pattern period, not half of one: the track is
                    // TWO stacked copies of the same scatter (the wrapper is 200% tall,
                    // see the CSS change order), so translating by half the track lands
                    // copy 2 exactly where copy 1 began. That is what makes the loop
                    // seamless with no visible seam sweeping through the beam.
                    y: ['0%', '-50%'],
                    transition: {
                      duration: timing.seconds(DUST_DRIFT_SECONDS),
                      ease: 'linear',
                      repeat: Infinity,
                    },
                  },
                }
          }
        >
          <div className="s05-beam__dust">
            {[0, 1].map((copy) =>
              MOTES.map((mote, index) => (
                <span
                  key={`${copy}-${index}`}
                  className="s05-beam__mote"
                  style={{
                    left: `${mote.left}%`,
                    top: `${mote.top + copy * 50}%`,
                    width: `${mote.size}px`,
                    height: `${mote.size}px`,
                    opacity: mote.dim,
                  }}
                />
              ))
            )}
          </div>
        </Animate>
      </div>
    </Animate>
  );
});

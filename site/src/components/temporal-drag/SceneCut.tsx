import { Animate } from 'cineview';
import { memo } from 'react';
import { useI18n } from '../../i18n';
import { ProjectorBeam } from './ProjectorBeam';
import { useTemporalMotion } from './TemporalMotion';

const CREDITS = [
  ['director', 'sceneEngine'],
  ['editor', 'timeline'],
  ['cinematography', 'scrollDrag'],
  ['performance', 'motionRuntime'],
  ['starring', 'yourStory'],
] as const;

// ── Act 05 · Curtain call ───────────────────────────────────────────────────
//
// The room geometry has been removed. The act is deliberately reduced to three things:
// projector light, dust within that light, and unframed credits rising in the dark.
//
// Everything deleted in this pass and why:
//   - the five-word TITLE (one <Animate> lane per word, each staggering its own
//     characters): 10+ lanes of machinery whose only job was to assemble a sentence. The
//     credits already say what the act is for.
//   - the SLATE (`05 / CURTAIN CALL`) — removed with the other four act labels. Its lane
//     and timing offset are gone from the tree entirely.
//   - the KICKER (`FINAL CUT`).
//   - `.s05-spotlight` (top-down stage cone) → ProjectorBeam. A follow-spot hanging over
//     the actors is the wrong fixture for a room whose light comes from the projection
//     port at the back.
//   - `.s05-floor`, screen, side walls, and seat rows; no replacement panel is rendered.
//
// Absolute delays keep the cadence independent of registered/staggered lane budgets. Each
// credit rises for 1800ms and the next begins 420ms later.
const CREDIT_START_MS = 1000;
const CREDIT_EACH_MS = 420;
const CREDIT_ENTER_MS = 1800;

// `SLATE_LEAD_MS = 320` is GONE, deliberately. It was the deleted slate lane's registered
// duration, which `waitFor: 's05-slate'` silently added to every downstream delay, and it
// survived the label's removal as the live operator behind three delays (title ×1,
// credits ×5, THE END). All three call sites are now retimed to the absolute values in the
// budget table, so the term has zero consumers — keeping it would be dead code, and
// keeping it "just in case" is what let it outlive its own lane the first time.
//
// Last credit lands at 4480ms; THE END follows after a short 180ms beat.
const THE_END_START_MS = 4660;
const THE_END_ENTER_MS = 1300;

// ── The fade/travel decoupling, and why it is TWO NESTED LANES ─────────────
// Opacity now resolves over the first 50% of the rise while position still uses the full lane.
// The two properties therefore need separate budgets. The equivalent per-property keyframes
// would be:
//     opacity: [0, 1], times: [0, 0.5]
// That form CANNOT work on the drag lane, and this was verified rather than assumed. The
// drag lane resolves every property through lerpTransformValue(initial, animate, p) with a
// single scalar p (useAnimateDrag.ts:311-350) — there is no keyframe/`times` evaluator on
// this path at all. Handed an array it falls through to its final `progress >= 1 ? end :
// start` branch and returns the ARRAY, which parseNumericValue then reads as the string
// "0,1" → 0. Measured: opacity stays 0.000 at every progress from 0 to 1, i.e. authoring
// the documented form verbatim would make the credits permanently invisible. (`times` is
// only honoured on the infinite lane, which hands its variant to framer-motion directly.)
//
// So the decoupling is expressed with the two budgets the framework does have: an OUTER
// lane owning the full-length travel and an INNER lane owning a short fade. Effective
// opacity is the product of the two, and CREDIT_FADE_MS / CREDIT_ENTER_MS = 50% reproduces
// the intended ratio exactly. Opacity reaches 1 over the first 900ms while y is halfway
// through its 80px travel, then the rise completes at full opacity.
//
// The outer lane MUST author `opacity: 1` in both its initial and animate records. Omitting
// it does not mean "no opacity animation" — getDefaultValue supplies 0 → 1 across the FULL
// 1800ms, which would silently re-couple the fade to the travel and undo the whole point.
const CREDIT_FADE_MS = CREDIT_ENTER_MS * 0.5;

// ── Exit: a reverse cascade, not a packed rollback ─────────────────────────
// An enter cascade built from delays has no exit-side counterpart for free. The outgoing
// lane ignores per-lane delay entirely — exit localProgress is
// clamp(renderProgress * transitionDuration / exitDuration) — so if every lane shared one
// exit budget the whole act would leave on a single frame («打包回滚») after having arrived
// in sequence. Budget LENGTH is therefore the only available ordering knob: shorter leaves
// sooner.
//
// Credits leave before THE END; both budgets stay within the 720ms scene transition.
const CREDIT_EXIT_MS = 360;
const THE_END_EXIT_MS = 700;

export const SceneCut = memo(function SceneCut(): JSX.Element {
  const timing = useTemporalMotion();
  const { t } = useI18n();

  return (
    <div className="tp-scene__inner s05-scene">
      <main className="s05-stage">
        <ProjectorBeam />
        <section className="s05-curtain-call" aria-label={t('dragTemporal.s05.creditsLabel')}>
          <div className="s05-credits">
            {CREDITS.map(([role, capability], index) => (
              <Animate
                key={role}
                // OUTER lane: the full-length rise. Explicit opacity 1 on both ends hands
                // the fade entirely to the nested short lane.
                animateId={`s05-credit-${index}`}
                enterAnimation={{
                  initial: { opacity: 1, y: 80 },
                  animate: { opacity: 1, y: 0 },
                }}
                exitAnimation={{ exit: { opacity: 0, y: -32 } }}
                duration={{
                  enter: timing.duration(CREDIT_ENTER_MS),
                  exit: timing.duration(CREDIT_EXIT_MS),
                }}
                timeline={{
                  delay: timing.delay(CREDIT_START_MS + index * CREDIT_EACH_MS),
                }}
              >
                <Animate
                  // INNER lane: the fast fade. No exitAnimation; the outer lane owns exit.
                  animateId={`s05-credit-fade-${index}`}
                  enterAnimation={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
                  duration={{ enter: timing.duration(CREDIT_FADE_MS) }}
                  timeline={{
                    delay: timing.delay(CREDIT_START_MS + index * CREDIT_EACH_MS),
                  }}
                >
                  <p className="s05-credit">
                    <span>{t(`dragTemporal.s05.${role}`)}</span>
                    <strong>{t(`dragTemporal.s05.${capability}`)}</strong>
                  </p>
                </Animate>
              </Animate>
            ))}
          </div>

          <Animate
            animateId="s05-the-end"
            enterAnimation={{
              initial: { opacity: 0, y: 18, scale: 0.96 },
              animate: { opacity: 1, y: 0, scale: 1 },
            }}
            exitAnimation={{ exit: { opacity: 0, y: -18 } }}
            duration={{
              enter: timing.duration(THE_END_ENTER_MS),
              exit: timing.duration(THE_END_EXIT_MS),
            }}
            timeline={{ delay: timing.delay(THE_END_START_MS) }}
          >
            <p className="s05-the-end">THE END</p>
          </Animate>
        </section>
      </main>
    </div>
  );
});

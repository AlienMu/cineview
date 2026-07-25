import { Animate } from 'cineview';
import { motion, useSpring, useTransform, type MotionValue } from 'framer-motion';
import { memo, type ReactNode } from 'react';
import { CornerDecoration } from './CornerDecoration';
import { DialTicks, DIAL_TICKS_TAIL } from './DialTicks';
import { useI18n } from '../../i18n';
import { FooterBar } from './FooterBar';
import { HeaderHUD } from './HeaderHUD';
import { useTemporalMotion } from './TemporalMotion';

type SceneRollingProps = {
  isDragging: boolean;
  signedDragProgress: MotionValue<number>;
};

// SEQUENCE (single framework drag timeline — 2026 rework):
// Every entering element is a framework <Animate> reading ONE shared per-scene
// element track. Order is expressed purely with waitFor + delay, so a single drag
// progress drives the whole thing: drag in and the hand sweeps, the ticks latch in
// behind it, then the ring / number / title chain; reverse-drag and it all unwinds
// in place; leave and re-enter the scene and it replays. No mount-timer, no
// separate exit lane — the framework's enter/exit IS the drag scrub, and it is
// reversible + replayable by construction.
const ROLL = {
  // Ticks are now 12 per-segment <Animate>s (see DialTicks); the ring chains off
  // the LAST segment so the whole ring has swept in before it draws.
  ticks: DIAL_TICKS_TAIL,
  ring: 'dial-ring',
  number: 'dial-number',
  eyebrow: 's01-eyebrow',
  title: 's01-title',
  subtitle: 's01-subtitle',
  actions: 's01-actions',
} as const;

// Hands are ALWAYS moving: the visual bar carries a continuous CSS spin (a real
// running second/minute hand), and this pivot adds a drag-driven rotation OFFSET
// on top — scrub forward and the hand leans ahead of time, reverse-drag and it
// winds back, following the finger. The two compose because the CSS spin animates
// the `rotate` property on the inner bar while framer-motion writes `transform`
// (rotate) on this pivot; nested rotations around the same dial center add.
function SweepSecondHand({ signedProgress }: { signedProgress: MotionValue<number> }): JSX.Element {
  const target = useTransform(signedProgress, [-1, 0, 1], [-46, 0, 46]);
  const rotate = useSpring(target, { stiffness: 160, damping: 18 });
  return (
    <motion.span className="s01-hand-pivot" style={{ rotate }}>
      <span className="s01-hand s01-hand--second" />
    </motion.span>
  );
}

function SweepMinuteHand({ signedProgress }: { signedProgress: MotionValue<number> }): JSX.Element {
  const target = useTransform(signedProgress, [-1, 0, 1], [-18, 0, 18]);
  const rotate = useSpring(target, { stiffness: 160, damping: 20 });
  return (
    <motion.span className="s01-hand-pivot" style={{ rotate }}>
      <span className="s01-hand s01-hand--minute" />
    </motion.span>
  );
}

// The dial gets a live drag TILT (framer-motion, reads signedDragProgress) so it
// leans with the finger. Its enter/exit is NOT composed here — the ticks / ring /
// number inside each own their framework <Animate>, so the dial is a pure tilt
// wrapper. reduced-motion pins the tilt to 0.
function GatedDial({
  children,
  signedDragProgress,
  reduced,
  label,
}: {
  children: ReactNode;
  signedDragProgress: MotionValue<number>;
  reduced: boolean;
  label: string;
}): JSX.Element {
  const targetRotate = useTransform(
    signedDragProgress,
    [-1, 0, 1],
    reduced ? [0, 0, 0] : [-5, 0, 5]
  );
  const rotate = useSpring(targetRotate, { stiffness: 180, damping: 14 });
  return (
    <motion.div className="s01-dial" style={{ rotate: reduced ? 0 : rotate }} aria-label={label}>
      {children}
    </motion.div>
  );
}

function GatedInnerRing(): JSX.Element {
  const timing = useTemporalMotion();
  return (
    <Animate
      animateId={ROLL.ring}
      enterAnimation={{
        initial: { opacity: 0, scale: 0 },
        animate: { opacity: 1, scale: 1, transition: { ease: [0.16, 1, 0.3, 1] } },
      }}
      exitAnimation={{ exit: { opacity: 0, scale: 0.4 } }}
      duration={{ enter: timing.duration(360), exit: timing.duration(300) }}
      timeline={{ waitFor: ROLL.ticks, delay: timing.delay(40) }}
    >
      <div className="s01-inner-ring" />
    </Animate>
  );
}

function GatedCenterNumber(): JSX.Element {
  const timing = useTemporalMotion();
  return (
    <Animate
      animateId={ROLL.number}
      enterAnimation={{
        initial: { opacity: 0, scale: 0.6, filter: 'blur(14px)' },
        animate: {
          opacity: 1,
          scale: 1,
          filter: 'blur(0px)',
          transition: { ease: [0.16, 1, 0.3, 1] },
        },
      }}
      exitAnimation={{ exit: { opacity: 0, scale: 0.6, filter: 'blur(10px)' } }}
      duration={{ enter: timing.duration(420), exit: timing.duration(280) }}
      timeline={{ waitFor: ROLL.ring, delay: timing.delay(20) }}
    >
      <span className="s01-center-number">01</span>
    </Animate>
  );
}

function GatedEyebrow({ text }: { text: string }): JSX.Element {
  const timing = useTemporalMotion();
  return (
    <Animate
      animateId={ROLL.eyebrow}
      enterAnimation={{
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0, transition: { ease: [0.16, 1, 0.3, 1] } },
      }}
      exitAnimation={{ exit: { opacity: 0, y: -22 } }}
      duration={{ enter: timing.duration(360), exit: timing.duration(240) }}
      timeline={{ waitFor: ROLL.number, delay: timing.delay(40) }}
    >
      <p className="s01-eyebrow">{text}</p>
    </Animate>
  );
}

function GatedTitle(): JSX.Element {
  const timing = useTemporalMotion();
  return (
    <Animate
      animateId={ROLL.title}
      enterAnimation={{
        initial: { opacity: 0, y: '18%', scale: 0.92, filter: 'blur(8px)' },
        animate: {
          opacity: 1,
          y: '0%',
          scale: 1,
          filter: 'blur(0px)',
          transition: { ease: [0.16, 1, 0.3, 1] },
        },
      }}
      exitAnimation={{ exit: { opacity: 0, y: '-26%', scale: 0.96 } }}
      duration={{ enter: timing.duration(520), exit: timing.duration(300) }}
      timeline={{ waitFor: ROLL.eyebrow, delay: timing.delay(30) }}
    >
      <h1 className="s01-title">CineView</h1>
    </Animate>
  );
}

function GatedSubtitle({ text }: { text: string }): JSX.Element {
  const timing = useTemporalMotion();
  return (
    <Animate
      animateId={ROLL.subtitle}
      enterAnimation={{
        initial: { opacity: 0, y: '100%' },
        animate: { opacity: 1, y: '0%', transition: { ease: [0.16, 1, 0.3, 1] } },
      }}
      exitAnimation={{ exit: { opacity: 0, y: '-60%' } }}
      duration={{ enter: timing.duration(420), exit: timing.duration(260) }}
      timeline={{ waitFor: ROLL.title, delay: timing.delay(30) }}
    >
      <p className="s01-subtitle">{text}</p>
    </Animate>
  );
}

// CTA band (moved forward from the old Scene-05 ending per the redesign): the two
// primary nav actions live in Act 1 now. Enters last, behind the subtitle.
function GatedActions({
  actionsLabel,
  btnHome,
  btnDocs,
}: {
  actionsLabel: string;
  btnHome: string;
  btnDocs: string;
}): JSX.Element {
  const timing = useTemporalMotion();
  return (
    <Animate
      animateId={ROLL.actions}
      enterAnimation={{
        initial: { opacity: 0, y: 40 },
        animate: { opacity: 1, y: 0, transition: { ease: [0.16, 1, 0.3, 1] } },
      }}
      exitAnimation={{ exit: { opacity: 0, y: -28 } }}
      duration={{ enter: timing.duration(420), exit: timing.duration(220) }}
      timeline={{ waitFor: ROLL.subtitle, delay: timing.delay(30) }}
    >
      <div className="s01-actions-band">
        <nav className="s01-actions" aria-label={actionsLabel}>
          <a className="tp-btn tp-btn--primary" href="/docs">
            {btnDocs}
          </a>
          <a className="tp-btn tp-btn--ghost" href="/">
            {btnHome}
          </a>
        </nav>
      </div>
    </Animate>
  );
}

export const SceneRolling = memo(function SceneRolling({
  isDragging,
  signedDragProgress,
}: SceneRollingProps): JSX.Element {
  const timing = useTemporalMotion();
  const { t } = useI18n();

  return (
    <div className="tp-scene__inner s01-scene">
      <HeaderHUD
        sceneId="rolling"
        timecode="00:00:00:00"
        startFrame={0}
        rolling={true}
        isDragging={isDragging}
      />

      <main className="s01-stage">
        <p className="s01-slate">01 / ROLLING</p>

        <GatedDial
          signedDragProgress={signedDragProgress}
          reduced={timing.reduced}
          label={t('dragTemporal.s01.dialLabel')}
        >
          <DialTicks />
          <GatedInnerRing />
          <GatedCenterNumber />
          <div className="s01-hands" aria-hidden="true">
            <SweepSecondHand signedProgress={signedDragProgress} />
            <SweepMinuteHand signedProgress={signedDragProgress} />
            <span className="s01-hands__pin" />
          </div>
        </GatedDial>

        <section className="s01-title-area">
          <GatedEyebrow text={t('dragTemporal.s01.eyebrow')} />
          <GatedTitle />
          <GatedSubtitle text={t('dragTemporal.s01.subtitle')} />
        </section>

        <GatedActions
          actionsLabel={t('dragTemporal.s01.actionsLabel')}
          btnHome={t('dragTemporal.s01.btnHome')}
          btnDocs={t('dragTemporal.s01.btnDocs')}
        />
      </main>

      <CornerDecoration position="tl" />
      <CornerDecoration position="tr" />
      <CornerDecoration position="bl" />
      <CornerDecoration position="br" />

      <FooterBar sceneId="rolling" frame={1} hint={t('dragTemporal.s01.footerHint')} />
    </div>
  );
});

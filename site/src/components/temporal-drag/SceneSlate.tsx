import { Animate, useAnimateTimeline } from 'cineview';
import { memo } from 'react';
import { FooterBar } from './FooterBar';
import { HeaderHUD } from './HeaderHUD';
import { ClapperboardCanvas } from './clapperboard/ClapperboardCanvas';
import { useTemporalMotion } from './TemporalMotion';
import { useI18n } from '../../i18n';

// Scene 02 — 场记板 (Slate / ACTION 高潮). The clapperboard is a canvas particle
// field that converges as the drag scrubs the enter progress and scatters on
// reverse/bounce. Per v3 §0 the framework does NOT wrap the canvas: a plain child
// reads useAnimateTimeline().progress (a MotionValue) and the canvas drives its own
// rAF from it — zero per-frame setState.
function ClapperStage(): JSX.Element {
  const timeline = useAnimateTimeline();
  return <ClapperboardCanvas progress={timeline.progress} phase={timeline.phase} />;
}

export const SceneSlate = memo(function SceneSlate(): JSX.Element {
  const timing = useTemporalMotion();
  const { t } = useI18n();

  return (
    <div className="tp-scene__inner s02-scene">
      <HeaderHUD sceneId="slate" timecode="00:00:00:12" startFrame={12} />

      <main className="s02-stage">
        <p className="s02-slate">02 / SLATE</p>

        {/* Main gate Animate. Its enter budget is the whole staged sequence
            (spotlight → particles converge → clap/ACTION) packed into one drag-
            scrubbed 0..1 progress; the canvas splits it internally. The canvas keeps
            its OWN opacity (particles fade with convergence / explode on exit), so
            this wrapper animates nothing visually — opacity 1→1 — it exists only to
            own the progress+phase timeline the canvas subscribes to. Exit is a long
            budget so the particle explosion plays out instead of a hard opacity cut. */}
        <Animate
          animateId="s02-clapper"
          enterAnimation={{ initial: { opacity: 1 }, animate: { opacity: 1 } }}
          exitAnimation={{ exit: { opacity: 1 } }}
          duration={{ enter: timing.duration(3400), exit: timing.duration(900) }}
        >
          <div className="s02-clapper" aria-label={t('dragTemporal.s02.clapperLabel')}>
            <ClapperStage />
          </div>
        </Animate>

        {/* Text appears ONLY after the clap completes: it waitFor's the clapper's
            full enter (delay folds in the clapper's whole enter+delay in registry),
            so the eyebrow can't start until ACTION has landed. */}
        <Animate
          animateId="s02-eyebrow"
          enterAnimation="fade-in"
          exitAnimation={{ exit: { opacity: 0, y: -16 } }}
          duration={{ enter: timing.duration(420), exit: timing.duration(240) }}
          timeline={{ waitFor: 's02-clapper', delay: timing.delay(60) }}
        >
          <p className="s02-eyebrow">{t('dragTemporal.s02.eyebrow')}</p>
        </Animate>
        <Animate
          animateId="s02-title"
          enterAnimation="slide-up"
          exitAnimation={{ exit: { opacity: 0, y: -24 } }}
          duration={{ enter: timing.duration(560), exit: timing.duration(240) }}
          timeline={{ waitFor: 's02-eyebrow', delay: timing.delay(60) }}
        >
          <h1 className="s02-title">{t('dragTemporal.s02.title')}</h1>
        </Animate>
      </main>

      <FooterBar sceneId="slate" frame={2} hint={t('dragTemporal.s02.footerHint')} />
    </div>
  );
});

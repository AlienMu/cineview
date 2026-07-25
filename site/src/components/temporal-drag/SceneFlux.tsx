import { Animate } from 'cineview';
import type { MotionValue } from 'framer-motion';
import { memo } from 'react';
import { useI18n } from '../../i18n';
import { FooterBar } from './FooterBar';
import { HeaderHUD } from './HeaderHUD';
import { ProgressRing } from './ProgressRing';
import { TickBar } from './TickBar';
import { TimeStreams } from './TimeStreams';
import { useTemporalMotion } from './TemporalMotion';

type SceneFluxProps = {
  dragProgress: MotionValue<number>;
};

const MAIN_TIMECODE = '00:00:02:00';

export const SceneFlux = memo(function SceneFlux({ dragProgress }: SceneFluxProps): JSX.Element {
  const timing = useTemporalMotion();
  const { t } = useI18n();

  return (
    <div className="tp-scene__inner s03-scene">
      <HeaderHUD sceneId="flux" timecode={MAIN_TIMECODE} startFrame={50} />

      <main className="s03-stage">
        <TimeStreams />
        <p className="s03-slate">04 / FLUX</p>

        <section className="s03-center">
          <Animate
            animateId="s03-label"
            enterAnimation="fade-in"
            exitAnimation={{ exit: { opacity: 0, y: -14 } }}
            duration={{ enter: timing.duration(420), exit: timing.duration(280) }}
          >
            <p className="s03-label">SMPTE TIME CODE</p>
          </Animate>

          <div className="s03-clock">
            <ProgressRing />
            <Animate
              animateId="s03-main-timecode"
              enterAnimation="flip"
              exitAnimation={{ exit: { opacity: 0, rotateX: 90, y: -12 } }}
              duration={{ enter: timing.duration(700), exit: timing.duration(420) }}
              timeline={{ waitFor: 's03-label', delay: timing.delay(400) }}
              stagger={{ each: timing.stagger(100) }}
            >
              <div className="s03-main-timecode" aria-label={MAIN_TIMECODE}>
                {MAIN_TIMECODE.split('').map((character, index) => (
                  <span key={`${index}-${character}`}>{character}</span>
                ))}
              </div>
            </Animate>
          </div>

          <Animate
            animateId="s03-equation"
            enterAnimation="slide-up"
            exitAnimation={{ exit: { opacity: 0, y: 28 } }}
            duration={{ enter: timing.duration(620), exit: timing.duration(320) }}
            timeline={{ waitFor: 's03-progress-ring', delay: timing.delay(120) }}
          >
            <p className="s03-equation">
              <span>{t('dragTemporal.s04.equationLabel')}</span>
              <strong>1% → 16ms</strong>
            </p>
          </Animate>
        </section>

        <TickBar dragProgress={dragProgress} />
      </main>

      <FooterBar sceneId="flux" frame={4} hint={t('dragTemporal.s04.footerHint')} />
    </div>
  );
});

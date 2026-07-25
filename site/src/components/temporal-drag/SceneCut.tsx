import { Animate } from 'cineview';
import { memo } from 'react';
import { useI18n } from '../../i18n';
import { FooterBar } from './FooterBar';
import { HeaderHUD } from './HeaderHUD';
import { useTemporalMotion } from './TemporalMotion';

const END_SPROCKETS = new Set([3, 7, 11]);

export const SceneCut = memo(function SceneCut(): JSX.Element {
  const timing = useTemporalMotion();
  const { t } = useI18n();

  return (
    <div className="tp-scene__inner s04-scene">
      <HeaderHUD sceneId="cut" timecode="00:00:03:00" startFrame={75} isRecording={false} />

      <main className="s04-stage">
        <p className="s04-slate">05 / FINAL CUT</p>
        <div className="s04-leader" aria-label={t('dragTemporal.s05.reelLabel')}>
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="s04-leader__frame">
              {String(8 - i).padStart(2, '0')}
            </span>
          ))}
        </div>
        <section className="s04-center">
          <Animate
            animateId="cut-title-blur"
            enterAnimation={{
              initial: { opacity: 0, filter: 'blur(14px)' },
              animate: {
                opacity: 1,
                filter: 'blur(0px)',
                transition: { duration: timing.seconds(0.7), ease: [0.16, 1, 0.3, 1] },
              },
            }}
            exitAnimation={{ exit: { opacity: 0, filter: 'blur(12px)' } }}
            duration={{ enter: timing.duration(700), exit: timing.duration(480) }}
            timeline={{ delay: timing.delay(300) }}
          >
            <Animate
              animateId="cut-title"
              enterAnimation={{
                initial: { scale: 0.75 },
                animate: {
                  scale: 1,
                  transition: { duration: timing.seconds(0.6), ease: [0.16, 1, 0.3, 1] },
                },
              }}
              exitAnimation={{ exit: { scale: 1.35, opacity: 0 } }}
              duration={{ enter: timing.duration(600), exit: timing.duration(460) }}
              timeline={{ waitFor: 'cut-title-blur', delay: timing.delay(200) }}
            >
              <h1 className="s04-cut-title">CUT</h1>
            </Animate>
          </Animate>

          <Animate
            animateId="s04-accent-line"
            enterAnimation={{
              initial: { scaleX: 0, opacity: 0 },
              animate: {
                scaleX: 1,
                opacity: 1,
                transition: { duration: timing.seconds(0.7), ease: [0.16, 1, 0.3, 1] },
              },
            }}
            exitAnimation={{ exit: { opacity: 0, scale: 0.6 } }}
            duration={{ enter: timing.duration(700), exit: timing.duration(300) }}
            timeline={{ waitFor: 'cut-title', delay: timing.delay(120) }}
          >
            <span className="s04-accent-line" aria-hidden="true" />
          </Animate>

          <Animate
            animateId="s04-the-end"
            enterAnimation="fade-in"
            exitAnimation={{ exit: { opacity: 0, y: 12 } }}
            duration={{ enter: timing.duration(520), exit: timing.duration(260) }}
            timeline={{ waitFor: 's04-accent-line', delay: timing.delay(120) }}
          >
            <p className="s04-the-end">THE END</p>
          </Animate>

          <nav className="s04-actions" aria-label={t('dragTemporal.s05.actionsLabel')}>
            <Animate
              animateId="s04-action-home"
              enterAnimation="slide-up"
              exitAnimation={{ exit: { opacity: 0, y: 32 } }}
              duration={{ enter: timing.duration(560), exit: timing.duration(320) }}
              timeline={{ waitFor: 's04-the-end', delay: timing.delay(160) }}
            >
              <a className="tp-btn tp-btn--ghost" href="/">
                {t('dragTemporal.s05.btnHome')}
              </a>
            </Animate>
            <Animate
              animateId="s04-action-docs"
              enterAnimation="slide-up"
              exitAnimation={{ exit: { opacity: 0, y: 32 } }}
              duration={{ enter: timing.duration(560), exit: timing.duration(320) }}
              timeline={{ waitFor: 's04-action-home', delay: timing.delay(140) }}
            >
              <a className="tp-btn tp-btn--primary" href="/docs">
                {t('dragTemporal.s05.btnDocs')}
              </a>
            </Animate>
          </nav>
        </section>

        <Animate
          animateId="s04-sprocket-strip"
          enterAnimation="fade-in"
          exitAnimation={{ exit: { opacity: 0 } }}
          duration={{ enter: timing.duration(260), exit: timing.duration(240) }}
          timeline={{ waitFor: 's04-action-docs', delay: timing.delay(160) }}
          stagger={{ each: timing.stagger(80) }}
        >
          <div className="s04-sprocket-strip" aria-label={t('dragTemporal.s05.reelLabel')}>
            {Array.from({ length: 12 }, (_, index) => (
              <span
                key={index}
                className={`s04-sprocket${END_SPROCKETS.has(index) ? ' is-end' : ''}`}
                aria-hidden="true"
              >
                {END_SPROCKETS.has(index) ? 'END' : ''}
              </span>
            ))}
          </div>
        </Animate>
      </main>

      <FooterBar sceneId="cut" frame={5} hint="END" />
    </div>
  );
});

import { Animate } from 'cineview';
import { memo, useCallback, useState } from 'react';
import { useI18n } from '../../i18n';
import { ConnectionLight } from './ConnectionLight';
import { FooterBar } from './FooterBar';
import { HeaderHUD } from './HeaderHUD';
import { ParamPanel } from './ParamPanel';
import { TimelineNode } from './TimelineNode';
import { useTemporalMotion } from './TemporalMotion';

// exitDuration decreases along the chain so the LAST node authored (CTA) finishes
// its exit earliest, and the first node (TITLE) lingers — a reverse "un-drawing"
// collapse that reads as the timeline retracting right-to-left on drag-away.
const NODES = [
  { id: 'node-title', glyph: 'T', label: 'TITLE', waitFor: 'timeline-base', delay: 0, exit: 460 },
  {
    id: 'node-subtitle',
    glyph: 'S',
    label: 'SUBTITLE',
    waitFor: 'node-title',
    delay: 240,
    exit: 420,
  },
  { id: 'node-body', glyph: 'B', label: 'BODY', waitFor: 'node-subtitle', delay: 240, exit: 380 },
  { id: 'node-image', glyph: 'I', label: 'IMAGE', waitFor: 'node-body', delay: 240, exit: 340 },
  { id: 'node-cta', glyph: 'C', label: 'CTA', waitFor: 'node-image', delay: 240, exit: 300 },
] as const;

export const SceneSync = memo(function SceneSync(): JSX.Element {
  const timing = useTemporalMotion();
  const { t } = useI18n();
  const [activeNodeIndex, setActiveNodeIndex] = useState(-1);
  const handleNodeEntered = useCallback((index: number): void => {
    setActiveNodeIndex((current) => Math.max(current, index));
  }, []);

  return (
    <div className="tp-scene__inner s02-scene">
      <HeaderHUD sceneId="sync" timecode="00:00:01:00" startFrame={25} />

      <main className="s02-stage">
        <p className="s02-slate">03 / CHOREOGRAPH</p>
        <Animate
          animateId="s03-eyebrow"
          enterAnimation="fade-in"
          exitAnimation={{ exit: { opacity: 0, y: -16 } }}
          duration={{ enter: timing.duration(420), exit: timing.duration(300) }}
        >
          <p className="s03-eyebrow">{t('dragTemporal.s03.eyebrow')}</p>
        </Animate>
        <Animate
          animateId="s03-title"
          enterAnimation="slide-up"
          exitAnimation={{ exit: { opacity: 0, y: -28 } }}
          duration={{ enter: timing.duration(680), exit: timing.duration(360) }}
          timeline={{ waitFor: 's03-eyebrow', delay: timing.delay(80) }}
        >
          <h1 className="s03-title">{t('dragTemporal.s03.title')}</h1>
        </Animate>

        <div className="s03-timeline" aria-label={t('dragTemporal.s03.timelineLabel')}>
          <Animate
            animateId="timeline-base"
            enterAnimation={{
              initial: { scaleX: 0, opacity: 0 },
              animate: {
                scaleX: 1,
                opacity: 1,
                transition: { duration: timing.seconds(0.8), ease: [0.16, 1, 0.3, 1] },
              },
            }}
            exitAnimation={{ exit: { opacity: 0, x: 40 } }}
            duration={{ enter: timing.duration(800), exit: timing.duration(520) }}
            timeline={{ waitFor: 's03-title', delay: timing.delay(120) }}
          >
            <span className="s03-timeline__base" aria-hidden="true" />
          </Animate>

          <div className="s03-timeline__nodes">
            {NODES.map((node, index) => (
              <div key={node.id} className="s03-timeline__slot">
                <TimelineNode
                  id={node.id}
                  glyph={node.glyph}
                  label={node.label}
                  waitFor={node.waitFor}
                  delay={node.delay}
                  exitDuration={node.exit}
                  index={index}
                  isCurrent={index === activeNodeIndex}
                  onEntered={handleNodeEntered}
                />
                {index < NODES.length - 1 ? (
                  <ConnectionLight index={index} waitFor={node.id} />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <ParamPanel activeNodeIndex={activeNodeIndex} />
      </main>

      <FooterBar sceneId="sync" frame={3} hint={t('dragTemporal.s03.footerHint')} />
    </div>
  );
});

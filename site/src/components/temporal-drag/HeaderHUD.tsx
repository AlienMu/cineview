import { Animate } from 'cineview';
import { memo } from 'react';
import { useI18n } from '../../i18n';
import { useTimecode } from '../../hooks/useTimecode';
import { RecBadge } from './RecBadge';
import { useTemporalMotion } from './TemporalMotion';
import { TimecodeDisplay } from './TimecodeDisplay';

type HeaderHUDProps = {
  sceneId: string;
  timecode: string;
  startFrame?: number;
  rolling?: boolean;
  isDragging?: boolean;
  isRecording?: boolean;
};

export const HeaderHUD = memo(function HeaderHUD({
  sceneId,
  timecode,
  startFrame = 0,
  rolling = false,
  isDragging = false,
  isRecording = true,
}: HeaderHUDProps): JSX.Element {
  const timing = useTemporalMotion();
  const { t } = useI18n();
  const { timecodeRef } = useTimecode(startFrame, isDragging, !rolling);
  const hudId = `hud-${sceneId}`;

  return (
    <header className="tp-hud">
      <Animate
        animateId={hudId}
        enterAnimation="fade-in"
        exitAnimation={{ exit: { opacity: 0, y: -14 } }}
        duration={{ enter: timing.duration(420), exit: timing.duration(360) }}
      >
        <div className="tp-hud__left">
          <RecBadge isRecording={isRecording} />
          <TimecodeDisplay
            value={timecode}
            animateId={`timecode-${sceneId}`}
            waitFor={hudId}
            displayRef={rolling ? timecodeRef : undefined}
          />
        </div>
      </Animate>
      <Animate
        animateId={`hud-meta-${sceneId}`}
        enterAnimation="fade-in"
        exitAnimation={{ exit: { opacity: 0, y: -14 } }}
        duration={{ enter: timing.duration(420), exit: timing.duration(320) }}
        timeline={{ waitFor: hudId, delay: timing.delay(80) }}
      >
        <div className="tp-hud__right" aria-label={t('dragTemporal.hud.metaLabel')}>
          <span>25 FPS</span>
          <span>SMPTE</span>
          <span>ISO 800</span>
        </div>
      </Animate>
    </header>
  );
});

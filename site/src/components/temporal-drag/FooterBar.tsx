import { Animate } from 'cineview';
import { memo } from 'react';
import { useTemporalMotion } from './TemporalMotion';

type FooterBarProps = {
  sceneId: string;
  frame: number;
  hint: string;
};

export const FooterBar = memo(function FooterBar({
  sceneId,
  frame,
  hint,
}: FooterBarProps): JSX.Element {
  const timing = useTemporalMotion();

  return (
    <Animate
      animateId={`footer-${sceneId}`}
      enterAnimation="fade-in"
      exitAnimation={{ exit: { opacity: 0, y: 14 } }}
      duration={{ enter: timing.duration(420), exit: timing.duration(360) }}
    >
      <footer className="tp-footer">
        <span>FRAME {String(frame).padStart(2, '0')} / 05</span>
        <span className="tp-footer__hint">{hint}</span>
      </footer>
    </Animate>
  );
});

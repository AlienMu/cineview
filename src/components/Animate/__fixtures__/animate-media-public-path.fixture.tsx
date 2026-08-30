import { createRef } from 'react';
import { AnimateVideo } from '../../../index';

// Valid explicit public surface. Native media capabilities stay intentionally
// enumerated instead of widening AnimateVideo to every VideoHTMLAttribute.
export function AnimateMediaPublicPathFixture(): JSX.Element {
  const videoRef = createRef<HTMLVideoElement>();

  return (
    <AnimateVideo
      ref={videoRef}
      src="/clip.mp4"
      poster="/poster.jpg"
      playbackRate={1.25}
      scrubRange={[0, 6]}
      aria-label="clip"
      width={375}
      height={200}
      style={{ borderRadius: 12 }}
      animateId="hero-vid"
      enterAnimation="fade-in"
      exitAnimation="fade-out"
      duration={{ enter: 2000, exit: 300 }}
      timeline={{ delay: 0, after: 'intro' }}
      visibility={{ replay: false, enterMargin: 40, exitMargin: 60 }}
      onPlay={() => undefined}
      onPause={() => undefined}
      onEnded={() => undefined}
      onTimeUpdate={() => undefined}
      onError={() => undefined}
    />
  );
}

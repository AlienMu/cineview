import { AnimateVideo } from '../../../index';

// Valid minimal public surface: src/style/size + animateId + timeline(delay/waitFor)
// + visibility(replayOnReenter/margins) + duration.enter (scrub span). Compiles clean.
export function AnimateMediaPublicPathFixture(): JSX.Element {
  return (
    <AnimateVideo
      src="/clip.mp4"
      aria-label="clip"
      width={375}
      height={200}
      style={{ borderRadius: 12 }}
      animateId="hero-vid"
      duration={{ enter: 2000 }}
      timeline={{ delay: 0, waitFor: 'intro' }}
      visibility={{ replayOnReenter: false, enterMargin: 40, exitMargin: 60 }}
    />
  );
}

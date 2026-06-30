import { AnimateVideo } from '../../../index';

// Illegal: enterAnimation/stagger are NOT part of the minimal scrub surface
// (scrub IS the animation). The excess-property check must reject these, so
// this fixture is expected to FAIL compilation (excluded from the main tsc via
// tsconfig, compiled in isolation by AnimateMedia.publicApi.test).
export function AnimateVideoIllegalPropsFixture(): JSX.Element {
  return <AnimateVideo src="/clip.mp4" enterAnimation="fade-in" stagger={{ each: 40 }} />;
}

import { AnimateVideo } from '../../../index';

// Illegal: AnimateVideo exposes explicit enter/exit animation control, but it is
// still a single media element rather than a stagger container.
export function AnimateVideoIllegalPropsFixture(): JSX.Element {
  return <AnimateVideo src="/clip.mp4" stagger={{ each: 40 }} />;
}

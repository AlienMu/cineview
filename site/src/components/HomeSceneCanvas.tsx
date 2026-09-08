import type { ReactNode } from 'react';
import { Container } from 'cineview';

/**
 * Unified design canvas for the home page.
 *
 * CineView's `config.size=1440` is the sole conversion ruler; here we use Container to declare a 1440×900
 * design box model, for relative layout roots like Capability / DemoVideo that consume `width/height:100%`.
 * Container does not establish a new positioned containing block: Position continues to uniquely own coordinates, and Hero's
 * viewport-center semantics remain unchanged. Scene is still actual viewport height, does not alter takeover measurement.
 *
 * `height` is optional (defaults to 900): on mobile, act three requires "canvas = one viewport height" to fill vertical screen with six blocks
 * (see `useDesignCanvasHeight` and task-flow `2026-08-04-act3-phone-layout.md`).
 * Uses Container's own `height` convenience prop (framework-native conversion), does not override inline styles.
 * Call sites that don't pass this prop remain byte-for-byte unchanged.
 */
export function HomeSceneCanvas({
  children,
  height = 900,
}: {
  children: ReactNode;
  height?: number;
}): import('react').JSX.Element {
  return (
    <Container width={1440} height={height} className="home-scene-canvas">
      {children}
    </Container>
  );
}

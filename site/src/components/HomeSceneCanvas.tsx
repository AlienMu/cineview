import type { ReactNode } from 'react';
import { Container } from 'cineview';

/**
 * Unified design canvas for the home page.
 *
 * Container declares a 1920×1200 design box using the parent Cineview's
 * width conversion. Callers can override its design height; this sizes the
 * content without changing Scene navigation or Position's containing block.
 */
export function HomeSceneCanvas({
  children,
  height = 1200,
}: {
  children: ReactNode;
  height?: number;
}): import('react').JSX.Element {
  return (
    <Container width={1920} height={height} className="home-scene-canvas">
      {children}
    </Container>
  );
}

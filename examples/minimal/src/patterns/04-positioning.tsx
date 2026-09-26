/** Position places content; Container converts its numeric size from design coordinates. */
import { Animate, Cineview, Container, Position, Scene } from 'cineview';

export function DesignCoordinates() {
  return (
    <Cineview designWidth={750}>
      <Scene style={{ background: '#0f172a', color: 'white' }}>
        <Position at={{ x: 40, y: 40 }}>
          <Container width={60} height={60}>
            <Animate enterAnimation="fade-in" duration={{ enter: 400 }}>
              <span>CV</span>
            </Animate>
          </Container>
        </Position>
        <Position at={{ anchor: 'center', y: -80 }}>
          <Container width={670}>
            <Animate enterAnimation="fade-in" duration={{ enter: 600 }} timeline={{ delay: 200 }}>
              <h1 style={{ fontSize: 'clamp(24px, 5vw, 48px)', textAlign: 'center' }}>
                Use your design coordinates
              </h1>
            </Animate>
          </Container>
        </Position>
        <Position at={{ anchor: 'center', y: 100 }}>
          <Container width={300}>
            <Animate enterAnimation="fade-in" duration={{ enter: 400 }} timeline={{ delay: 600 }}>
              <p style={{ textAlign: 'center' }}>Centered, with a vertical offset.</p>
            </Animate>
          </Container>
        </Position>
      </Scene>
    </Cineview>
  );
}

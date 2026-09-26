/** Animate a box and caption across 1400px; after waits for entrance, not exit. */
import { Cineview, Scene, Animate } from 'cineview';

export function ScrollScrubbing() {
  return (
    <Cineview designWidth={750} mode="scroll">
      {/* Normal scene: scrolls freely */}
      <Scene>
        <div
          style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1e293b',
          }}
        >
          <h2 style={{ color: 'white' }}>Scroll down slowly ↓</h2>
        </div>
      </Scene>

      {/* Scrub zone: scroll distance = animation progress */}
      <Scene scroll={{ zoneId: 'hero' }}>
        <div
          style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f172a',
          }}
        >
          <Animate
            animateId="box"
            enterAnimation={{
              initial: { opacity: 0, scale: 0.5, y: 100 },
              animate: { opacity: 1, scale: 1, y: 0 },
            }}
            exitAnimation="fade-out"
            duration={{ enter: 800, exit: 400 }} // Entrance ends at 800px; exit ends at 1200px
          >
            <div
              style={{
                width: '200px',
                height: '200px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '1rem',
              }}
            />
          </Animate>

          <Animate
            animateId="label"
            enterAnimation={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
            duration={{ enter: 400 }}
            timeline={{ after: 'box', delay: 200 }} // Starts at 1000px, while the box is exiting
          >
            <p style={{ color: '#94a3b8', marginTop: '2rem' }}>
              This starts 200px after the box finishes entering
            </p>
          </Animate>
        </div>
      </Scene>

      {/* Normal scene: scrolls freely again */}
      <Scene>
        <div
          style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1e293b',
          }}
        >
          <h2 style={{ color: 'white' }}>Zone complete. Free scrolling resumed.</h2>
        </div>
      </Scene>
    </Cineview>
  );
}

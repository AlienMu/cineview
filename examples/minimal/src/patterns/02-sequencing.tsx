/** Play a title, subtitle, and button in sequence with timeline.after. */
import { Cineview, Scene, Animate } from 'cineview';

export function TimelineSequencing() {
  return (
    <Cineview designWidth={750}>
      <Scene>
        <div
          style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2rem',
            background: '#0f172a',
          }}
        >
          {/* First animation: fades in immediately */}
          <Animate
            animateId="title"
            enterAnimation={{ initial: { opacity: 0 }, animate: { opacity: 1 } }}
            duration={{ enter: 600 }}
          >
            <h1 style={{ color: 'white', margin: 0 }}>Step 1</h1>
          </Animate>

          {/* Second: starts at 600ms, after "title" finishes entering */}
          <Animate
            animateId="subtitle"
            enterAnimation={{ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }}
            duration={{ enter: 400 }}
            timeline={{ after: 'title' }}
          >
            <p style={{ color: '#94a3b8', margin: 0 }}>Step 2 (after title)</p>
          </Animate>

          {/* Third: starts at 1000ms, after "subtitle" finishes entering */}
          <Animate
            animateId="cta"
            enterAnimation={{
              initial: { opacity: 0, scale: 0.9 },
              animate: { opacity: 1, scale: 1 },
            }}
            duration={{ enter: 400 }}
            timeline={{ after: 'subtitle' }}
          >
            <button
              style={{
                padding: '0.75rem 2rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              Step 3 (after subtitle)
            </button>
          </Animate>
        </div>
      </Scene>
    </Cineview>
  );
}

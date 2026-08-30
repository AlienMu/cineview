/**
 * TEMPORARY adversarial-review fixture (task-flow 2026-08-23-scene-scroll-budget-
 * dual-clock, N5/N7). Not product code — delete after review.
 *
 * Reproduces the unit-test mixed configuration in a real browser:
 *   title   : phase {start: 0.05, end: 0.3}, enter 600, no exit
 *   subline : after title,  enter 600
 *   tail    : after subline, enter 6000
 * Predicted fixed point: T = 6600 / 0.7 ≈ 9428.57 px; title window
 * [471.43, 2828.57]; subline [2828.57, 3428.57]; tail [3428.57, 9428.57].
 */
import { Animate, CineView, Scene } from 'cineview';

export default function DualClockFixturePage(): JSX.Element {
  return (
    <CineView designWidth={1440} mode="scroll">
      <Scene sceneId="dual-intro" layout={{ width: '100%', height: '80vh' }}>
        <div style={{ padding: '10vh 8vw' }}>
          <h2>Intro (document flow)</h2>
        </div>
      </Scene>
      <Scene
        sceneId="dual-zone"
        layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
        scroll={{ zoneId: 'dual-clock-zone', trigger: 'center-lock' }}
      >
        <div style={{ padding: '30vh 8vw', background: '#101418', color: '#eee', height: '100%' }}>
          <Animate
            animateId="dual-title"
            enterAnimation="fade-in"
            duration={{ enter: 600 }}
            timeline={{ phase: { start: 0.05, end: 0.3 } }}
          >
            <h2 style={{ fontSize: 40 }}>TITLE (phase 0.05-0.3)</h2>
          </Animate>
          <Animate
            animateId="dual-subline"
            enterAnimation="fade-in"
            duration={{ enter: 600 }}
            timeline={{ after: 'dual-title', delay: 0 }}
          >
            <p style={{ fontSize: 24 }}>SUBLINE (after title)</p>
          </Animate>
          <Animate
            animateId="dual-tail"
            enterAnimation="fade-in"
            duration={{ enter: 6000 }}
            timeline={{ after: 'dual-subline', delay: 0 }}
          >
            <p style={{ fontSize: 24 }}>TAIL (after subline, 6000)</p>
          </Animate>
        </div>
      </Scene>
      <Scene sceneId="dual-outro" layout={{ width: '100%', height: '80vh' }}>
        <div style={{ padding: '10vh 8vw' }}>
          <h2>Outro (document flow)</h2>
        </div>
      </Scene>
    </CineView>
  );
}

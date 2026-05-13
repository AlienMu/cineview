import { useState } from 'react';
import { Animate, CineView, Position, Scene, ScrollZone } from 'cineview';

function ScrollBand({
  title,
  body,
  gradient,
  zoneId,
}: {
  title: string;
  body: string;
  gradient: string;
  zoneId: string;
}): JSX.Element {
  return (
    <Scene layout={{ height: 1180 }}>
      <div
        style={{
          minHeight: '1180px',
          position: 'relative',
          padding: '92px 92px 180px',
          boxSizing: 'border-box',
          background: gradient,
        }}
      >
        <Position at={{ x: 92, y: 92 }}>
          <Animate
            enterAnimation="fade-in"
            duration={{ enter: 460 }}
            timeline={{ driver: 'visibility' }}
          >
            <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: 14, marginBottom: 14 }}>
              {title}
            </div>
          </Animate>
        </Position>
        <Position at={{ x: 92, y: 170 }}>
          <Animate
            enterAnimation="slide-up"
            duration={{ enter: 780 }}
            timeline={{ driver: 'visibility' }}
          >
            <h1 style={{ color: '#fff', fontSize: 54, lineHeight: 1.05, margin: 0, maxWidth: 680 }}>
              {title}
            </h1>
          </Animate>
        </Position>
        <Position at={{ x: 92, y: 392 }}>
          <Animate
            animateId={`${zoneId}-copy`}
            enterAnimation="fade-in"
            duration={{ enter: 700 }}
            timeline={{ driver: 'visibility', delay: 160 }}
          >
            <p
              style={{
                color: 'rgba(255,255,255,0.82)',
                fontSize: 20,
                lineHeight: 1.6,
                margin: 0,
                maxWidth: 700,
              }}
            >
              {body}
            </p>
          </Animate>
        </Position>

        <ScrollZone zoneId={zoneId} trigger="center-lock" budget="auto">
          <div style={{ marginTop: 520, display: 'grid', gap: 18, maxWidth: 760 }}>
            <Animate
              animateId={`${zoneId}-card`}
              enterAnimation="zoom-in"
              duration={{ enter: 1400, exit: 900 }}
              timeline={{ driver: 'scroll' }}
            >
              <div
                style={{
                  padding: 28,
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                }}
              >
                Scroll-driven card
              </div>
            </Animate>
            <Animate
              animateId={`${zoneId}-stat-a`}
              enterAnimation="slide-right"
              duration={{ enter: 620 }}
              timeline={{ driver: 'visibility', delay: 180 }}
            >
              <div style={{ color: 'rgba(255,255,255,0.82)' }}>
                Visibility motion stays independent.
              </div>
            </Animate>
            <Animate
              animateId={`${zoneId}-stat-b`}
              enterAnimation="slide-up"
              duration={{ enter: 960, exit: 720 }}
              timeline={{ driver: 'scroll', delay: 260, waitFor: `${zoneId}-card` }}
            >
              <div style={{ color: 'rgba(255,255,255,0.82)' }}>
                timeline.driver=&#34;scroll&#34; claims the budget explicitly.
              </div>
            </Animate>
          </div>
        </ScrollZone>
      </div>
    </Scene>
  );
}

export default function ScrollShowcase(): JSX.Element {
  const [currentScene, setCurrentScene] = useState(0);

  return (
    <CineView
      mode="scroll"
      modes={{ scroll: { direction: 'y', sceneSizing: 'content' } }}
      config={{ width: 1440, height: 1200, unit: 'px' }}
      callbacks={{ common: { onSceneDidChange: (detail) => setCurrentScene(detail.toIndex) } }}
      scrollbar={{ enabled: true, width: 10 }}
    >
      <ScrollBand
        title="Scroll Showcase"
        body={`Current scene: ${currentScene + 1}. This legacy page is now authored with ScrollZone, grouped timeline props, and Position.at coordinates.`}
        gradient="linear-gradient(180deg, #0d1624 0%, #142643 100%)"
        zoneId="scroll-showcase-intro"
      />
      <ScrollBand
        title="Budgeted Story Beat"
        body="Scene sizing now follows content by default; short sections and long sections share the same runtime contract."
        gradient="linear-gradient(180deg, #172138 0%, #273963 100%)"
        zoneId="scroll-showcase-budget"
      />
    </CineView>
  );
}

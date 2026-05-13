import React, { useState } from 'react';
import { Animate, CineView, Position, Scene, ScrollZone } from 'cineview';

function SectionFrame({
  title,
  body,
  background,
  children,
}: {
  title: string;
  body: string;
  background: string;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <Scene layout={{ height: 1100, overflow: 'visible' }}>
      <div
        style={{
          minHeight: '1100px',
          background,
          position: 'relative',
          padding: '120px 88px 160px',
          boxSizing: 'border-box',
        }}
      >
        <Position at={{ x: 24, y: 48 }} layer={{ fixed: true }}>
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 999,
              background: 'rgba(10,12,18,0.78)',
              color: '#fff',
              fontSize: 12,
              letterSpacing: 0,
            }}
          >
            scene-scoped fixed layer
          </div>
        </Position>

        <div style={{ maxWidth: 620 }}>
          <Animate enterAnimation="fade-in" duration={{ enter: 520 }}>
            <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, marginBottom: 16 }}>
              {title}
            </div>
          </Animate>
          <Animate enterAnimation="slide-up" duration={{ enter: 760 }} timeline={{ delay: 120 }}>
            <h1 style={{ color: '#fff', fontSize: 52, lineHeight: 1.1, margin: '0 0 18px' }}>
              {title}
            </h1>
          </Animate>
          <Animate
            animateId={`${title}-body`}
            enterAnimation="fade-in"
            duration={{ enter: 640 }}
            timeline={{ delay: 220 }}
          >
            <p
              style={{ color: 'rgba(255,255,255,0.82)', fontSize: 20, lineHeight: 1.6, margin: 0 }}
            >
              {body}
            </p>
          </Animate>
        </div>

        {children}
      </div>
    </Scene>
  );
}

export default function ScrollCapabilitiesShowcase(): JSX.Element {
  const [currentScene, setCurrentScene] = useState(0);

  return (
    <CineView
      mode="scroll"
      modes={{ scroll: { direction: 'y', sceneSizing: 'content', wheelStep: 1, touchStep: 1 } }}
      config={{ width: 1440, height: 1200, unit: 'px' }}
      callbacks={{ common: { onSceneDidChange: (detail) => setCurrentScene(detail.toIndex) } }}
      scrollbar={{ enabled: true, width: 10 }}
    >
      <SectionFrame
        title="Scroll Capabilities"
        body="ScrollZone is the public takeover primitive. Visibility-driven motion stays separate from the budgeted scroll timeline."
        background="linear-gradient(180deg, #0d1624 0%, #162846 100%)"
      >
        <ScrollZone zoneId="capabilities-intro" trigger="center-lock" budget="auto">
          <div style={{ marginTop: 120, display: 'grid', gap: 24 }}>
            <Animate
              animateId="capabilities-intro-card"
              enterAnimation="zoom-in"
              duration={{ enter: 1100, exit: 900 }}
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
                Budgeted scroll card
              </div>
            </Animate>
            <Animate
              animateId="capabilities-intro-copy"
              enterAnimation="slide-up"
              duration={{ enter: 900 }}
              timeline={{ driver: 'scroll', delay: 260, waitFor: 'capabilities-intro-card' }}
            >
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18 }}>
                timeline.driver=&quot;scroll&quot; now owns this sequence explicitly.
              </div>
            </Animate>
          </div>
        </ScrollZone>
      </SectionFrame>

      <SectionFrame
        title="Visibility Motion"
        body="Elements outside the takeover budget can still animate from visibility rules using timeline.driver='visibility'."
        background="linear-gradient(180deg, #1a2440 0%, #2f3d69 100%)"
      >
        <div style={{ marginTop: 120, display: 'flex', gap: 18 }}>
          {['Visibility badge', 'Replay on re-enter', `Current scene ${currentScene + 1}`].map(
            (label, index) => (
              <Position key={label} at={{ x: index * 180, y: 0 }}>
                <Animate
                  animateId={`visibility-pill-${index}`}
                  enterAnimation="slide-up"
                  duration={{ enter: 520 }}
                  timeline={{ driver: 'visibility', delay: index * 120 }}
                >
                  <div
                    style={{
                      padding: '12px 18px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.12)',
                      color: '#fff',
                      fontSize: 15,
                    }}
                  >
                    {label}
                  </div>
                </Animate>
              </Position>
            )
          )}
        </div>
      </SectionFrame>
    </CineView>
  );
}

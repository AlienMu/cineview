import React from 'react';
import { Animate, CineView, Position, Scene } from 'cineview';

const messageStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: '28px',
  margin: 0,
  textAlign: 'center',
  transform: 'translateX(-50%)',
};

export default function DelayTest(): JSX.Element {
  return (
    <CineView
      mode="snap"
      modes={{ snap: { direction: 'y', duration: 500 } }}
      config={{ width: 750, height: 1334, unit: 'px' }}
    >
      <Scene>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(180deg, #101726 0%, #24324f 100%)',
          }}
        />

        {[
          { id: 'delay-1', y: 200, text: 'Delay 0ms', delay: 0 },
          { id: 'delay-2', y: 350, text: 'Delay 500ms', delay: 500 },
          { id: 'delay-3', y: 500, text: 'Delay 1000ms', delay: 1000 },
          { id: 'delay-4', y: 650, text: 'Delay 1500ms', delay: 1500 },
        ].map((item) => (
          <Position key={item.id} at={{ x: 375, y: item.y }}>
            <Animate
              animateId={item.id}
              enterAnimation="fade-in"
              duration={{ enter: 500 }}
              timeline={{ delay: item.delay }}
            >
              <p style={messageStyle}>{item.text}</p>
            </Animate>
          </Position>
        ))}
      </Scene>
    </CineView>
  );
}

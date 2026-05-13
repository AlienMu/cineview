import React from 'react';
import { Animate, CineView, Position, Scene } from 'cineview';

const backdrop = (gradient: string): React.CSSProperties => ({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  background: gradient,
});

const headingStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: '48px',
  margin: 0,
  textAlign: 'center',
  transform: 'translateX(-50%)',
};

const copyStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.92)',
  fontSize: '22px',
  margin: 0,
  textAlign: 'center',
  transform: 'translateX(-50%)',
};

function renderNotes(
  notes: Array<{ id: string; y: number; text: string; delay?: number; waitFor?: string }>
): JSX.Element[] {
  return notes.map((note) => (
    <Position key={note.id} at={{ x: 375, y: note.y }}>
      <Animate
        animateId={note.id}
        enterAnimation="slide-up"
        exitAnimation="slide-down"
        duration={{ enter: 600, exit: 300 }}
        timeline={{ delay: note.delay ?? 0, waitFor: note.waitFor }}
      >
        <p style={copyStyle}>{note.text}</p>
      </Animate>
    </Position>
  ));
}

export default function App(): JSX.Element {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <CineView
        mode="drag"
        modes={{ drag: { direction: 'y', transitionDuration: 800 } }}
        config={{ width: 750, height: 1334, unit: 'px' }}
      >
        <Scene transition={{ exitDuration: 800 }}>
          <div style={backdrop('linear-gradient(135deg, #667eea 0%, #764ba2 100%)')} />
          <Position at={{ x: 375, y: 210 }}>
            <Animate
              animateId="Drag Scene 1-title"
              enterAnimation="fade-in"
              duration={{ enter: 600 }}
            >
              <h1 style={headingStyle}>Drag Scene 1</h1>
            </Animate>
          </Position>
          {renderNotes([
            { id: 'scene-1-copy-1', y: 320, text: 'Drag upward to settle into the next scene.' },
            {
              id: 'scene-1-copy-2',
              y: 420,
              text: 'Grouped duration and timeline props stay aligned.',
              delay: 180,
            },
          ])}
        </Scene>

        <Scene transition={{ exitDuration: 800 }}>
          <div style={backdrop('linear-gradient(135deg, #f093fb 0%, #f5576c 100%)')} />
          <Position at={{ x: 375, y: 210 }}>
            <Animate
              animateId="Drag Scene 2-title"
              enterAnimation="fade-in"
              duration={{ enter: 600 }}
            >
              <h1 style={headingStyle}>Drag Scene 2</h1>
            </Animate>
          </Position>
          {renderNotes([
            { id: 'scene-2-copy-1', y: 320, text: 'This page demonstrates staggered drag entry.' },
            { id: 'scene-2-copy-2', y: 390, text: 'Delay 120ms', delay: 120 },
            { id: 'scene-2-copy-3', y: 460, text: 'Delay 240ms', delay: 240 },
          ])}
        </Scene>

        <Scene transition={{ exitDuration: 800 }}>
          <div style={backdrop('linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)')} />
          <Position at={{ x: 375, y: 210 }}>
            <Animate
              animateId="Drag Scene 3-title"
              enterAnimation="fade-in"
              duration={{ enter: 600 }}
            >
              <h1 style={headingStyle}>Drag Scene 3</h1>
            </Animate>
          </Position>
          {renderNotes([
            { id: 'scene-3-copy-1', y: 320, text: 'waitFor is now nested under timeline.' },
            {
              id: 'scene-3-copy-2',
              y: 400,
              text: 'Second note waits for the title.',
              delay: 180,
              waitFor: 'Drag Scene 3-title',
            },
          ])}
        </Scene>
      </CineView>
    </div>
  );
}

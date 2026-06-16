import React from 'react';
import { Animate, CineView, Position, Scene } from 'cineview';

const sceneBaseStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
};

const titleStyle: React.CSSProperties = {
  fontSize: '48px',
  fontWeight: 'bold',
  color: '#fff',
  textAlign: 'center',
  transform: 'translateX(-50%)',
  textShadow: '0 4px 20px rgba(0,0,0,0.5)',
};

const copyStyle: React.CSSProperties = {
  fontSize: '24px',
  color: '#fff',
  textAlign: 'center',
  transform: 'translateX(-50%)',
  textShadow: '0 2px 10px rgba(0,0,0,0.5)',
};

export default function App(): JSX.Element {
  return (
    <CineView
      mode="drag"
      modes={{ drag: { direction: 'y', transitionDuration: 500 } }}
      config={{ width: 750, height: 1334, unit: 'px' }}
    >
      <Scene>
        <div
          style={{
            ...sceneBaseStyle,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        />
        <Position at={{ x: 375, y: 300 }}>
          <Animate
            animateId="scene1-title"
            enterAnimation="fade-in"
            duration={{ enter: 1000 }}
            timeline={{ delay: 0 }}
          >
            <h1 style={titleStyle}>Scene 1</h1>
          </Animate>
        </Position>
        <Position at={{ x: 375, y: 400 }}>
          <Animate
            animateId="scene1-copy"
            enterAnimation="slide-up"
            duration={{ enter: 800 }}
            timeline={{ delay: 500 }}
          >
            <p style={copyStyle}>Root-owned drag mode with grouped timing.</p>
          </Animate>
        </Position>
        <Position at={{ x: 375, y: 520 }}>
          <Animate
            animateId="scene1-card"
            enterAnimation="zoom-in"
            duration={{ enter: 600 }}
            timeline={{ delay: 900 }}
          >
            <div
              style={{
                width: '132px',
                height: '132px',
                background: '#fff',
                borderRadius: '14px',
                transform: 'translateX(-50%)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}
            />
          </Animate>
        </Position>
      </Scene>

      <Scene>
        <div
          style={{
            ...sceneBaseStyle,
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          }}
        />
        <Position at={{ x: 375, y: 300 }}>
          <Animate animateId="scene2-title" enterAnimation="fade-in" duration={{ enter: 1000 }}>
            <h1 style={titleStyle}>Scene 2</h1>
          </Animate>
        </Position>
        <Position at={{ x: 375, y: 400 }}>
          <Animate
            animateId="scene2-copy"
            enterAnimation="slide-up"
            duration={{ enter: 800 }}
            timeline={{ delay: 400 }}
          >
            <p style={copyStyle}>`Position.at` keeps the coordinates tidy.</p>
          </Animate>
        </Position>
      </Scene>

      <Scene>
        <div
          style={{
            ...sceneBaseStyle,
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          }}
        />
        <Position at={{ x: 375, y: 300 }}>
          <Animate animateId="scene3-title" enterAnimation="fade-in" duration={{ enter: 1000 }}>
            <h1 style={titleStyle}>Scene 3</h1>
          </Animate>
        </Position>
        <Position at={{ x: 375, y: 420 }}>
          <Animate
            animateId="scene3-badge"
            enterAnimation="rotate-in"
            duration={{ enter: 800 }}
            timeline={{ delay: 500 }}
          >
            <div
              style={{
                width: '120px',
                height: '120px',
                background: '#fff',
                borderRadius: '50%',
                transform: 'translateX(-50%)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}
            />
          </Animate>
        </Position>
      </Scene>
    </CineView>
  );
}

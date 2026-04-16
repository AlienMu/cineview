import React from 'react';
import { CineView, Scene, Animate, Position } from 'cineview';

const App: React.FC = () => {
  return (
    <CineView
      config={{
        designSize: 750,
        unit: 'px',
      }}
    >
      {/* Scene 1 */}
      <Scene slideMode="snap" slideDuration={500}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        />

        <Position x={375} y={300}>
          <Animate enterAnimation="fade-in" enterDuration={1000} delay={0} animateId="scene1-title">
            <h1
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: '#fff',
                textAlign: 'center',
                transform: 'translateX(-50%)',
                textShadow: '0 4px 20px rgba(0,0,0,0.5)',
              }}
            >
              Scene 1
            </h1>
          </Animate>
        </Position>

        <Position x={375} y={400}>
          <Animate
            enterAnimation="slide-up"
            enterDuration={800}
            delay={500}
            animateId="scene1-desc"
          >
            <p
              style={{
                fontSize: '24px',
                color: '#fff',
                textAlign: 'center',
                transform: 'translateX(-50%)',
                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              }}
            >
              This is the first scene
            </p>
          </Animate>
        </Position>

        <Position x={375} y={500}>
          <Animate enterAnimation="zoom-in" enterDuration={600} delay={1000} animateId="scene1-box">
            <div
              style={{
                width: '100px',
                height: '100px',
                background: '#fff',
                borderRadius: '10px',
                transform: 'translateX(-50%)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}
            />
          </Animate>
        </Position>
      </Scene>

      {/* Scene 2 */}
      <Scene slideMode="snap" slideDuration={500}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          }}
        />

        <Position x={375} y={300}>
          <Animate enterAnimation="fade-in" enterDuration={1000} delay={0} animateId="scene2-title">
            <h1
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: '#fff',
                textAlign: 'center',
                transform: 'translateX(-50%)',
                textShadow: '0 4px 20px rgba(0,0,0,0.5)',
              }}
            >
              Scene 2
            </h1>
          </Animate>
        </Position>

        <Position x={375} y={400}>
          <Animate
            enterAnimation="slide-up"
            enterDuration={800}
            delay={500}
            animateId="scene2-desc"
          >
            <p
              style={{
                fontSize: '24px',
                color: '#fff',
                textAlign: 'center',
                transform: 'translateX(-50%)',
                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              }}
            >
              This is the second scene
            </p>
          </Animate>
        </Position>
      </Scene>

      {/* Scene 3 */}
      <Scene slideMode="snap" slideDuration={500}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          }}
        />

        <Position x={375} y={300}>
          <Animate enterAnimation="fade-in" enterDuration={1000} delay={0} animateId="scene3-title">
            <h1
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: '#fff',
                textAlign: 'center',
                transform: 'translateX(-50%)',
                textShadow: '0 4px 20px rgba(0,0,0,0.5)',
              }}
            >
              Scene 3
            </h1>
          </Animate>
        </Position>

        <Position x={375} y={400}>
          <Animate
            enterAnimation="rotate-in"
            enterDuration={800}
            delay={500}
            animateId="scene3-box"
          >
            <div
              style={{
                width: '100px',
                height: '100px',
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
};

export default App;

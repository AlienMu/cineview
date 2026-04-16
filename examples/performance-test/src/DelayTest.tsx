import React from 'react';
import { CineView, Scene, Animate, Position } from 'cineview';

/**
 * 简单的延迟测试组件
 * 用于验证动画延迟是否正常工作
 */
const DelayTest: React.FC = () => {
  return (
    <CineView
      config={{
        designSize: 750,
        unit: 'px',
      }}
    >
      <Scene slideDirection="y" slideMode="snap">
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

        <Position x={375} y={200}>
          <Animate
            enterAnimation="fade-in"
            enterDuration={500}
            delay={0}
            animateId="box-1"
          >
            <div
              style={{
                width: '100px',
                height: '100px',
                background: '#FF6B6B',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '24px',
                fontWeight: 'bold',
                transform: 'translateX(-50%)',
              }}
            >
              1
            </div>
          </Animate>
        </Position>

        <Position x={375} y={350}>
          <Animate
            enterAnimation="fade-in"
            enterDuration={500}
            delay={500}
            animateId="box-2"
          >
            <div
              style={{
                width: '100px',
                height: '100px',
                background: '#4ECDC4',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '24px',
                fontWeight: 'bold',
                transform: 'translateX(-50%)',
              }}
            >
              2
            </div>
          </Animate>
        </Position>

        <Position x={375} y={500}>
          <Animate
            enterAnimation="fade-in"
            enterDuration={500}
            delay={1000}
            animateId="box-3"
          >
            <div
              style={{
                width: '100px',
                height: '100px',
                background: '#45B7D1',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '24px',
                fontWeight: 'bold',
                transform: 'translateX(-50%)',
              }}
            >
              3
            </div>
          </Animate>
        </Position>

        <Position x={375} y={650}>
          <Animate
            enterAnimation="fade-in"
            enterDuration={500}
            delay={1500}
            animateId="box-4"
          >
            <div
              style={{
                width: '100px',
                height: '100px',
                background: '#FFA07A',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '24px',
                fontWeight: 'bold',
                transform: 'translateX(-50%)',
              }}
            >
              4
            </div>
          </Animate>
        </Position>

        <Position x={375} y={100}>
          <div
            style={{
              color: '#fff',
              fontSize: '32px',
              fontWeight: 'bold',
              textAlign: 'center',
              transform: 'translateX(-50%)',
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            }}
          >
            延迟测试
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: '16px',
              textAlign: 'center',
              transform: 'translateX(-50%)',
              marginTop: '10px',
            }}
          >
            方块应该按顺序出现：0ms → 500ms → 1000ms → 1500ms
          </div>
        </Position>
      </Scene>
    </CineView>
  );
};

export default DelayTest;

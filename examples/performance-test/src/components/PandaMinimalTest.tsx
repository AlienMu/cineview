/**
 * MINIMAL test — one scene to verify framework rendering works.
 * If this doesn't show animations, the framework has an issue.
 */
import { Animate, Scene } from 'cineview';

export const PandaMinimalScenes = [
  <Scene
    key="test-0"
    transition={{ enterAnimation: 'slide-up', exitAnimation: 'fade-out', exitDuration: 800 }}
  >
    <div
      style={{
        width: '100%',
        minHeight: '100%',
        background: 'linear-gradient(180deg, #FFFBEB, #E8F5E9)',
        overflow: 'hidden',
        paddingTop: 100,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Animate animateId="t1" enterAnimation="zoom-in" duration={{ enter: 700, exit: 400 }}>
          <span style={{ fontSize: 80 }}>🐼</span>
        </Animate>
      </div>
      <div style={{ marginTop: 30, textAlign: 'center' }}>
        <Animate
          animateId="t2"
          enterAnimation="slide-up"
          duration={{ enter: 550, exit: 300 }}
          timeline={{ waitFor: 't1' }}
        >
          <h1 style={{ fontSize: 30, fontWeight: 800, color: '#263238' }}>熊猫测试</h1>
        </Animate>
      </div>
      <div style={{ marginTop: 15, textAlign: 'center' }}>
        <Animate
          animateId="t3"
          enterAnimation="fade-in"
          duration={{ enter: 500, exit: 300 }}
          timeline={{ waitFor: 't2' }}
        >
          <p style={{ fontSize: 14, color: '#8D6E63' }}>
            如果你看到这段文字，Scene 和 Animate 正在工作
          </p>
        </Animate>
      </div>
    </div>
  </Scene>,

  <Scene
    key="test-1"
    transition={{ enterAnimation: 'zoom-in', exitAnimation: 'slide-up', exitDuration: 800 }}
  >
    <div
      style={{
        width: '100%',
        minHeight: '100%',
        background: 'linear-gradient(180deg, #E8F5E9, #C8E6C9)',
        overflow: 'hidden',
        paddingTop: 100,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Animate animateId="t4" enterAnimation="bounce-in" duration={{ enter: 700 }}>
          <span style={{ fontSize: 80 }}>🎋</span>
        </Animate>
      </div>
      <div style={{ marginTop: 30, textAlign: 'center' }}>
        <Animate
          animateId="t5"
          enterAnimation="slide-right"
          duration={{ enter: 550 }}
          timeline={{ waitFor: 't4' }}
        >
          <h1 style={{ fontSize: 30, fontWeight: 800, color: '#1B5E20' }}>第二页</h1>
        </Animate>
      </div>
      <div style={{ marginTop: 15, textAlign: 'center' }}>
        <Animate
          animateId="t6"
          enterAnimation="fade-in"
          duration={{ enter: 500 }}
          timeline={{ waitFor: 't5' }}
          infiniteAnimation="pulse"
        >
          <p style={{ fontSize: 14, color: '#8D6E63' }}>试试上下拖动切换场景 ↑↓</p>
        </Animate>
      </div>
    </div>
  </Scene>,
];

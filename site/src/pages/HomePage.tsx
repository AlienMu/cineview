import { CineView, Scene } from 'cineview';
import { HeroScene } from '../components/HeroScene';
import {
  CapabilityFilmStripScene,
  CapabilityStageDrawerScene,
} from '../components/CapabilityScene';
import { DemoVideoScene } from '../components/DemoVideoScene';
import { HomeSceneCanvas } from '../components/HomeSceneCanvas';
import { DragPhoneScene } from '../components/DragPhoneScene';

/**
 * 官网首页 — 整页单个 scroll 实例(见 task-flow A2)。
 * 第一幕 Hero 已落地(HeroScene);第二幕能力展示为两个独立 Scene.scroll
 * (胶片带 / 舞台抽屉),各自 center-lock 接管、播完释放。第四幕滚动驱动视频
 * (DemoVideoScene,center-lock 接管,AnimateVideo 逐帧擦洗)。其余幕次后续替换占位。
 */
export default function HomePage(): JSX.Element {
  return (
    <CineView
      config={{ size: 1440 }}
      mode="scroll"
      scrollbar={{
        enabled: true,
        width: 8,
        autoHide: true,
        trackColor: 'rgba(26, 24, 20, 0.06)',
        thumbColor: 'var(--accent)',
        thumbHoverColor: 'rgba(255, 255, 255, 0.9)',
      }}
    >
      <Scene sceneId="hero" layout={{ width: '100%', height: '100vh' }}>
        <HomeSceneCanvas>
          <HeroScene />
        </HomeSceneCanvas>
      </Scene>

      {/* 能力展示：两个独立 center-lock 接管镜（胶片带 / 舞台抽屉），各自锁定演完再释放 */}
      <Scene
        sceneId="cap-film"
        layout={{ width: '100%', height: '100vh' }}
        scroll={{ zoneId: 'cap-film-zone', trigger: 'center-lock' }}
      >
        <HomeSceneCanvas>
          <CapabilityFilmStripScene />
        </HomeSceneCanvas>
      </Scene>

      <Scene
        sceneId="cap-stage"
        layout={{ width: '100%', height: '100vh' }}
        scroll={{ zoneId: 'cap-stage-zone', trigger: 'center-lock' }}
      >
        <HomeSceneCanvas>
          <CapabilityStageDrawerScene />
        </HomeSceneCanvas>
      </Scene>

      {/* 第四幕：滚动驱动视频（center-lock 接管，AnimateVideo 随进度逐帧擦洗） */}
      <Scene
        sceneId="demo-video"
        layout={{ width: '100%', height: '100vh' }}
        scroll={{ zoneId: 'demo-video-zone', trigger: 'center-lock' }}
        assets={{ preloadImages: ['/video.mp4'] }}
      >
        <HomeSceneCanvas>
          <DemoVideoScene />
        </HomeSceneCanvas>
      </Scene>

      <Scene
        sceneId="drag-phone"
        layout={{ width: '100%', height: '100vh', overflow: 'visible' }}
        scroll={{ zoneId: 'drag-phone-zone', trigger: 'center-lock' }}
      >
        <HomeSceneCanvas>
          <DragPhoneScene />
        </HomeSceneCanvas>
      </Scene>
    </CineView>
  );
}

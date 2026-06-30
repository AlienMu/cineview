import { CineView, Scene } from 'cineview';
import { HeroScene } from '../components/HeroScene';
import {
  CapabilityFilmStripScene,
  CapabilityStageDrawerScene,
} from '../components/CapabilityScene';
import { DemoVideoScene } from '../components/DemoVideoScene';
import { useI18n } from '../i18n';

/**
 * 官网首页 — 整页单个 scroll 实例(见 task-flow A2)。
 * 第一幕 Hero 已落地(HeroScene);第二幕能力展示为两个独立 Scene.scroll
 * (胶片带 / 舞台抽屉),各自 center-lock 接管、播完释放。第四幕滚动驱动视频
 * (DemoVideoScene,center-lock 接管,AnimateVideo 逐帧擦洗)。其余幕次后续替换占位。
 */
export default function HomePage(): JSX.Element {
  const { t } = useI18n();

  return (
    <CineView
      config={{ width: 1440, height: 900 }}
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
        <HeroScene />
      </Scene>

      {/* 能力展示：两个独立 center-lock 接管镜（胶片带 / 舞台抽屉），各自锁定演完再释放 */}
      <Scene
        sceneId="cap-film"
        layout={{ width: '100%', height: '100vh' }}
        scroll={{ zoneId: 'cap-film-zone', trigger: 'center-lock' }}
      >
        <CapabilityFilmStripScene />
      </Scene>

      <Scene
        sceneId="cap-stage"
        layout={{ width: '100%', height: '100vh' }}
        scroll={{ zoneId: 'cap-stage-zone', trigger: 'center-lock' }}
      >
        <CapabilityStageDrawerScene />
      </Scene>

      {/* 第四幕：滚动驱动视频（center-lock 接管，AnimateVideo 随进度逐帧擦洗） */}
      <Scene
        sceneId="demo-video"
        layout={{ width: '100%', height: '100vh' }}
        scroll={{ zoneId: 'demo-video-zone', trigger: 'center-lock' }}
      >
        <DemoVideoScene />
      </Scene>

      {[5].map((i) => (
        <Scene key={i} sceneId={`placeholder-${i}`} layout={{ width: '100%', height: '100vh' }}>
          <div className="home-placeholder">
            <span className="home-placeholder__tc mono">{String(i).padStart(2, '0')}</span>
            <h2>{`Scene ${i}`}</h2>
            <p>{t('hero.intro')}</p>
          </div>
        </Scene>
      ))}
    </CineView>
  );
}

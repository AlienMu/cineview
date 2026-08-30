import { useCallback, useEffect, useState } from 'react';
import { CineView, Scene } from 'cineview';
import { HeroScene } from '../components/HeroScene';
import { CapabilityFilmStripScene } from '../components/CapabilityScene';
import { Act3DollyScene } from '../components/Act3DollyScene';
import { DemoVideoScene } from '../components/DemoVideoScene';
import { HomeSceneCanvas } from '../components/HomeSceneCanvas';
import { useDesignCanvasHeight } from '../hooks/useDesignCanvasHeight';
import { Scene5Cinema } from '../components/Scene5Cinema';

/**
 * 预热 /drag 体验：CineView onReady 后创建 hidden iframe 拉取 /drag 的
 * HTML/JS/CSS 进缓存（preload=true 只渲染空壳，零动画零 rAF），onLoad 即移除。
 * 不阻塞首页渲染，无视觉/交互副作用。
 */
function DragExperiencePreloader({ active }: { active: boolean }): null {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const iframe = document.createElement('iframe');
    iframe.src = '/drag?preload=true';
    iframe.style.cssText =
      'position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.title = 'preload';
    const handleLoad = (): void => iframe.remove();
    iframe.addEventListener('load', handleLoad);
    document.body.appendChild(iframe);
    return (): void => {
      iframe.removeEventListener('load', handleLoad);
      iframe.remove();
    };
  }, [active]);

  return null;
}

/**
 * 官网首页 — 整页单个 scroll 实例(见 task-flow A2)。
 * 第一幕 Hero 已落地(HeroScene);第二幕能力展示为两个独立 Scene.scroll
 * (胶片带 / 舞台抽屉),各自 center-lock 接管、播完释放。第四幕滚动驱动视频
 * (DemoVideoScene,center-lock 接管,AnimateVideo 逐帧擦洗)。第五幕 Cinema
 * Entrance(熄灯 → 手机亮起 → iframe 进入 /drag 完整拖拽体验)。
 */
export default function HomePage(): JSX.Element {
  const [dragPreloadArmed, setDragPreloadArmed] = useState(false);
  const armDragPreload = useCallback((): void => setDragPreloadArmed(true), []);
  // 手机上第三幕的画布要长到「一个视口高」，否则 1440×900 在 390 宽只有 390×244，
  // 六块被压进顶部 29%。只第三幕用，其余四幕不传 ⇒ 维持 900（见 task-flow
  // 2026-08-04-act3-phone-layout.md；其余四幕的窄屏偏小属 D8 ② 待专项）。
  const { designH: shot3CanvasH } = useDesignCanvasHeight();

  return (
    <div className="home-page">
      {/* 全站背景色带 = App 级 <BackgroundRibbon />（初版机制还原，2026-08-13），
          不再由本页挂载（见 task-flow 2026-08-13 追加轮）。 */}
      <CineView
        designWidth={1440}
        mode="scroll"
        scrollbar={{
          enabled: true,
          width: 8,
          autoHide: true,
          trackColor: 'rgba(26, 24, 20, 0.06)',
          thumbColor: 'var(--accent)',
          thumbHoverColor: 'rgba(255, 255, 255, 0.9)',
        }}
        callbacks={{ onReady: armDragPreload }}
      >
        <Scene
          sceneId="hero"
          className="home-scene home-scene--hero"
          layout={{ width: '100%', height: '100vh' }}
        >
          <HomeSceneCanvas>
            <HeroScene />
          </HomeSceneCanvas>
        </Scene>

        {/* 能力展示：两个独立 center-lock 接管镜（胶片带 / 舞台抽屉），各自锁定演完再释放 */}
        <Scene
          sceneId="cap-film"
          className="home-scene home-scene--film"
          layout={{ width: '100%', height: '100vh' }}
          scroll={{ zoneId: 'cap-film-zone', trigger: 'center-lock' }}
        >
          <HomeSceneCanvas>
            <CapabilityFilmStripScene />
          </HomeSceneCanvas>
        </Scene>

        {/* 第三幕：推镜（dolly in）—— 6 个特性代码块沿径向外扩放大出画，
            全部消失后中心显影标题收尾。预算 10s。 */}
        <Scene
          sceneId="cap-shot3"
          className="home-scene home-scene--shot3"
          layout={{ width: '100%', height: '100vh' }}
          scroll={{ zoneId: 'cap-shot3-zone', trigger: 'center-lock' }}
        >
          <HomeSceneCanvas height={shot3CanvasH}>
            <Act3DollyScene />
          </HomeSceneCanvas>
        </Scene>

        {/* 第四幕：滚动驱动视频（center-lock 接管，AnimateVideo 随进度逐帧擦洗） */}
        <Scene
          sceneId="demo-video"
          className="home-scene home-scene--demo"
          layout={{ width: '100%', height: '100vh' }}
          scroll={{ zoneId: 'demo-video-zone', trigger: 'center-lock' }}
          assets={{ preloadImages: ['/video.mp4'] }}
        >
          <HomeSceneCanvas>
            <DemoVideoScene />
          </HomeSceneCanvas>
        </Scene>

        {/* 第五幕：Cinema Entrance（熄灯 → 手机亮起 → iframe 进入 /drag，
            不走 HomeSceneCanvas：overlay 需盖满整个场景、手机以视口带为基准居中）

            height 由 150vh 改为 100vh（2026-08-04，D3）：原 150vh 里 stage 只占中间
            100vh（top:50% + translateY(-50%)），上下各留 25vh 死白 —— 这就是第四幕与
            第五幕之间「有间隔」的直接来源。改 100vh 后 takeover sticky 壳正好一个视口、
            钉在 top:0 且 overflow:hidden，overlay 的 absolute inset:0 即等价于视口铺满，
            无需 position:fixed（fixed 在 takeover 内必然降级：ScrollSceneSlot 给
            takeover content 恒定加 transform，任何非 none 的 transform 都会成为
            fixed 的包含块）。 */}
        <Scene
          sceneId="cinema-entrance"
          className="home-scene home-scene--cinema"
          layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
          scroll={{ zoneId: 'cinema-entrance', trigger: 'center-lock' }}
        >
          <Scene5Cinema />
        </Scene>
      </CineView>
      <DragExperiencePreloader active={dragPreloadArmed} />
    </div>
  );
}

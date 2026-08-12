import { Animate, CineView, Scene } from 'cineview';
import { memo, useCallback, useEffect, useState } from 'react';
import { SceneCut } from './SceneCut';
import { SceneFlux } from './SceneFlux';
import { SceneRolling } from './SceneRolling';
import { SceneSlate } from './SceneSlate';
import { SceneSync } from './SceneSync';
import { TemporalMotionProvider, useTemporalMotion } from './TemporalMotion';
import '../../styles/temporal-drag.css';
import '../../styles/temporal-scenes-03-05.css';

const GRAIN_TIMES = [0, 0.249, 0.25, 0.499, 0.5, 0.749, 0.75, 0.999, 1];

function SceneTexture({ id }: { id: string }): JSX.Element {
  const timing = useTemporalMotion();

  return (
    <div className="tp-texture" aria-hidden="true">
      {timing.reduced ? (
        <div className="tp-texture__grain" />
      ) : (
        <Animate
          animateId={`${id}-grain`}
          infiniteAnimation={{
            animate: {
              x: ['0%', '0%', '-3%', '-3%', '2%', '2%', '-1%', '-1%', '0%'],
              y: ['0%', '0%', '1%', '1%', '-2%', '-2%', '2%', '2%', '0%'],
              transition: {
                duration: timing.seconds(0.5),
                ease: 'linear',
                times: GRAIN_TIMES,
                repeat: Infinity,
              },
            },
          }}
        >
          <div className="tp-texture__grain" />
        </Animate>
      )}
      <div className="tp-texture__scanline" />
      <div className="tp-texture__vignette" />
    </div>
  );
}

type TemporalDragExperienceProps = {
  /** 预热壳：只让 hidden iframe 把本页 HTML/JS/CSS 拉进缓存并求值模块，
   *  不 mount CineView、零动画零 rAF；iframe onLoad 即完成使命。 */
  preload?: boolean;
  /** 延迟启动（Homepage scene5 内嵌）：先渲染暗场壳并向父窗口宣告
   *  'cineview-embed-ready'，收到 'cineview-activate' 才冷启动挂载完整
   *  CineView（第一幕入场链在揭幕瞬间从零播放）；'cineview-freeze' 卸载回壳。
   *  壳态零 CPU，不与外层滚动抢主线程（task-flow 2026-08-02 架构细化 #1/#2）。
   *  注：内部协议 URL——直接开 tab 访问 /drag?deferred=true 无父窗口应答，
   *  将停留在暗场壳，属预期行为。 */
  deferred?: boolean;
};

/** 末幕索引（五幕：rolling/slate/sync/flux/cut）。到达它即「滑到结尾」。 */
const LAST_SCENE_INDEX = 4;

export const TemporalDragExperience = memo(function TemporalDragExperience({
  preload = false,
  deferred = false,
}: TemporalDragExperienceProps): JSX.Element {
  const [stage, setStage] = useState<'frozen' | 'live'>(deferred ? 'frozen' : 'live');

  /* 第四条消息：`cineview-embed-finished` / `cineview-embed-unfinished`（2026-08-06；
   * 2026-08-09 增加反向 —— 用户访谈裁决「退场 = 完整反向编排」）。
   * 用户要的时序是「在 /drag 页面滑动到结束并且 commit 完成的情况」才让外层手机左移。
   * 判据必须是 **commit 完成**而非 drag 进行中 —— `onSceneDidChange` 正是转场结算后
   * 才发，且带 toIndex，故用它而不用 `onDragProgress`（后者在手指还没松时就到 1）。
   * 反向同理：commit 离开末幕（toIndex < LAST_SCENE_INDEX）发 unfinished，外层
   * 标题/副标题镜像退场、手机移回居中（split 从单向 latch 变双向）。两向都幂等：
   * 父层对重复的 finished/unfinished 只是 setSplit 同值，无副作用。
   * 只在 deferred（被首页内嵌）时发：独立开 /drag 时没有父窗口，发了也无人接。
   * 同源校验沿用既有约定。 */
  const notifySceneSettled = useCallback(
    (detail: { toIndex: number }): void => {
      if (!deferred) return;
      window.parent?.postMessage(
        detail.toIndex === LAST_SCENE_INDEX
          ? 'cineview-embed-finished'
          : 'cineview-embed-unfinished',
        window.location.origin
      );
    },
    [deferred]
  );

  useEffect(() => {
    if (!deferred) return;
    const origin = window.location.origin;
    const handleMessage = (event: MessageEvent): void => {
      if (event.origin !== origin) return;
      if (event.data === 'cineview-activate') {
        setStage('live');
      } else if (event.data === 'cineview-freeze') {
        setStage('frozen');
      }
    };
    window.addEventListener('message', handleMessage);
    // listener 就位后才宣告就绪；父层只在收到 ready 后发 activate，规避 load 竞态。
    window.parent?.postMessage('cineview-embed-ready', origin);
    return (): void => window.removeEventListener('message', handleMessage);
  }, [deferred]);

  if (preload || stage === 'frozen') {
    return <div className="drag-temporal" data-embed={preload ? 'preload' : 'deferred-frozen'} />;
  }

  return (
    <div className="drag-temporal" data-embed={deferred ? 'deferred-live' : undefined}>
      <TemporalMotionProvider>
        <CineView
          config={{ size: 390 }}
          mode="drag"
          callbacks={{ onSceneDidChange: notifySceneSettled }}
          modes={{
            drag: {
              direction: 'y',
              transitionDuration: 720,
              unit: 'time',
              threshold: {
                minVelocity: 0,
                maxVelocity: 1200,
                minRatio: 0.15,
                maxRatio: 0.32,
              },
            },
          }}
        >
          <Scene
            sceneId="rolling"
            className="tp-scene tp-scene--01"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneRolling />
            <SceneTexture id="s01-texture" />
          </Scene>
          <Scene
            sceneId="slate"
            className="tp-scene tp-scene--02"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneSlate />
            <SceneTexture id="s02-texture" />
          </Scene>
          <Scene
            sceneId="sync"
            className="tp-scene tp-scene--03"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneSync />
            <SceneTexture id="s03-texture" />
          </Scene>
          <Scene
            sceneId="flux"
            className="tp-scene tp-scene--04"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneFlux />
            <SceneTexture id="s04-texture" />
          </Scene>
          <Scene
            sceneId="cut"
            className="tp-scene tp-scene--05"
            layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
          >
            <SceneCut />
            <SceneTexture id="s05-texture" />
          </Scene>
        </CineView>
      </TemporalMotionProvider>
    </div>
  );
});

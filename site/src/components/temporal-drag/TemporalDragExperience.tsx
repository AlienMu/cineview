import { Animate, CineView, Scene } from 'cineview';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { SceneCut } from './SceneCut';
import { SceneFlux } from './SceneFlux';
import { SceneRolling } from './SceneRolling';
import { SceneSlate } from './SceneSlate';
import { SceneSync } from './SceneSync';
import { TemporalMotionProvider, useTemporalMotion } from './TemporalMotion';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
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
          loopAnimation={{
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
  const reduced = usePrefersReducedMotion();

  /* 第四条消息：`cineview-embed-finished` / `cineview-embed-unfinished`（2026-08-06；
   * 2026-08-09 增加反向 —— 用户访谈裁决「退场 = 完整反向编排」）。
   * 用户要的时序是「在 /drag 页面滑动到结束并且 commit 完成的情况」才让外层手机左移。
   * 判据必须是 **commit 完成**而非 drag 进行中 —— `onSceneLeave` 正是转场结算后
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

  /* 第五幕黑幕 + 场景纹理会（2026-08-13，task-flow 2026-08-13-act5-black-exit-bg-follow；
   * code-review 发现 1/2/4 修正版）。黑幕背景已从 .tp-scene--05 迁到 .tp-act5-black
   * （temporal-drag.css），本组件负责两个面的 opacity：
   *   - `.tp-act5-black`：第五幕黑色背景（z1 根级层，不随场景框平移）。
   *   - `.tp-scene--05 .tp-texture`：颗粒/扫描线/暗角。场景背景透明后这些覆盖层若
   *     不退场就会随场景框滑过第四幕内容（review 发现 1）——必须与黑层同步淡出。
   * 编排三态（零 React state，直写 DOM）：
   *   1. 手势期：逐 tick 直写 + transition:none —— 完全跟手、无滞后（review 发现 4
   *      否决了「每帧重定向 250ms transition」的写法；drag 的 progress 本身就是每帧
   *      平滑值，不需要再平滑）。
   *   2. 松手（pointerup，session 内）：transition 线性过渡到终值，时长 = |终值 − 当前值|
   *      × slideDuration(800ms)（与剩余滑程同速，淡完与 commit 同时到达）——settle
   *      补间期间黑幕/纹理平滑淡完，不再冻结在松手值等 commit 才 snap（review 发现 2）。
   *      bounce 回程 tick 会立即夺回手势态，不受影响。
   *   3. commit/cancel：snap 终值（第四幕框已铺满，snap 不可见）。
   * latch（对抗验收 A3/S2）：首个匹配「进入/退出第五幕」的 tick 建立，本 session 内
   * 不再判 direction——手势中途 forward↔reverse 反转仍按 sceneIndex 跟 |progress| 回缩；
   * 歧义方向起步的 session 逐 tick 匹配补上。commit/cancel 复位（DESIGN.md：每 session
   * 恰好一次 commit|cancel，跨 session 无残留）。 */
  const blackRef = useRef<HTMLDivElement | null>(null);
  const textureRef = useRef<HTMLElement | null>(null);
  const blackSessionRef = useRef<number | null>(null);
  /** 黑层当前值跟踪：settle 时长按「剩余滑程」换算（见 pointerup 处理）。 */
  const lastBlackRef = useRef(1);

  const applyBlack = useCallback(
    (opacity: number, mode: 'gesture' | 'settle' | 'snap', settleMs?: number): void => {
      // freeze/activate 壳切换会卸载重挂 CineView（blackRef 由 React 自动重挂），
      // 手动缓存的 textureRef 会指向已脱离文档的旧节点 —— isConnected 校验并重解析
      // （对抗验收 T4 实测：旧引用导致纹理恒 1 卡死）。
      if (!textureRef.current?.isConnected) {
        textureRef.current = document.querySelector<HTMLElement>('.tp-scene--05 .tp-texture');
      }
      const transition = mode === 'settle' ? `opacity ${settleMs ?? 700}ms linear` : 'none';
      for (const node of [blackRef.current, textureRef.current]) {
        if (!node) continue;
        if (node.style.transition !== transition) node.style.transition = transition;
        node.style.opacity = String(opacity);
      }
      lastBlackRef.current = opacity;
    },
    []
  );

  const handleBlackOpacity = useCallback(
    (detail: {
      sceneIndex: number;
      direction?: 'forward' | 'backward' | null;
      progress: number;
    }): void => {
      if (blackSessionRef.current === null && detail.direction) {
        if (detail.sceneIndex === LAST_SCENE_INDEX - 1 && detail.direction === 'forward') {
          blackSessionRef.current = LAST_SCENE_INDEX - 1;
        } else if (detail.sceneIndex === LAST_SCENE_INDEX && detail.direction === 'backward') {
          blackSessionRef.current = LAST_SCENE_INDEX;
        }
      }
      if (blackSessionRef.current === null) return;
      const opacity =
        blackSessionRef.current === LAST_SCENE_INDEX - 1 ? detail.progress : 1 - detail.progress;
      applyBlack(opacity, 'gesture');
    },
    [applyBlack]
  );
  const handleBlackSessionEnd = useCallback((): void => {
    blackSessionRef.current = null;
  }, []);
  const handleSceneSettled = useCallback(
    (detail: { toIndex: number }): void => {
      notifySceneSettled(detail);
      blackSessionRef.current = null;
      applyBlack(detail.toIndex === LAST_SCENE_INDEX ? 1 : 0, 'snap');
    },
    [applyBlack, notifySceneSettled]
  );

  // 松手 → settle 淡入淡出（三态之 2）。用 capture 相位，防框架指针路径拦截冒泡。
  // 时长按剩余滑程换算：|终值 − 当前值| × slideDuration(800ms)，淡完与 commit 同时
  // 到达，snap 零跳变（对抗验收「进场侧 commit pop」建议）。
  useEffect(() => {
    const onPointerUp = (): void => {
      if (blackSessionRef.current === null) return;
      const terminal = blackSessionRef.current === LAST_SCENE_INDEX ? 0 : 1;
      const settleMs = Math.min(
        800,
        Math.max(reduced ? 80 : 120, Math.abs(terminal - lastBlackRef.current) * 800)
      );
      applyBlack(terminal, 'settle', settleMs);
    };
    window.addEventListener('pointerup', onPointerUp, true);
    return (): void => window.removeEventListener('pointerup', onPointerUp, true);
  }, [applyBlack, reduced]);

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
      {/* 第五幕黑幕根级层：必须在 CineView 之前（DOM 序）+ z-index 1，
          高于容器背景、低于全部场景框（见 temporal-drag.css .tp-act5-black）。 */}
      <div ref={blackRef} className="tp-act5-black" aria-hidden="true" />
      <TemporalMotionProvider>
        <CineView
          designWidth={390}
          mode="drag"
          direction="y"
          transitionDuration={720}
          unit="time"
          threshold={{
            minVelocity: 0,
            maxVelocity: 1200,
            minRatio: 0.15,
            maxRatio: 0.32,
          }}
          callbacks={{
            onSceneLeave: handleSceneSettled,
            onDragProgress: handleBlackOpacity,
            onDragCancel: handleBlackSessionEnd,
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

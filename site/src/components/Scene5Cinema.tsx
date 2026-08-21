import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Animate, useAnimateTimeline } from 'cineview';
import { useI18n } from '../i18n';
import { PhoneMockup } from './PhoneMockup';
import { createLastWinsTimerSequence, type LastWinsTimerSequence } from './lastWinsTimerSequence';
import {
  createScene5LifecycleState,
  freezeScene5Element,
  reduceScene5Lifecycle,
  scene5TabIndex,
  SCENE5_SPLIT_SCRUB_START,
  type Scene5LifecycleEffect,
  type Scene5LifecycleEvent,
  type Scene5LifecycleState,
} from './scene5Lifecycle';
import './Scene5Cinema.css';

const GITHUB_URL = 'https://github.com/AlienMu/cineview';

/**
 * 第五幕：Cinema Entrance（熄屏入场）。
 *
 * 三阶段串行（zone 预算分数窗口，task-flow 2026-08-02-scene5-cinema-entrance）：
 *   0.02–1.0 熄灯（黑 overlay 线性变黑，反向可逆，斜坡贯穿整个 zone）
 *   0.4–0.7 手机显现（mockup opacity/scale/blur scrub）
 *   0.7–1.0 揭幕（iframe opacity/blur scrub + postMessage 激活 /drag 冷启动入场）
 *
 * 总预算由 cinema-clock lane 唯一决定（2200ms → 2200px 锁定滚动）。
 * iframe 生命周期为只进不退的 latch：progress ≥0.4 创建 deferred iframe、≥0.7 激活；
 * 回滚只反向 scrub 视觉，不重新冻结。场景整体离开视口（末幕唯一退场路径 = 向上滚出，
 * 此时 progress 已回 0）才 freeze + 卸载 + 重置，重进从头重放。
 */

/* 预算 1600 → 2200（2026-08-04，D4）：标题从角落 13px 单行升级为放映机字幕卡
 * （虚焦→实焦 + 流光 + 阴影脉冲），需要一段独占窗口把入场演完，再交给手机显现。
 * 手机/揭幕仍占 0.4→0.7 与 0.7→1 的同一分数窗口，绝对时长随总预算等比拉长。 */
const TOTAL_MS = 2200;
const CREATE_AT = 0.4;
const REVEAL_AT = 0.7;
/* ⚠️ 标题的 phase 窗口与两条常驻 lane（TITLE_START/TITLE_END/TITLE_LOOP_*、
 * titleVariant、TITLE_BEAM_LOOP、TITLE_SHADOW_LOOP）已于 2026-08-06 全部删除。
 * 标题不再由 zone progress 驱动入场，而是随右栏在**分栏态**出现（由子页
 * `cineview-embed-finished` 触发）—— 用户指定的时序是「手机先入场，滑到结尾且
 * commit 完成后才出标题」，那不是 progress 的函数，故不能再用 phase 窗口表达。 */
/** 熄灯终点 0.94 而非 1.0：留极微暖底透出，避免第五幕变成纯黑（用户明确要求）。 */
const LIGHTS_OFF_MAX = 0.94;
// 交互开放晚于激活（审查建议）：activate 在 0.7 就送达（入场链在揭幕 blur-in 中播放），
// 但 pointer-events 到揭幕近完成才开——否则 0.7–0.98 锁定段内触屏按在手机上滑动会被
// 半透明 iframe 吞掉、无法推进外层揭幕；反滚离开段末则收回交互（带迟滞防抖）。
const INTERACT_AT = 0.98;
const INTERACT_OFF_BELOW = 0.92;

/* ── 收尾层退场语义：scrub（2026-08-15 用户拍板，取代 2026-08-14 手动控制轨）──
 * 旧方案（enterRef/exitRef 手动控制轨 + SPLIT_ENTER / SPLIT_EXIT 定时器
 * 编排）已整体删除：事件驱动退场不跟手——用户往上滚时文字/CTA 不动，
 * 要等消息/定时器才退。新语义三件事：
 *   1. 文字/CTA/footer 的**透明度 = zone progress 的纯函数**，scrub 窗
 *      0.85→1（下方 SPLIT_SCRUB_*）：往上滚跟手淡出、滚回来原样回来。
 *   2. 元素**挂载门控在 finished latch 上**（latch 才渲染）：框架轨制下
 *      同一 lane 不能「手动入场 + scrub 退场」（scrub 轨手动写入会被下一帧
 *      scroll 覆盖），故串行入场改为子元素的**一次性 CSS transform/visibility 动画**
 *      （`animation: … both` + delay 0/0.25s/0.6s/0.9s，见 Scene5Cinema.css；
 *      CLAUDE.md 规则 6 允许一次性插值，禁 infinite）。滚动 opacity 由外层 scrub owner
 *      写入；unfinished 才会启用独立的 manual-opacity 通道。
 *   3. 列收拢阈值 0.85：progress < 0.85 → 收列（手机回中，CSS 1.1s 位移段照旧）；
 *      progress 回升至 0.95 才重开，且递增 replay generation 重新走四拍，避免
 *      0.85 临界来回抖动与隐藏期间跳过入场。
 * unfinished 消息先按序驱动一次性 manual-opacity，再由同一代 sequence 收列；
 * manual-opacity 只负责消息时序，不另写框架 progress。 */
const SPLIT_SCRUB_END = 1;
/* ── 严格串行时序（2026-08-16 用户指令，回归 08-09 裁决语义）───────────────
 * 入场：手机位移 1.1s（CSS gap/basis/width transition）**完成后**标题才起
 * （1.1s），副标题 1.35s、CTA 1.7s、footer 2.0s——CSS animation delay 对齐。
 * unfinished 路径退场：**先**按序驱动子节点的 manual-opacity 通道（footer 0 /
 * cta 0.15 / 副标题 0.35 / 标题 0.55s），**再**收列（手机位移）——外层 scrub
 * 仍独占滚动透明度，JS 只编排一次性事件时序（非每帧；滚轮路径不受影响）。 */
const SPLIT_EXIT_DONE_MS = 1050;
const SPLIT_EXIT_DELAYS_MS: Array<[className: string, delay: number]> = [
  ['scene5-cinema__footer', 0],
  ['scene5-cinema__cta', 150],
  ['scene5-cinema__subtitle-text', 350],
  ['scene5-cinema__title-text', 550],
];
/** freeze 路径的两级串行（视口外的最终清理，语义保留）：t=700ms 收列
 * （此时 progress≈0，文字 opacity 已被 scrub 归零，收列只是布局复位），
 * t=1400ms 卸载 iframe + 重置 latch。 */
const FREEZE_COLLAPSE_MS = 700;
const FREEZE_UNMOUNT_MS = 1400;

/** 收尾 scrub variant：纯 opacity 0→1（y 不参与——退场只做透明度跟手，
 * 位移分量一律交给子元素的一次性 CSS 入场动画，两层职责不重叠）。 */
const closingFadeVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0 } },
} as const;

type CinemaStage = 'idle' | 'mounted' | 'revealed';

function clockVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { opacity: 1 },
    animate: { opacity: 1, transition: { duration: 0 } },
  };
}

/**
 * 熄灯：黑 overlay 由 zone progress 线性拉到 `LIGHTS_OFF_MAX`。
 *
 * ⚠️ **起点必须是 0**（2026-08-09 用户指令，**有意反转** 2026-08-08 的 ISSUE-B 修复）。
 * 历史：第四幕内容在它自己主轴末端就收干，而本幕 slot 要晚 ~900px 才接管 ⇒ 那段滑入
 * 行程透出奶白空屏。08-08 的修法是让 overlay 从 0.62 起步（接管前画面已压暗，接缝被
 * 本幕自己接上）。用户 08-09 否掉了这个方向：「场景5的背景不能在过渡的时候是黑色，
 * 目前是屏幕5未接管就变成是黑色背景了」。
 *
 * 现裁决：接管前的滑入行程透出**色带尾段暖色**（容器背景兜底 #f7dfcc，见 global.css
 * 无级色带），暖接暖、无分层接缝；熄灯斜坡贯穿锁定后整个 zone（0.02→1，见
 * `LIGHTS_OFF_RAMP_END`）。
 * 已知代价（用户知情接受）：那段 ~900px 会回到「暖色空屏」——平坦但不黑，
 * 与前四幕屏间过渡的观感一致。
 */
const LIGHTS_OFF_MIN = 0;

/**
 * ── 熄灯必须真的黑，且黑了就不再退回（2026-08-12 真机实测修正）──────────────
 * 用户报：「我要求背景是黑色的，背景出现后又消失了。」探针
 * `site/scripts/rv-20260812-sweep.mjs`（130px 小步 wheel 穿段，sweep.json）实测：
 *   y=30450 → 0.256、30840 → 0.392、31100 → 0.439、**31230 峰值 0.442**，
 *   之后 31360 → 0.434、31490 → 0.415、31600（页面到底）→ **0.388**。
 * 两个结论，都与旧实现的意图相反：
 *   1. **永远到不了黑**。实测斜率约 3.5e-4 /px，从 0 拉到 0.94 需要约 2700px，
 *      而本幕从熄灯起点到文档末尾根本没有这么多可滚距离 ⇒ 峰值卡在 0.44。
 *      旧写法把 0→0.94 摊在相位 0→0.4 上，等于把全部黑度压在一段走不完的行程里。
 *   2. **到底部还在往回亮**。旧的四点镜像关键帧 `[0,.94,.94,0]` @ `[0,.4,.6,1]`
 *      在相位后段线性回 0 —— 正向滚到底时黑幕自己淡掉了，就是用户说的「出现后又消失」。
 *
 * 现改：**整 zone 单段线性斜坡拉到全黑**（`times:[0,1]` / `opacity:[0,0.94]`，
 *   `LIGHTS_OFF_RAMP_END=1`），斜坡贯穿整个 zone。达到 0.94 后**再也不回亮**。
 *   times    [0,   1   ]
 *   opacity  [0,   0.94]
 *
 * 「退场与入场一样」仍然成立，而且是更本质的成立方式：本 lane 的 opacity 是 zone
 * progress 的**纯函数**，反向滚动时 progress 递减、黑幕沿同一条曲线原样亮回来 ——
 * 镜像是免费的，不需要（也不该）在正向行程末尾人为加一段回亮。
 *
 * 起点仍必须是 0（2026-08-09 用户指令未变）：接管前的滑入行程透出色带尾段暖色，
 * 不能一进过渡就是黑的。
 */
/* 斜坡长度（2026-08-13 用户裁决重定）：斜坡 = **整个 zone**（RAMP_END = 1）。
 * 历史：0.029 太短（瞬变）、0.12 走不完（峰值 0.44）、0.17 折中（斜坡 600px + 恒黑
 * 1700px）。但 0.17 有两个用户裁决压不住的缺点：
 *   1. 屏闪（N13 回归）：移除 1.05s 防闪 transition 后（用户 2026-08-13 裁决
 *      「黑屏完全消失才结束滚动拦截」优先），600px 斜坡在离散滚轮档位下
 *      每档 Δopacity ≈ 0.19（-120px 档）≈ 40+ lum 单帧跳——频闪复现（用户报障）。
 *   2. 整 zone 线性斜坡把每档 Δ 压到 ≈ 0.032（-120px 档）≈ 7 lum/帧，低于
 *      N13 的 15 lum 阈值；-400px 快甩档 Δ ≈ 0.107 ≈ 25 lum——快速甩动时
 *      被运动本身掩盖（已知残余，用户知情）。
 * 代价：熄灯从「前段快速变黑 + 恒黑」改为「贯穿整段滚动的缓慢变暗」（影院调性，
 * 正向单调不减，08-12「黑了就不再退回」仍成立）；黑屏仍在解钉前完全消失
 * （相位窗起点 0.02 见 JSX 注释）。 */
const LIGHTS_OFF_RAMP_END = 1;

function lightsOffVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { opacity: LIGHTS_OFF_MIN },
    animate: {
      opacity: [LIGHTS_OFF_MIN, LIGHTS_OFF_MAX],
      transition: { duration: 0, times: [0, LIGHTS_OFF_RAMP_END] },
    },
  };
}

/* ── 星光已整体退役（2026-08-19 用户指令：「黑色背景星星去掉，增加淡淡的黑金
 *    渐变背景 + 持续动画」）。9 条 twinkle 频道 lane、54 颗逐星 DOM、buildStars
 *    种子随机全部删除，氛围改由两层黑金渐变雾承担（见下方 JSX 与 CSS
 *    `.scene5-cinema__gold-mist-*`）。历史上的逐星闪烁实现与性能消融记录见
 *    git 历史与本文件 2026-08-08/09 版本，不在此保留。 */
function phoneVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { opacity: 0, scale: 0.92, filter: 'blur(14px)' },
    animate: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 0 } },
  };
}

function revealVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { opacity: 0, filter: 'blur(12px)' },
    animate: { opacity: 1, filter: 'blur(0px)', transition: { duration: 0 } },
  };
}

/** 只读投影 zone progress 做阶段 latch；每帧仅数字比较，setState 只在阈值穿越时发生。 */
function CinemaLatchProjection({ onProgress }: { onProgress: (value: number) => void }): null {
  const { progress } = useAnimateTimeline();

  useEffect(() => {
    onProgress(progress.get());
    return progress.on('change', onProgress);
  }, [onProgress, progress]);

  return null;
}

export function Scene5Cinema(): JSX.Element {
  const { t, lang } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const stageRef = useRef<CinemaStage>('idle');
  const embedReadyRef = useRef(false);
  const liveRef = useRef(false);
  const interactiveRef = useRef(false);
  const [stage, setStage] = useState<CinemaStage>('idle');
  const [live, setLive] = useState(false);
  const [interactive, setInteractive] = useState(false);
  /** zone progress 的最新值镜像（消息 handler 到达时读当前进度用）。 */
  const progressRef = useRef(0);
  const textColRef = useRef<HTMLDivElement>(null);
  /**
   * Scene5 的离散生命周期只有一个 owner。消息、progress 和
   * IntersectionObserver 都通过这个 reducer 进入；React state 只是该状态的渲染投影。
   */
  const [lifecycle, setLifecycle] = useState<Scene5LifecycleState>(() =>
    createScene5LifecycleState()
  );
  const lifecycleRef = useRef<Scene5LifecycleState>(lifecycle);
  const lifecycleSequenceRef = useRef<LastWinsTimerSequence | null>(null);
  const lifecycleDispatchRef = useRef<(event: Scene5LifecycleEvent) => void>(() => undefined);

  const getLifecycleSequence = useCallback((): LastWinsTimerSequence => {
    if (!lifecycleSequenceRef.current) {
      lifecycleSequenceRef.current = createLastWinsTimerSequence({
        setTimeout: (callback, delay) => window.setTimeout(callback, delay),
        clearTimeout: (id) => window.clearTimeout(id),
      });
    }
    return lifecycleSequenceRef.current;
  }, []);

  const resetClosingElementStyles = useCallback((): void => {
    for (const [cls] of SPLIT_EXIT_DELAYS_MS) {
      const element = rootRef.current?.querySelector<HTMLElement>(`.${cls}`) ?? null;
      if (!element) continue;
      element.style.animation = '';
      element.style.transform = '';
      element.style.visibility = '';
      element.style.removeProperty('--scene5-manual-opacity');
    }
  }, []);

  const freezeClosingElements = useCallback((): void => {
    for (const [cls] of SPLIT_EXIT_DELAYS_MS) {
      const element = rootRef.current?.querySelector<HTMLElement>(`.${cls}`) ?? null;
      if (!element) continue;
      // Capture the keyframe's current transform before taking opacity ownership. Without this,
      // cancelling a delayed/running entrance snaps the node to the CSS rule's static transform.
      freezeScene5Element(element);
    }
  }, []);

  /** Apply reducer effects. All finite callbacks use the same last-wins sequence owner. */
  const applyLifecycleEffect = useCallback(
    (effect: Scene5LifecycleEffect): void => {
      const sequence = getLifecycleSequence();
      switch (effect.type) {
        case 'cancel-sequence':
          sequence.cancel();
          return;
        case 'start-freeze':
          sequence.start(
            [
              {
                delay: FREEZE_COLLAPSE_MS,
                run: () =>
                  lifecycleDispatchRef.current({
                    type: 'freeze-collapse',
                    generation: effect.generation,
                  }),
              },
            ],
            () =>
              lifecycleDispatchRef.current({
                type: 'freeze-complete',
                generation: effect.generation,
              }),
            FREEZE_UNMOUNT_MS
          );
          return;
        case 'start-exit':
          freezeClosingElements();
          sequence.start(
            SPLIT_EXIT_DELAYS_MS.map(([cls, delay]) => ({
              delay,
              run: (): void => {
                const element = rootRef.current?.querySelector<HTMLElement>(`.${cls}`) ?? null;
                if (element) element.style.setProperty('--scene5-manual-opacity', '0');
              },
            })),
            () =>
              lifecycleDispatchRef.current({
                type: 'exit-complete',
                generation: effect.generation,
              }),
            SPLIT_EXIT_DONE_MS
          );
          return;
        case 'replay-closing':
          // The keyed Fragment below remounts the four beats. Clear imperative residue from the
          // old DOM before React commits the new generation, so a cancelled exit cannot leak in.
          resetClosingElementStyles();
          return;
        case 'freeze-reset':
          iframeRef.current?.contentWindow?.postMessage('cineview-freeze', window.location.origin);
          stageRef.current = 'idle';
          embedReadyRef.current = false;
          liveRef.current = false;
          interactiveRef.current = false;
          setStage('idle');
          setLive(false);
          setInteractive(false);
          resetClosingElementStyles();
          return;
        case 'exit-reset':
          resetClosingElementStyles();
          return;
      }
    },
    [freezeClosingElements, getLifecycleSequence, resetClosingElementStyles]
  );

  const dispatchLifecycle = useCallback(
    (event: Scene5LifecycleEvent): void => {
      const current = lifecycleRef.current;
      const transition = reduceScene5Lifecycle(current, event);
      if (transition.state === current && transition.effects.length === 0) return;
      lifecycleRef.current = transition.state;
      setLifecycle(transition.state);
      for (const effect of transition.effects) applyLifecycleEffect(effect);
    },
    [applyLifecycleEffect]
  );
  // Timer callbacks intentionally dereference the latest dispatch function; queued callbacks may
  // outlive a React render, while the reducer generation still rejects stale work.
  lifecycleDispatchRef.current = dispatchLifecycle;

  const split = lifecycle.split;
  const closing = lifecycle.closing;
  const closingReplayKey = lifecycle.replayKey;

  useLayoutEffect(() => {
    // `inert` covers future focusable descendants; explicit tabIndex on current links below also
    // closes the pre-layout-effect commit window and works in older engines without inert support.
    const textColumn = textColRef.current;
    if (!textColumn) return;
    textColumn.inert = !split;
    if (
      !split &&
      document.activeElement instanceof HTMLElement &&
      textColumn.contains(document.activeElement)
    ) {
      document.activeElement.blur();
    }
  }, [split]);

  useEffect(
    () => () => {
      getLifecycleSequence().cancel();
    },
    [getLifecycleSequence]
  );

  const sendActivate = useCallback((): void => {
    const target = iframeRef.current?.contentWindow;
    if (!target || liveRef.current) return;
    target.postMessage('cineview-activate', window.location.origin);
    liveRef.current = true;
    setLive(true);
  }, []);

  const handleProgress = useCallback(
    (value: number): void => {
      progressRef.current = value;
      if (value >= REVEAL_AT) {
        if (stageRef.current !== 'revealed') {
          stageRef.current = 'revealed';
          setStage('revealed');
          if (embedReadyRef.current) sendActivate();
        }
      } else if (value >= CREATE_AT && stageRef.current === 'idle') {
        stageRef.current = 'mounted';
        setStage('mounted');
      }
      // 交互门（非 latch，带迟滞）：揭幕近完成才开放 iframe 指针，反滚离段末收回
      if (value >= INTERACT_AT) {
        if (!interactiveRef.current) {
          interactiveRef.current = true;
          setInteractive(true);
        }
      } else if (value < INTERACT_OFF_BELOW && interactiveRef.current) {
        interactiveRef.current = false;
        setInteractive(false);
      }
      /* 列收拢/重开：reducer 在 0.85/0.95 两个阈值上只做离散转换；重开会递增
       * replayKey，下面的 keyed Fragment 因此重新播放四拍 CSS 入场，而不是揭示已完成帧。 */
      dispatchLifecycle({ type: 'progress', value });
    },
    [dispatchLifecycle, sendActivate]
  );

  // deferred iframe 的就绪握手：只有「ready 已收到 + progress 已过揭幕阈值」才发 activate，
  // 规避 iframe 加载竞态丢消息。双向都校验同源 + 消息源。
  useEffect(() => {
    const origin = window.location.origin;
    const handleMessage = (event: MessageEvent): void => {
      if (event.origin !== origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data === 'cineview-embed-ready') {
        embedReadyRef.current = true;
        if (stageRef.current === 'revealed') sendActivate();
        return;
      }
      /* 第四条消息（2026-08-06）：子页滑到末幕且 commit 完成 ⇒ 进入分栏态：
         手机移到左侧、右栏收尾层挂载。用户指定的时序就是这一刻，
         不是 progress 到 1、也不是 drag 进行中（那两者手指可能还没松）。
         2026-08-15 scrub 语义 + 2026-08-16 严格串行修订（见 SPLIT_EXIT_* 注释）：
         finished ⇒ latch 置位（收尾层挂载 + CSS 串行入场）+ 开列；
         unfinished ⇒ **先文字有序退场（SPLIT_EXIT_DELAYS_MS），退完才收列**——
         不再瞬时卸载。重复消息幂等/last-wins。 */
      if (event.data === 'cineview-embed-finished') {
        // An offscreen/cleanup generation is authoritative: the reducer ignores this late
        // message instead of cancelling the freeze that owns resource release.
        dispatchLifecycle({ type: 'finished', progress: progressRef.current });
      } else if (event.data === 'cineview-embed-unfinished') {
        dispatchLifecycle({ type: 'unfinished' });
      }
    };
    window.addEventListener('message', handleMessage);
    return (): void => window.removeEventListener('message', handleMessage);
  }, [dispatchLifecycle, sendActivate]);

  // 场景整体离开视口 → freeze + 卸载 iframe + 重置 latch（重新进入时从头重放）。
  // 末幕向下无后继，唯一退场路径是向上滚出。可见退场 = 收尾层 scrub 淡出
  // （progress 纯函数，视口内跟手播完）+ zone 三段反向 scrub；本 effect 是
  // 视口外的最终清理（用户滚离后 iframe 还在后台跑才是浪费），不挂
  // exitAnimation 的裁决不变（架构细化 #5）。
  //
  // 2026-08-15 scrub 语义下两级串行（freeze 的 iframe 清理职责不变）：
  //   t=700ms  收列（此时 progress≈0，文字 opacity 已被 scrub 归零，收列只是
  //            布局复位，不再有文字退场编排——旧 exitRef 链已删）
  //   t=1400ms 卸载 iframe + 重置 latch/stage
  // 滚出后 <1.4s 内滚回（对抗复审 R6-1 场景）：取消定时器即可——latch 仍持有、
  // 收尾层仍挂载，滚回段末时 opacity 随 scrub 窗原样回来；progress 到 0.95 时
  // 由 lifecycle replay generation 重新走四拍。
  useEffect(() => {
    const node = rootRef.current;
    if (node === null || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      dispatchLifecycle({
        type: 'visibility',
        visible: entry.isIntersecting,
        stageActive: stageRef.current !== 'idle',
      });
    });
    observer.observe(node);
    return (): void => observer.disconnect();
  }, [dispatchLifecycle]);

  return (
    <div ref={rootRef} className="scene5-cinema" data-cinema-stage={stage} data-lang={lang}>
      {/* 熄灯 overlay：Animate 驱动 opacity 曲线（2026-08-13 用户裁决 A：
          黑罩留在场景内、保留 Animate；黑屏必须在滚动拦截结束前完全消失）。
          ⚠️ 相位窗起点 0.02 而非 0：zone progress < 0.02 时本 lane 停在 initial
          （opacity 0）—— 反向滚出时黑罩在解钉（progress 0）前约 44px 就完全消失，
          「黑屏完全消失才结束滚动拦截」成立（解钉滑动发生时黑罩已透明、不可见）。
          ⚠️ 1.05s 防闪 transition 已按用户裁决移除（原 N13 修复）：快滚时淡入/淡出
          斜坡回到逐档跳变，属用户知情接受的代价（用户 2026-08-13 选择
          「完全消失」优先于「无频闪」）。 */}
      <Animate
        animateId="cinema-lightsoff"
        enterAnimation={lightsOffVariant()}
        duration={{ enter: 640 }}
        /* 整幕相位（C-act5）：退场要与入场镜像，故不能只覆盖 0→CREATE_AT。
           lightsOffVariant 是整 zone 单段线性斜坡（见其注释），phase 窗 0.02→1。 */
        timeline={{ phase: { start: 0.02, end: 1 } }}
      >
        <div className="scene5-cinema__overlay" aria-hidden="true" />
      </Animate>

      {/* 黑金渐变氛围（2026-08-19 重做：星野退役，用户指令「星星去掉，淡黑金渐变
          + 持续动画」）。两层大 radial 金雾（alpha ≤0.055，淡而不显），各自一条
          infinite lane 写 CSS 变量（--gold-drift-1/2，周期 9s/14s 互质 ⇒ 两层呼吸
          不同相、合成波不复现）映射到自身 opacity 做极慢呼吸 ⇒ 「背景持续动画」
          且不与标题/手机动效同相抢眼。嵌套结构与旧星光同构：每层 Animate 只写
          自己的变量，雾层作为最内层子节点继承并消费。
          ⚠️ infinite lane 只能写 CSS 变量不能写 opacity 白名单属性
          （memory `infinite-lane-cannot-drive-whitelist-props`）。
          ⚠️ 全屏 gradient + 每帧变量改写会全屏重绘（memory
          `css-var-opacity-repaints-fullscreen`）——两层都 translateZ(0) 提为
          合成层，opacity 呼吸交合成器，与旧三层星幕方案同一修法。 */}
      <div className="scene5-cinema__gold-mist" aria-hidden="true">
        <Animate
          animateId="cinema-gold-mist-a"
          infiniteAnimation={{
            animate: {
              '--gold-drift-1': [0.55, 1, 0.55],
              transition: { duration: 9, ease: 'easeInOut', repeat: Infinity },
            },
          }}
          timeline={{ phase: { start: 0, end: 1 } }}
        >
          <Animate
            animateId="cinema-gold-mist-b"
            infiniteAnimation={{
              animate: {
                '--gold-drift-2': [1, 0.5, 1],
                transition: { duration: 14, ease: 'easeInOut', repeat: Infinity },
              },
            }}
            timeline={{ phase: { start: 0, end: 1 } }}
          >
            <div className="scene5-cinema__gold-mist-layer scene5-cinema__gold-mist-layer--a" />
            <div className="scene5-cinema__gold-mist-layer scene5-cinema__gold-mist-layer--b" />
          </Animate>
        </Animate>
      </div>

      {/* 视口带：center-lock 锁定时与视口严格重合（架构细化 #6）
          ── 布局与时序（2026-08-06 用户指令）────────────────────────────
          横向两栏：手机在左、标题+副标题在右（原为纵向：标题压在手机上方，
          用户判「太占位置」）。
          两态由 `split` 切换：
            默认   手机居中、右栏 width:0 不占位（用户：「入场手机先入场」）
            分栏   收到子页 `cineview-embed-finished`（滑到末幕且 commit 完成）
                   ⇒ 手机左移、右栏出现
          位移与展开由 CSS transition 承担（一次性状态切换，非常驻动效，
          不属 CLAUDE.md 规则 6 第一条约束的 `animation: infinite`）。 */}
      <div className="scene5-cinema__stage">
        <div className={`scene5-cinema__phone-slot${split ? ' is-split' : ''}`}>
          <div className="scene5-cinema__phone-col">
            <Animate
              animateId="cinema-phone"
              enterAnimation={phoneVariant()}
              duration={{ enter: 480 }}
              timeline={{ phase: { start: CREATE_AT, end: REVEAL_AT } }}
            >
              <PhoneMockup>
                <Animate
                  animateId="cinema-reveal"
                  enterAnimation={revealVariant()}
                  duration={{ enter: 480 }}
                  timeline={{ phase: { start: REVEAL_AT, end: 1 } }}
                >
                  <div
                    className={`scene5-cinema__iframe-slot${live && interactive ? ' is-live' : ''}`}
                  >
                    {stage !== 'idle' ? (
                      <iframe
                        ref={iframeRef}
                        className="scene5-cinema__iframe"
                        src="/drag?deferred=true"
                        title={t('scene5.frameTitle')}
                      />
                    ) : null}
                  </div>
                </Animate>
              </PhoneMockup>
            </Animate>
          </div>

          {/* 右栏收尾层：标题 + 副标题 + CTA + footer（2026-08-15 scrub 语义）。
              - 挂载门控在 finished latch（closing）上：latch 才渲染，串行入场
                由子元素一次性 CSS 动画承担（delay 0/0.25s/0.6s/0.9s，
                Scene5Cinema.css `scene5-closing-*`，规则 6 允许一次性插值）。
              - 每个元素一条 scrub lane：timeline.phase 窗 0.85→1（sceneControlled
                默认，绑本 zone takeover 时间轴）——包装层 opacity 是 progress
                的纯函数，往上滚跟手淡出、滚回来原样回来，无消息/定时器参与。
              - FOUC：latch 挂载时 progress 已为 1，包装层 opacity 由 scrub 立即
                解析为 1，子元素 CSS 动画 `both` 在 delay 期停在 opacity 0——
                两层都不会闪现半成品。 */}
          <div ref={textColRef} className="scene5-cinema__text-col" aria-hidden={!split}>
            {closing ? (
              <Fragment key={closingReplayKey}>
                <Animate
                  animateId="cinema-split-title"
                  enterAnimation={closingFadeVariant}
                  duration={{ enter: 480 }}
                  timeline={{ phase: { start: SCENE5_SPLIT_SCRUB_START, end: SPLIT_SCRUB_END } }}
                >
                  <p className="scene5-cinema__title-text">{t('scene5.title')}</p>
                </Animate>
                <Animate
                  animateId="cinema-split-subtitle"
                  enterAnimation={closingFadeVariant}
                  duration={{ enter: 480 }}
                  timeline={{ phase: { start: SCENE5_SPLIT_SCRUB_START, end: SPLIT_SCRUB_END } }}
                >
                  <p className="scene5-cinema__subtitle-text">{t('scene5.subtitle')}</p>
                </Animate>
                {/* 收尾 CTA（第三拍）。按钮用本幕 scoped 类（黑场影院语境：
                    浅色文字/实底骨白主钮 + 描边次钮，无 box-shadow——列容器
                    overflow:hidden 会裁掉阴影，亮度层级取代光晕）。 */}
                <Animate
                  animateId="cinema-split-cta"
                  enterAnimation={closingFadeVariant}
                  duration={{ enter: 480 }}
                  timeline={{ phase: { start: SCENE5_SPLIT_SCRUB_START, end: SPLIT_SCRUB_END } }}
                >
                  <div className="scene5-cinema__cta">
                    <p className="scene5-cinema__cta-lead">{t('cta.title')}</p>
                    <div className="scene5-cinema__cta-buttons">
                      <Link
                        className="scene5-cinema__btn scene5-cinema__btn--primary"
                        to="/docs/quickstart"
                        tabIndex={scene5TabIndex(split)}
                      >
                        {t('cta.start')}
                      </Link>
                      <a
                        className="scene5-cinema__btn scene5-cinema__btn--ghost"
                        href={GITHUB_URL}
                        target="_blank"
                        rel="noreferrer"
                        tabIndex={scene5TabIndex(split)}
                      >
                        {t('cta.github')}
                      </a>
                    </div>
                    <p className="scene5-cinema__cta-body">{t('cta.body')}</p>
                  </div>
                </Animate>
                {/* footer（第四拍）：2026-08-15 从视口底 absolute 挪进右栏，
                    排在 cta.body 下方——同栏语境、同 scrub 窗。 */}
                <Animate
                  animateId="cinema-footer"
                  enterAnimation={closingFadeVariant}
                  duration={{ enter: 480 }}
                  timeline={{ phase: { start: SCENE5_SPLIT_SCRUB_START, end: SPLIT_SCRUB_END } }}
                >
                  <div className="scene5-cinema__footer" aria-hidden={!split}>
                    <span className="scene5-cinema__footer-tagline">{t('footer.tagline')}</span>
                    <nav className="scene5-cinema__footer-links" aria-label={t('footer.tagline')}>
                      <Link to="/docs" tabIndex={scene5TabIndex(split)}>
                        {t('footer.docs')}
                      </Link>
                      <Link to="/demo" tabIndex={scene5TabIndex(split)}>
                        {t('footer.demo')}
                      </Link>
                      <span className="scene5-cinema__footer-sep" aria-hidden="true" />
                      <span>{t('footer.license')}</span>
                    </nav>
                  </div>
                </Animate>
              </Fragment>
            ) : null}
          </div>
        </div>
      </div>

      {/* 预算钟：唯一决定 zone 总预算（2200px 锁定滚动），并投影 progress 做阶段 latch */}
      <Animate
        animateId="cinema-clock"
        enterAnimation={clockVariant()}
        duration={{ enter: TOTAL_MS }}
      >
        <CinemaLatchProjection onProgress={handleProgress} />
      </Animate>
    </div>
  );
}

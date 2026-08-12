import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animate, useAnimateTimeline } from 'cineview';
import { useI18n } from '../i18n';
import { PhoneMockup } from './PhoneMockup';
import './Scene5Cinema.css';

/**
 * 第五幕：Cinema Entrance（熄屏入场）。
 *
 * 三阶段串行（zone 预算分数窗口，task-flow 2026-08-02-scene5-cinema-entrance）：
 *   0–0.4 熄灯（黑 overlay 线性变黑，反向可逆）
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
 * 无级色带），暖接暖、无分层接缝；熄灯只在锁定后 progress 0→0.4 内播放。
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
 * 现改：**前 12% 相位内拉到全黑，其后恒定 0.94 到底**。
 *   times    [0,   0.12, 0.56, 1   ]
 *   opacity  [0,   0.94, 0.94, 0.94]
 * 0.12 相位按实测约合 810px ⇒ 进入本幕后很快就全黑，且**再也不回亮**。
 *
 * 「退场与入场一样」仍然成立，而且是更本质的成立方式：本 lane 的 opacity 是 zone
 * progress 的**纯函数**，反向滚动时 progress 递减、黑幕沿同一条曲线原样亮回来 ——
 * 镜像是免费的，不需要（也不该）在正向行程末尾人为加一段回亮。
 *
 * 起点仍必须是 0（2026-08-09 用户指令未变）：接管前的滑入行程透出色带尾段暖色，
 * 不能一进过渡就是黑的。
 */
/* 0.029 也是实测定的：0.12 时斜坡实测占 2080px（32210→34290），而文档到 34400 就结束
 * ⇒ 只有最后约 110px 是黑的，等于没黑。按同一斜率折算，0.029 ≈ 500px 斜坡，
 * 进入本幕后半屏内就全黑，其后恒黑到底。 */
const LIGHTS_OFF_RAMP_END = 0.029;

function lightsOffVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { opacity: LIGHTS_OFF_MIN },
    animate: {
      opacity: [LIGHTS_OFF_MIN, LIGHTS_OFF_MAX, LIGHTS_OFF_MAX, LIGHTS_OFF_MAX],
      transition: { duration: 0, times: [0, LIGHTS_OFF_RAMP_END, 0.56, 1] },
    },
  };
}

/* ── 星光（2026-08-06 用户指令：「我要的背景星光闪烁的动画效果，你也没有实现。
 *    如果可以，我希望不要灯光，只要闪烁的星光就行了，保证随机性」）──────────────
 *
 * 最初的问题：3 层，**每层内所有星点共用一个 `--twinkle`** ⇒ 一层里 5–8 颗星严格同相地
 * 一起亮一起暗。观感是「三块背景在呼吸」，不是「星星在闪」。
 *
 * 第一版改法（把「层」换成 9 条互质周期的「频道」，逐星随机分配）**只解决了一半** ——
 * 对抗验收实测证伪（2026-08-08）：
 *   - 54 颗星的频道直方图 `{0:8, 1:4, 2:4, 3:5, 4:6, 5:2, 6:4, 7:8, 8:13}`
 *   - 两两相关中 **r>0.99 占 12.4%**，而同频道星对占比 178/1431 = **12.4%**，逐位吻合
 *     ⇒ 同频道星就是**完全同相**，一一对应，不是巧合
 *   - 最大的 8 号频道有 **13 颗**星、周期 23s ⇒ 13 颗一起缓慢涨落，**比它要修的
 *     「5–8 颗同相」那组还大**
 * 而我第一版注释里写「相位由『分配到哪个频道』+『该星自己的 lo/hi 区间』共同制造差异」
 * 是**自相矛盾的**：`lo/hi` 只改**振幅**，改不了**相位**，同频道星只是同一条曲线的等比缩放。
 *
 * 现在的改法：**每颗星消费两条频道的加权混合** ——
 *   `--star-t: calc(var(--twinkle-a) * w + var(--twinkle-b) * (1 - w))`
 * a / b / w 三者都逐星随机。两条不同周期的合成波形逐星不同，共享 a 的星只要 b 或 w 不同
 * 就自动解相关，**同相组被打散**。仍是 9 条 lane、零 canvas、零 rAF、零每帧 JS ——
 * 混合发生在 CSS 的 calc() 里，不新增任何 JS 每帧成本。
 * 频道周期取互质质数秒（2/3/5/7/11/13/17/19/23）⇒ 任意两条的公共周期是乘积
 * （最小 6s、最大 437s），合成波不会短周期复现。
 *
 * 随机性可复现：固定种子 LCG，不用 `Math.random()` —— 每次刷新看到同一片星空
 * （站点当前是纯 CSR，故这不是 SSR 水合问题；理由是**可复现调试**，改星野时能对照）。
 *
 * ⚠️ 为什么必须走 CSS 变量而不能直接 animate opacity：
 * useAnimateScroll 恒定返回含 opacity/x/y/scale/filter 等 10 个白名单属性的
 * MotionValue style，Animate 用 `style={scrollResult.style}` 绑到 motion 元素上。
 * framer-motion 里 style 上的 MotionValue 优先级高于 controls.start()，
 * 因此 infiniteAnimation **无法**驱动这 10 个属性中的任何一个（实测：直接写
 * opacity 的 lane 永远停在 1）。见 memory `infinite-lane-cannot-drive-whitelist-props`。 */
const TWINKLE_CHANNELS = [2, 3, 5, 7, 11, 13, 17, 19, 23] as const;
const STAR_COUNT = 54;

/** 固定种子 LCG（数值取自 Numerical Recipes）。要的是「看起来随机」+ 可复现。 */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Star {
  /** 百分比坐标，写进 inline style 的 left/top */
  x: number;
  y: number;
  /** 直径 px（远小近大） */
  size: number;
  /** 主频道索引 → 读 `--twinkle-{chA}` */
  chA: number;
  /** 副频道索引（**必与 chA 不同**）→ 读 `--twinkle-{chB}` */
  chB: number;
  /** 主频道权重 0.35–0.65；副频道权重是 1 − w。逐星不同 ⇒ 合成波形逐星不同。 */
  w: number;
  /** 该星自己的亮度区间，制造「有的星闪得狠、有的只微微起伏」（只改振幅，不改相位） */
  lo: number;
  hi: number;
  /** 偏暖(1)还是偏冷白(0)——星野不该只有一种白 */
  warm: number;
}

/** 生成星野。纯函数 + 固定种子 ⇒ 每次刷新同一片星空，改星野时可对照调试。 */
function buildStars(count: number, seed = 20260806): Star[] {
  const rnd = makeRng(seed);
  const n = TWINKLE_CHANNELS.length;
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    // size 用平方分布：小星远多于大星（真实星野的亮度分布也是长尾）
    const r = rnd();
    const size = +(0.9 + r * r * 2.4).toFixed(2);
    // 暗星闪烁幅度大、亮星幅度小 —— 亮星整片乱闪会显得廉价
    const bright = 0.22 + rnd() * 0.5;
    const swing = (0.55 - bright * 0.45) * (0.5 + rnd());
    /* 两条**不同**频道 + 逐星权重 = 逐星不同的合成波形。
     * chB 用 `(chA + 1 + k) % n` 取偏移而不是重抽随机数，是为了保证 **chB ≠ chA**
     * （重抽有概率撞上自己，那颗星就退化回单频道、又变成同相候选）。 */
    const chA = Math.floor(rnd() * n);
    const chB = (chA + 1 + Math.floor(rnd() * (n - 1))) % n;
    stars.push({
      x: +(rnd() * 100).toFixed(2),
      y: +(rnd() * 100).toFixed(2),
      size,
      chA,
      chB,
      // 0.35–0.65：两条都保持可观权重。太接近 0/1 会退化成单频道、重新同相。
      w: +(0.35 + rnd() * 0.3).toFixed(3),
      lo: +Math.max(0.04, bright - swing).toFixed(3),
      hi: +Math.min(1, bright + swing).toFixed(3),
      warm: rnd() < 0.38 ? 1 : 0,
    });
  }
  return stars;
}

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
  // 星野只在挂载时算一次（固定种子 ⇒ 每次刷新同一片星空，且 SSR/水合一致）。
  // 不进任何每帧路径：闪烁全靠 9 条 lane 写 CSS 变量。
  const stars = useMemo(() => buildStars(STAR_COUNT), []);
  const rootRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const stageRef = useRef<CinemaStage>('idle');
  const embedReadyRef = useRef(false);
  const liveRef = useRef(false);
  const interactiveRef = useRef(false);
  const [stage, setStage] = useState<CinemaStage>('idle');
  const [live, setLive] = useState(false);
  /** 分栏态：手机左移 + 右栏标题/副标题出现。由子页 `cineview-embed-finished` 触发。 */
  const [split, setSplit] = useState(false);
  const [interactive, setInteractive] = useState(false);

  const sendActivate = useCallback((): void => {
    const target = iframeRef.current?.contentWindow;
    if (!target || liveRef.current) return;
    target.postMessage('cineview-activate', window.location.origin);
    liveRef.current = true;
    setLive(true);
  }, []);

  const handleProgress = useCallback(
    (value: number): void => {
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
    },
    [sendActivate]
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
         手机移到左侧、右栏标题+副标题出现。用户指定的时序就是这一刻，
         不是 progress 到 1、也不是 drag 进行中（那两者手指可能还没松）。
         2026-08-09 起分栏改为**双向**（用户访谈裁决「退场 = 完整反向编排」）：
         子页 commit 离开末幕发 `cineview-embed-unfinished` ⇒ 分栏镜像退场
         （副标题先出 → 标题出 → 手机移回居中，时序由 CSS 分方向 delay 承担）。
         两向消息均幂等。整幕滚出视口时随 latch 一起重置（见下方 freeze effect）。 */
      if (event.data === 'cineview-embed-finished') {
        setSplit(true);
      } else if (event.data === 'cineview-embed-unfinished') {
        setSplit(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return (): void => window.removeEventListener('message', handleMessage);
  }, [sendActivate]);

  // 场景整体离开视口 → freeze + 卸载 iframe + 重置 latch（重新进入时从头重放）。
  // 末幕向下无后继，唯一退场路径是向上滚出。可见退场 = 分栏镜像退出（unfinished 消息）
  // + zone 三段反向 scrub，都在视口内播放；本 effect 是视口外的最终清理（用户滚离后
  // iframe 还在后台跑才是浪费），不挂 exitAnimation 的裁决不变（架构细化 #5）。
  useEffect(() => {
    const node = rootRef.current;
    if (node === null || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry || entry.isIntersecting) return;
      if (stageRef.current === 'idle') return;
      // freeze 属防御性冗余（同 tick 随后卸载 iframe 才是主路径），belt-and-braces
      iframeRef.current?.contentWindow?.postMessage('cineview-freeze', window.location.origin);
      stageRef.current = 'idle';
      embedReadyRef.current = false;
      liveRef.current = false;
      interactiveRef.current = false;
      setStage('idle');
      setLive(false);
      setInteractive(false);
      // 分栏态随 latch 一起重置：重进本幕时手机应回到居中、右栏收起，从头重放。
      setSplit(false);
    });
    observer.observe(node);
    return (): void => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="scene5-cinema" data-cinema-stage={stage} data-lang={lang}>
      {/* 熄灯 overlay：0–40% 线性变黑（终点 0.94，留一线暖底）；背景之上、星光之下。
          ⚠️ 本 lane 的包装层在 CSS 挂了一条 1050ms 线性 opacity transition
          (Scene5Cinema.css `[data-cineview-animate-id='cinema-lightsoff']`)——
          把滚轮离散档位摊成逐帧斜坡,修 N13 的输入量化频闪(2026-08-10)。
          若日后改这条 lane 的 animateId,CSS 选择器要同步改。 */}
      <Animate
        animateId="cinema-lightsoff"
        enterAnimation={lightsOffVariant()}
        duration={{ enter: 640 }}
        /* 整幕相位（C-act5）：退场要与入场镜像，故不能只覆盖 0→CREATE_AT。
           关键帧把入场/hold/退场三段切在 0.4 / 0.6 上，见 lightsOffVariant 注释。 */
        timeline={{ phase: { start: 0, end: 1 } }}
      >
        <div className="scene5-cinema__overlay" aria-hidden="true" />
      </Animate>

      {/* 星光：黑幕之上、手机之下。三层写死星点的 radial-gradient，各自一条
          infinite lane 驱动 opacity（周期 3.7/5.3/8.1s，互不同步）。 */}
      {/* 星光：黑幕之上、手机之下。9 条闪烁频道 lane 各写一个 CSS 变量
          （--twinkle-0..8，周期互质），54 颗星按种子随机分配频道 + 各自亮度区间
          ⇒ 逐星独立闪烁。星点是真实 DOM 元素（不再是 radial-gradient 背景），
          因为每颗星要读不同的频道变量、有不同的 lo/hi。
          嵌套结构：9 层 Animate 各只负责写自己的变量，星野作为最内层的兄弟节点
          继承全部 9 个变量 —— 这样只需 9 条 lane，而不是 54 条。 */}
      <div className="scene5-cinema__stars" aria-hidden="true">
        {TWINKLE_CHANNELS.reduce(
          (inner, period, index) => (
            <Animate
              key={`ch-${index}`}
              animateId={`cinema-twinkle-${index}`}
              infiniteAnimation={{
                animate: {
                  [`--twinkle-${index}`]: [0, 1, 0],
                  transition: { duration: period, ease: 'easeInOut', repeat: Infinity },
                },
              }}
              timeline={{ phase: { start: 0, end: CREATE_AT } }}
            >
              {inner}
            </Animate>
          ),
          (
            <div className="scene5-cinema__star-field">
              {stars.map((s, i) => (
                <span
                  key={i}
                  className={`scene5-cinema__star${s.warm ? ' is-warm' : ''}`}
                  style={{
                    left: `${s.x}%`,
                    top: `${s.y}%`,
                    width: `${s.size}px`,
                    height: `${s.size}px`,
                    /* 两条频道的加权混合 ⇒ 逐星不同的合成波形（见 TWINKLE_CHANNELS 注释）。
                       混合在 CSS calc() 里完成，不新增 JS 每帧成本。 */
                    ['--star-t' as string]:
                      `calc(var(--twinkle-${s.chA}, 0) * ${s.w}` +
                      ` + var(--twinkle-${s.chB}, 0) * ${+(1 - s.w).toFixed(3)})`,
                    ['--star-lo' as string]: String(s.lo),
                    ['--star-hi' as string]: String(s.hi),
                  }}
                />
              ))}
            </div>
          ) as JSX.Element
        )}
      </div>

      {/* 放映机光锥已删除（2026-08-06 用户指令：「不要灯光，只要闪烁的星光」）。
          「太方正」的成因是它用 clip-path polygon 切硬边梯形，四条直边在极淡暖白上
          仍可辨，读作几何色块而非光。氛围改由随机闪烁星光独立承担。 */}

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

          {/* 右栏：标题 + 副标题。只在分栏态可见（CSS 控 width/opacity）。
              标题不再有流光扫掠 —— 那套 background-clip:text + text-fill:transparent
              的写法会让未被光束覆盖的字**根本不绘制**，就是用户说的「总是缺一半」。
              现在纯 color 实心绘制。副标题为本轮新设计（见 CSS 注释）。
              这两行是**真实可读内容**，分栏后屏幕阅读器应当读到，所以不能无条件
              `aria-hidden`。
              ⚠️ 但**必须按状态开关**（2026-08-08 对抗复审发现）：未分栏时右栏是靠
              `width: 0` + `opacity: 0` + `overflow: hidden` 隐藏的，而这三者**都不会**
              把元素移出可访问性树 —— 屏幕阅读器会从**进入本幕起**就念出标题与副标题，
              与 D3 的时序意图（滑到结尾且 commit 完成才出标题）矛盾，视觉与朗读两条通道
              时序不一致。故绑到 `split`：视觉上不可见时同步对辅助技术隐藏。 */}
          <div className="scene5-cinema__text-col" aria-hidden={!split}>
            <p className="scene5-cinema__title-text">{t('scene5.title')}</p>
            <p className="scene5-cinema__subtitle-text">{t('scene5.subtitle')}</p>
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

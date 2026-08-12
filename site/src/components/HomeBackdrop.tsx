import { useEffect, useRef } from 'react';
import './HomeBackdrop.css';

/**
 * 首页无级色带承载层（C1 重做，2026-08-10）。
 *
 * ── 为什么从 background 换成 DOM 元素 ─────────────────────────────────────
 * 旧实现把「色相长带」写成 `.cineview-container` 上的第二层 background，靠
 * `background-attachment: local` 随内容滚动。
 * 用户报障：滚动时**某一帧整块暖橙盖住画面、下一帧又变回暖白**（停住不闪，只有滚动才闪）。
 *
 * ⚠️⚠️ **这次重做没有证实的病因，不要把它当成「已修好用户报的那个闪」的证据。**
 * 同日两轮 subagent 实测把我先后写下的**两个**归因都打掉了（探针与数据见
 * `review/20260810-c1/` 与 `review/20260810-c1/adv/`）：
 *   1. 「`local` 由主线程定位、滚动由合成器推进 ⇒ 一帧错位」——**算不出症状**。
 *      带最陡锚段斜率 0.0014 lum/px，实测滞后上界 11.4px 带坐标 ⇒ Δlum 0.39
 *      （`A-lag.json`）。一两个颜色单位不可能读作「整屏变暖橙」。
 *   2. 「`local` 把长带并入滚动内容层 ⇒ 每次滚动整层重新分块光栅 ⇒ 错 tile = 整屏错色」
 *      ——**实测不存在**。运行时注回等价旧实现后，那层的 `paintCount` 在 24000px 滚动
 *      前后恒为 1（Δ0，`adv/raster.json`）；而且它是 1440×32500 的层，4800vh 名义高度
 *      从未被光栅过。唯一真的「每滚一帧重画一个视口层」的是 `attachment: fixed` 的
 *      明度纱（经典 repaint-on-scroll），但它掉一帧的整屏幅度只有 ΔR−B 3.15–4.80
 *      （`adv/veil-amp.json`），够不上「整屏暖橙」所需的约 15 单位。
 *
 * 也就是说：**背景层从来没被证明是那个闪的来源。** 全页唯一测得的 ≥10 单位整屏色相
 * 阶跃全部来自内容层，最像用户报障的是 **Act4 结束到 Act5 熄灯之间约 1400px 的裸色带段**
 * （sy 28200 整屏 R−B 15.8 → 28400 25.1 → 28600–29400 稳定 33.1 → 29600 才压暗；
 * 前接 Act4 近中性淡幕、后接黑幕，400px/帧快滚时只有 3–4 帧 ⇒ 观感正是
 * 「暖白 → 整屏暖橙一闪 → 暗」）。该段在注回旧实现时同样存在，与本次重做无关，
 * 属幕间构图缺口 —— 见 task-flow `2026-08-10-…-flicker.md` 的 N14。
 *
 * 那本次重做凭什么留下？凭**它自己被实证的收益**，不是凭治好了那个闪：
 *   - 滚动**零重画**：band 层 `paintCount` Δ0；旧实现的 `fixed` 明度纱是每帧重画一个
 *     视口层，现在纱不再挂 background-attachment，那 60 次/手势的重画消失了。
 *   - 单帧误差可忽略：隔离测量（`.home-scene{opacity:0}`）350 帧内单帧最大
 *     Δ(R−B) = 0.49，比 12 的判据低 24 倍。
 *   - 带高与映射不再靠猜（见下方「带高与映射」）。
 * 若日后要评估「是否值得留」，请拿这三条去比，别再引用任何机制故事。
 *
 * 现方案（用户裁决 A：保留「无级连续」，不退化为纯色台阶）：
 *   长带改由**本组件的 DOM 元素**承载，钉在视口（`position: fixed`），
 *   平移用 **`transform: translate3d`**（只在合成器侧生效，滚动不重画）；
 *   渐变本身仍是真 `linear-gradient`，**无级连续**不打折。
 *
 * ── 为什么挂在 CineView **外面** ────────────────────────────────────────
 * takeover 场景内 `position: fixed` 必然降级（ScrollSceneSlot 恒给 takeover content
 * 加 transform，任何非 none 的 transform 都会成为 fixed 的包含块 ——
 * 见 memory `takeover-fixed-always-degrades`）。故本层必须是 CineView 的**兄弟节点**，
 * 且其祖先链（`.home-page`）不得有 transform。滚动容器外层 wrapper 实测无 transform、
 * 无 overflow（`DirectScrollCineView.tsx:488-494`），fixed 相对视口定位成立。
 * 层级：本层在 DOM 中**先于** CineView，两者 z-index 同级（0/auto）⇒ 按 DOM 序绘制，
 * 本层恒在所有场景内容之下。
 *
 * ── 带高与映射（不再写死 4800vh）──────────────────────────────────────
 * 旧实现取 `background-size: 100% 4800vh` + 1:1 跟随滚动，是按「最矮窗口的文档高」
 * 猜出来的常量，高窗下只走到色带 55%（旧注释自陈）。现改**比例映射**：
 *   `translateY = -progress × (带高 − 视口高)`，progress = scrollTop / 最大可滚
 * 于是「带的顶端 → 底端」恰好在整个文档滚完时走完，与文档实际高度无关。
 *
 * ⚠️ 带高 **600vh 是实测定的，不能随手改小**（首版取 200vh，被验收 D 项判 FAIL）：
 * 决定「滚动时屏幕颜色变不变」的不是带高本身，而是**视口一次看到色带的多少**。
 *   200vh：视口恒显示色带的 50% ⇒ 屏内是一条大纵向渐变，而每滚一屏带只移 25.6px
 *          （可见窗口的 2.8%）⇒ 屏幕整体颜色几乎不随滚动变，锚色 18 单位的明度落差
 *          被空间平均掉。实测 Act3 剖面平均亮度 225.2–230.2 vs Act1 229.1，
 *          「中段明度下沉」等于消失（`review/20260810-c1/D2-warm-profile.json`）。
 *   600vh：视口恒显示 1/6 ⇒ 屏内接近平色；每滚一屏走过色带约 2.4%，
 *          与旧实现的 2.08%/屏 同量级 ⇒ 「滚动时色相缓慢改变」的观感回来了。
 * 隔离实测（`adv/mapping-v2.json`，21 档、内容隐藏、整屏均值）：
 *   整屏 R−B 摆幅 旧 12.20 / 200vh 4.42 / **600vh 10.96**
 *   整屏亮度摆幅 旧 14.98 / 200vh 3.9 / **600vh 11.17**
 *   明度剖面 600vh 是 236.1→228.7→224.9→224.9→230.2（中段下沉后回暖，走过色带 83.3%），
 *   旧实现是 239.0→232.9→229.2→228.1→227.9（单调下降、末段回不来，只走过 73%）。
 * 代价：band 是全页最大的常驻提层，1440×(6×视口高)，1440×900 视口下约 **30MB**，
 * 换来的是滚动零重画（`paintCount` Δ0）。
 * ⚠️ 不要再把它和「旧方案 249MB」对比 —— 那个数字是背景图的**名义高度**换算，
 * 从未被分配；旧滚动内容层名义 1440×32500 也靠分块只画一次。名义面积 ≠ 实际开销。
 * 带高只写在 CSS 里，JS 通过 `offsetHeight` 读回（见 measure()），改 CSS 不需要动 JS。
 *
 * ── 每帧成本 ────────────────────────────────────────────────────────────
 * 仅在 scroll 事件期间用一次 rAF 合并写入 `transform`（空闲时**零** rAF、零轮询），
 * 不 setState、不进 React render —— 与 `FilmTimelineProjection` 同款「读进度 → 写 DOM」
 * 投影写法（CLAUDE.md 规则 2）。全局 scrollTop 没有对应的框架 MotionValue
 * （zone timeline 是分幕语义），故直接读容器 scrollTop 是必要的。
 */
export function HomeBackdrop(): JSX.Element {
  const bandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const band = bandRef.current;
    if (band === null) return;

    let scroller: HTMLElement | null = null;
    let observer: ResizeObserver | null = null;
    let frame = 0;
    let disposed = false;
    /** 带高缓存：每帧读 offsetHeight 会构成布局读；只在挂载/resize 时测一次。 */
    let bandTravel = 0;

    const measure = (): void => {
      if (scroller === null) return;
      // 平移满程 = 带高 − 视口高。带高由 CSS 唯一决定（`.home-backdrop__band`），
      // 这里从 DOM 读回，避免「改 CSS 必须同步改 JS 系数」的隐式耦合。
      bandTravel = Math.max(0, band.offsetHeight - scroller.clientHeight);
    };

    const write = (): void => {
      frame = 0;
      if (scroller === null) return;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / max)) : 0;
      const shift = Math.round(progress * bandTravel * 100) / 100;
      band.style.transform = `translate3d(0, ${-shift}px, 0)`;
    };

    const remeasure = (): void => {
      measure();
      schedule();
    };

    const schedule = (): void => {
      if (frame !== 0 || disposed) return;
      frame = requestAnimationFrame(write);
    };

    // 容器由 CineView 在同一次提交里渲染，effect 运行时通常已在 DOM；
    // 仍留一轮 rAF 重试，避免将来渲染时序变化导致静默失效。
    const attach = (): void => {
      if (disposed) return;
      scroller = document.querySelector<HTMLElement>('[data-cineview-container="true"]');
      if (scroller === null) {
        requestAnimationFrame(attach);
        return;
      }
      scroller.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', remeasure);
      /* 容器尺寸可以在**没有** window resize 的情况下变化（框架 `refreshLayout()`、
       * 移动端 URL bar 收放、字体加载后回流）。只挂 window.resize 会让 bandTravel 过期
       * ⇒ 末段走不到或走过头。ResizeObserver 覆盖这一路（对抗复审指出的残留口）。 */
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(remeasure);
        observer.observe(scroller);
      }
      measure();
      write();
    };
    attach();

    return (): void => {
      disposed = true;
      if (frame !== 0) cancelAnimationFrame(frame);
      observer?.disconnect();
      scroller?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', remeasure);
    };
  }, []);

  return (
    <div className="home-backdrop" aria-hidden="true">
      {/* 色相长带：唯一随滚动移动的层（transform，合成器） */}
      <div ref={bandRef} className="home-backdrop__band" />
      {/* 明度纱：视口锁定、永不移动。上亮下沉的固定 falloff 让**每一屏**自带上→下渐变；
          因为它不动，屏边界处不可能有跳变，接缝被结构性消除（而非靠调色掩盖）。
          绘制在带之上（DOM 序在后）。 */}
      <div className="home-backdrop__veil" />
    </div>
  );
}

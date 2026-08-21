import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { lutAt } from '../design/lut';

/**
 * 全站背景色带层 + 当前镜头强调色驱动（初版机制还原，2026-08-13）。
 *
 * 源自 task-flow 2026-06-30-official-site-docs.md 的锁定方案「全站总进度驱动 +
 * 上下双端 linear-gradient 插值 + 停靠点数组可配」（f164470 快照同名组件即其实现），
 * 用户裁决 2026-08-13「只还原这个」。C1 的 600vh 色带 + 明度纱（HomeBackdrop）
 * 因灰粉交替闪烁、30MB 提层、无 accent 流动等报障整组退役。
 *
 * 消费 CineView 内部滚动容器的 scrollTop（A1/A2 决策：scroll 模式滚动源是内部
 * 容器，不是 window/document），按 LUT 在停靠点间插值出上下双端渐变色 + 当前镜头
 * 强调色，写入 :root 的 CSS 变量：
 *   --bg-grad-top / --bg-grad-bot —— 固定全屏渐变层的两端色
 *   --accent / --accent-ink       —— 随滚动流动的「当前镜头色」（滚动条/按钮/选区）
 *
 * ⚠️ 与初版实现的差异（当前结构适配）：
 *   - 初版经 React state 每帧 setProgress 重渲染——违反现行 CLAUDE.md 规则 2
 *     （每帧 setState 禁）。现改为滚动事件上的量化 CSS 变量投影，零 React render、
 *     零自建 DOM 动画帧循环；LUT key 去重把同一停靠点内的事件变成 no-op。
 *   - `.bg-ribbon` 的 `transition: background 0.18s linear` 保留（初版结构一致）；
 *     ⚠️ 验收实测 Chromium 对渐变 transition 是惰性 CSS（不插值）——真正的防闪
 *     因子是 LUT 浅斜率（全页 33700px 仅 ~26 lum 摆幅，滚轮 -120/-400 档实测
 *     单帧 ≤1.67 lum）；瞬时大跳变（End 键/程序化）单帧可达 ~21 lum，属已知
 *     残余，交给真实浏览器验收确认，不在此处另建动画帧循环。
 *   - 量化去重：四个色值不变时不写变量（LUT 相邻停靠间约每 60-100px 才变一次）。
 */
export function BackgroundRibbon(): JSX.Element {
  const { pathname } = useLocation();

  useEffect(() => {
    let scroller: HTMLElement | null = null;
    let disposed = false;
    let lastKey = '';
    let resizeObserver: ResizeObserver | null = null;

    const write = (): void => {
      if (scroller === null) return;
      // ResizeObserver on the scroll container only observes its border/content
      // box. Async descendants can grow scrollHeight without changing that box,
      // so the scroll event itself must refresh the denominator before projecting
      // the LUT. Read metrics before writing root styles to avoid read-after-write
      // layout work in the same handler.
      const maxScroll = Math.max(scroller.scrollHeight - scroller.clientHeight, 0);
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / maxScroll)) : 0;
      const { top, bot, accent, accentInk } = lutAt(progress);
      const key = `${top}|${bot}|${accent}|${accentInk}`;
      if (key === lastKey) return;
      lastKey = key;
      const root = document.documentElement;
      root.style.setProperty('--bg-grad-top', top);
      root.style.setProperty('--bg-grad-bot', bot);
      root.style.setProperty('--accent', accent);
      root.style.setProperty('--accent-ink', accentInk);
    };

    const clearRootLut = (): void => {
      const root = document.documentElement;
      root.style.removeProperty('--bg-grad-top');
      root.style.removeProperty('--bg-grad-bot');
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-ink');
      lastKey = '';
    };

    const refreshMetrics = (): void => {
      if (scroller === null) return;
      write();
    };

    const detach = (): void => {
      if (scroller !== null) {
        scroller.removeEventListener('scroll', write);
      }
      resizeObserver?.disconnect();
      resizeObserver = null;
      scroller = null;
      clearRootLut();
    };

    const attach = (next: HTMLElement | null): void => {
      if (disposed || next === scroller) return;
      detach();
      if (next === null) return;

      scroller = next;
      scroller.addEventListener('scroll', write, { passive: true });
      refreshMetrics();
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(refreshMetrics);
        resizeObserver.observe(scroller);
      }
    };

    const reconcile = (): void => {
      if (disposed) return;
      const next = document.querySelector<HTMLElement>('[data-cineview-container="true"]');
      if (next === null) {
        if (scroller !== null) detach();
        else clearRootLut();
        return;
      }
      if (next !== scroller || (scroller !== null && !scroller.isConnected)) {
        attach(next);
        return;
      }
      // A same-container DOM mutation may change overflow without changing the
      // container's own observed box. Re-project immediately at the current offset.
      refreshMetrics();
    };

    let mutationObserver: MutationObserver | null = null;
    const observationRoot = document.body ?? document.documentElement;
    if (typeof MutationObserver !== 'undefined' && observationRoot !== null) {
      mutationObserver = new MutationObserver(reconcile);
      mutationObserver.observe(observationRoot, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-cineview-container'],
      });
    }
    reconcile();

    return (): void => {
      disposed = true;
      mutationObserver?.disconnect();
      mutationObserver = null;
      detach();
    };
  }, [pathname]);

  return <div className="bg-ribbon" aria-hidden="true" />;
}

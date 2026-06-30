import { useEffect, useState } from 'react';

/**
 * 全站滚动总进度 0..1。驱动背景 LUT 色带 + 左侧胶片边轨时间码。
 *
 * 官网首页整页是一个 `<CineView mode="scroll">` 实例（见 task-flow 架构决策 A1）。
 * scroll 模式的滚动发生在 CineView 内部容器 `.cineview-container`
 * （`data-cineview-container="true"`，`height:100vh; overflowY:scroll`），
 * **不是** window/document 滚动。因此进度源必须读该容器的 scrollTop，
 * 而非 `document.documentElement.scrollTop`。
 *
 * 该容器异步挂载（CineView 内部渲染后才出现），故用 MutationObserver +
 * 轮询兜底定位；定位到后监听其 scroll，用 rAF 节流。
 */
export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    let container: HTMLElement | null = null;

    const read = () => {
      raf = 0;
      if (!container) return;
      const max = container.scrollHeight - container.clientHeight;
      const p = max > 0 ? container.scrollTop / max : 0;
      setProgress(p < 0 ? 0 : p > 1 ? 1 : p);
    };

    const onScroll = () => {
      if (raf === 0) raf = window.requestAnimationFrame(read);
    };

    const attach = (el: HTMLElement) => {
      if (container === el) return;
      if (container) container.removeEventListener('scroll', onScroll);
      container = el;
      container.addEventListener('scroll', onScroll, { passive: true });
      read();
    };

    const find = (): boolean => {
      const el = document.querySelector<HTMLElement>('[data-cineview-container="true"]');
      if (el) {
        attach(el);
        return true;
      }
      return false;
    };

    // 容器可能尚未挂载:先试一次,没有就用 MutationObserver 等它出现。
    let observer: MutationObserver | null = null;
    if (!find()) {
      observer = new MutationObserver(() => {
        if (find() && observer) {
          observer.disconnect();
          observer = null;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      if (container) container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (observer) observer.disconnect();
    };
  }, []);

  return progress;
}

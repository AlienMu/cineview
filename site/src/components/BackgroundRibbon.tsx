import { useEffect } from 'react';
import { lutAt } from '../design/lut';
import { useScrollProgress } from '../hooks/useScrollProgress';

/**
 * 全站背景色带层 + 当前镜头强调色驱动。
 *
 * 消费全站滚动总进度(见 useScrollProgress / task-flow A1),按 LUT 在停靠点间
 * 插值出上下双端渐变色 + 当前镜头强调色,写入 :root 的 CSS 变量:
 *   --bg-grad-top / --bg-grad-bot —— 固定全屏渐变层的两端色
 *   --accent / --accent-ink       —— 随滚动流动的"当前镜头色"(按钮/链接/选区)
 *
 * 渲染一个 position:fixed 的全屏层承载渐变(在 CineView 滚动容器之下),
 * CineView 容器本身背景透明,让色带透出。
 */
export function BackgroundRibbon(): JSX.Element {
  const progress = useScrollProgress();

  useEffect(() => {
    const { top, bot, accent, accentInk } = lutAt(progress);
    const root = document.documentElement;
    root.style.setProperty('--bg-grad-top', top);
    root.style.setProperty('--bg-grad-bot', bot);
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-ink', accentInk);
  }, [progress]);

  return <div className="bg-ribbon" aria-hidden="true" />;
}

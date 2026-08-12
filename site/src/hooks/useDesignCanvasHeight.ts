import { useEffect, useState } from 'react';

/** 手机版断点。CSS 侧 `Act3DollyScene.css` 的 `@media (max-width: 600px)` 必须用同一个值。 */
export const PHONE_MAX_WIDTH = 600;

/** 首页设计画布的宽基准，与 `HomePage` 的 `config={{ size: 1440 }}` 同源。 */
const DESIGN_WIDTH = 1440;

/** 桌面画布高（设计 px），即 `HomeSceneCanvas` 的默认值。 */
const DESKTOP_DESIGN_HEIGHT = 900;

export interface DesignCanvasHeight {
  /** 视口宽 ≤ PHONE_MAX_WIDTH。手机版布局（2 列 ×3 行）的开关。 */
  phone: boolean;
  /**
   * 设计画布应声明的高度（设计 px）。
   * 桌面恒 900；手机取 `1440 * vh / vw` —— 即「画布正好等于一个视口高」的设计 px 等价值。
   */
  designH: number;
}

/**
 * 首页设计画布高度 / 手机版开关。
 *
 * 为什么手机需要另一个画布高：`config.size=1440` +「认宽不认高」⇒ `--cineview-unit = vw/1440`，
 * 390 宽时 u=0.2708，声明 1440×900 的画布实际只有 **390×244**，占 844 视口高的 29% ——
 * 六块与收尾标题全被压进顶部一条带里。画布的定位容器（`.capability-full`）填满画布，
 * 故把画布高提到「一个视口」即可让六块用满竖屏（实测：244→844 时六块整体下移 300 =
 * (844−244)/2）。详见 task-flow `2026-08-04-act3-phone-layout.md`。
 *
 * **不进每帧热路径**：只订阅 `resize` 与 media query 的 `change`。返回值用于 render 期的
 * 布局数据计算（panel 坐标 / peak scale），不参与 scrub 每帧映射（CLAUDE.md 自检 4）。
 */
export function useDesignCanvasHeight(): DesignCanvasHeight {
  const [state, setState] = useState<DesignCanvasHeight>(() => read());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const sync = (): void =>
      setState((prev) => {
        const next = read();
        // 同值不换引用：避免 resize 抖动引起无意义重渲染。
        return prev.phone === next.phone && prev.designH === next.designH ? prev : next;
      });

    sync();
    window.addEventListener('resize', sync);

    const mql =
      typeof window.matchMedia === 'function'
        ? window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`)
        : null;
    mql?.addEventListener('change', sync);

    return (): void => {
      window.removeEventListener('resize', sync);
      mql?.removeEventListener('change', sync);
    };
  }, []);

  return state;
}

function read(): DesignCanvasHeight {
  if (typeof window === 'undefined') {
    return { phone: false, designH: DESKTOP_DESIGN_HEIGHT };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const phone = vw <= PHONE_MAX_WIDTH;
  if (!phone || vw <= 0) {
    return { phone: false, designH: DESKTOP_DESIGN_HEIGHT };
  }
  // 画布 = 一个视口高，换算回设计 px：vh / u，其中 u = vw / 1440。
  return { phone: true, designH: Math.round((DESIGN_WIDTH * vh) / vw) };
}

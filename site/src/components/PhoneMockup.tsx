import { Animate } from 'cineview';
import type { ReactNode } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import './Scene5Cinema.css';

/**
 * 手机 mockup：332×720 设计基准（19.5:9），CSS `max-height:75vh` 等比钳制。
 *
 * 呼吸 box-shadow（3s）与径向光晕（5s）按 CLAUDE.md 规则 6 走 infiniteAnimation
 * （禁 CSS `animation: … infinite`）：infinite-only lane 由 scene runtimeState 门控，
 * 场景离场自动 stop。lane 循环写 CSS 变量（--phone-breathe / --glow-pulse，沿用
 * film-pan `--film-perf-phase` 模式），阴影/光晕在 CSS 里 calc() 消费——变量落在
 * Animate 的包装 motion 元素上并继承给持有圆角的真实元素，避免方角阴影。
 * 3s/5s 异周期（LCM 15s）保证两层 beats 不同步叠加。
 */
export function PhoneMockup({ children }: { children: ReactNode }): JSX.Element {
  const reduced = usePrefersReducedMotion();
  const frame = (
    <div className="phone-mockup__frame">
      <span className="phone-mockup__notch" aria-hidden="true" />
      <div className="phone-mockup__screen">{children}</div>
    </div>
  );
  const glow = <div className="phone-mockup__glow" aria-hidden="true" />;

  return (
    <div className="phone-mockup">
      {reduced ? (
        glow
      ) : (
        <Animate
          animateId="cinema-phone-glow"
          infiniteAnimation={{
            animate: {
              '--glow-pulse': [0, 1, 0],
              transition: { duration: 5, ease: 'easeInOut', repeat: Infinity },
            },
          }}
        >
          {glow}
        </Animate>
      )}
      {reduced ? (
        frame
      ) : (
        <Animate
          animateId="cinema-phone-breathe"
          infiniteAnimation={{
            animate: {
              '--phone-breathe': [0, 1, 0],
              transition: { duration: 3, ease: 'easeInOut', repeat: Infinity },
            },
          }}
        >
          {frame}
        </Animate>
      )}
    </div>
  );
}

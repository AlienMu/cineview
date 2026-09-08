import { useState } from 'react';
import { Animate, Position } from 'cineview';
import { useI18n } from '../i18n';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { IconClapper } from './CapabilityIcons';
import './PositionLoopScene.css';

const LOOP = {
  animate: {
    y: ['0%', '-20%', '0%'],
    transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
  },
};

function configuration(x: number, y: number, loop: boolean): string {
  const animation = loop
    ? `{{ animate: {
      y: ['0%', '-20%', '0%'],
      transition: { duration: 2.4,
        repeat: Infinity, ease: 'easeInOut' }
    } }}`
    : '{undefined}';
  return `<Position at={{ anchor: 'center', x: ${x}, y: ${y} }}>
  <Animate timeline={{ driver: 'clock' }}
    enterAnimation="fade-in" duration={{ enter: 0 }}
    loopAnimation=${animation}>
    <IconClapper size={64} />
  </Animate>
</Position>`;
}

/** Input events change authored coordinates; Animate owns every loop frame. */
export function PositionLoopScene(): import('react').JSX.Element {
  const { lang } = useI18n();
  const isChinese = lang === 'zh';
  const reduced = usePrefersReducedMotion();
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const shouldLoop = loopEnabled && !reduced;
  const code = configuration(x, y, shouldLoop);

  function reset(): void {
    setX(0);
    setY(0);
    setLoopEnabled(false);
    setCopyStatus('idle');
  }

  async function copyConfiguration(): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <section className="position-loop-scene" data-lang={lang} aria-labelledby="position-loop-title">
      <header className="position-loop-scene__header">
        <p className="position-loop-scene__slate">04 / POSITION + LOOP</p>
        <h2 id="position-loop-title" className="position-loop-scene__title">
          {isChinese ? '调位置，试循环。' : 'Set a position. Try a loop.'}
        </h2>
        <p className="position-loop-scene__intro">
          {isChinese
            ? '拖动 X、Y 滑块移动场记板，再开启循环。参数可以直接复制。'
            : 'Move the clapperboard with X and Y, then turn on its loop. Copy the settings to use them.'}
        </p>
      </header>

      <div className="position-loop-playground">
        <figure
          className="position-loop-stage"
          aria-label={isChinese ? '位置预览' : 'Position preview'}
        >
          <div className="position-loop-stage__surface" data-position-stage>
            <span className="position-loop-stage__anchor" aria-hidden="true">
              anchor: center
            </span>
            <span
              className="position-loop-stage__axis position-loop-stage__axis--x"
              aria-hidden="true"
            >
              X
            </span>
            <span
              className="position-loop-stage__axis position-loop-stage__axis--y"
              aria-hidden="true"
            >
              Y
            </span>
            <span className="position-loop-stage__origin" aria-hidden="true">
              0, 0
            </span>
            <Position
              at={{ anchor: 'center', x, y }}
              className="position-loop-target-position"
              data-position-target
              data-x={x}
              data-y={y}
            >
              <Animate
                key={shouldLoop ? 'loop' : 'static'}
                animateId="position-playground-target"
                enterAnimation="fade-in"
                duration={{ enter: 0 }}
                timeline={{ driver: 'clock' }}
                visibility={{ replay: false, enterMargin: 0, exitMargin: 0 }}
                loopAnimation={shouldLoop ? LOOP : undefined}
              >
                <div className="position-loop-target" aria-hidden="true">
                  <IconClapper size={64} />
                </div>
              </Animate>
            </Position>
          </div>
          <figcaption className="position-loop-stage__caption">
            <span>{isChinese ? '相对中心偏移' : 'Offset from center'}</span>
            <output
              className="position-loop-stage__coordinates"
              htmlFor="position-loop-x position-loop-y"
            >
              X {x} / Y {y}
            </output>
          </figcaption>
        </figure>

        <div className="position-loop-settings">
          <fieldset className="position-loop-settings__coordinates">
            <legend>{isChinese ? '位置' : 'Position'}</legend>
            <div className="position-loop-settings__field">
              <label htmlFor="position-loop-x">{isChinese ? 'X 轴位置' : 'X position'}</label>
              <output htmlFor="position-loop-x">{x}</output>
              <input
                className="home-demo-range"
                id="position-loop-x"
                type="range"
                min={-240}
                max={240}
                step={10}
                value={x}
                onChange={(event) => {
                  setX(Number(event.target.value));
                  setCopyStatus('idle');
                }}
                aria-describedby="position-loop-units"
              />
            </div>
            <div className="position-loop-settings__field">
              <label htmlFor="position-loop-y">{isChinese ? 'Y 轴位置' : 'Y position'}</label>
              <output htmlFor="position-loop-y">{y}</output>
              <input
                className="home-demo-range"
                id="position-loop-y"
                type="range"
                min={-120}
                max={120}
                step={10}
                value={y}
                onChange={(event) => {
                  setY(Number(event.target.value));
                  setCopyStatus('idle');
                }}
                aria-describedby="position-loop-units"
              />
            </div>
            <p id="position-loop-units" className="position-loop-settings__hint">
              {isChinese
                ? '单位：设计像素，随视口宽度缩放。'
                : 'Design pixels, scaled with viewport width.'}
            </p>
          </fieldset>

          <div className="home-demo-controls position-loop-settings__actions">
            <label className="position-loop-settings__toggle">
              <input
                type="checkbox"
                checked={loopEnabled}
                onChange={(event) => {
                  setLoopEnabled(event.target.checked);
                  setCopyStatus('idle');
                }}
                aria-describedby="position-loop-motion-note"
              />
              {isChinese ? '循环动画' : 'Loop animation'}
            </label>
            <button type="button" className="home-demo-button" onClick={reset}>
              {isChinese ? '复位' : 'Reset'}
            </button>
          </div>
          <p id="position-loop-motion-note" className="position-loop-settings__hint">
            {reduced
              ? isChinese
                ? '已按系统的减少动态效果设置保持静止。'
                : 'Motion stays still with your reduced-motion preference.'
              : isChinese
                ? '循环只在目标可见时播放，离屏暂停。'
                : 'The loop plays while the target is visible and pauses offscreen.'}
          </p>
        </div>
      </div>

      <div className="position-loop-configuration">
        <div className="position-loop-configuration__heading">
          <span>{isChinese ? '当前配置' : 'Current configuration'}</span>
          <button
            type="button"
            className="home-demo-button"
            onClick={() => void copyConfiguration()}
          >
            {isChinese ? '复制配置' : 'Copy configuration'}
          </button>
        </div>
        <pre
          className="position-loop-configuration__code"
          tabIndex={0}
          aria-label={
            isChinese
              ? '当前 Position 与 Animate 配置'
              : 'Current Position and Animate configuration'
          }
        >
          <code>{code}</code>
        </pre>
        <p className="position-loop-configuration__status" role="status">
          {copyStatus === 'copied'
            ? isChinese
              ? '已复制。'
              : 'Copied.'
            : copyStatus === 'failed'
              ? isChinese
                ? '无法访问剪贴板，请选中上方代码复制。'
                : 'Clipboard unavailable. Select the code above to copy it.'
              : ''}
        </p>
      </div>
    </section>
  );
}

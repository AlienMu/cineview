import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';

/**
 * 时间码胶囊 -- Act 2 两镜的统一签名元素。
 *
 * 左上角小胶囊：镜号 → 分隔线 → REC 红点（常驻呼吸+光晕，纯 CSS keyframes，
 * 挂载即播、贯穿全镜不因场景内容编排暂停）→ "REC" 文字 → 时间读数。
 * 读数随本镜 center-lock 段内滚动进度递增，每镜独立从 0 重新计。
 */
interface TimecodeAxisProps {
  /** 本镜在 Act2 中的序号（1、2...），对应 data-scene-index */
  shotIndex: number;
  /** 本镜读数满格秒数（≈ 本镜滚动预算/1000），默认 9 */
  seconds?: number;
  /**
   * 外部进度(0..1)。提供时读数直接用它 × seconds —— 用于 center-lock 接管镜:
   * 接管场景 DOM 高度恒为视口高(sticky),DOM 测量会瞬间饱和,必须由动画时钟驱动。
   */
  progress?: number;
}

export function TimecodeAxis({ shotIndex, seconds = 9, progress }: TimecodeAxisProps): JSX.Element {
  const { t } = useI18n();
  const [local, setLocal] = useState(0);
  const external = progress != null;

  useEffect(() => {
    if (typeof window === 'undefined' || external) return;
    const findScene = (): HTMLElement | null => {
      const el = document.querySelector(`[data-scene-index="${shotIndex}"]`);
      return el instanceof HTMLElement ? el : null;
    };

    let raf = 0;

    const read = (): void => {
      raf = 0;
      const container = document.querySelector('[data-cineview-container="true"]');
      const scene = findScene();
      if (!container || !scene) {
        setLocal(0);
        return;
      }
      const vh = (container as HTMLElement).clientHeight || window.innerHeight || 1;
      const scrollTop = (container as HTMLElement).scrollTop;
      const sceneOffsetTop = scene.offsetTop;
      const sceneHeight = Math.max(scene.offsetHeight, vh);
      const travel = Math.max(sceneHeight - vh, 1);
      const l = Math.min(Math.max((scrollTop - sceneOffsetTop) / travel, 0), 1);
      setLocal(l);
    };

    const onScroll = (): void => {
      if (raf === 0) raf = window.requestAnimationFrame(read);
    };

    let tries = 0;
    const tryAttach = (): void => {
      if (findScene()) {
        read();
        return;
      }
      if (tries++ < 40) setTimeout(tryAttach, 100);
    };
    tryAttach();

    const container = document.querySelector('[data-cineview-container="true"]');
    if (container) {
      container.addEventListener('scroll', onScroll, { passive: true });
    }
    window.addEventListener('resize', onScroll, { passive: true });
    return (): void => {
      if (raf) window.cancelAnimationFrame(raf);
      container?.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [shotIndex, external]);

  const p = external ? Math.min(Math.max(progress as number, 0), 1) : local;
  const sec = Math.round(p * seconds);
  const readout = `00:00:${String(sec).padStart(2, '0')}`;
  const recLabel = t('cap.tc.rec');

  return (
    <div className="tc-capsule" aria-label={`${recLabel} ${readout}`}>
      <span className="tc-capsule__rec-dot" aria-hidden="true" />
      <span className="tc-capsule__rec-label" aria-hidden="true">
        {recLabel}
      </span>
      <span className="tc-capsule__readout" aria-hidden="true">
        {readout}
      </span>
    </div>
  );
}

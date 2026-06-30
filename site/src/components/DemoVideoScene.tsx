import { memo, useCallback, useLayoutEffect, useRef } from 'react';
import { AnimateVideo, Animate, Position } from 'cineview';
import { useI18n } from '../i18n';
import './DemoVideoScene.css';

/**
 * Demo · 滚动驱动视频(时光副标题版,2026-07-14)
 *
 * center-lock 接管镜。标题快速入场后,视频与副标题并行、同刻收束:
 *   - 视频(demo-video):随滚动逐帧擦洗
 *   - 副标题(demo-subtitle):电影衬线,逐字两层——先黑字 blur→清晰,再从黑替换成
 *     沿整句流转的渐变暖色(覆盖层)。由自身 enterProgress 全程驱动
 */

/** 主标题在 `|` 处分成两段,主句 + 强调追问(斜体点题)。 */
function VideoTitle({ text }: { text: string }): JSX.Element {
  const [head, tail] = text.split('|');
  // 英文 head 以字母/数字结尾需补空格(Perhaps it…);中文 head 以「，」结尾则不加。
  const needSpace = /[A-Za-z0-9]$/.test(head ?? '');
  return (
    <h2 className="demo-video__title">
      <span className="demo-video__title-head">{head}</span>
      {tail ? (
        <em className="demo-video__title-tail">
          {needSpace ? ' ' : ''}
          {tail}
        </em>
      ) : null}
    </h2>
  );
}

/**
 * 沿整句位置 t(0→1)取暖色 [r,g,b]。色带:琥珀金 → 暖橘 → 玫瑰陶土(hue 40→14),
 * 中等饱和 → 相邻位置平滑衔接,连成流过整句的一条暖色带。
 */
function warmAt(t: number): [number, number, number] {
  const tc = Math.min(1, Math.max(0, t));
  const hue = 40 - tc * 26; // 40(金) → 14(陶土)
  const sat = 46 + Math.sin(tc * Math.PI) * 10; // 中段略饱和
  const light = 50 - tc * 5;
  const s = sat / 100;
  const l = light / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = hue / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g2 = 0;
  let b = 0;
  if (hp < 1) [r, g2, b] = [c, x, 0];
  else if (hp < 2) [r, g2, b] = [x, c, 0];
  else [r, g2, b] = [0, c, x];
  const m = l - c / 2;
  return [Math.round((r + m) * 255), Math.round((g2 + m) * 255), Math.round((b + m) * 255)];
}

/** 每个字的固定参数(渲染一次时算好,之后每帧只读不算)。 */
interface CharMeta {
  start: number; // 错峰起点(progress 轴)
  offset0: number; // 初始散开位移(px),合拢后归 0
  lineStart: number; // 所在行合拢起
  lineEnd: number; // 所在行合拢止
  w1: [number, number, number]; // 渐变左端定形暖色
  w2: [number, number, number]; // 渐变右端定形暖色
}

/**
 * 每行的固定参数。blur 施加在行容器上(而非逐字):同一行整体从糊→清,
 * 一行只有一个 blur 层,滚动中任一刻最多 1-2 行的 blur 在变 → 每帧只 1-2 次模糊卷积,
 * 而非几十个字各自卷积。逐字的淡入/位移/颜色仍保留(前两者合成器免费)。
 */
interface LineMeta {
  blurStart: number; // 该行 blur 起点(= 行首字错峰起点)
  blurEnd: number; // 该行 blur 归零点(= 行末字显形完成)
}

const INK: [number, number, number] = [26, 23, 19]; // 墨色起点(非纯黑)

/**
 * 静态字幕子树:132 个字的 span 只按 text 渲染一次(memo on text)→ React 不再逐帧碰它。
 * span 不带任何逐帧样式;每字的固定参数经 onChars 回调交给父组件缓存(见 CharMeta),
 * 由父组件每帧直接写进该字叶子的 inline style。
 *
 * 为什么写叶子而非容器变量:改共同祖先上的自定义属性(如 --p)会让整棵继承子树(132 字)
 * 全部标记 recalc(实测 ~960ms/120帧);改叶子自己的非继承属性(opacity/filter/transform/color)
 * 只失效该叶子(实测 ~38ms,-96%)。故驱动写在叶子。
 */
const StaticSubtitle = memo(function StaticSubtitle({
  text,
  containerRef,
  onChars,
}: {
  text: string;
  containerRef: React.RefObject<HTMLParagraphElement>;
  onChars: (metas: CharMeta[], lineMetas: LineMeta[]) => void;
}): JSX.Element {
  const lines = text.split('\n');
  const total = Math.max(1, text.replace(/\n/g, '').length);
  const metas: CharMeta[] = [];
  const lineMetas: LineMeta[] = [];
  let g = 0; // 跨行全局字序,错峰从第一行流向第二行

  const nodes = lines.map((line, li) => {
    const chars = Array.from(line);
    const center = (chars.length - 1) / 2;
    const firstGi = g;
    const lastGi = g + chars.length - 1;
    const lineStart = (firstGi / total) * 0.6;
    const lineEnd = (lastGi / total) * 0.6 + 0.22; // 与旧实现一致
    // 行级 blur:行首字起点糊→行末字显形完清。整行一个 blur 层。
    lineMetas.push({ blurStart: (firstGi / total) * 0.6, blurEnd: lineEnd });
    const lineNode = (
      <span className="demo-video__subtitle-line" key={li} aria-hidden="true">
        {chars.map((ch, ci) => {
          const gi = g;
          g += 1;
          const t = gi / total;
          metas.push({
            start: (gi / total) * 0.6, // 该字错峰起点
            offset0: (ci - center) * 16, // 初始散开位移(px),合拢后归 0
            lineStart,
            lineEnd,
            w1: warmAt(t - 0.14), // 渐变两端定形暖色(预算)
            w2: warmAt(t + 0.14),
          });
          return (
            <span className="demo-video__subtitle-char" key={ci}>
              {ch === ' ' ? ' ' : ch}
            </span>
          );
        })}
      </span>
    );
    return lineNode;
  });

  // 渲染期收集的 metas 与 DOM 中 .subtitle-char 顺序一致;lineMetas 与 .subtitle-line 一致。
  onChars(metas, lineMetas);

  return (
    <p ref={containerRef} className="demo-video__subtitle" aria-label={text.replace(/\n/g, ' ')}>
      {nodes}
    </p>
  );
});

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * 时光副标题:逐字两层动效(错峰显影 + 沿句流转暖色),全程由 progress(0→1)驱动。
 * 架构(实测定案):span 子树静态(StaticSubtitle,只渲一次);本组件每帧遍历 132 个字节点,
 * 把算好的 opacity/filter/transform/color 直接写进各字叶子的 inline style。
 * 写叶子非继承属性只失效该叶子,不触发子树全量 recalc → recalcStyle 从 ~960ms 降到 ~38ms。
 */
function TimeSubtitle({ text, progress }: { text: string; progress: number }): JSX.Element {
  const ref = useRef<HTMLParagraphElement>(null);
  const metasRef = useRef<CharMeta[]>([]);
  const lineMetasRef = useRef<LineMeta[]>([]);
  const charEls = useRef<HTMLElement[] | null>(null);
  const lineEls = useRef<HTMLElement[] | null>(null);
  // 每个字上一帧是否已定形(颜色到位):定形后跳过写入 → 已完成的字彻底退出重绘。
  const settledRef = useRef<boolean[]>([]);
  // 每行上一帧 blur 是否已归零:归零后不再每帧写 filter,该行退出模糊卷积。
  const lineClearRef = useRef<boolean[]>([]);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    // 首次(或 text 变更后)缓存字/行节点列表,避免每帧 querySelector。
    if (!charEls.current) {
      charEls.current = Array.from(
        root.querySelectorAll<HTMLElement>('.demo-video__subtitle-char')
      );
      lineEls.current = Array.from(
        root.querySelectorAll<HTMLElement>('.demo-video__subtitle-line')
      );
      settledRef.current = new Array(charEls.current.length).fill(false);
      lineClearRef.current = new Array(lineEls.current.length).fill(false);
    }
    const p = progress;

    // ① 行级 blur:整行一个模糊层。滚动中任一刻最多 1-2 行在过渡 → 每帧只 1-2 次卷积。
    const lines = lineEls.current ?? [];
    const lineMetas = lineMetasRef.current;
    for (let li = 0; li < lines.length; li++) {
      const lm = lineMetas[li];
      if (!lm) continue;
      const clear = clamp01((p - lm.blurStart) / (lm.blurEnd - lm.blurStart));
      const done = clear >= 1;
      // 已清晰且上帧也已清晰 → 跳过,不再写 filter(该行退出重绘)。
      if (done && lineClearRef.current[li]) continue;
      lines[li].style.filter = done ? 'none' : `blur(${((1 - clear) * 8).toFixed(2)}px)`;
      lineClearRef.current[li] = done;
    }

    // ② 逐字:opacity + 位移(合成器免费)+ 颜色(定形前逐字重绘,定形后静止)。
    const els = charEls.current;
    const metas = metasRef.current;
    for (let i = 0; i < els.length; i++) {
      const m = metas[i];
      if (!m) continue;
      const colorLocal = clamp01((p - m.start - 0.22) / 0.22);
      const settled = colorLocal >= 1;
      // 已定形且上帧也定形 → 完全跳过(opacity=1、位移=0、颜色到位,均无需再写)。
      if (settled && settledRef.current[i]) continue;
      const el = els[i];
      const appear = clamp01((p - m.start) / 0.22);
      const gather = clamp01((p - m.lineStart) / (m.lineEnd - m.lineStart));
      el.style.opacity = String(appear);
      const off = m.offset0 * (1 - gather);
      el.style.transform = off !== 0 ? `translateX(${off.toFixed(1)}px)` : 'none';
      const c1 = mix(INK, m.w1, colorLocal);
      const c2 = mix(INK, m.w2, colorLocal);
      el.style.backgroundImage = `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
      settledRef.current[i] = settled;
    }
  }, [progress]);

  // text 变更时使节点/状态缓存失效(下个 layout effect 重建)。
  useLayoutEffect(() => {
    charEls.current = null;
    lineEls.current = null;
  }, [text]);

  const handleChars = useCallback((metas: CharMeta[], lineMetas: LineMeta[]): void => {
    metasRef.current = metas;
    lineMetasRef.current = lineMetas;
  }, []);

  return <StaticSubtitle text={text} containerRef={ref} onChars={handleChars} />;
}

/** 从墨色按 t(0→1)混到暖色,返回 rgb() 串。 */
function mix(from: [number, number, number], to: [number, number, number], t: number): string {
  const r = Math.round(from[0] + (to[0] - from[0]) * t);
  const g = Math.round(from[1] + (to[1] - from[1]) * t);
  const b = Math.round(from[2] + (to[2] - from[2]) * t);
  return `rgb(${r},${g},${b})`;
}

export function DemoVideoScene(): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="demo-video">
      {/* 铺底:全屏视频 + 4 光圈层。视频 waitFor 标题 → 标题入场后擦洗。 */}
      <div className="demo-video__stage">
        <AnimateVideo
          src="/video.mp4"
          aria-label={t('demoVideo.slate')}
          animateId="demo-video"
          duration={{ enter: 4000 }}
          timeline={{ waitFor: 'demo-title', delay: 0 }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <div className="demo-video__scrim" />
      </div>

      {/* 顶部:主标题快速入场(开头即就位,随后常驻) */}
      <Position at={{ anchor: 'center-x', y: 200 }}>
        <Animate
          animateId="demo-title"
          enterAnimation={{ initial: { y: 32, opacity: 0 }, animate: { y: 0, opacity: 1 } }}
          duration={{ enter: 640 }}
          timeline={{ delay: 0 }}
        >
          <div className="demo-video__titleblock">
            <VideoTitle text={t('demoVideo.title')} />
          </div>
        </Animate>
      </Position>

      {/* 画面正中:时光副标题(新主角),waitFor 标题 → 与视频并行、全程逐字驱动 */}
      <Position at={{ anchor: 'center' }}>
        <Animate
          animateId="demo-subtitle"
          enterAnimation={{ initial: { opacity: 1 }, animate: { opacity: 1 } }}
          duration={{ enter: 4000 }}
          timeline={{ waitFor: 'demo-title', delay: 0 }}
        >
          {({ enterProgress }) => (
            <TimeSubtitle text={t('demoVideo.intro')} progress={enterProgress} />
          )}
        </Animate>
      </Position>
    </div>
  );
}

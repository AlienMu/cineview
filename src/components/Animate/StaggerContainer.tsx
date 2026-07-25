/**
 * Tier 2 — stagger 子元素编排(方案B:framer 原生 variant 传播)。
 *
 * 用法:<Animate stagger={{each}}><p>{items.map(x => <span>{x}</span>)}</p></Animate>
 *   - `container`(这里的 <p>)克隆成 motion 元素,作为 variant 传播的父;
 *   - container 的每个**直接子元素**(spans)克隆成 motion 元素,继承 variant 标签;
 *   - 各子元素用 `variant`(= enterAnimation 解析出的 ParsedAnimationVariant)播放,
 *     **绕过 enter/exit 的 10 属性白名单**(走 framer 原生 animate,可用任意可动画属性)。
 *
 * 错峰用 variant 函数 + `custom={index}` 算 per-index delay(仍是原生 variant 传播,
 * 非手搓 style):`from` 决定顺序('first'/'last'/'center')。
 *
 * gate:订阅 hook 暴露的进度源。进度 >0 → 播 'animate',回 0 → 复位 'initial'
 * (支持 replayOnReenter)。时间驱动,不 scrub。scroll / drag 各一个薄订阅组件,
 * 各自只订阅自己的源(不建临时 MotionValue、不条件调用 hook)。
 */
import { Children, isValidElement, useState } from 'react';
import type { ReactElement } from 'react';
import { motion, MotionValue, useMotionValueEvent } from 'framer-motion';
import type { ParsedAnimationVariant } from '../../types';
import type { DragVisualState } from './useAnimateDrag';

type StaggerFrom = 'first' | 'last' | 'center';
type StaggerPhase = 'initial' | 'animate' | 'exit';

export interface StaggerTiming {
  itemDurationMs: number;
  tailDurationMs: number;
  effectiveDurationMs: number;
}

// 由字符串标签取 framer motion 组件(motion.p / motion.span / ...)。
function motionTag(type: ReactElement['type']): React.ElementType {
  if (typeof type === 'string') {
    const tag = (motion as unknown as Record<string, React.ElementType>)[type];
    if (tag) return tag;
  }
  return motion.div;
}

// 子元素揭示顺序:first=正序,last=逆序,center=由中间向两侧。
function orderFor(index: number, count: number, from: StaggerFrom): number {
  if (from === 'last') return count - 1 - index;
  if (from === 'center') return Math.abs(index - (count - 1) / 2);
  return index;
}

function getStaggerItems(container: ReactElement): ReactElement[] {
  return Children.toArray((container.props as { children?: React.ReactNode }).children).filter(
    isValidElement
  ) as ReactElement[];
}

export function countStaggerItems(container: ReactElement): number {
  return getStaggerItems(container).length;
}

export function resolveStaggerTiming(
  variant: ParsedAnimationVariant,
  authoredDurationMs: number,
  each: number,
  from: StaggerFrom,
  itemCount: number,
  target: 'animate' | 'exit' = 'animate'
): StaggerTiming {
  const targetVariant = variant[target] as { transition?: Record<string, unknown> } | undefined;
  const transition = targetVariant?.transition;
  const transitionDurationSeconds = transition?.duration;
  const itemDurationMs =
    typeof transitionDurationSeconds === 'number' && Number.isFinite(transitionDurationSeconds)
      ? Math.max(transitionDurationSeconds * 1000, 0)
      : Math.max(authoredDurationMs, 0);
  const safeEach = Math.max(each, 0);
  let lastOrder = 0;

  for (let index = 0; index < itemCount; index += 1) {
    lastOrder = Math.max(lastOrder, orderFor(index, itemCount, from));
  }

  const tailDurationMs = lastOrder * safeEach;
  return {
    itemDurationMs,
    tailDurationMs,
    effectiveDurationMs: Math.max(authoredDurationMs, tailDurationMs + itemDurationMs),
  };
}

// variant 传播的纯渲染:container/子元素克隆成 motion 元素,子元素用 custom={i} + variant 函数
// 算 per-index delay。play 决定父的 animate 标签('animate' 播 / 'initial' 复位)。
export function renderStaggerTree(
  container: ReactElement,
  variant: ParsedAnimationVariant,
  each: number,
  from: StaggerFrom,
  phase: boolean | StaggerPhase,
  itemDurationMs?: number,
  exitVariant?: ParsedAnimationVariant | null,
  exitItemDurationMs?: number
): ReactElement {
  const children = Children.toArray((container.props as { children?: React.ReactNode }).children);
  const items = getStaggerItems(container);
  const count = items.length;
  const eachSec = Math.max(each, 0) / 1000;
  const resolvedPhase: StaggerPhase =
    typeof phase === 'boolean' ? (phase ? 'animate' : 'initial') : phase;

  const authoredTransition =
    (variant.animate as { transition?: Record<string, unknown> }).transition ?? {};
  const childVariants = {
    initial: variant.initial,
    animate: (i: number) => ({
      ...variant.animate,
      transition: {
        ...authoredTransition,
        ...(authoredTransition.duration === undefined && itemDurationMs !== undefined
          ? { duration: Math.max(itemDurationMs, 0) / 1000 }
          : {}),
        delay: orderFor(i, count, from) * eachSec,
      },
    }),
    exit: (i: number): Record<string, unknown> => {
      const exitTarget = (exitVariant?.exit ?? variant.initial) as Record<string, unknown>;
      const authoredExitTransition =
        (exitTarget as { transition?: Record<string, unknown> }).transition ?? {};
      return {
        ...exitTarget,
        transition: {
          ...authoredExitTransition,
          ...(authoredExitTransition.duration === undefined && exitItemDurationMs !== undefined
            ? { duration: Math.max(exitItemDurationMs, 0) / 1000 }
            : {}),
          delay: orderFor(i, count, from) * eachSec,
        },
      };
    },
  };

  let itemIndex = 0;
  const wrappedItems = children.map((child, sourceIndex) => {
    if (!isValidElement(child)) {
      return child;
    }
    const i = itemIndex;
    itemIndex += 1;
    const ChildTag = motionTag(child.type);
    return (
      <ChildTag
        key={child.key ?? sourceIndex}
        custom={i}
        variants={childVariants}
        className={(child.props as { className?: string }).className}
        style={(child.props as { style?: React.CSSProperties }).style}
      >
        {(child.props as { children?: React.ReactNode }).children}
      </ChildTag>
    );
  });

  // container 本身变成 variant 传播的 motion 父元素(不再另套一层,避免双重嵌套)。
  // 父的 initial/animate 空 variant 仅作标签传播开关,子元素继承标签后各自播放。
  const ParentTag = motionTag(container.type);
  const { children: _drop, ...containerProps } = container.props as {
    children?: unknown;
  } & Record<string, unknown>;
  void _drop;
  return (
    <ParentTag
      {...containerProps}
      initial="initial"
      animate={resolvedPhase}
      variants={{ initial: {}, animate: {}, exit: {} }}
    >
      {wrappedItems}
    </ParentTag>
  );
}

interface CommonProps {
  container: ReactElement;
  variant: ParsedAnimationVariant;
  each: number;
  from: StaggerFrom;
  itemDurationMs?: number;
  exitVariant?: ParsedAnimationVariant | null;
  exitItemDurationMs?: number;
}

// scroll:订阅 signedVisual(0=初始/1=进入/-1=退出),>0 即播。
export function ScrollStagger({
  container,
  variant,
  each,
  from,
  itemDurationMs,
  exitVariant,
  exitItemDurationMs,
  signedVisual,
}: CommonProps & { signedVisual: MotionValue<number> }): ReactElement {
  const derive = (value: number): StaggerPhase =>
    value > 0 ? 'animate' : value < 0 && exitVariant ? 'exit' : 'initial';
  const [phase, setPhase] = useState(() => derive(signedVisual.get()));
  useMotionValueEvent(signedVisual, 'change', (value) => setPhase(derive(value)));
  return renderStaggerTree(
    container,
    variant,
    each,
    from,
    phase,
    itemDurationMs,
    exitVariant,
    exitItemDurationMs
  );
}

// drag:订阅 visualState,mode=enter&progress>0 或 rest 即播。
export function DragStagger({
  container,
  variant,
  each,
  from,
  itemDurationMs,
  exitVariant,
  exitItemDurationMs,
  visualState,
}: CommonProps & { visualState: MotionValue<DragVisualState | null> }): ReactElement {
  const derive = (visual: DragVisualState | null): StaggerPhase => {
    if (visual?.mode === 'outgoing' && exitVariant) return 'exit';
    if (
      visual &&
      ((visual.mode === 'enter' && visual.localProgress > 0) || visual.mode === 'rest')
    ) {
      return 'animate';
    }
    return 'initial';
  };
  const [phase, setPhase] = useState(() => derive(visualState.get()));
  useMotionValueEvent(visualState, 'change', (visual) => setPhase(derive(visual)));
  return renderStaggerTree(
    container,
    variant,
    each,
    from,
    phase,
    itemDurationMs,
    exitVariant,
    exitItemDurationMs
  );
}

/**
 * directScrollHelpers 独立单测。
 *
 * 这些纯函数原本内联在 DirectScrollCineView.tsx 里、仅由组件测试间接覆盖。
 * 阶段1 外移、阶段2 合并 span 解析器后，这里为「核心算法」补直接单测：
 *  - resolveScrollIntentOffset：center-lock 防跳过 reducer（design.md 规则 13）
 *  - resolveScrollSceneDeclaredSpan / resolveTakeoverSceneSpan：合并后两 wrapper
 *    的逐分支等价性（number/px design 换算、floor-to-1 差异、vh/vw、auto/非法）
 *  - normalizeWheelDeltaPx / normalizeKeyboardDeltaPx：输入归一化边界
 *  - buildSceneTimelineState：phase 判定与 sceneProgress
 */

import {
  buildSceneTimelineState,
  clamp,
  normalizeKeyboardDeltaPx,
  normalizeTouchDeltaPx,
  normalizeWheelDeltaPx,
  resolveScrollIntentOffset,
  resolveScrollSceneDeclaredSpan,
  resolveTakeoverSceneSpan,
  shouldDeferToNestedScrollable,
  shouldIgnoreGlobalScrollKey,
  isSceneElement,
  isLegacyDisplayNameSceneElement,
  type CenterLockSegment,
  type SceneAuthoringCompatProps,
  type SceneLayoutInfo,
} from './directScrollHelpers';
import { createElement, forwardRef, memo } from 'react';

describe('clamp', () => {
  it('限制在 [min, max] 区间', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe('resolveScrollIntentOffset', () => {
  it('deltaPx 为 0 时返回被 clamp 的当前 offset', () => {
    expect(resolveScrollIntentOffset({ currentOffset: 50, deltaPx: 0, maxNativeOffset: 100 })).toBe(
      50
    );
    expect(
      resolveScrollIntentOffset({ currentOffset: 150, deltaPx: 0, maxNativeOffset: 100 })
    ).toBe(100);
  });

  it('无 segments 时按 delta 线性推进并 clamp', () => {
    expect(
      resolveScrollIntentOffset({ currentOffset: 10, deltaPx: 30, maxNativeOffset: 100 })
    ).toBe(40);
    expect(
      resolveScrollIntentOffset({ currentOffset: 90, deltaPx: 30, maxNativeOffset: 100 })
    ).toBe(100);
  });

  it('Infinity / -Infinity 直接跳到边界（Home/End 键）', () => {
    expect(
      resolveScrollIntentOffset({
        currentOffset: 50,
        deltaPx: Number.POSITIVE_INFINITY,
        maxNativeOffset: 100,
      })
    ).toBe(100);
    expect(
      resolveScrollIntentOffset({
        currentOffset: 50,
        deltaPx: Number.NEGATIVE_INFINITY,
        maxNativeOffset: 100,
      })
    ).toBe(0);
  });

  it('正向大输入跨完整 segment 时钳到 segmentStart+1（规则13：至少产一个段内帧）', () => {
    const segments: CenterLockSegment[] = [{ segmentStart: 100, segmentEnd: 300 }];
    // 从段前(50)一跃到段后(400)，必须先落到段内 segmentStart+1=101
    const result = resolveScrollIntentOffset({
      currentOffset: 50,
      deltaPx: 350,
      maxNativeOffset: 1000,
      segments,
    });
    expect(result).toBe(101);
  });

  it('正向输入从段内越过 segmentEnd 时钳到 segmentEnd', () => {
    const segments: CenterLockSegment[] = [{ segmentStart: 100, segmentEnd: 300 }];
    // 当前在段内(150)，目标越过段尾(400) → 钳到 segmentEnd=300
    const result = resolveScrollIntentOffset({
      currentOffset: 150,
      deltaPx: 250,
      maxNativeOffset: 1000,
      segments,
    });
    expect(result).toBe(300);
  });

  it('反向大输入跨完整 segment 时钳到 segmentEnd-1', () => {
    const segments: CenterLockSegment[] = [{ segmentStart: 100, segmentEnd: 300 }];
    // 从段后(400)一跃到段前(50)，必须先落到段内 segmentEnd-1=299
    const result = resolveScrollIntentOffset({
      currentOffset: 400,
      deltaPx: -350,
      maxNativeOffset: 1000,
      segments,
    });
    expect(result).toBe(299);
  });

  it('反向输入从段内回退越过 segmentStart 时钳到 segmentStart', () => {
    const segments: CenterLockSegment[] = [{ segmentStart: 100, segmentEnd: 300 }];
    // 当前在段内(250)，目标越过段首(50) → 钳到 segmentStart=100
    const result = resolveScrollIntentOffset({
      currentOffset: 250,
      deltaPx: -200,
      maxNativeOffset: 1000,
      segments,
    });
    expect(result).toBe(100);
  });

  it('小幅输入（< 边界 epsilon）直接返回 target，不触发段判定', () => {
    const segments: CenterLockSegment[] = [{ segmentStart: 100, segmentEnd: 300 }];
    const result = resolveScrollIntentOffset({
      currentOffset: 150,
      deltaPx: 0.3,
      maxNativeOffset: 1000,
      segments,
    });
    expect(result).toBeCloseTo(150.3, 5);
  });
});

describe('span 解析器：declared 与 takeover 的逐分支等价/差异', () => {
  const makeProps = (size: number | string): SceneAuthoringCompatProps =>
    ({ layout: { height: size } }) as SceneAuthoringCompatProps;

  describe('resolveScrollSceneDeclaredSpan（无 design 换算、不 floor）', () => {
    it('number 原样返回', () => {
      expect(resolveScrollSceneDeclaredSpan(makeProps(500), 'y', 375, 667)).toBe(500);
    });

    it('px 原样返回', () => {
      expect(resolveScrollSceneDeclaredSpan(makeProps('480px'), 'y', 375, 667)).toBe(480);
    });

    it('vh 按视口高换算', () => {
      expect(resolveScrollSceneDeclaredSpan(makeProps('50vh'), 'y', 375, 667)).toBeCloseTo(
        333.5,
        5
      );
    });

    it('auto / 非法 / 非正数 返回 null', () => {
      expect(resolveScrollSceneDeclaredSpan(makeProps('auto'), 'y', 375, 667)).toBeNull();
      expect(resolveScrollSceneDeclaredSpan(makeProps('abc'), 'y', 375, 667)).toBeNull();
      expect(resolveScrollSceneDeclaredSpan(makeProps(0), 'y', 375, 667)).toBeNull();
    });
  });

  describe('resolveTakeoverSceneSpan（方案 A 单尺子：绝对值不换算→null，仅 vh/vw 保留）', () => {
    it('number（绝对设计值）返回 null → 调用方回退 DOM 实测', () => {
      // 单尺子模型下不再有独立高度尺子，takeover 绝对值一律 null。
      expect(resolveTakeoverSceneSpan(1000, 375, 667)).toBeNull();
    });

    it('px（绝对像素）同样返回 null', () => {
      expect(resolveTakeoverSceneSpan('1000px', 375, 667)).toBeNull();
    });

    it('vh 按视口换算保留（无需设计尺子）', () => {
      // 50vh @ 视口高 667 → 333.5，floor 到 ≥1
      expect(resolveTakeoverSceneSpan('50vh', 375, 667)).toBeCloseTo(333.5, 5);
    });

    it('vw 按视口换算保留', () => {
      // 80vw @ 视口宽 375 → 300
      expect(resolveTakeoverSceneSpan('80vw', 375, 667)).toBeCloseTo(300, 5);
    });

    it('vh 结果 floor 到 ≥1（极小值）', () => {
      // 0.1vh @ 667 ≈ 0.667 → floor 到 1
      expect(resolveTakeoverSceneSpan('0.1vh', 375, 667)).toBe(1);
    });

    it('auto / 非法 返回 null', () => {
      expect(resolveTakeoverSceneSpan('auto', 375, 667)).toBeNull();
      expect(resolveTakeoverSceneSpan(undefined, 375, 667)).toBeNull();
    });
  });
});

describe('normalizeWheelDeltaPx', () => {
  it('deltaMode=0（像素）原样返回', () => {
    expect(normalizeWheelDeltaPx(40, 0, 667)).toBe(40);
  });

  it('deltaMode=1（行）乘 18', () => {
    expect(normalizeWheelDeltaPx(3, 1, 667)).toBe(54);
  });

  it('deltaMode=2（页）乘视口跨度', () => {
    expect(normalizeWheelDeltaPx(2, 2, 667)).toBe(1334);
  });

  it('0 或非有限值返回 0', () => {
    expect(normalizeWheelDeltaPx(0, 0, 667)).toBe(0);
    expect(normalizeWheelDeltaPx(Number.NaN, 0, 667)).toBe(0);
  });
});

describe('normalizeTouchDeltaPx', () => {
  it('有限值原样返回，非有限返回 0', () => {
    expect(normalizeTouchDeltaPx(25)).toBe(25);
    expect(normalizeTouchDeltaPx(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('normalizeKeyboardDeltaPx', () => {
  it('PageDown/PageUp 为 ±0.86 视口跨度', () => {
    expect(normalizeKeyboardDeltaPx('PageDown', false, 1000)).toBe(860);
    expect(normalizeKeyboardDeltaPx('PageUp', false, 1000)).toBe(-860);
  });

  it('空格按 shift 决定方向', () => {
    expect(normalizeKeyboardDeltaPx(' ', false, 1000)).toBe(860);
    expect(normalizeKeyboardDeltaPx(' ', true, 1000)).toBe(-860);
  });

  it('方向键为固定行步长 ±80', () => {
    expect(normalizeKeyboardDeltaPx('ArrowDown', false, 1000)).toBe(80);
    expect(normalizeKeyboardDeltaPx('ArrowUp', false, 1000)).toBe(-80);
  });

  it('Home/End 为 ∓Infinity', () => {
    expect(normalizeKeyboardDeltaPx('Home', false, 1000)).toBe(Number.NEGATIVE_INFINITY);
    expect(normalizeKeyboardDeltaPx('End', false, 1000)).toBe(Number.POSITIVE_INFINITY);
  });

  it('其它键返回 0', () => {
    expect(normalizeKeyboardDeltaPx('Enter', false, 1000)).toBe(0);
  });
});

describe('shouldDeferToNestedScrollable', () => {
  function setupNestedScroller(): {
    root: HTMLDivElement;
    scroller: HTMLDivElement;
    child: HTMLButtonElement;
  } {
    const root = document.createElement('div');
    const scroller = document.createElement('div');
    const child = document.createElement('button');
    scroller.style.overflowY = 'auto';
    scroller.appendChild(child);
    root.appendChild(scroller);
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 100 });
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 500 });
    return { root, scroller, child };
  }

  it('keeps forward input in a nested scroller until its lower boundary', () => {
    const { root, scroller, child } = setupNestedScroller();
    scroller.scrollTop = 120;
    expect(shouldDeferToNestedScrollable(child, root, 'y', 80)).toBe(true);

    scroller.scrollTop = 400;
    expect(shouldDeferToNestedScrollable(child, root, 'y', 80)).toBe(false);
  });

  it('keeps reverse input in a nested scroller until its upper boundary', () => {
    const { root, scroller, child } = setupNestedScroller();
    scroller.scrollTop = 120;
    expect(shouldDeferToNestedScrollable(child, root, 'y', -80)).toBe(true);

    scroller.scrollTop = 0;
    expect(shouldDeferToNestedScrollable(child, root, 'y', -80)).toBe(false);
  });

  it('does not defer non-element or zero-delta input', () => {
    const { root, child } = setupNestedScroller();
    expect(shouldDeferToNestedScrollable(null, root, 'y', 80)).toBe(false);
    expect(shouldDeferToNestedScrollable(child, root, 'y', 0)).toBe(false);
  });

  it('supports horizontal nested scroll ownership', () => {
    const root = document.createElement('div');
    const scroller = document.createElement('div');
    const child = document.createElement('button');
    scroller.style.overflowX = 'auto';
    scroller.appendChild(child);
    root.appendChild(scroller);
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 100 });
    Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 500 });
    scroller.scrollLeft = 120;

    expect(shouldDeferToNestedScrollable(child, root, 'x', 80)).toBe(true);
    scroller.scrollLeft = 400;
    expect(shouldDeferToNestedScrollable(child, root, 'x', 80)).toBe(false);
  });
});

describe('scene discovery and keyboard ownership helpers', () => {
  it('recognizes explicit and wrapped Scene markers without relying on displayName', () => {
    function MarkedScene(): JSX.Element {
      return createElement('div');
    }
    (MarkedScene as typeof MarkedScene & { cineViewScene?: boolean }).cineViewScene = true;

    function NamedScene(): JSX.Element {
      return createElement('div');
    }
    (NamedScene as typeof NamedScene & { displayName?: string }).displayName = 'Scene';

    const Wrapped = memo(MarkedScene);
    const WrappedNamedScene = memo(NamedScene);
    const PlainScene = (): JSX.Element => createElement('div');
    const LegacyRender = (): JSX.Element => createElement('div');
    (LegacyRender as typeof LegacyRender & { displayName?: string }).displayName = 'Scene';
    const ForwardLegacyScene = forwardRef<HTMLDivElement>(LegacyRender);

    expect(isSceneElement(createElement(MarkedScene))).toBe(true);
    expect(isSceneElement(createElement(NamedScene))).toBe(false);
    expect(isSceneElement(createElement(Wrapped))).toBe(true);
    expect(isSceneElement(createElement('div'))).toBe(false);
    expect(isSceneElement('scene')).toBe(false);

    expect(isLegacyDisplayNameSceneElement(createElement(MarkedScene))).toBe(false);
    expect(isLegacyDisplayNameSceneElement(createElement(NamedScene))).toBe(true);
    expect(isLegacyDisplayNameSceneElement(createElement(WrappedNamedScene))).toBe(true);
    expect(isLegacyDisplayNameSceneElement(createElement(ForwardLegacyScene))).toBe(true);
    expect(isLegacyDisplayNameSceneElement(createElement(Wrapped))).toBe(false);
    expect(isLegacyDisplayNameSceneElement(createElement(PlainScene))).toBe(false);
    expect(isLegacyDisplayNameSceneElement(createElement('div'))).toBe(false);
    expect(isLegacyDisplayNameSceneElement('scene')).toBe(false);
  });

  it('keeps space keys on controls and editable fields', () => {
    const button = document.createElement('button');
    const input = document.createElement('input');
    const section = document.createElement('section');

    expect(
      shouldIgnoreGlobalScrollKey(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    ).toBe(false);
    Object.defineProperty(button, 'tagName', { value: 'BUTTON' });
    Object.defineProperty(input, 'tagName', { value: 'INPUT' });
    const keyEvent = (key: string, target: Element): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true });
      Object.defineProperty(event, 'target', { configurable: true, value: target });
      return event;
    };
    expect(shouldIgnoreGlobalScrollKey(keyEvent(' ', button))).toBe(true);
    expect(shouldIgnoreGlobalScrollKey(keyEvent('ArrowDown', input))).toBe(true);
    expect(shouldIgnoreGlobalScrollKey(keyEvent('ArrowDown', section))).toBe(false);
  });
});

describe('buildSceneTimelineState', () => {
  const layout: SceneLayoutInfo = {
    sceneStart: 100,
    sceneEnd: 500,
    visualSpan: 400,
    flowSpan: 400,
    timelineDistancePx: 0,
    centerLockOffset: 0,
    segmentStart: 0,
    segmentEnd: 0,
    enterLength: 100,
    exitLength: 100,
    stackMode: 'cover',
  };

  it('layout 为 null 返回 null', () => {
    expect(buildSceneTimelineState(null, 0, 667)).toBeNull();
  });

  it('视口在 scene 之前 → phase=before', () => {
    const state = buildSceneTimelineState(layout, 0, 50);
    expect(state?.phase).toBe('before');
  });

  it('视口完全越过 scene → phase=after，enter/exit 进度=1', () => {
    const state = buildSceneTimelineState(layout, 600, 100);
    expect(state?.phase).toBe('after');
    expect(state?.enterProgress).toBe(1);
    expect(state?.exitProgress).toBe(1);
  });

  it('sceneProgress 按视口中心相对 scene 区间线性', () => {
    // 视口中心 = 300+667/2... 用小视口便于断言：scrollOffset=200,span=100 → center=250
    const state = buildSceneTimelineState(layout, 200, 100);
    // (250-100)/(500-100)=150/400=0.375
    expect(state?.sceneProgress).toBeCloseTo(0.375, 5);
  });
});

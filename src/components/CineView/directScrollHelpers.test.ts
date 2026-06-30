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
  type CenterLockSegment,
  type SceneAuthoringCompatProps,
  type SceneLayoutInfo,
} from './directScrollHelpers';

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

  describe('resolveTakeoverSceneSpan（number/px 做 design→viewport 换算，全分支 floor≥1）', () => {
    it('number 做 design→viewport 换算', () => {
      // design 高 1334，视口高 667 → 比例 0.5；1000 设计px → 500 物理px
      expect(resolveTakeoverSceneSpan(1000, 'y', 375, 667, 750, 1334)).toBeCloseTo(500, 5);
    });

    it('px 同样换算', () => {
      expect(resolveTakeoverSceneSpan('1000px', 'y', 375, 667, 750, 1334)).toBeCloseTo(500, 5);
    });

    it('vh 按视口换算（与 declared 一致）', () => {
      expect(resolveTakeoverSceneSpan('50vh', 'y', 375, 667, 750, 1334)).toBeCloseTo(333.5, 5);
    });

    it('换算结果 floor 到 ≥1（极小设计值）', () => {
      // 1 设计px / 1334 * 667 ≈ 0.5 → floor 到 1
      expect(resolveTakeoverSceneSpan(1, 'y', 375, 667, 750, 1334)).toBe(1);
    });

    it('auto / 非法 返回 null', () => {
      expect(resolveTakeoverSceneSpan('auto', 'y', 375, 667, 750, 1334)).toBeNull();
      expect(resolveTakeoverSceneSpan(undefined, 'y', 375, 667, 750, 1334)).toBeNull();
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

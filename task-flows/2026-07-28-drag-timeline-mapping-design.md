# Drag 时间轴映射与非场景驱动设计归档

- 日期：2026-07-28
- 状态：第二版归档已修订，等待最终独立对抗验收
- 范围：drag 时间轴映射、Scene 级覆盖、拖拽资格闸口、事务快照、动态 Animate、预设加载中控
- 依据：`DESIGN.md` 双轨模型、关键状态唯一所有者、render 轨唯一 commit 触发器

## 1. 目标与现状

目标是在不破坏 drag 双轨模型的前提下，让每个 Scene 选择“拖拽距离如何推进自身元素时间轴”，并为动态内容提供不领取 Scene 时间轴的到场后驱动。

已核实现状：

- 默认每拖拽 1 个百分点推进元素时钟 `10ms`；现有字段为 `modes.drag.dragTimeScale`。
- Scene 内所有 scene-driven Animate 共享 `elementElapsedMotion`，再按各自 `calculatedDelay` 与 `duration` 计算局部进度。
- drag 只挂载 `current ± 1`；Scene 离开窗口会卸载。
- registry 当前把页面过渡时长作为元素时间轴下限，并允许运行时重算。
- `timeline.sceneControlled` 当前在 drag 下不分流；稳定当前页中新挂载的 Animate 直接显示终态。
- 内置预设按分类动态 `import()` 并缓存。

## 2. 公共 API

### 2.1 单位与尺子

```ts
export type DragTimelineUnit = 'time' | 'percent';

export interface SceneDragConfig {
  enabled?: boolean;
  unit?: DragTimelineUnit;
  scale?: number;
}

export interface DragModeConfig {
  // 既有 drag 字段省略
  unit?: DragTimelineUnit;
  scale?: number;
}
```

采用 drag 命名空间内的扁平字段，不增加 `timeline` / `mapping` 中间层：

```tsx
<CineView modes={{ drag: { unit: 'time', scale: 10 } }}>
  <Scene drag={{ enabled: ready, unit: 'percent', scale: 0.5 }} />
</CineView>
```

- `unit: 'time'`：每 1 个拖拽百分点推进 `scale` ms；缺省 `scale=10`。
- `unit: 'percent'`：每 1 个拖拽百分点推进 Scene 元素时间轴的 `scale` 个百分点；缺省 `scale=1`。
- 全部省略时为 `time + 10`。
- 使用字符串联合，不引入运行时 enum。
- `scale` 保留该公共命名；它位于 `drag` 命名空间，不表示 px2vw 尺寸换算。
- 旧 `modes.drag.dragTimeScale` 破坏式删除，不保留兼容分支；源码、site、案例和测试同步迁移。

### 2.2 映射继承

优先级：

```text
Scene 显式映射 > CineView 根映射 > 框架默认值
```

整组来源规则保持扁平 API：

- Scene 的 `unit` 或 `scale` 只要有一个值不为 `undefined`，Scene 映射整组覆盖 CineView；未提供的另一字段使用框架默认，不逐字段继承。
- Scene 完全未提供 `unit/scale` 时，继承 CineView 完整映射。
- `drag.enabled` 不触发映射覆盖。

```text
root percent+0.5，Scene 未写映射       → percent+0.5
root percent+0.5，Scene 只写 unit=time → time+10
root percent+0.5，Scene 只写 scale=2   → time+2
Scene 只写 enabled=false               → 映射仍继承 root
```

“只写 `scale` 会采用 `time`”是明确公共语义。类型注释、文档与测试必须直接展示该行为。

每个 Scene 只用自己的解析结果驱动自己的 element 轨。A→B 使用 B 的尺子；B→A 使用 A 的尺子。不给 Animate 增加 `unit/scale`，避免同一依赖图混合量纲。

### 2.3 Scene 资格闸口

```tsx
<Scene drag={{ enabled: dataReady }} />
```

- `enabled` 默认 `true`，只表示该 Scene 当前是否允许作为用户 drag 的目标。
- 只限制真实用户拖拽，不限制 `goToScene()` 等程序化导航，不影响 scroll。
- 仅严格布尔 `false` 关闭；非法运行时值报错后回退 `true`。

### 2.4 回调类型

```ts
export interface DragStartDetail extends Omit<DragDetail, 'direction'> {
  direction: 'forward' | 'backward';
}

export interface DragBlockedDetail {
  fromIndex: number;
  targetSceneIndex: number;
  direction: 'forward' | 'backward';
}

export interface DragCommitDetail extends DragDetail {
  targetSceneIndex: number;
  elapsedMs: number;
  timelineDurationMs: number;
}
```

- `onDragStart` 使用 `DragStartDetail`，改为 ownership 正式建立时触发；`progress=0`，`direction` 必为当时实际取得 ownership 的方向。
- `onDragBlocked` 位于 CineView 根级 drag callbacks；detail 不携带 `progress`。
- `onDragProgress.progress` 始终是页面切换比例 `0..1`。
- `DragCommitDetail.elapsedMs` 表示本次元素轨进入的起始 elapsed，不是回调时的实时采样。

提交字段口径：

| 来源 | `progress` | `elapsedMs` | `timelineDurationMs` |
|---|---:|---:|---:|
| 手势提交 | 页面释放比例 | 目标事务按目标尺子换算并 clamp 后的释放 elapsed | 目标事务纯元素编排 `T_self` |
| 程序化导航，目标已有 prepared snapshot | `1` | `0` | 目标 snapshot `T_self` |
| 程序化远跳，目标未挂载/无 snapshot | `1` | `0` | `0` |
| 目标无 scene-driven 入场编排 | 对应来源值 | `0` | `0` |

`timelineDurationMs=0` 是已确认的合并语义：表示“当前没有可用的 scene-driven 编排快照”，包括合法无编排与远端目标尚未挂载。消费者不得仅凭 `0` 区分二者。本轮不增加预备挂载、nullable 字段或额外判别字段。

## 3. 单一映射公式与双轨分尺

### 3.1 纯元素时间轴

本文的 `T_self` 只表示 drag 下 scene-driven Animate 的纯入场编排：

```ts
T_self = max(sceneDrivenAnimate.calculatedDelay + sceneDrivenAnimate.effectiveEnterDuration)
```

- `Scene.tsx` 调用 registry 时按 mode 传 floor：`effectiveMode === 'drag' ? 0 : resolvedSceneTransitionDuration`。
- drag 的 registry floor 为 `0`；scroll 保留既有 `baseDuration` 行为。
- `sceneControlled=false`、纯 `infiniteAnimation`、静态内容不进入 `T_self`。
- 页面位移时长只来自 `CineView.modes.drag.transitionDuration` 及默认值。
- `Scene.transition.enterAnimation/exitAnimation/exitDuration` 只属于 scroll；drag 下不解析、不加载、不参与 readiness，并在开发环境诊断。

若存在声明 `sceneControlled=true + enterAnimation` 的 Animate，却因解析或 registration 无效无法形成有效 `T_self`，报告专门诊断。静态 Scene、全部 `sceneControlled=false`、纯循环 Scene 均合法且不警告。

### 3.2 唯一解析函数

所有跟手、release seed 与诊断复用同一解析结果：

```ts
function resolveDragMapping(unit: DragTimelineUnit, scale: number, tSelf: number) {
  const msPerDragPercent = unit === 'time' ? scale : (tSelf * scale) / 100;
  return {
    unit,
    scale,
    msPerDragPercent,
    map(dragPercent: number) {
      return clamp(dragPercent * msPerDragPercent, 0, tSelf);
    },
  };
}
```

```ts
sceneElapsedMs = mapping.map(dragPercent); // 0..100
localProgress = clamp((sceneElapsedMs - calculatedDelay) / enterDuration, 0, 1);
```

`unit + scale` 只影响 follow-finger 与 release 当帧 seed：

- 松手提交：从 seed 按真实毫秒速率补到 `T_self`。
- 松手取消：从 seed bounce 到 `0`。
- cold-start、程序化导航：从 `0` 按真实时间播放。
- outgoing/exit：只由 render 轨处理。

### 3.3 数值边界与满程诊断

- `scale` 必须有限且 `>=0`；`0` 合法。
- `scale=0` 时页面仍移动，scene-driven incoming 元素在拖动期间停在 initial，commit 后才按真实时间入场。
- elapsed 始终 clamp 到 `[0,T_self]`。
- 非法 `unit` 整组回退 `time+10`；非法 `scale` 按合法 unit 回退 `time=10` / `percent=1`。

提前耗尽诊断只在 `T_self>0` 时计算：

```ts
const uncappedFullDragElapsedMs = 100 * mapping.msPerDragPercent;
if (T_self > 0 && uncappedFullDragElapsedMs > T_self) {
  const completionDragPercent = (T_self / uncappedFullDragElapsedMs) * 100;
}
```

这是 clamp 前诊断量，不得写入 MotionValue。默认映射也检查。去重键为 Scene instance/index 与 `{unit,scale,T_self}`。

## 4. Prepared snapshot 与进入事务

### 4.1 唯一所有者和结构

CineView 维护：

```ts
preparedScenes: Map<sceneIndex, PreparedSceneSnapshot>
activeTransactions: Map<transactionId, DragSceneTransaction>
```

只有已经稳定的 snapshot 才进入 `preparedScenes`；不存在 `ready=false` 条目。未稳定状态由 Scene 本地 readiness 状态持有。

```ts
interface PreparedSceneSnapshot {
  sceneIndex: number;
  instanceId: symbol;
  revision: number;
  enabled: boolean;
  mapping: { unit: DragTimelineUnit; scale: number };
  registrySnapshot: FrozenAnimationRegistrySnapshot; // registrations、依赖、delays、T_self
  enterVariantsByAnimateId: ReadonlyMap<string, ParsedAnimationVariant>;
}
```

- `registrySnapshot` 是一次编译产物；不再并列存放可互相漂移的 registrations/delay/timelineDuration 三份状态。
- Scene/registry 编译 prepared snapshot；CineView 持有跨 commit transaction。
- outgoing 引擎只提交 `targetSceneIndex + progressRatio`；中控从目标 prepared snapshot 建立事务并权威换算 elapsed。
- Scene 更新发布新 revision，不修改既有 transaction。
- Scene 卸载时，仅在 `instanceId+revision` 仍匹配时驱逐对应 prepared entry；active transaction 已持有不可变副本，不受驱逐影响。

standalone drag Scene（无 CineView）使用单 Scene退化事务：由 Scene 本地持有自己的 prepared snapshot/transaction，不做跨 Scene查询；既有 standalone commit 行为保留。

### 4.2 Registry 稳定端口与收敛

registry 新增显式稳定端口：

```ts
onStableSnapshot(snapshot, revision)
```

它只能在 `scheduleValidation` 的 `rebuildSnapshot()` 完成后触发。Scene readiness 为：

```text
当前 generation 的预设需求全部成功或确定失败
+ registry onStableSnapshot 已到达
+ 稳定批次后无待提交 registration
→ 发布 prepared snapshot
```

- 所有进入来源只从 prepared snapshot 建立播放快照。
- 预设中控按分类从首次 pending 起计时；内部常量 `PRESET_LOAD_TIMEOUT_MS=3000`。超时按 `ANIMATION_ASSET_LOAD_FAILED` 处理并结束 pending。
- 视觉解析失败的 Animate 从本轮 registry 编排、依赖图、`T_self` 与 variants 一并排除；依赖它的 follower 按既有 fail-open 错误规则处理。
- 收敛只覆盖已挂载且已上报的 Animate，不等待业务未来异步数据。
- 首屏仅在 prepared snapshot 建立后启动，不再 extend-on-growth。首屏 activation 后才动态挂载的 `sceneControlled=true` Animate按既定规则静态终态；这是明确取舍，不补长本轮时间轴。
- `T_self=0` 可以是合法稳定结果；不得用 `T_self>0` 代替 readiness。

### 4.3 Transaction 下发与唯一读取源

`DragSceneTransaction` 冻结：

- target instance/revision；
- compiled `registrySnapshot` 与 `T_self`；
- 解析后的 mapping；
- enter variants；
- driver ownership；
- release seed 与 transaction id。

active transaction 通过 SceneContext/runtime port 下发给目标 Scene。所有 element-track 读取必须统一：

- `useAnimateDrag` 的 `calculatedDelay`、timeline duration、enter variant；
- `useElementTrack` 的 follow-finger、release settle、bounce、orphan-resume；
- re-grab 后的 continuation；

均从 active transaction 读取，禁止回退 live registry。cold-start 没有手势 transaction，但使用启动时捕获的 prepared snapshot；程序化 enter同样捕获 prepared snapshot。只有没有任何播放事务时，实时目录才可用于编译下一 snapshot。

`SceneDragRuntime.dragTimeScale` 被删除，替换为 prepared/transaction reference；`useElementTrack` 不接受原始 scale，也不自行解析默认值。

### 4.4 Transaction 生命周期与回调终态

```text
prepared → driving → settling → released
                └→ bouncing → released
                └→ retargeted (内部 abort，pointer session继续)
                └→ aborted   → released
```

- render commit 不释放 transaction；element settle 可跨 commit。
- settle 中 re-grab 同目标复用同一 transaction。
- transaction 中 Animate 卸载只移除 DOM；冻结数据保留。live registry可立即注销。
- 新挂载 `sceneControlled=true` Animate 本轮静态终态，下次进入参与。
- Scene cleanup 必须向中控发送带 `instanceId+revision+transactionId` 的失效通知；过期通知不得终止新实例事务。

终态与公共回调分开定义：

1. **retarget**：旧目标 transaction内部结束；同一 pointer session继续，不发 terminal callback。
2. **commit 前目标失效/真正 session abort**：清 join，若已触发 `onDragStart`，恰好发一次 `onDragCancel`。
3. **render commit 后、element settle 前目标失效**：停止 continuation、清 join、释放 transaction；`onDragCommit` 已是 session terminal，不再发 cancel/commit。
4. **settle/bounce complete**：释放 transaction；对应 session此前已经 commit 或在 bounce完成时 cancel。
5. **terminal 兜底**：任何已触发 `onDragStart` 的 pointer session，若结束时未发生 `onDragCommit`，必须在 render 轨回位完成时恰好发一次 `onDragCancel`。边界、被拒方向、无目标、retarget 后再被拒等分支均由本条覆盖；后文边界规则只是示例而非穷举。

因此正式 pointer session始终满足：

```text
onDragStart → onDragProgress* → exactly one of onDragCommit | onDragCancel
```

## 5. Candidate、re-grab suspension 与 ownership

业务 `enabled` 与内部 readiness 合并为方向资格状态机；拒绝原因不同：

```text
pointer down → candidate → 解析候选相邻 Scene
→ gate = businessEnabled && internalReady
   ├─ open   → ownership → follow
   └─ closed → 本方向 rejected-latched
```

### 5.1 普通 candidate（页面静止）

- 不置 `globalIsDragging`；
- 不触发 element-track抢占；
- 不 `preventDefault`、不抑制 click/tap；
- 不发 drag callbacks；
- pointercancel 只结束 candidate。

首个有效轴向移动完成方向与 gate裁决。gate通过时，ownership以**该帧** render progress/指针位置为新 baseline；candidate期间位移不追认，首次写入从 `progress=0` 开始，避免页面跳变。

### 5.2 在飞 lane 上的 re-grab candidate

pointer down 命中在飞 render/element continuation 时，不允许 lane在候选期间继续 commit，也不能不可逆 stop：

- 创建内部 `SuspendedContinuation`，在 pointer-down 帧可逆暂停 render lane与对应 element continuation；保留原 token、目标、剩余时长与当前位置。
- 不置 `globalIsDragging`，但置内部 `candidateSuspended=true`；orphan-resume/commit timer 必须同时检查该标志，不得在候选期间恢复或 commit。
- gate通过：把 suspension提升为 ownership，旧 continuation永久 preempt；以暂停点 render progress + ownership当帧指针作为 baseline。
- tap、pointercancel、gate拒绝或未取得 ownership即结束：恢复原 continuation，从暂停点继续到原目标；不得生成新的公共 drag session。
- suspension 期间到点的 settle/commit 触发是延后而非丢弃：恢复时必须以暂停时记录的剩余时长重新武装该定时器；若剩余时长 `<= 0`，恢复当帧立即执行原 commit，生成 `activationToken`、关闭 join，并按既有规则发出 `onDragCommit`。
- 这样既不让页面在按住期间继续滑动，也不会因候选被拒把页面永久冻结。

### 5.3 Ownership 与拒绝

ownership建立时才：

- 置 `globalIsDragging=true`；
- 接管旧 continuation；
- 抑制点击；
- 建立/选择 target transaction；
- 发一次 `onDragStart({progress:0,direction})`。

拒绝规则：

- `enabled=false`：每次按压每方向最多一次 `onDragBlocked`。
- internal readiness=false：不发业务 blocked；发去重开发诊断。
- 同方向在按压期间变 open也不得中途启动；抬手后重试。
- 越过 pointer-down 起点并由既有 incoming选择逻辑明确反向时，可预检另一侧；不增加公开阈值。
- ownership后 `enabled` 变化不影响当前 transaction。
- 一次 pointer session只发一次 `onDragStart`。retarget后 `onDragProgress.direction` 与最终 terminal callback反映当前/最终方向；`onDragStart.direction` 保留首次取得 ownership的方向。

### 5.4 物理边界

- 无目标 Scene不发 `onDragBlocked`。
- 保留 render-only橡皮筋。发生实际边界位移时建立 render ownership并发 `onDragStart`，不建立元素 transaction。
- 边界 `onDragProgress` 可发出，但页面切换 progress固定为 `0`；direction为尝试方向。
- 若整个 session始终停留在边界方向，bounce完成后只发 `onDragCancel`。
- 若同一 session反向进入合法邻居，session继续并最终以该目标的 commit或cancel结束，不在边界阶段提前 cancel。

## 6. `sceneControlled=false` 的 drag 到场后驱动

不恢复作者可写四值 driver。运行态继续报告 `'visibility'`，并在 `AnimateTimeline` **新增**：

```ts
readonly mode: ScrollMode;
```

```text
drag + sceneControlled=true  → driver='drag'
drag + sceneControlled=false → driver='visibility'，正式到场后真实时间
scroll                        → 保持既有 scroll/visibility
```

### 6.1 Activation

`activationToken` 表示 Scene已正式成为当前页：

- drag render commit、程序化 commit生成 token；
- 首屏 `firstSceneEnterReady` 生成首个 token；
- 首屏静态揭示超时也建立 active token；当时已挂载元素直接终态，之后动态挂载非场景驱动元素仍可读取 token运行；
- 回弹/取消不生成；
- `onSceneDidChange` 只是同语义点通知，不反向驱动动画。

### 6.2 播放状态机

```text
activation token 或已 active 时挂载
→ delay
→ enterAnimation / stagger
→ infiniteAnimation
→ Scene离开停止并重置
```

| 能力 | drag + `sceneControlled=false` |
|---|---|
| Scene registry / `T_self` | 不参与 |
| drag scrub / mapping | 不参与 |
| delay / enter / stagger / infinite | 支持 |
| 仅 infinite | 内容立即终态可见，delay只延迟循环 |
| waitFor | 不支持；警告后忽略 |
| drag 元素 exit | 不支持；警告后忽略 |
| visibility.* | 全部忽略 |
| 再次到场 | 每次重播 |

动态挂载到 incoming、未 commit的 Scene等待 activation；挂载到 active Scene从挂载时启动。props更新不触发播放或切换当前 driver；新值从重新挂载或下次 activation生效。

### 6.3 Animate 有效性与类型形状

`enterAnimation`、`infiniteAnimation` 从公共 base optional字段移到联合臂：

```ts
type EnterAnimationRequired = {
  enterAnimation: AnimationType;
  infiniteAnimation?: AnimationType;
};

type InfiniteOnly = {
  enterAnimation?: never;
  infiniteAnimation: AnimationType;
};

type AnimateProps =
  | (AnimateBaseWithoutEnterInfinite & EnterAnimationRequired & {
      stagger: AnimateStaggerConfig;
      children: ReactElement;
    })
  | (AnimateBaseWithoutEnterInfinite & (EnterAnimationRequired | InfiniteOnly) & {
      stagger?: never;
      children: ReactNode | ((state: AnimateRenderState) => ReactNode);
    });
```

- 仅 exit全局不合法；scroll既有 exit-only路径与测试同步删除/迁移。
- stagger必须有 enter。
- render-prop宿主、AnimateVideo等封装用 neutral enter明确表达。
- 绕过类型的无有效动画配置：`INVALID_ANIMATION`；生产静态终态。
- scene-driven follower等待 `sceneControlled=false` leader：公共报 `INVALID_ANIMATION`，内部 reason=`incompatible-driver`。

## 7. 预设加载中控

统一服务 Animate 与 scroll Scene transition。状态机：

```text
idle → pending → success
              ├→ failed-permanent（未知/非法预设）
              └→ failed-transient（chunk/网络/部署；可重试）
```

- 成功/永久失败缓存与在途 Promise模块级共享；同分类请求合并。
- consumer持 generation/lease；旧结果只落缓存，不回写新 generation。
- animation props变化重新上报；自定义对象同步解析。
- 卸载只退订；加载成功不触发重播。
- 未知/非法预设：`INVALID_ANIMATION`，永久失败缓存。
- chunk/网络/部署失败：`ANIMATION_ASSET_LOAD_FAILED`，进入公共 `onError`，不永久缓存，允许重试，consumer静态终态 fail-open。

本轮不引入源码扫描、预编译、全分类预加载或远端 Scene预备挂载。

## 8. 诊断与错误表

| 情况 | 通道 | 恢复 |
|---|---|---|
| 满程前提前耗尽 `T_self` | dev warning | 继续并 clamp |
| transaction中修改编排/视觉/driver | dev warning | 当前不变，下次生效 |
| active Scene动态挂载 scene-driven Animate | dev warning | 本轮静态终态 |
| mode-only prop错误模式使用 | dev warning | 忽略 |
| internal readiness阻止方向 | dev warning | 本次方向锁定 |
| 非法 `unit/scale/enabled` | `INVALID_DRAG_CONFIG` | 安全回退 |
| Animate无 enter/infinite、非法 `'none'`、未知预设 | `INVALID_ANIMATION` | 静态终态/排除 |
| 依赖缺失/循环/重复/跨 driver | 既有错误码或 `INVALID_ANIMATION` | fail-open |
| chunk/网络/部署失败 | `ANIMATION_ASSET_LOAD_FAILED` | 清在途、静态终态、可重试 |

- 非法 unit→`time+10`；非法 scale→合法 unit默认；非法 enabled→`true`。
- mode-only诊断按实例与字段集合去重。
- `'none'` 从公共动画预设联合删除；CSS插值的 `'none'` 不动。
- `CineViewErrorCode` 联合与 JSDoc新增 `INVALID_DRAG_CONFIG`、`ANIMATION_ASSET_LOAD_FAILED`。

## 9. DESIGN.md 同步与迁移清单

同步并收敛：

- drag双轨数据流旧公式；
- `DragModeConfig` API表；
- 属性6：drag纯元素 `T_self`，scroll floor保留；
- 属性10：收窄到非场景驱动到场后语义；
- 属性14：改为 `unit/scale + resolveDragMapping`，其余重复公式引用这里；
- 预设清单删除预设 `'none'`；
- 增加 prepared directory、transaction owner、candidate/re-grab suspension、activation token、错误码和 callback契约。

代码迁移：

- 删除 `dragTimeScale`、`dragTimeScalePer100`、`DEFAULT_DRAG_TIME_SCALE`；
- `SceneDragRuntime.dragTimeScale` 改为 prepared/transaction port；
- `Scene.tsx` 按 mode传 registry floor；
- registry新增 stable snapshot/revision port；
- SceneContext/runtime下发 active transaction；所有 element-track路径改读冻结源；
- `Scene.drag` 加入 known/consumed props，禁止透传 DOM；
- 新增并从 barrel导出 `DragTimelineUnit`、`SceneDragConfig`、`DragStartDetail`、`DragBlockedDetail`；
- `DragModeConfig` 增 `unit/scale`；`SceneProps` 增 `drag`；drag callbacks增 `onDragBlocked`并让 `onDragStart` 使用新 detail；
- `AnimateTimeline` 新增 `mode`；同步其构造与断言；
- `AnimateProps` 改为有效动画联合；删除 scroll exit-only路径/测试；
- 错误码联合/JSDoc/测试新增两码；
- site、案例、测试迁移旧字段、旧 driver、旧 onDragStart和可选 commit字段断言。

## 10. 明确不采用

- Animate级 mapping；第三种等价单位；`allowSceneOverride`。
- 闸口拒绝自动回弹；业务可写 render progress；作者可写四值 driver。
- 业务异步 ready推断；预编译/Vite插件/全预设预加载。
- 远端程序化导航隐藏预备挂载。
- drag Scene根级 transition动画。
- nullable `timelineDurationMs` 或额外“是否已准备”公共字段。

## 11. 执行与验收门槛

- [x] 核实现有 drag双轨、registry、场景窗口与驱动解析。
- [x] 完成设计访谈、五维审查与第一轮四维对抗复审。
- [x] 第二版补齐冻结数据下发、registry稳定端口、re-grab suspension、错误码/类型导出和终态配对。
- [ ] 全新独立 Agent 对本版做最终 PASS/FAIL；PASS后同步 `DESIGN.md`。
- [ ] 同步 `DESIGN.md` 后由独立 Agent比对一致性。
- [ ] 分节点实现；每节点后独立 Agent做对抗测试与代码评审。
- [ ] 运行类型、单测、lint、build、site/案例迁移和真实 pointer验收。
- [ ] 观察预设缓存、snapshot编译次数、热路径写入与 transaction泄漏。

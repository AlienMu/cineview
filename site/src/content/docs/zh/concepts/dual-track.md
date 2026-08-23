---
title: 双轨模型与唯一所有者
eyebrow: OWNERSHIP
---

drag 引擎把「页面位移」与「元素编排」拆成两条独立轨道，每条轨道只有一个写入方。这个单写者不变式是 drag 模式最重要的行为边界：理解了它，谁在什么时候写哪个状态就永远有唯一答案，排查动画错乱不再需要猜。

## 两条轨道

**render 轨（全局）：`renderProgress`**

页面位移轨。它驱动整条 scene track 的 translate，并且是 commit（场景切换提交）的唯一触发器。只有正式取得 drag ownership 的会话与 release lane 能写它。`renderProgress` 表示相对当前 Scene 的进度，必须与 `currentScene` 在同一次 React commit 中重基；禁止单独把归零同步出去。

**element 轨（每个 Scene 自持）：`elementElapsedMotion`**

场景编排轨。每个 Scene 实例持有自己的 MotionValue，只有该 Scene 的 `useElementTrack` 能写，跨 Scene 零共享。它只消费本次 `DragSceneTransaction` 冻结下来的 registry 快照、`T_self`、映射与视觉变体，不回退读 live registry。

**`dragRelease`：全局只读指令**

release 发生后，`useSceneManager` 写入一条 `dragRelease` 指令（settle 还是 bounce、目标是谁），向所有 element track 广播「接下来按什么模式续跑」。element track 读取它并各自驱动自己的补完；没有任何消费者反向写它。

## 单写者不变式

| 状态                   | 唯一写者                        | 主要读者                            |
| ---------------------- | ------------------------------- | ----------------------------------- |
| `renderProgress`       | render lane（drag ownership + release） | 页面 translate、commit 判定         |
| `elementElapsedMotion` | 该 Scene 的 `useElementTrack`   | 该 Scene 内全部 scene-driven Animate |
| `dragRelease`          | `useSceneManager`               | 所有 element track（只读指令）      |

prepared snapshot 与 transaction 只提供只读输入。若实现中出现跨 Scene 共享 element elapsed 写者、同一事务混读 live registry、或 incoming/outgoing 各自换算 release elapsed，都属于破坏不变式，必须立即停止。

所有跟手与 release seed 共用同一份解析结果：

```ts
// Resolved once per transaction; consumers never re-derive it.
T_self = max(calculatedDelay + effectiveEnterDuration); // over scene-driven Animate
msPerDragPercent = unit === 'time' ? scale : (T_self * scale) / 100;
map(dragPercent) = clamp(dragPercent * msPerDragPercent, 0, T_self);
localProgress = clamp((elementElapsedMs - calculatedDelay) / enterDuration, 0, 1);
```

`T_self` 是本 Scene 纯元素编排的总时长：drag registry floor 固定为 0，页面 `modes.drag.transitionDuration` 不会抬高它。`sceneControlled=false`、纯 `infiniteAnimation` 与静态内容不进入 `T_self`。

## Animate 如何消费这两条轨道

Animate 不把轨道数值搬进 React state。`useAnimateDrag` 用 MotionValue 单输入映射消费 element 轨：把按 scene 状态（rest / outgoing / enter / hidden）解析好的视觉态写进一个 MotionValue，再由各动画属性从它单层派生。delay 经 `localProgress` 公式门控：`elementElapsedMs ≤ calculatedDelay` 时动画停在 initial 帧。

```tsx
<CineView mode="drag" config={{ size: 750 }}>
  <Scene sceneId="act-1" layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}>
    <Animate animateId="headline" enterAnimation="fade-in" duration={{ enter: 800 }}>
      <h2>Chapter one</h2>
    </Animate>
    <Animate
      animateId="subline"
      enterAnimation="slide-up"
      duration={{ enter: 600 }}
      timeline={{ waitFor: 'headline', delay: 200 }}
    >
      <p>This line follows the headline on the element track.</p>
    </Animate>
  </Scene>
</CineView>
```

上面两个 Animate 都挂在 Scene 1 的 element 轨上：手指拖动时 `elementElapsedMs` 跟手增长，`subline` 要等 `headline` 的入场完成（`waitFor`）再叠加自身 `delay` 才开始；反向拖拽时同一条轨道递减，入场对称倒放。这一切不需要你写任何状态，轨道的所有权在框架内部。

分清两个方向的驱动来源：**入场与续播**由本 Scene 自持的 `elementElapsedMotion` 驱动；**离场视觉**由 outgoing 状态映射 `renderProgress`，退场跟的是页面位移轨。所以手指往回拖时，退场实时回卷，而不是按时间单向播放。这也解释了一条编排规则：入场用 `waitFor` + `delay` 做了级联的，退场要有对应的反向编排（各元素错峰的 `exitDuration`），否则所有元素会在同一帧打包回滚。

## waitFor 链在 element 轨上如何解析

`waitFor` 不是运行时轮询「leader 播完没有」。registry 在快照阶段就把整条依赖链折叠成每个元素的 `calculatedDelay`：

```ts
calculatedDelay(follower) = follower.delay
  + calculatedDelay(leader)
  + leader.effectiveEnterDuration;
```

链式等待逐级累加：`A → B → C` 的 C，其 `calculatedDelay` 是三者 delay 与前驱入场时长的总和。之后 element 轨只需要一个减法，`localProgress = clamp((elementElapsedMs − calculatedDelay) / enterDuration, 0, 1)`，就能确定每个元素此刻该在第几帧；正向跟手、反向倒放、release 补完全部天然对称。

解析同时做两类静态检查：循环依赖（`A waits B waits A`）与缺失依赖（`waitFor` 指向不存在的 `animateId`）都会进入 registry issues，而不是留给运行时表现为「永远不开场」。scene-driven follower 等待非场景驱动 leader 时，公共上报 `INVALID_ANIMATION`（内部 reason 为 `incompatible-driver`）。

## 为什么禁止第二写者

开发原则 2 的核心：**scrub 轨的视觉位置是其唯一所有者的纯函数**。drag 下是手指位移，scroll 下是 zone 的 `progressPx`。第二个写者写入的值不会报错，而是会在下一帧被唯一所有者重新计算覆盖：动画「看起来失效」，实际是写入从未生效。

具体到 API 面：`enterRef` / `exitRef` 手动控制只存在于时间驱动的轨道（visibility 轨与 drag 的 arrival 轨）。在 scrub 轨（scroll takeover、drag 的 scene-controlled 轨）上传 ref，框架会上报 `INVALID_ANIMATION` 并忽略，而不是假装生效。

调试维度同样依赖单写者。排查 drag 链路时的第一个问题永远是：**此刻谁在写这个 MotionValue**。单写者让这个问题有唯一答案。若靠「多试几个判断分支」「猜某个 progress 应该是多少」修问题，等于放弃了所有权模型。

## 排查姿势：先问四个问题

不靠猜测修问题（开发原则 1）。drag 链路行为异常时，先借助关键节点日志回答这四个问题，再动手改代码：

1. 某个 scene 的 `elementElapsedMotion` 此刻是谁在写？（必须只有该 scene 自己）
2. 当前 `renderProgress` 是否已滑到位？（commit 是否该触发）
3. 当前场景和目标场景，谁应该处于可动画状态？
4. 某个具体元素为什么没有开始、为什么被跳过、为什么直接到了终态？

这四个问题分别对应轨道所有权、commit 判定、场景交接与元素门控——恰好是双轨模型的四个故障面。日志覆盖 drag start、release render tick、element track tick、commit start/done 与 element settle complete，能从头回答而不是从结果倒推。

## commit 不释放 element 轨

render commit 只切换当前页，不释放仍在补完的 element transaction：手指越过阈值、页面已翻过去之后，incoming 场景的元素动画仍按 release seed 继续补完（settle 到 `T_self`，bounce 回到 0），可以跨越 commit 边界。

正在续跑的 settle 被重新抓住时（re-grab），框架创建可逆的 suspension：暂停并保留剩余时长，gate 通过则原地接管为新的 ownership，tap 或取消则恢复原 continuation。不会出现 flush 式的单帧整栈瞬移。

## transaction 的生命周期

两条轨道的跨 Scene 一致性由不可变快照保证，生命周期是一个显式状态机：

```ts
// DragSceneTransaction states
driving -> settling | bouncing | retargeted | aborted -> released;
```

- Scene 在预设解析与 registry 稳定后，向 CineView 发布不可变的 prepared snapshot（`instanceId + revision`、解析后的 mapping、compiled registry 与视觉变体）。
- drag 发生时，CineView 从目标 Scene 的 prepared snapshot 建立 transaction，冻结 registry snapshot、`T_self`、mapping、variants 与 release seed；Scene 后续新 revision 不修改既有 transaction。
- element track 的全部动作（跟手、settle、bounce、orphan resume、re-grab continuation）只读冻结 transaction，禁止回退 live registry。
- render commit 不释放 transaction；element settle 完成后才 `released`。Scene 卸载用 `instanceId + revision + transactionId` 通知中控，过期实例的清理不得终止新 transaction。

这套冻结机制是单写者不变式的数据面：写者唯一不仅因为纪律，更因为轨道消费者拿到的输入本身就是不可变的。

## ownership 如何取得：candidate 与 gate

render 轨不是「按下就接管」。普通 pointer-down 只建立 candidate：不置全局 dragging、不抢占 element 轨、不阻止默认行为、不发任何 drag 回调。首个有效轴向移动才决定候选 Scene 并计算闸门（业务 `drag.enabled` 与内部 readiness 同时通过），通过后一次性完成：取得 render 轨 ownership、建立 transaction、置 dragging、抑制点击并发 `onDragStart({ progress: 0, direction })`。

被闸门拒绝的按压不影响页面：同一按压同方向被拒后锁定（闸门中途变 open 也不启动），明确反向可预检另一侧；业务拒绝每方向最多发一次 `onDragBlocked`，内部 readiness 拒绝只发开发诊断。物理边界保留 render-only 橡皮筋，边界 progress 固定为 0。

对作者的直觉意义：一次轻点永远不会被误读成拖拽开始；而一旦 `onDragStart` 发出，这个 pointer session 最终必然以恰好一次 `onDragCommit` 或 `onDragCancel` 收口。

## scroll 模式的同一原则

scroll 侧不使用双轨，但遵守同一条所有权纪律：**唯一 scroll owner**。`Scene.scroll` progress owner 与 native 文档流二选一，绝不并行。zone progress 是 `scrollTop` 的纯函数（center-lock 段即真实滚动距离，`1ms = 1px`），反向滚回时 progress 天然 `100% → 0%`，无需任何记忆模型。

所有权一旦取得同样不被中途重算：center-lock trigger 只决定某个 scene 首次获得 progress ownership；ownership 期间，后续输入按真实 px delta 消费剩余 progress，不会被再次触发点截短、节流或重算。大 flick 的「防跳过」同样来自所有权语义：过大的 delta 被钳到滚动段边界内侧，强制用户看到段内帧，而不是一跳跨过整个动画。

任何视觉补偿只影响渲染，不创建第二套虚拟滚动指标。

## 已删除的模型，保持删除

历史上 drag 曾用全局 `sharedElapsedMs` 标量 + `dragTransitionSnapshot` 交接机制：commit 时把 elapsed 从 outgoing「交接」给 incoming。这套模型已删除且不得恢复：它让 element elapsed 出现了第二个写者，交接边界上的每一处半程状态都是一个历史 bug 来源。

同样已删除的还有：`dragTimeScale` / `dragTimeScalePer100`（被 `unit + scale` 映射取代）、页面 `transitionDuration` 作为 drag `T_self` 下限、以及 commit 时交接 element elapsed 的整个思路。如果你在旧代码或旧文档里看到它们，那是历史记录，不是可恢复的 API。

## 小结

把双轨模型压缩成三句话：

1. 页面翻到哪，问 render 轨；元素播到哪，问该 Scene 的 element 轨；release 之后怎么续跑，问 `dragRelease` 指令。三者各有唯一写者。
2. 作者侧没有任何「写 progress」的 API：编排全部通过声明（`duration` / `delay` / `waitFor`）进入冻结快照，运行时由轨道按声明重放。
3. 看到动画行为与预期不符，先问「此刻谁在写」，再问「声明进了哪个快照」；两个问题都有唯一答案，才动手改。

---
title: 四条输入路径
eyebrow: SCROLL / INPUT
---

滚轮、触摸、键盘、拖滚动条，四种输入最后都归到同一个函数：把增量交给防跳过钳制（clamp），钳完写 `scrollTop`，再同步一次 zone 状态。锁定区（locked zone）的语义因此天然一致，四条路径的差别只在「增量怎么算出来」和「谁有资格拦」。

## 汇聚点

```text
输入事件 → 归一化成主轴 px 增量 → applyNativeScrollDelta(delta)
         → 防跳过钳制：拦下会跳过锁定段的大增量→ 写 scrollTop → 同步 zone 状态
```

`applyNativeScrollDelta` 返回一个布尔值：增量是否真被消费。钳制后的位置与当前偏移相差不到 0.5px 时返回 `false`，一像素都不写。

拖滚动条走的是 `applyNativeScrollbarOffset`：它把「目标偏移」换成增量后过同一道钳制，所以拖滚动条也不能跳过锁定段。

## preventDefault 是有条件的

这是整套 scroll 接管里最容易被误解的一处：引擎**只在增量真被消费时才 `preventDefault`**。

```text
if (applyNativeScrollDelta(delta) && event.cancelable) event.preventDefault();
```

而在段尾（`segmentEnd`）处，钳制会返回零位移，于是不消费，于是不拦，于是浏览器的原生滚动接手，页面继续往下走。zone 的释放机制就是这个：没有计时器，没有「解锁」状态位，也没有一段代码去决定「什么时候放行」。锁定期间事件被拦，预算走完后同一段代码自然不再拦。

反过来也成立：`event.defaultPrevented` 为真的事件，或目标不在本 CineView 容器内的事件，引擎一开始就不看。

## 四条路径的差异

| 路径      | 增量来源                                                | 归一化                                                                 | 特殊之处                                     |
| --------- | ------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| wheel     | `direction:'y'` 读 `deltaY`，`'x'` 读 `deltaX`          | `deltaMode:1`（行）×18；`deltaMode:2`（页）× 视口跨度；`0`（像素）原样 | capture 阶段 + `passive: false` 绑定         |
| touch     | `touchstart` 记基线，`touchmove` 取基线与当前点的主轴差 | 直接当 px 用                                                           | 每帧重设基线，增量始终是「这一帧移动了多少」 |
| keyboard  | 按键映射成固定步长                                      | 见按键步长表                                                           | 两个 handler，语义不同                       |
| scrollbar | 拖拽 / 点击轨道算出目标偏移                             | 转成增量后过同一道钳制                                                 | 键盘方向键在 rail 聚焦时也走同一套步长       |

键盘步长写死，不可配置：

| 按键                    | 步长                   |
| ----------------------- | ---------------------- |
| `PageDown` / `PageUp`   | ± 视口跨度 × 0.86      |
| `Space` / `Shift+Space` | 同 PageDown / PageUp   |
| `ArrowDown` / `ArrowUp` | ± 80px                 |
| `Home` / `End`          | ∓ Infinity（钳到两端） |

## 键盘的两个 handler

按键输入有两个绑定点，语义不一样，作者需要知道的是它们各自漏掉了什么。

window 级（捕获阶段）：要求 `document.activeElement` 是 `body` 或 `documentElement`，也就是页面上没有任何东西聚焦时才生效。它不检查嵌套滚动容器，也不检查事件目标是否落在容器内。

后果是：scroll 模式的 CineView 在无焦点状态下会接管整个文档的方向键与空格，**即使根容器已经滚出视野**。把 CineView 嵌进一个更长的普通页面时，这是绕不开的限制，设计时要避开它：页面级唯一 scroll 根，或让容器外的可交互元素持有焦点。

容器级（`onKeyDownCapture`）：不要求 activeElement 是 body（焦点合理地可以落在容器内部），但会检查嵌套滚动容器并让路。

两者共用一条豁免：所有按键都释放给 `input` / `textarea` / `select` / `contentEditable`（打字），空格额外释放给 `button` / `summary` / 带 `href` 的 `a` / `role="button"` / `role="link"`（激活）。没有这条豁免，输入框里的空格会被 `preventDefault` 吞掉。

## direction: 'x' 下按键不旋转

横向模式有两处需要明确：

- **按键语义不旋转**。`ArrowDown` 仍然表示「沿 x 正向」，`PageDown` 同理。没有「ArrowRight 变成主轴正向」这回事。
- 滚轮只读 `deltaX`。纯竖向的鼠标滚轮在横向模式下产生 0 增量，什么都不动。触控板的横向手势、`Shift + 滚轮`（浏览器会把它记为 `deltaX`）才有效。

做横向叙事时，键盘提示文案按实际生效的键写，不要按方向直觉写。详见[横向 direction: 'x'](/docs/04-direction-x)。

## 嵌套滚动容器优先

增量在进钳之前，引擎会从事件目标往上走到容器根，逐层看有没有「同轴上还有余量的可滚动祖先」：计算样式的 `overflow-x` / `overflow-y` 是 `auto`、`scroll` 或 `overlay`，可滚动跨度超过 1px，且在本次增量的方向上还没到底。命中就整体让路：不钳、不 `preventDefault`、不写根偏移，输入完全交给那个内层容器。

这条对作者的直接影响是：**锁定区里放一个内层滚动条，它会消费滚轮直到自己滚到底**。zone 的锁定进度在那期间完全不推进，观众看到的是画面停住不动。要在锁定区里放长文本，用 zone 自己的预算做揭示，不要嵌一个 `overflow: auto` 的框。

wheel 与 touch 两条路径都过这道检查；容器级键盘 handler 也过，window 级不过。

## 程序化滚动与用户输入的抢占

`goToScene` / `goToZone` 发起的平滑滚动期间，引擎标记「在途程序化目标」并跳过意图钳（否则钳的纠正性 `scrollTo` 会中断平滑动画）。任何一条真实用户输入路径进来，都会当场：把在途标记清掉、用 `behavior: 'auto'` 的 `scrollTo` 把平滑动画停在当前位置、以真实偏移重设增量基线。此后这次手势走正常的钳流程。

也就是说用户永远能打断程序化导航，且打断点就是输入到达的那一刻，页面不会先滚到目标再退回来。

## 相关页面

- [center-lock 滚动接管](/docs/01-centerlock)：意图钳的完整规则表
- [滚动条主题化](/docs/05-scrollbar)：自绘滚动条的字段与默认值
- [横向 direction: 'x'](/docs/04-direction-x)：横向模式的全部差异
- [scroll 排错](/docs/06-scroll-pitfalls)：输入相关的常见故障

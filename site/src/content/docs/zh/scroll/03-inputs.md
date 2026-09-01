---
title: 四条输入路径
eyebrow: SCROLL / INPUT
---

滚轮、触控、键盘与滚动条拖拽四种输入源最终汇聚至统一的派发管道：增量经由防跳过拦截与边界约束计算后写入 `scrollTop`，并同步触发锁定区状态更新。四条路径的差异主要体现在增量计算方式与事件消费条件。

## 汇聚点

```text
输入事件 → 归一化为主轴 px 增量 → applyNativeScrollDelta(delta)
         → 防跳过边界约束 → 写入 scrollTop → 同步锁定区状态
```

增量写入会返回一个布尔值，指示这次增量是否被消费。计算后的目标位置与当前偏移相差不足 0.5px 时返回 `false`，不产生 DOM 写操作。

滚动条拖拽走另一条入口：先把目标偏移转成增量，再执行相同的边界约束，确保拖拽滚动条同样遵循锁定段规则。

## 条件性 preventDefault

引擎仅在滚动增量被有效消费时调用 `preventDefault`：

```text
if (applyNativeScrollDelta(delta) && event.cancelable) event.preventDefault();
```

当滚动到达锁定段终点（`segmentEnd`）时，约束逻辑返回 0 位移，不再消费事件，浏览器原生滚动无缝接管并继续向下流动。

对于已被标记 `event.defaultPrevented === true` 或事件目标位于 CineView 容器外部的事件，引擎直接忽略。

## 四条路径的差异

| 路径      | 增量来源                                           | 归一化                                                                 | 特殊之处                             |
| --------- | -------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| wheel     | `direction:'y'` 读取 `deltaY`，`'x'` 读取 `deltaX` | `deltaMode:1`（行）×18；`deltaMode:2`（页）× 视窗跨度；`0`（像素）原样 | capture 阶段 + `passive: false` 绑定 |
| touch     | `touchstart` 记录基线，`touchmove` 计算主轴位移差  | 直接作为 px 消费                                                       | 每帧重设基线，增量反映当前帧位移     |
| keyboard  | 按键映射成固定步长                                 | 见按键步长表                                                           | 两个 handler，语义不同               |
| scrollbar | 拖拽 / 点击轨道算出目标偏移                        | 转换为增量后执行统一边界约束                                           | 键盘方向键在 rail 聚焦时复用相同步长 |

键盘步长为内置固定常量，不支持外部重置：

| 按键                    | 步长                     |
| ----------------------- | ------------------------ |
| `PageDown` / `PageUp`   | ± 视窗跨度 × 0.86        |
| `Space` / `Shift+Space` | 同 PageDown / PageUp     |
| `ArrowDown` / `ArrowUp` | ± 80px                   |
| `Home` / `End`          | ∓ Infinity（约束至两端） |

## 键盘事件监听体系

键盘输入包含两套绑定层级：

window 级（捕获阶段）：仅当 `document.activeElement` 为 `body` 或 `documentElement` 时响应，此时焦点未被具体元素捕获。该层级不校验嵌套滚动容器。

容器级（`onKeyDownCapture`）：当焦点处于容器内部时响应，自动识别嵌套滚动容器并优先让路。

两者均包含表单元素豁免规则：所有按键直接交由 `input`、`textarea`、`select` 及 `contentEditable` 元素处理；空格键额外释放给 `button`、`summary` 与带 `href` 的链接等可交互节点。

## 横向模式说明

横向模式有两处需要明确：

- 按键映射保持主轴正向语义（`ArrowDown` 与 `PageDown` 仍对应主轴正向步长）。
- 滚轮仅读取 `deltaX`；垂直滚轮输入产生 0 增量，需使用触控板横向滑动手势或 `Shift + 滚轮`。

详见 [横向 direction: 'x'](/docs/04-direction-x)。

## 嵌套滚动容器优先权

在执行边界计算前，引擎沿 DOM 树向上遍历，检测是否存在同轴且尚未滚到底部的可滚动祖先（样式包含 `overflow: auto/scroll` 且可滚动距离超过 1px）。若命中，则直接让出事件控制权，不调用 `preventDefault`，优先保证内层容器滚动。

wheel、touch 与容器级键盘事件均包含此项检查。

## 程序化滚动与用户输入的抢占

在 `goToScene` 或 `goToZone` 执行平滑滚动期间，引擎标记程序化状态并暂时跳过防跳过拦截。一旦检测到任意真实用户输入（滚轮、触摸、按键、拖拽），引擎立即清除在途标记，将滚动位置瞬时锁定在当前帧，并重新以当前物理偏移建立手势基线。

## 相关页面

- [center-lock 滚动](/docs/01-centerlock)：防跳过拦截机制与锁定几何
- [滚动条主题化](/docs/05-scrollbar)：自绘滚动条的字段与默认值
- [横向 direction: 'x'](/docs/04-direction-x)：横向模式的全部差异
- [scroll 排错](/docs/06-scroll-pitfalls)：输入相关的常见故障

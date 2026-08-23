---
title: CineView
eyebrow: ROOT
---

CineView 选择模式引擎、提供设计宽度上下文、调度预加载，并暴露命令式导航。

## When to use

- 页面要按章节（`Scene`）组织，章节间带进退场编排，而不是一篇普通滚动文档。
- 需要 drag（拖拽分页，全屏栈语义）或 scroll（真实文档流滚动接管，center-lock 锁定段）作为整个页面的根。
- 需要全站统一的设计稿换算尺子（`config.size`，认宽不认高）或统一预加载调度。即便不用场景栈，也别自建第二套尺子。

## 模式与 scrollbar

`mode` 与 `callbacks` 构成判别联合：向 drag 模式传 scroll 回调（或反之）是类型错误，inline 字面量与提取后的变量两条赋值路径都被堵住。模式一经选定，运行时按 `mode` 派发到对应引擎。`CineView` 是唯一入口，两套引擎都在包里；在意包体积的 UMD 消费者可改用 `cineview/drag` / `cineview/scroll` 按模式入口。

scrollbar 覆盖层是 scroll 模式的选配：传对象即启用，厚度、圆角、颜色、内缩与 autoHide 的完整字段见 API 参考。它不只隐藏原生滚动条，还承接拖拽导航与键盘交互。

## Ref API

公共方法 `goToScene` / `refreshLayout` / `preload` / `getCurrentScene` / `getPerformanceMetrics` 两种模式都可用，从场景跳转到布局刷新都是命令式调用。`goToZone` 仅 scroll 模式提供，在 `CineViewScrollRef` 上是必填项。ref 的取得方式与完整签名见 API 参考。

## 常见误用

- **给 drag 模式传 `scroll` 回调**（或反之）：判别联合直接报类型错误，不是运行时静默忽略。
- **改 `config.size` 当「缩放开关」用**：它是设计稿基准，不是主题参数。换尺子意味着所有设计 px 的语义随之改变。
- **`children` 不写 `Scene`**：CineView 只识别 Scene 子节点，一个都没有时上报 `NO_SCENES`。

---

完整字段参考见 [CineView API](/docs/cineview-api)。

---
title: CineView
eyebrow: ROOT
---

CineView 选择模式引擎、提供设计宽度上下文、调度预加载，并暴露命令式导航。

## When to use

- 需要影院式叙事页面——按章节（`Scene`）组织内容、章节间带进退场编排——而不是普通滚动文档时。
- 需要 drag（拖拽分页，全屏栈语义）或 scroll（真实文档流滚动接管，center-lock 锁定段）两种模式引擎之一作为整个页面的根。
- 需要一把全站统一的设计稿换算尺子（`config.size`，认宽不认高）或统一预加载调度时——即便不用场景栈，也别自建第二套尺子。

## 模式与 scrollbar

`mode` 与 `callbacks` 构成判别联合：向 drag 模式传 scroll 回调（或反之）是类型错误——inline 字面量与提取后的变量两条赋值路径都被堵住。模式一经选定，运行时按 `mode` 派发到对应引擎（`CineView` 是唯一入口，两套引擎都在包里；在意包体积的 UMD 消费者可改用 `cineview/drag` / `cineview/scroll` 按模式入口）。

scrollbar 覆盖层是 scroll 模式的选配：传对象即启用，主题化（厚度/圆角/颜色/内缩）与 autoHide 行为的完整字段见 API 参考。隐藏原生滚动条之外，它还承接拖拽导航与键盘交互。

## Ref API

公共方法始终可用。goToZone 仅 scroll 模式提供，并且是 CineViewScrollRef 的必填项。

```tsx
const ref = useRef<CineViewScrollRef>(null);

ref.current?.goToScene(2, true);
ref.current?.goToZone('sequence', { animated: true });
ref.current?.refreshLayout();
ref.current?.preload(['hero']);
```

## 常见误用

- **给 drag 模式传 `scroll` 回调**（或反之）——判别联合直接报类型错误，不是运行时静默忽略。
- **改 `config.size` 当「缩放开关」用**——它是设计稿基准，不是主题参数；换尺子意味着所有设计 px 语义随之改变。
- **`children` 不写 `Scene`**——CineView 只识别 Scene 子节点，一个都没有时上报 `NO_SCENES`。

---

完整字段参考见 [CineView API](/docs/cineview-api)。

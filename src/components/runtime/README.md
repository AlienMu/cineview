# runtime/ — 共享运行时设施

双模式引擎（drag / scroll）与 Scene 对等依赖的运行时基础设施，不属于任何一个引擎：

- `runtimeContext.tsx` — CineView 运行时上下文（模式、reportError 路由、scroll 可见性门 margin 默认值）
- `scrollExternalStore.ts` — 通用外部存储原语（整体 / keyed 两形态，useSyncExternalStore 消费）
- `scrollSceneFrameStore.ts` — scroll 场景连续帧通道（native scroll controller 唯一写者）

放在独立目录是为了让 Scene 组件不 import `../CineView/...`——引擎目录只放引擎。
对 CineView/ 的依赖仅剩 type-only 边（如 `ScrollInputDirection`）。

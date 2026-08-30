# CineView — Minimal Example

教学级最小示例：一个 `CineView`、三个 `Scene`、三个 `Animate`（含一组 `timeline.after`
级联编排），顶栏按钮在 drag / scroll 双引擎间切换同一棵声明树。

## 启动

```bash
pnpm --dir examples/minimal install
pnpm --dir examples/minimal dev    # 打开 Vite 打印的地址（默认 http://localhost:4100）
```

前置：仓库根先 `pnpm build` 一次——本例像真实消费者一样通过包入口吃 `dist/`
产物，不吃 `src/`；根仓库改动后需重新 build 才会反映到本例。

## 与框架文档的对应关系

本例是框架 README「Minimal Usage」与 getting-started 文档页的**活代码真源**
（task-flow `2026-08-23-minimal-example.md` M3）：文档中的代码块从
[`src/App.tsx`](./src/App.tsx) 节选同步，两处文件头注释互指。修改 `src/App.tsx`
的公共 API 用法时必须同步文档，反之亦然——防止文档漂移。`pnpm type-check`
针对 `dist/index.d.ts` 编译，兼作公共 API 漂移哨兵。

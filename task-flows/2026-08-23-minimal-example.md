# 2026-08-23 教学级 minimal example（examples/minimal）

定位（grill-me 对齐）：与阶段 3 T1 并行；**getting-started 文档页的活代码真源**
（md 示例从本例同步拷贝，防文档漂移）；type-check 充当轻量 API 漂移哨兵
（performance-test 依赖重的角色由它分担）。

## 节点

- [x] M1 脚手架：examples/minimal/ 独立 package.json（cineview: link:../../，
      react/react-dom/framer-motion 对齐 performance-test 的 dedupe 方案）+ vite 最小配置
      （2026-08-23 完成；与 performance-test 的刻意差异：不 alias 到 src，走包入口吃
      dist/ 产物——真实消费者视角，type-check 兼作 dist API 漂移哨兵；根 `pnpm build`
      为前置。install/type-check/build/dev-boot 四绿）
- [x] M2 内容：README 快速上手同款——一个 CineView（config.size 默认基准）+ 2-3 Scene +
      2-3 Animate（含一个 waitFor 级联演示编排），顶部按钮切 mode（drag↔scroll，
      双模式同构展示）
      （2026-08-23 完成；mode 切换用 `key={mode}` 整树重挂并注释理由——mode 是根声明、
      双引擎各持不同 DOM/运行时，框架无跨引擎状态移交；级联放在带 scroll 声明的
      takeover scene（waitFor 链是 registry 驱动，drag 全场景 + scroll zone 内成立，
      纯 visibility 降级场景不保证链式）；同一棵声明树 drag 下 scroll 声明惰性
      （useSceneScrollTakeover 的 mode 门控）。App.tsx 120 行）
- [ ] M3 与文档同步契约：getting-started 页代码块 = 本例源码节选（T1.3 落地时执行同步，
      在两处文件头注释互指）
- [ ] M4 验收：pnpm i 后 dev 直接可跑（fresh agent 冒烟：双模式切换 + Animate 入场 +
      waitFor 级联可见——并入 T1.8 统一浏览器 lane 批量执行）+ type-check 纳入
      verify:framework:static 链
      （type-check 挂链已完成 2026-08-23：minimal 的 type-check 自带根 build 前置
      ——类型走 dist 包入口，净克隆不断链；根 type-check:examples 串双示例，
      `pnpm type-check:examples` 实跑绿。浏览器冒烟待 T1.8 lane）

## 约束

- 只用框架公共 API（不得 import 内部模块）；不引 playwright 等重依赖；
  行数上限 ~150（教学可读性优先，不做视觉打磨——对比度/样式原值属用户领地）。

# 2026-08-23 教学级 minimal example（examples/minimal）

定位（grill-me 对齐）：与阶段 3 T1 并行；**getting-started 文档页的活代码真源**
（md 示例从本例同步拷贝，防文档漂移）；type-check 充当轻量 API 漂移哨兵
（performance-test 依赖重的角色由它分担）。

## 节点

- [ ] M1 脚手架：examples/minimal/ 独立 package.json（cineview: link:../../，
      react/react-dom/framer-motion 对齐 performance-test 的 dedupe 方案）+ vite 最小配置
- [ ] M2 内容：README 快速上手同款——一个 CineView（config.size 默认基准）+ 2-3 Scene +
      2-3 Animate（含一个 waitFor 级联演示编排），顶部按钮切 mode（drag↔scroll，
      双模式同构展示）
- [ ] M3 与文档同步契约：getting-started 页代码块 = 本例源码节选（T1.3 落地时执行同步，
      在两处文件头注释互指）
- [ ] M4 验收：pnpm i 后 dev 直接可跑（fresh agent 冒烟：双模式切换 + Animate 入场 +
      waitFor 级联可见）+ type-check 纳入 verify:framework:static 链
  （注：type-check:examples 已覆盖 examples/*——确认 tsconfig 引用即可）

## 约束

- 只用框架公共 API（不得 import 内部模块）；不引 playwright 等重依赖；
  行数上限 ~150（教学可读性优先，不做视觉打磨——对比度/样式原值属用户领地）。

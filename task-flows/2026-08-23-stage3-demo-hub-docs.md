# 2026-08-23 阶段 3：Demo Hub 补全 + 双语文档站（grill-me 对齐后）

来源：2026-06-30-official-site-docs.md 阶段 3 续作，2026-08-23 grill-me 重新对齐
（发布链已全绿：4179d74→ef62d8a 五提交 + N6 真机验收 PASS，前置条件满足）。

## 已对齐的裁决（2026-08-23 grill-me）

1. **文档架构**：双语 Markdown 目录（site/src/content/docs/{zh,en}/*.md + frontmatter，
   manifest.ts 派生侧边栏/路由，react-markdown+gfm+highlight 渲染）；
   现 DocsPage 491 行内联 TS 内容迁移为首批 md；构建期 zh/en 同构校验（缺页报错）。
2. **节奏**：两波分层——T1 入门+核心概念+组件 API（~13 页×2），T2 动画+进阶（~11 页×2）；
   每波双语同步交付、独立浏览器验收。
3. **Demo Hub**：3.2 原案补全（zone progress 实时可视化 + waitFor 级联沿滚动推进）
   + 两个交互位：AnimateVideo 帧擦洗（复用 site/public/video.mp4 全关键帧 3.9MB，
   首页已加载可共享缓存）、enterRef 按钮触发手动入场（可反复触发）。drag 侧不动。
4. **教学示例**：单列 task-flow（2026-08-23-minimal-example.md），与 T1 并行；
   examples/minimal 为 getting-started 页的活代码真源（md 示例从它同步，防漂移），
   type-check 充当轻量 API 漂移哨兵。
5. **文档准确性验收**：T1/T2 收口各由 fresh agent 做「API 断言对齐」核对
   （每页 props/示例对 src/public-api.ts 与类型）；行文风格由用户抽查（用户领地）。
6. CLAUDE.md 数据刷新（1127→1579+、test-threshold.js 归属纠正、firstSceneEnter 关闭项）
   折入 T1 作为文档节点；README 刷新折入 T2。
7. 部署目标不变（CF Pages，阶段 1 的 _redirects/build:cf 沿用）。

## T1 节点（入门+核心概念+组件 API + Hub + 架构）

- [x] T1.1 文档管线 ✅：content/docs/{zh,en}/ 目录 + manifest.ts（glob raw + frontmatter
      解析 + 索引/TOC/headingId 同源）+ DocsPage 混合改造（md 优先、legacy 兜底，
      迁移期不缺页）+ global.css markdown/hljs 令牌化样式 + vite-env.d.ts +
      契约测试 docsContent.test.ts 3/3（zh/en 同构/组白名单/frontmatter title，
      fs 直读独立复检）。验证：site type-check 0 错、site build 通过。
      试点页 introduction 双语已迁。T1.2（余 15 页×2 + legacy 拆除）与
      minimal-example M1-M2 已派双 agent 并行，均带 /tmp 笔记防中断
- [x] T1.2 迁移现有内联内容为双语 md ✅（agent 执行，主会话五项抽查属实）：
      16 页 ×2 = 32 md 全迁（en 正文来自 legacy、zh 忠实翻译、代码围栏字节级一致）；
      DocsPage legacy 全拆（596→173 行）；i18n 双字典对称删 19 个 docs.page.* 死键；
      验证三连绿（type-check / 契约 3/3 / build）。过程一次 Edit 反向自愈无残留
- [ ] T1.3 入门三页：installation / getting-started（示例同步自 examples/minimal）/ introduction
- [ ] T1.4 核心概念五页：px2vw 单尺 / 双轨与唯一所有者 / drag vs scroll 选型 /
      时间轴与编排（waitFor·delay·stagger）/ scene-scoped fixed layer
- [ ] T1.5 组件 API 七页：CineView / Scene / Animate（enterRef/exitRef+infiniteAnimation）/
      AnimateVideo（帧擦洗+全关键帧约束+releaseOnLeave）/ Position / Container·Image /
      useAnimateTimeline
- [ ] T1.6 Demo Hub 补全：zone progress 可视化条 + waitFor 沿滚动级联 + AnimateVideo
      交互位 + enterRef 按钮交互位
- [ ] T1.7 CLAUDE.md 数据刷新节点
- [ ] T1.8 门禁 + fresh agent 验收（API 断言对齐 + 浏览器 lane：双语切换/高亮/锚点/
      Hub 四交互）+ 提交

## T2 节点（动画+进阶）

- [ ] T2.1 动画三页：44 预设总览 / 自定义动画 / waitFor 级联与 StaggerContainer
- [ ] T2.2 进阶六页：center-lock 与 zone / 冷启动预加载 / 回调与错误上报 /
      性能实践（全关键帧编码硬约束、motionValue 纪律、并发观测）/ direction:'x' /
      滚动条主题化
- [ ] T2.3 README 刷新（补 drag 模式示例 + SSR 边界声明 + 关键帧约束）
- [ ] T2.4 门禁 + fresh agent 验收 + 提交

## 明确不做（本轮）

- 8 项新能力全展廊（与文档代码示例重叠）；P3 代码级遗留（dist 调试死开关、
  旧告警前缀、同 tick release+warmUp 边界）——已记档，与文档线无关。

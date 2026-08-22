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
- [x] T1.3 入门三页 ✅：introduction/installation 已迁移在册；quickstart 重写为
      minimal 真源镜像（M3 契约落地：代码节选自 examples/minimal/src/App.tsx，
      双向互指注释；含运行命令/级联讲解/一棵树双引擎三个教学点）
- [x] T1.4 核心概念五页 ✅：responsive/modes/timeline 迁移在册 + 新页 dual-track /
      fixed-layer 双语（agent 执行，事实源逐行号核实：dragRelease 写者 / waitFor 累加 /
      fixed host 挂载点均对照源码）
- [x] T1.5 组件 API 七页 ✅：六页迁移 + 新页 use-animate-timeline 双语；既有六页
      zh/en 各注入 Props 全表（agent 执行：字段逐一对照 types/index.ts 与实现处默认值，
      附 9 条 types 缺 JSDoc 观察清单记档；顺手修真 bug——image.md 用了不存在的
      priority prop → preload）
- [x] T1.6 Demo Hub 补全 ✅：zone progress 读数（公共回调 onZoneProgress + ref 命令式
      投影，零每帧 React 渲染）+ waitFor 三级链（title→subline→video 沿滚动推进）+
      AnimateVideo 帧擦洗位（全关键帧 video.mp4）+ enterRef 手动入场位（visibility 轨
      + 粘性所有权教学文案）。实现中核出的 API 形态事实：waitFor 与 phase 是互斥
      timeline 判别联合；AnimateVideo.timeline 是窄内联类型仅 delay/waitFor——均按
      真实形态落地并在代码注释记录
- [x] T1.7 CLAUDE.md 数据刷新节点 ✅：runtime/ 迁移后路径、layout 树、
      1582/122 测试数、build:verify 14/14 与 verify 链修复记录、N6 验收完成、
      firstSceneEnter 关闭项、下一步重点改为阶段 3 状态、test-threshold.js
      归属纠正（真门 jest.config.js coverageThreshold）
- [x] T1.8 门禁 + fresh agent 验收 ✅ **首轮 FAIL → 修复 → 聚焦复审 PASS（2026-08-23）**
  - 首轮全量：A 审计 38 md（唯一真错误五态/六态已修）；文档站 18/18；minimal M4 8/8；
    Demo Hub 8 PASS / 2 FAIL（waitFor 链序 / 卡片重播）+ 按钮遮挡观察
  - 修复：title 摘 phase 改纯三级链；ManualControlSlot 重做（enter/exit 双按钮 +
    exitAnimation + hit-testing 前置 z-index）；错误注释改扁平类型事实；
    timeline.md 双语六态
  - 复审（真机 4025）：链窗 [0,600]→[600,1200]→[1200,7200]px 零重叠、真指针
    enter→exit→enter 循环、三态按钮恒可点、console 0 —— 全 PASS
  - 证据入库 site/review/20260823-t18-acceptance/（两轮笔记/探针/trace/截图）
  - **T1 波收口** ✅（19 页×2 + 管线 + Hub + minimal + CLAUDE.md + README）
  - **首轮终验 FAIL（2026-08-23，agent 全量报告 /tmp/t18-acceptance-notes.md）**：
    A 审计 38 md 唯一真错误 = timeline.md 五态/六态（当轮已修）；文档站 18/18 PASS
    （双语/路由/高亮/TOC/console 全绿）；minimal M4 8/8 PASS；Demo Hub 8 PASS / 2 FAIL
  - **FAIL 1 waitFor 链序**：leader 带 phase 窗口时 sceneScrollBudget 的 resolveTiming
    双时钟分裂（px 级 totalEndPx 做 phase 校正、ms 级 waitFor 链没跟上）→ subline 在
    title 14% 时起动。**修复**：demo 侧摘 phase 改纯三级链。
    ⚠️ **框架侧缺口记档（待用户裁决 P2）**：phase leader + waitFor follower 的语义
    分裂是框架级问题——修 sceneScrollBudget（链消费 leader 的 phaseEnd）或在类型/文档
    声明约束。minimal 例纯链严格有序证明缺口仅在混用时显现。
  - **FAIL 2 卡片重播**：无 exitAnimation 的元素「no exit => stay visible」，
    replayOnReenter 结构性不生效，原 hint 教了无法演示的规则。**修复**：改
    enter/exit 双按钮（visibility 轨支持 exitRef），hint 改教轨道支持矩阵。
  - **附带修复**：真指针按钮被卡片 initial 位移盖 hit-testing → 按钮前置+z-index；
    我的错误注释（waitFor/phase 互斥判别联合）改正为扁平类型事实（AnimateBaseProps
    timeline 扁平可选字段，窄类型仅 AnimateVideo）
  - 复审 agent 运行中（聚焦 A/B/C/D 四场景）

## T2 节点（动画+进阶）

- [x] T2.1 动画三页 + AnimateVideo 页 ✅（agent 执行，主会话权威验证：契约 3/3 +
      type-check/build 绿）：presets 总览（预设总数 **43**——animationCategoryMap/
      PresetAnimation union/各类别模块导出三方核对；「44」是结构评审沿袭口径，无人
      实数过，本轮纠正）/ 自定义变体（关键帧
      数组 + composer 组合）/ waitFor 级联与 stagger（含 T1.8 实证「leader 勿带
      phase」约束小节）/ AnimateVideo（帧擦洗 + 全关键帧硬约束 + releaseOnLeave，
      补上审计点名的零覆盖缺口）
- [x] T2.2 进阶六页 ✅（agent 执行）：新页 direction-x（x 轴证据链逐处核实）+
      scrollbar-theming（字段表对照默认值与钳制；纠正任务书数字——idle timer 实码
      120ms）；既有四页 append 增强（centerlock 补 phase 窗口语义与双时钟约束/
      preload 补冷启动门/ callbacks 补零渲染读数模式/ performance 补关键帧编码与
      N6 并发观测范式与 motionValue 纪律）
- [x] T2.4 门禁 + fresh agent 验收 + 提交 ✅ **T2.4 终验 PASS（2026-08-23）**
  - A 静态审计 20 文件零 API 失实（43 预设逐类归属、autoHide 四时序数字逐毫秒、
    AnimateVideo 全字段、2% 迟滞、1.5/1 视口频带全部与代码行号级吻合）；
    2 条非阻断 nit 记档（preload includeZoneIds 双模式语义等价、callbacks 亚像素
    阈值合并语义无损）
  - B 浏览器（4026）：12 路由全 200、hljs/GFM/TOC 双向同源、侧边栏新增「动画」组
    序位正确、双语零混排、console 0
  - 终门禁：框架 1582/1582、契约 3/3、site type-check/build 绿
  - 证据 site/review/20260823-t24-acceptance/

## 收口：阶段 3 完成（2026-08-23）

T1 波（19 页×2 迁移+管线+Hub+minimal+双文档刷新）+ T2 波（动画组三页 + AnimateVideo +
进阶两新页四增强 = 20 文件）全部经 fresh-agent 终验；文档站 25 页 ×2 双语同构，
API 断言两轮审计零失实。遗留（未入本轮范围）：旧计划 X.1 中英文框架梳理长文；
框架侧 P2 记档待裁决（phase leader + waitFor 双时钟分裂修法）。
- [x] T2.3 README 刷新 ✅：补 drag 模式最小示例（默认模式此前无示例）+
      examples/minimal 活代码真源指针 + Video Scrubbing 章节（全关键帧硬约束 +
      ffmpeg 命令 + dev 延迟守卫说明）+ Support Matrix 增 Rendering runtime 行
      （CSR only，SSR 不支持）
- [ ] T2.4 门禁 + fresh agent 验收 + 提交

## 明确不做（本轮）

- 8 项新能力全展廊（与文档代码示例重叠）；P3 代码级遗留（dist 调试死开关、
  旧告警前缀、同 tick release+warmUp 边界）——已记档，与文档线无关。

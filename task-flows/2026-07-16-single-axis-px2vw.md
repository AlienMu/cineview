# Task Flow — 换算内核单轴化 (px2vw) + Container 升级 + 冗余清理

日期: 2026-07-16
分支: codex/drag-release-dual-gate
关联讨论: stagger/waitFor → Container 定位 → 双轴 vs px2vw 内核错位

## 背景 / 裁决

用户理念明确: `config` 设 750 为设计宽度, 所有换算基于「750 宽度为满」的单一
px 单位 (等价 PostCSS `px2viewport`)。当前实现是**双轴** (`scaleX=vw/750`,
`scaleY=vh/1334`), 与该理念矛盾 —— 双轴在宽高比 ≠ 设计稿时会**形变** (正方形变长条)。

裁决: 尺寸/坐标换算内核从双轴统一为 **px2vw 单尺子** (全用 `scaleX = viewportWidth/designWidth`),
`convertY ≡ convertX`。`viewportHeight` 视口布局 (scroll 预算 / `vh` 解析) **原样保留** ——
它量的是「屏幕多高/滚动多远」, 与 px2vw 不冲突, 且代码里本就不经过 `scaleY`。

### 用户已拍板的两个决策
1. `config.height` / `designHeight`: **保留**, 重新定性为视口量 (scroll 预算基准),
   不再是内容尺寸的尺子。
2. `config.unit` (`'px'|'rem'|'vw'`): **直接删除 (breaking)** —— 活路径不消费, 与
   「只有设计 px 一个单位」理念矛盾。

## 头号验收风险
单轴化后**纵向坐标 y 也改乘 scaleX** (认宽不认高)。`y=1334` 元素不再贴视口底部,
改为按宽度比例落点, 超出靠流动/滚动。这是肉眼可见的纵向布局变化, 是本次头号验收点。

## 必读文档状态
- [x] DESIGN.md 已读 (双轴表述遍布: 架构裁决/数据模型/Position 裁决/属性测试/性能示例/Context 复用, 需同步改)
- [!] requirements.md **不存在** (CLAUDE.md 点名但仓库无此文件)
- [!] AGENT_SELF_REVIEW.md **不存在** (CLAUDE.md 点名但仓库无此文件)

## 节点

### A. 换算内核 (CineViewContext.tsx)
- [x] A1 删除 `scaleY`; **`scaleX` 亦重命名为单一 `scale`** (px2vw 只有一把尺子, 轴向后缀是误导性冗余; 不在公共 barrel, 折叠安全)
- [x] A2 `convertX`/`convertY` 折叠为单个 `convert` (= size * scale); **未保留别名** (直接单命名, 更彻底去冗余)
- [x] A3 删死 CSS 变量 —— 全部 6 个 `--cineview-*` 变量零消费, 一并删除 (含整个 containerStyle inline-style 注入)
- [x] A4 删除 `unit` / `resolvedUnit` 字段

### B. styleConvert.ts
- [x] B1 horizontal/vertical/scalar 三套 key 坍缩为一套 `lengthStyleKeys` → 全乘单 `convert`; `AxisConverter{convertX,convertY}` → `ScaleConverter{convert}`

### C. 各消费点
- [x] C1 Position.tsx (x/y 坐标 + center 偏移: 两处 convertX/convertY → 单 convert)
- [x] C2 Image.tsx (width+height 均走 convert)
- [x] C3 VideoFrameRenderer.tsx (width+height 均走 convert)
- [x] C4 useAnimateScroll.ts (enter/exitMargin: × scaleY → × scale; 注意与已有 `scale` style 变量冲突, 本地命名 `gateScale`)

### D. Container 升级为盒模型换算容器
- [x] D1 保留 width/height 便捷 prop (走单 convert)
- [x] D2 整个 style 过 convertStyle → padding/gap/borderRadius/fontSize/margin 自动换算
- [x] D3 ContainerProps JSDoc 标注 (盒模型换算职责, 与 Position 正交)

### E. 删除冗余死模块 + unit 类型
- [x] E1 删 SizeUnit 类型 + config.unit + barrel 导出
- [x] E2 删死模块 sizeConverter.ts + 2 测试文件
- [x] E3 删死模块 useResponsive.ts + 2 测试文件 (+ sizeConversion.property.test.ts)
- [x] E4 更新所有传 unit:'px' 的 fixture/测试 (~20 文件 + site/HomePage.tsx); CineViewContext.test.tsx 整体重写为 px2vw API

### F. designHeight 重定性
- [x] F1 CineViewContext 头注释标注 config.height 为视口量; scaleY 用途已随 A1 消除; resolveTakeoverSceneSpan 消费保留

### G. DESIGN.md 同步
- [x] G1 数据模型 CineViewContext / config.unit / Position 裁决 / margin scaleY / Image 双轴 / Context 复用 / 工具函数&JSDoc&性能示例 / Hooks&Utils 测试清单 / 项目树 全部双轴→px2vw 单轴

### H. 验证
- [x] H1 type-check 0 错
- [x] H2 lint 0 错 0 警
- [x] H3 pnpm test 全绿 (1179/1179, 84 suites; 1 预期行为变化测试已重写: Position「y 认宽落点」)
- [x] H4 build 通过 (ES gzip 49.55 KB < 50 KB; dist .d.ts 已重新生成, unit/convertX/Y 已从公共声明移除)
- [x] **H4b 覆盖率过线** —— branch 85.11% → 90.06% (补测新增文件), 四项全 ≥ 90%
- [x] **H5 独立 agent 真机验收 PASS** (Playwright/Chromium, 对齐 dist 构建产物, 四契约全过):
  - 契约1 无形变: 框架 `Container 200×200` 在 1920×1080 (266.66×266.66) 与 800×1200 (111.11×111.11) 下宽高逐像素相等, 圆保持圆 (旧双轴下 800×1200 会变 111宽×148高)
  - 契约2 认宽不认高: 只改高度时元素 px 尺寸恒定 (Position top 在 600/900/1400 高度下都 840px); 改宽度时盒模型量按同一因子缩放
  - 契约3 scroll 端到端: 正向 0→34880 场景 0→4, 反向归 0, 无卡死/隐藏
  - 契约4 无框架 console error/warning (唯一输出为 site 侧 React Router future-flag, 与框架无关)
  - **方法论亮点**: 验收 agent 发现 live 首页只用 Position 坐标+静态 CSS px, 无框架换算尺寸元素 (无法区分新旧模型), 自建临时 harness 用 `Container` 渲染真正走换算的元素才得真形变证据
  - **遗留 (非框架缺陷, 转告 site owner)**: 首页可见内容用静态 CSS px 而非 Container 换算, 故内容不随视口宽度缩放; 若期望"认宽缩放"需接入 Container/换算样式

## 覆盖率决策 (已解决)

初次 `pnpm test:coverage` branch 88.91% < 90%。根因 (已核实): 非本次改动引入 —— (1) 三个未跟踪 WIP 文件 (`StaggerContainer.tsx` 0%、`AnimateVideo.tsx`/`VideoFrameRenderer.tsx` 57%) 拉低均值; (2) 删除 sizeConverter/useResponsive 移走高覆盖代码, 暴露既有空洞。

**处理: 补测拉过线 (branch 90.06%)**, 新增测试文件:
- `StaggerContainer.test.tsx` (0% → 100% stmt / 92.85% branch)
- `VideoFrameRenderer.test.tsx` 补缺口分支 (57% → 90.47% branch)
- `AnimateRenderBridge.test.tsx` (75% → 100%)
- `registry.branches.test.ts` diamond dep (66.66% → 83.33%; 剩余 77/89 为公共 API 不可达防御分支)
- `animateInterpolation.unit.test.ts` (88.57% → 100%)
- `Container.test.tsx` production 无 context 分支 + `helpers.unit.test.ts` (anchor 全 case + phase→progress 映射)
3. **本次新增/改动的文件覆盖良好**: styleConvert 100%, Container 87.5%, Position 100% branch, CineViewContext 97% stmt (72% branch 仅 SSR `typeof window` 死分支, 非回归)。

即用未跟踪 WIP 排除后仍 89.48% —— 说明是长期积累的空洞 + 死模块删除的均值效应, **不是本次单轴化引入的**。

选项 (用户拍板):
- (a) 给 StaggerContainer + AnimateVideo/VideoFrameRenderer 补测试 (它们本就该测, 但属独立任务)
- (b) 给本次改动相关的既有空洞 (Scene/CineView) 补 branch 测试拉过 90%
- (c) 接受当前 88.91%, 说明本次改动本身覆盖达标, 门槛失败由 WIP 引起, 待 WIP 各自补测

⚠️ 单测全绿 ≠ 视觉验收 (CLAUDE.md 规则 4): H5 真机验收未做, 头号风险是纵向 y 认宽落点的肉眼变化。

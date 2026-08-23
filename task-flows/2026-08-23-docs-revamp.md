# 2026-08-23 文档站重整：bug 审计 + API/组件分离 + callbacks 补全 + 排版对标

用户指令（2026-08-23）：
1. 文档未完善 API 与回调（callbacks）
2. **不允许把 API 和组件放在一起**（现结构 components/ 组每页教程+Props 表混排——要拆）
3. 对抗复审找出页面 bug：URL 连接错误、排版错误、demo 布局错误等
4. 参考其他类似框架的文档排版格式

前置已完成：双时钟修复复审整改 + P3×3 已提交（dae115c）。

## 节点

- [ ] D1 站点对抗审计（agent 运行中，已 26+ 截图；坐实发现：未知 slug 空 article
      无 404（P1 候选）、TOC 锚点双源风险待运行时验证、移动端表格溢出证据
      （viewport-expansion））
- [x] D2 对标研究 ✅（/tmp/docs-restructure-proposal.md，287 行）：五站实查
      （motion.dev/GSAP/Radix/antd/react-spring）9 维矩阵；结论 = react.dev 式
      「指南 ‖ 参考」双轨——第 6 组 api（9 页：7 组件 + hook + types 字典），
      组件组改标签「组件指南」；回调呈现 = api 页三表分节 + advanced/callbacks
      讲语义；slug 方案指南保裸名 + api 页 -api 后缀（零路由破坏）；
      callbacks 缺口：14 回调中 6 个零覆盖 + 9 个 Detail 载荷 + 8 错误码无文档
- [ ] D3 结构方案裁决 → 按 loop 指令「继续执行直到完结」推进（提案即用户
      指令的直接实现；任何时点可打断）
- [x] D4 管线适配 ✅：manifest（DocsGroupId/DOC_GROUP_ORDER）、DocsPage
      （GROUPS/GROUP_KEY_BY_ID）、i18n 双语组词条（组件指南/Guides 改标 +
      API 参考/API Reference 新增）、契约测试 VALID_GROUPS——四处加组完成，
      契约 3/3 + type-check + build 绿
- [x] D5 内容迁移与补全 ✅（双 agent）：
  - D5a：api 组 9 页 ×2（cineview-api Callbacks 三表 14 字段全量 + types 载荷字典
      9 Detail + 8 错误码逐码核写；7 指南页拆表重排 + When to use + api 尾链）；
      34 文件、68 页零死链、zh/en 代码块字节级一致；事实纠偏：DragCancelDetail
      不存在（onDragCancel 复用 DragDetail）已写进文档
  - D5b：callbacks 指南双语 9 节（六零覆盖回调语义/时机/互斥 + 行号级事实源）；
      纠偏 onLoadProgress 0–100 整数（提案误写 0..1）
- [x] D6 bug 修复 ✅（D1 审计 6×P1 处置）：
  - P1-1 未知 slug：DocsPage 显式 404 态（标题/说明/回介绍页按钮，双语文案）
  - P1-2 View source 404：github.com/cineview/cineview → AlienMu/cineview（双语）
  - P1-3 表格溢出：article/markdown 列 min-width:0 + table 块级化横向滚动
  - P1-4 /drag act1 CTA：文案「View on GitHub」与 href="/" 不符 → href 改仓库
    地址 + 新窗属性（按文案正名，s05 同名键本就是「返回首页」佐证意图）
  - P1-5 demo 手动槽恒裁剪：根因 = zone 场景 100vh（浏览器视口）在 544px 舞台
    内溢出裁剪 256px；修 = 场景改百分比高度（100%/70%）+ scroll 舞台加高
    min(84vh,840) + 视频收敛 320×180
  - P1-6 手动卡「矛盾」判**无效**——审计探针量了内层卡片（opacity 恒 1），
    动画态在 [data-cineview-animate-id] 包装层；主会话亲测：零点击 30 步滚轮
    wrapOp 恒 0（抑制生效）+ translateY 58（initial 帧在位）+ enter 点击 0→1。
    与 T1.8 复审（量包装层）完全对账
  - P2-8（首页中段无文档入口）留用户领地裁决；P2-9 移动端随 D7 复验
- [x] D7 fresh agent 终验 + 提交 ✅（含一轮纠偏）
  - 首轮 agent 六项 PASS + P1-5 **FAIL**（像素级仪器抓出 179b86c 的 % 高度
    塌缩：shell 1px、整段空白、点击被拦——主会话此前的 rect/样式探针
    仪器不足，误判「半修/无效」；教训已记：布局盒在 ≠ 元素被绘制）
  - 重修（7eeed69）：84vh 同高对齐 + 移动端特异性覆盖 + 间距收敛；
    paint-aware 复验（shell 672/709、真指针点击双视口成功、console 0）
  - 已知微瑕：1280 下手动槽按钮顶超折叠线 ~17px（页面可达，不阻交互）
  - 终态：D7 全项闭合（结构/零死链 68/68/P1-1~5/手动卡轨语义/console 全扫）

## 明确不做

- 不推翻 md 管线（frontmatter/契约测试沿用，只扩组）
- 对比度/字号等设计原值仍属用户领地（对标只取结构，不取视觉原值）

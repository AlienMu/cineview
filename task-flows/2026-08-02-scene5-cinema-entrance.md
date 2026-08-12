# Task Flow: Scene 5 — Cinema Entrance (熄屏入场)

**日期**: 2026-08-02  
**目标**: 替换 Homepage `drag-phone` 场景为"熄屏→手机屏幕亮起→进入电影"过渡场景，内嵌 `/drag` iframe。

---

## 架构决策（已共识）

- **替换** `DragPhoneScene`，不新增第6场景
- **iframe 隔离** 解决 px2vw 基准冲突（1440 vs 390）
- **预加载**: hidden iframe `/drag?preload=true` → 缓存后删除
- **正式 iframe**: `/drag?deferred=true`，冻结状态，scroll 进度触发 `postMessage('cineview-activate')` 解冻
- **Scroll 预算**: 150vh，串行三阶段（0-40% 熄灯 / 40-70% 手机显现 / 70-100% reveal）
- **手机尺寸**: 设计基准 332×720px（19.5:9），CSS `max-height:75vh` 等比压缩
- **呼吸光晕**: box-shadow（周期 3s）+ 径向渐变 overlay（周期 5s），持续运行
- **标题**: 左上，`"两个端，两种模式"` / `"Two Modes, One Canvas"`
- **退场**: `postMessage('cineview-freeze')` → exit animation → 卸载 iframe

---

## 架构细化（实现前裁决，2026-08-02）

原节点描述与框架规则/运行时事实冲突处，按以下裁决执行（理由随注）：

1. **deferred 冻结 = 壳态，activate = 冷启动挂载**（改自「全量 mount + 所有 Animate opacity:0」）。
   `deferred=true` 时只渲染 `.drag-temporal` 暗场壳（100svh 深色底），**不 mount CineView**；
   收到 `cineview-activate` 才挂载完整树，drag 冷启动门控让第一幕入场链在揭幕瞬间从零播放；
   `cineview-freeze` 卸载回壳。理由：
   - P0 正确性：冷启动挂载 = 确定性全新入场，无"冻结中间态在 reveal 时错乱"的可能；
     框架没有"挂载后压制/重启入场"的公共 API，强行压制需侵入所有 temporal-drag 场景组件。
   - P1 CPU：壳态零动画零 rAF，0.4→0.7 滚动窗口内 hidden iframe 不与外层滚动抢主线程。
   - 挂载突刺已被两层预热摊平（preload iframe 暖缓存 + deferred 文档本身已求值全部模块）。
2. **postMessage 握手**：deferred 页挂好 listener 后主动向父窗口发 `cineview-embed-ready`；
   父层只在「已收到 ready + progress 已过阈值」时才发 `cineview-activate`，规避 load 竞态丢消息。
   双向消息均校验 `event.origin === window.location.origin`。
3. **呼吸/光晕禁用 CSS keyframes**（节点 8 原文与 CLAUDE.md 规则 6 冲突，规则 6 胜出）：
   两条 infinite-only `Animate` lane 各自循环写一个 CSS 变量（`--phone-breathe` 3s /
   `--glow-pulse` 5s，沿用 `--film-perf-phase` 已验证模式），box-shadow / 光晕在 CSS 里
   `calc()` 消费变量。infinite-only lane 由 scene runtimeState 门控，离场自动停。
4. **三阶段用 `timeline.phase` 窗口**：总预算由 `cinema-clock` lane（enter=1600ms → 1600px
   锁定滚动 ≈150vh@1080p）唯一决定；熄灯/手机/揭幕 lane 用 `phase:{start,end}` 钉在
   0–0.4 / 0.4–0.7 / 0.7–1.0 预算分数窗口，scrub 天然可逆。
5. **冻结时机 = 场景整体离开视口**（改自「进入 exit phase」）：scene5 是末幕，向下无后继
   （文档到底），唯一退场路径是向上滚出——此时 zone progress 已被反向 scrub 回 0，手机
   lane 视觉上已归零，再滚出视口才 freeze+卸载（IntersectionObserver 检测，卸载即重置
   latch，重进从头重放）。原节点 7 的 600ms 装饰性退场动画发生在视口外不可见，且给 scroll
   lane 挂 exitAnimation 会被预算器钉在 zone 末端（progress→1 时手机反而淡出），故不做。
6. **150vh 场景内的视口带**：center-lock 锁定时 scene 中心 = 视口中心，内容统一放进
   `top:50%; height:100vh; translateY(-50%)` 的视口带容器，标题 `Position at={{x:60,y:60}}`
   与手机居中均以带为基准，锁定期间与视口严格重合。
7. **样式落位**：`.home-scene--cinema` palette 进 `global.css`（与其余 scene palette 同区），
   组件样式按仓库惯例进同目录 `Scene5Cinema.css`（PhoneMockup 共用），不塞进 global.css。

---

## 节点清单

### 节点 1: `/drag` 侧 — 预加载与冻结支持
- [x] `TemporalDragExperience` 新增 `preload?: boolean` prop
  - `preload=true`: 渲染 `.drag-temporal` 空壳（`data-embed="preload"`），不 mount CineView/canvas/动画
- [x] `TemporalDragExperience` 新增 `deferred?: boolean` prop
  - 按架构细化 #1/#2 实现：冻结壳 → `cineview-embed-ready` 握手 → `cineview-activate`
    冷启动挂载完整树（入场链从零播放）→ `cineview-freeze` 卸载回壳；消息双向同源校验
- [x] `DragPage.tsx` 读取 URL params（`useSearchParams`）传入对应 prop
- [x] 自检：`/drag` 无参数访问行为完全不变（probe A1–A4 PASS：无 data-embed、
  第一幕在场、CineView 挂载、无页面错误；drag 模式懒挂载相邻幕是框架既有行为）

### 节点 2: 预加载机制（Homepage 侧）
- [x] `HomePage.tsx` 内 `DragExperiencePreloader`：CineView `onReady` 后创建 hidden iframe
  （`/drag?preload=true`，absolute 0×0 透明 pointer-events:none aria-hidden），onLoad 自删
- [x] 自检：不阻塞首页渲染、无视觉副作用（probe D2 PASS：预加载 iframe 已自删）

### 节点 3: 手机 Mockup 组件
- [x] 新建 `PhoneMockup.tsx`：332×720 设计基准（aspect-ratio 332/720），
  `height: min(720u, 75vh)`；边框 1px rgba(225,164,91,0.35)；圆角 40u；摄像头岛剪影
- [x] 呼吸 box-shadow：3s infinite-only lane 写 `--phone-breathe`，CSS calc 消费，
  12px 3px @0.20 ↔ 20px 5px @0.40（实测 shadow 12.95→18.65px / alpha 0.224→0.365 跟随）
- [x] 径向渐变 overlay：5s lane 写 `--glow-pulse`，中心 rgba(225,164,91,0.08)→透明，
  radius 60%↔80% 以 scale 1↔1.333 等价表达（实测变量在跑）
- [x] 自检：3s/5s 异周期（LCM 15s）beats 不冲突；零 per-frame setState（循环走 framer
  tween 写 CSS 变量，reduced-motion 降级为静态帧）

### 节点 4: 黑色 Overlay + Scroll 驱动
- [x] 全屏黑色 overlay（absolute inset 0，z 在视口带之下、场景背景之上）
- [x] `cinema-lightsoff` lane `phase:{0, 0.4}` 线性映射 opacity 0→1
- [x] 自检：反向可逆（probe D7 PASS，trace opacity 1→0.63→0.25 随反滚 scrub）

### 节点 5: Iframe 创建与 Reveal 触发
- [x] `CinemaLatchProjection` 读 `cinema-clock` lane progress 做阈值 latch（每帧仅数字
  比较，setState 只在穿越 0.4/0.7 时发生）：≥0.4 创建 `/drag?deferred=true` iframe
- [x] Reveal：≥0.7 且收到 embed-ready 后 postMessage activate；`cinema-reveal` lane
  `phase:{0.7, 1}` scrub iframe opacity 0→1 + blur 12px→0
- [x] 自检：reveal 不可逆（probe D8 PASS：回滚 latch 保持 + iframe 保留，不重新冻结）

### 节点 6: 标题组件
- [x] `Position at={{ x:60, y:60 }}`（挂在视口带内，锁定期间与视口重合）
- [x] 中文 `"两个端，两种模式"` / 英文 `"Two Modes, One Canvas"`（i18n key `scene5.title`）
- [x] 样式：`--font-mono`、13u（≈text-xs 且随单尺子缩放）、rgba(250,248,244,0.6)
- [x] 生命周期：`phase:{0.2, 0.4}` 淡入后停留（无 exit）
- [x] i18n 另增 `scene5.frameTitle`（iframe a11y title）

### 节点 7: Exit 处理
- [x] 按架构细化 #5：场景整体离开视口（IntersectionObserver）→ postMessage
  `cineview-freeze` → 卸载 iframe → 重置 latch；600ms 装饰性退场不做（视口外不可见，
  且 scroll lane 的 exitAnimation 会被预算器钉在 zone 末端，语义相反）
- [x] 自检：exit 后无 iframe 动画残留（probe D9 PASS：idle + iframe 卸载；D10 PASS：
  重进重放）

### 节点 8: CSS 样式
- [x] `global.css`：`.home-scene--phone` → `.home-scene--cinema`（palette 原值沿用）
- [x] `Scene5Cinema.css`（按仓库惯例组件同目录，架构细化 #7）：mockup 边框/圆角/阴影、
  呼吸与光晕的 CSS 变量消费、overlay、视口带、iframe 槽位 pointer-events 门控
- [x] 无 CSS keyframes infinite（规则 6）；不触碰 temporal-drag `--tp-*` palette
- [x] 自检：iframe 槽位揭幕前 pointer-events:none（opacity:0 的 iframe 不吞外层滚轮）

### 节点 9: Homepage 集成
- [x] `<DragPhoneScene>` → `<Scene5Cinema>`（不走 HomeSceneCanvas：overlay 需盖满
  150vh 全场景、手机以视口带居中）
- [x] `sceneId="cinema-entrance"`、`scroll={{ zoneId: 'cinema-entrance', trigger: 'center-lock' }}`
- [x] 布局 `height: '150vh'`；zone 预算 1600ms→1600px 锁定滚动（≈150vh@1080p）
- [x] 自检：整页 scroll 链路完整（probe D3/D10：逐段穿越后 latch；其余 scene 不受影响，
  probe D11 无页面错误）

### 节点 10: 代码审查 — 死代码/冗余检查
- [x] 删除 `DragPhoneScene.tsx/.css`、`DragPhoneExperience.tsx/.css`
- [x] 全仓 grep 无残留引用；`scripts/capture-animation-snapshots.mjs` 选择器更新为
  `.scene5-cinema` / `.phone-mockup`
- [x] 死键清理：`drag.*` 七个 i18n key（原仅被删除组件消费）一并移除；
  `TemporalDragExperienceProps` 不导出（零消费）
- [x] 对抗性审查 agent 复核 **PASS**（type-check 0 错、probe 23/23 复核、几何/门控/
  滚轮穿透实测、握手竞态与 StrictMode 审计通过）。非阻断建议处置：
  - ✅ #1 已采纳：交互门与激活拆开——activate 仍在 0.7（入场链在揭幕中播放），
    pointer-events 到 ≥0.98 才开、反滚 <0.92 收回（迟滞防抖），修复触屏在
    0.7–0.98 段被半透明 iframe 吞滑动、以及反滚后不可见 iframe 仍可交互两个问题
  - ✅ #2/#4/#5 已加注释说明（框架包装选择器耦合、deferred 直访黑壳属预期、
    freeze 为防御性冗余）
  - ⏸ #3 `PREFERS_REDUCED` 模块级采样与站点既有惯例一致（CapabilityScene 同款），不改

### 节点 11: 浏览器验收（独立 agent）
- [x] 冒烟探针 `site/scripts/scene5-probe.mjs` 23/23 PASS（A:/drag 不变 B:preload
  C:deferred 协议 D:首页全链路 latch/可逆/重置/重放/无错误）
- [ ] 独立验收 agent 实测（视觉 + 交互 + 性能）返回 PASS/FAIL

---

## 依赖关系

```
节点 1 (/drag 侧) ──┐
节点 2 (预加载) ────┤
节点 3 (手机框) ────┤
节点 4 (overlay) ───┤
节点 6 (标题) ──────┤
                    ▼
              节点 9 (集成)
                    ▼
              节点 5 (iframe reveal)
                    ▼
              节点 7 (exit)
                    ▼
              节点 8 (CSS)
                    ▼
              节点 10 (审查)
                    ▼
              节点 11 (验收)
```

## 风险标记

- **P0**: `/drag` 侧冻结/解冻机制必须正确，否则 iframe 内容在 reveal 时状态错误
- **P0**: iframe touch 事件不得冒泡到外层 scroll（iframe 天然隔离，但需验证）
- **P1**: 预加载 hidden iframe 的 CPU 开销（在低端设备上可能影响 Homepage 动画）
- **P1**: 手机 `max-height:75vh` 在超矮 viewport 下的视觉可用性

# Task-flow: AnimateGif / AnimateVideo（进度驱动帧擦除）

> 创建 2026-07-13。目标：新增 `<AnimateGif>` / `<AnimateVideo>` 两个组件，
> 让 GIF/视频成为「进度驱动帧擦除」资源——drag/scroll 位置即帧号，反向天然倒放。

## 固化决策（grill 结论）

- **语义**：进度驱动帧擦除（scrub）。GIF → 逐帧视频；video → currentTime scrub。
- **组件形态**：两个新组件是 `Animate` 的**薄封装（facade）**，复用其 render-prop 拿
  `enterProgress`。`Animate` 仍是**唯一 progress owner**，单一所有者原则不破。
- **擦除跨度**：绑自己的**进入预算段**（zone 内可与其他元素共存排序），复用
  `enterProgress`，零新进度管线。
- **参数面（最小集）**：
  - 自有：`src`、`style`、`width`/`height`（走双轴换算，同 `Image`）
  - 透传：`animateId`、`timeline.{delay,waitFor}`、
    `visibility.{replayOnReenter,enterMargin,exitMargin}`
  - **不暴露**：`enterAnimation`/`exitAnimation`（scrub 即动画）、`stagger`、`drive`
    （跟 CineView mode 自动：scroll→scrub、drag→跟翻页）
- **解码/播放**：
  - GIF → `gifuct-js`（peerDependency + 动态 import），canvas 按 disposal 合成帧
  - Video → 原生 `<video muted playsinline>` + `currentTime`，**零库**
- **映射**：均匀线性（progress 0→1 ↔ 第 1→末帧），忽略 GIF 原生每帧 delay；
  未就绪渲染第 0 帧 poster。
- **预加载（A 深度整合）**：新建 `mediaPreloadCache`，首屏 media 就绪并入
  `priorityComplete` 冷启动门控；泛化 `Scene.assets` + `CineView.preload()`。

## 基线（2026-07-13 记录）

- `pnpm test`：**1151 tests / 79 suites 全绿**
- `type-check`：**0 错**
- `lint`：**0 错 0 警**
- `gifuct-js`：安装 `2.1.2`（2025-01 更新，稳定）；自带 `index.d.ts` 类型
  - API：`parseGIF(buffer)` → `decompressFrames(parsed, true)` → `ParsedFrame[]`
  - 每帧：`dims{width,height,top,left}` / `patch: Uint8ClampedArray`(RGBA) / `disposalType` / `delay`
  - 决策：设为**可选 peerDependency**（`peerDependenciesMeta.optional`），不用 AnimateGif 的用户零负担

## 阶段节点

### 阶段 0：基线与脚手架 ✅
- [x] 0.1 建 task-flow、读 DESIGN.md 预加载/职责章节
- [x] 0.2 记录 test 基线（1151 全绿）
- [x] 0.3 记录 type-check / lint 基线（均 0）
- [x] 0.4 `gifuct-js` 加可选 peerDependency + devDependency；`vite.config.ts` external 加

### 阶段 1：GIF 解码内核（`src/media/gifFrames.ts`，纯逻辑）✅
- [x] 1.1 `decodeGifFrames(buffer)` 动态 import gifuct-js
- [x] 1.2 `composeParsedFrames` 按 disposal method 合成完整帧（纯 Uint8ClampedArray，无 canvas）
      - disposal 0/1 保留、2 清空矩形、3 快照回滚;1-bit alpha 透明不覆盖;越界裁剪
- [x] 1.3 `frameIndexForProgress(progress, frameCount)` 线性均匀 round（纯函数）
- [x] 1.4 `gifFrames.test.ts` 全绿（12 例）;type-check 0 错

### 阶段 2：media 预加载缓存（`src/hooks/mediaPreloadCache.ts`）✅
- [x] 2.1 gif:fetch→decodeGifFrames→缓存帧+标记 ready
- [x] 2.2 video:fetch blob→objectURL+标记 ready
- [x] 2.3 `preloadMedia`/`isMediaPreloaded`/`getGifFrames`/`getVideoObjectUrl`/`subscribeToPreloadedMedia`/`inferMediaKind`
- [x] 2.4 LRU 字节预算淘汰（默认 128MB）+ video objectURL revoke
- [x] 2.5 `mediaPreloadCache.test.ts` 全绿（10 例,含淘汰/去重/reset）;type-check+lint 0

### 阶段 3：帧渲染组件 ✅
- [x] 3.0 抽 `src/utils/styleConvert.ts` 公共双轴换算;`Image.tsx` 改为 import(8 例回归全绿)
- [x] 3.1 `GifFrameRenderer.tsx`（canvas putImageData + 未就绪 <img> 兜底 + 双轴换算 + SSR 安全）
- [x] 3.2 `VideoFrameRenderer.tsx`（currentTime scrub + objectURL 优先 + loadedmetadata 门控 + SSR 安全）
- [x] 3.3 renderer 单测全绿（11 例）;type-check+lint 0

### 阶段 4：facade 组件 ✅
- [x] 4.1 `AnimateGif.tsx` 接 Animate render-prop（中性恒等变体 `{initial:{opacity:1},animate:{opacity:1}}` 建立时间轴但视觉恒等）
- [x] 4.2 prop 白名单最小集:src/alt/style/尺寸 + animateId + **duration.enter**(scrub 跨度) + timeline.{delay,waitFor} + visibility.{replayOnReenter,margins}
      - 注:duration 是我之前多选疏漏,scrub 长度必需,已作可选透传纳入
- [x] 4.3 `AnimateVideo.tsx` 同结构
- [x] 4.4 budget 段长 = duration.enter,经现有 registerZoneAnimation→sceneScrollBudget(1ms=1px)复用,无新代码
- [x] 4.5 facade 单测(6 例)+ tsc fixture(2 例:最小面编译通过 / enterAnimation 非法报错)
      - illegal-props fixture 加入 tsconfig exclude(对齐 scene-legacy fixture)
- [x] 全量回归:**1192 tests / 86 suites 全绿**(+41);type-check+lint 0

### 阶段 5：冷启动深度整合（⚠️ 回归高发区）✅
- [x] 5.1 `useImagePreloader.loadImage` 把 gif/video URL 路由到 `preloadMedia`(解码/buffer)
      → 媒体进入同一优先级批次,`priorityComplete` 天然等首屏媒体就绪。零新信号管线。
- [x] 5.2 `Scene.assets.preloadImages` 无需改:URL 是字符串,`collectScenePreloadPlan` 逐字透传媒体 URL
- [x] 5.3 `CineView.preload()` 无需改:`resolveScenePreloadTargetImages` 同样逐字透传
- [x] 5.4 基线保持:preloader/coldstart/drag-first-scene 全套 53 例不回归
- [x] 5.5 回归测试 `useImagePreloader.media.test.ts`(3 例):路由+kind、慢解码延迟 priorityComplete、失败仍结算
- [x] 全量:**1195 tests / 87 suites 全绿**;type-check+lint 0
      注:超时门控(FIRST_SCENE_TIMEOUT)对媒体天然生效——媒体是优先级批次一员,慢/失败都走同一超时路径

### 阶段 6：导出 + 文档 + 构建 ✅
- [x] 6.1 barrel 导出 `AnimateGif`/`AnimateVideo` + `AnimateGifProps`/`AnimateVideoProps`
- [x] 6.2 DESIGN.md 增补「组件 3.5」章节;CLAUDE.md 职责表 + API 速查增补
- [x] 6.3 `build:verify` **8/8 通过**;dist 类型含新组件(9 处命中)
      - `gifuct-js` 已 external:bundle 仅 `import("gifuct-js")` 动态调用,3.7MB 库未内联
      - ⚠️ ES gzip **48.97 KB**(目标 <50KB,达标但**headroom 仅 ~1KB**,后续新增需警惕)

### 阶段 7：真实浏览器验收（独立 agent，规则 4）⏳ 待验收
> 实现 agent 不能自证收口。以下须由**独立 agent** 在真实浏览器实测。
> 前置:`site/` 存在 dev 工具站(Vite+React,untracked),但**尚无使用 AnimateGif/AnimateVideo
> 的 demo 页**——验收前需先在 harness 里作一个含 gif+video 的 scroll 页和 drag 页。
- [ ] 7.0 在 `site/` 或 examples 建 demo 页(scroll zone + drag,各放 AnimateGif/AnimateVideo)
- [ ] 7.1 scroll scrub 正/反向 + 多元素共 zone 排序
- [ ] 7.2 drag 翻页窗口内 scrub + 翻完冻末帧
- [ ] 7.3 video 倒放平滑
- [ ] 7.4 首屏 gif 冷启动无卡顿/无闪空(冷启动门控生效)
- [ ] 7.5 Firefox:GIF scrub 行为(gifuct 纯 JS,应可用;若不装 gifuct 则 <img> 兜底)

## 完成状态（2026-07-13）

**阶段 0–6 全部落地,自动化门全绿:**
- test **1195 / 87 suites**(+44 新增);type-check 0;lint 0;build:verify **8/8**
- ES gzip 48.97 KB(<50KB 达标,headroom ~1KB)
- gifuct-js 已 external + 可选 peerDep,核心 bundle 不含
- 新增文件:`src/media/{gifFrames,GifFrameRenderer,VideoFrameRenderer}`、
  `src/hooks/mediaPreloadCache`、`src/components/Animate/{AnimateGif,AnimateVideo}`、
  `src/utils/styleConvert`(从 Image 抽出)
- 改动文件:`Image.tsx`(改用 styleConvert)、`useImagePreloader.ts`(媒体路由)、
  `index.ts`(导出)、`package.json`/`vite.config.ts`(gifuct)、`tsconfig.json`(fixture exclude)

**阶段 7 待独立 agent 真实浏览器验收**(单测全绿 ≠ 视觉正确)。

## 依赖关系

```
0 → 1 ┐
    2 ┼→ 3 → 4 → 5 → 6 → 7
      ┘
```
阶段 1/2/3 纯逻辑可并行；阶段 5 最高风险单独验收。

## 待实现期确认

1. `gifuct-js` = peerDep（倾向，对齐 framer-motion）vs 普通 dep
2. 阶段 5 = 扩展 `useImagePreloader`（倾向）vs 新建统一 `usePreloader`

# UMD 按 mode 拆入口（修体积门）— 2026-08-04

用户裁决：**方案 (A) 按 mode 拆入口**。

---

## 事实基线（全部实测，非估算）

- 门：`scripts/verify-build.js:20` `MAX_BUNDLE_SIZE_KB=50`（51200 字节）。
  规格出处 `DESIGN.md:2449`「对于*任意*构建输出，主包的 gzipped 大小不应超过 50KB」
  ⇒ 门适用于 UMD，抬门等于改规格，故不抬。
- 现状：`dist/cineview.umd.js.gz` = **51391 字节，超 191**。
  `dist/cineview.es.mjs.gz` = 42896 字节（**达标**，ES 侧已用 `manualChunks` 拆了四支）。
- **是框架自己超量，与 site 无关**（三条证据）：门量的是仓库根 `dist/`；UMD 包里
  `act3-dolly`/`home-scene`/`capability-full`/`a3-panel`/`temporal-drag`/`cineview-site-lang`/
  `Act3Dolly`/`DragPage` 八个 site 独有串**全为 0 次**；框架非测试源码零 `site/` 导入。
  （`src/__tests__/site/` 是读磁盘校验 site 的契约测试，不在入口可达图，不进产物。）
- 历史：CLAUDE.md 记 2026-06-30 时 UMD 38.51 KB ⇒ 后续功能开发涨了 11.7 KB 吃穿预算。
  本分支那四个 framework 文件（+138/−62 功能改动）净增 ~0.25 KB，只是压线最后一根。

### 逐模块 UMD 占重（`external` 仅作测量手段，非方案）

| 模块 | gzip 占重 | 占全包 |
| --- | --- | --- |
| **`CineView/DirectScrollCineView`（scroll 引擎）** | **10437** | **20.3%** |
| `animations/composer` | 3031 | 5.9% |
| `Animate/useAnimateScroll` | 2892 | 5.6% |
| `Scene/useSceneAnimationRegistry` | 2747 | 5.3% |
| `animations/presets` | 2096 | 4.1% |
| `media`（video ownership） | 1879 | 3.7% |
| `Scene/useDragSceneEngine` | 1628 | 3.2% |
| `Animate/useAnimateDrag` | 1492 | 2.9% |
| `Scene/useElementTrack` | 1465 | 2.9% |
| `utils/performanceMonitor` | 725 | 1.4% |

### 已排除的其它路子（都实测过，不是推断）

- **UMD 代码拆分不可能**：Rollup 直接报错
  `Invalid value "umd" for option "output.format" - UMD and IIFE output formats are not supported for code-splitting builds`。
- **压缩已到底**：收紧 esbuild（`legalComments/minifyIdentifiers/minifySyntax/minifyWhitespace`）
  与 terser（`passes:3→5`、`format.comments:false`）**各自一字节不省**。两处改动已还原。
- **包里无免费死重**：查 `__tests__`/`describe(`/`expect(`/`NODE_ENV`/`process.env` 全 0；
  `composer`、`useSceneAnimationRegistry` 均确认在用。
- **只外部化 `presets/special`**：51166 字节，**只剩 34 字节余量** ⇒ 等于焊死门，不算解法。

---

## 为什么 mode 是正确的切口

`CineView.tsx:1141-1146` 的 `CineViewComponent` 本身就是个 5 行派发器：

```tsx
if (resolveRootMode(props.mode) === 'scroll') return <DirectScrollCineView {...props} ref={ref} />;
return <DragCineViewComponent {...props} ref={ref} />;
```

两个引擎已经是**各自独立的根组件**（`DragCineViewComponent` 1141 行前 / `DirectScrollCineView`
独立文件 574 行）。`mode` 是框架的一级抽象，也是 `DESIGN.md` 的顶层划分。故按 mode 拆，
切口落在框架自己的架构缝上，而不是随手切一刀（对比：拆 presets 要把
`index.ts:366` 那个注释写明「intentionally not re-exported」的私有测试接缝提升为公共 API）。

只用 `mode="drag"` 的 script-tag 消费者，现在白背 10437 字节的 scroll 引擎，反之亦然。

---

## 方案

**只拆 UMD，ES 与 bundler 消费者零变化**（ES 已达标且天然 chunk 化）。

- `dist/cineview.umd.js` —— **drag 专用**（`mode` 默认值就是 `'drag'`）。
  预期 ~40954 字节，余量 ~1 万字节。
- `dist/cineview-scroll.umd.js` —— **scroll 专用**（不含 drag 引擎）。
- 两个 UMD 各自 `inlineDynamicImports: true` 单文件，需**两趟 build**
  （Rollup 单趟不能出两个各自内联的 UMD）。

**防静默失败（必须做）**：drag-only 产物里若收到 `mode="scroll"`，不能默默不工作 ——
要抛明确错误，指明「请加载 `cineview-scroll.umd.js`」。反向同理。

---

## 执行节点

- [ ] **U1 导出接缝**：`CineView.tsx` 导出 `DragCineViewComponent`（现为文件内私有），
      新增两个入口文件 `src/entry-drag.ts` / `src/entry-scroll.ts`，各自把 `CineView`
      绑定到单一引擎 + 错模式时抛错。`src/index.ts` 保持全量（ES 用）不变。
- [ ] **U2 构建配置**：`vite.config.ts` 主趟出 ES 全量 + drag UMD；新增第二趟配置出
      scroll UMD。`package.json` 的 `exports` 增补 scroll UMD 路径。
- [ ] **U3 体积门**：`verify-build.js` 需同时校验两个 UMD 产物（现在只认
      `cineview.umd.js`），否则拆完新产物无人看守。
- [ ] **U4 实测**：两个 UMD gzip 均 < 51200；`build:verify` 全过；
      两个产物各自 smoke（drag 产物跑 drag、scroll 产物跑 scroll、错模式抛错）。
- [ ] **U5 顺带净减负**：删 `src/utils/gestureDetector.ts`（205 行，**全仓零引用**，
      已被 tree-shake 故与体积无关，纯死代码）；修正 CLAUDE.md 里
      `gestureHandlers.ts` 的过期记录（该文件**不存在**）。
- [ ] **U6 门禁**：`type-check`/`lint`/`prettier`/`test`；确认 5 个既有失败数不变。
- [ ] **U7 文档**：`DESIGN.md` / `README` 记录 UMD 按 mode 分产物的消费方式与迁移说明
      （破坏性变更，需版本号决策 —— 留给你定）。

---

## 风险

1. **破坏性变更**：现有 script-tag + `mode="scroll"` 的消费者必须换文件。U1 的抛错设计
   是为了让这个失败**可见且自解释**，不是静默白屏。
2. **两趟 build 的产物一致性**：两个 UMD 由不同入口产出，共享代码会各自内联一份
   （这是 UMD 单文件的固有代价，不是 bug）。同页同时加载两个产物会有重复运行时 ——
   文档须写明「按模式二选一，不要同时加载」。
3. **`verify-build` 漏看新产物**：U3 若忘做，scroll UMD 就是无人看守的第二个包，
   下次涨破无人知。
4. **共享部分仍在长胖**：本次拆完 drag 侧余量 ~1 万字节，但 `composer`(3031) +
   `useSceneAnimationRegistry`(2747) + `presets`(2096) 等共享块两个产物都要带。
   若后续继续涨，下一道坎还是它们 —— 记录待观察，本轮不动。

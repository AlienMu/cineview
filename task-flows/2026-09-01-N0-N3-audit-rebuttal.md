# N0/N3 bundle-diagnostics 对抗审计驳回摘要（2026-09-01）

对抗审计 agent `a8a519fb1f060fb69` 驳回了执行计划 N0/N3 的全部前提。

## 核心裁决：N0→N3 依赖链不成立，两个节点都需要重写

### CLAIM 1：A1 的 7018/2765 字节不可复现，真实边际成本 ~731 字节（误差 3.8×）

- 执行计划声称恢复 dev 卫语句需 2765 字节 gzip，实测边际成本 **731 字节**。
- 方法论三处无效：① awk 提取不是语法级（terser 拒绝解析）；② 量的是未压缩 TS 源码，
  而恢复代码会被 esbuild minify；③ 共享字典效应小（~5%），但 minification 效应大。
- A1 的方向结论仍然成立（731 > 253 真的吹预算），但幅度从 16× 降为 3×。

### CLAIM 2：N0 的 ≥3KB 门**不可达**，实测上界 358 字节（缺口 2714 字节）

- 删掉所有十项 prop 标识符 + 整个 57 项 denylist 字符串载荷，**上界仅省 358 字节**。
- 其中三项（`getGlobalPerformanceMonitor` / `INTERNAL_SCENE_PROPS` / `debugDrag` 重复）
  在 dist 里出现次数 = **0**，已被 tree-shake 掉，删它们释放零字节。
- `onRenderProgressChange` 不是死码：`useDragSceneEngine.ts` 五处真实调用它；
  `setRenderProgress` 也有两处调用；它们只是**经由 `CineView.tsx:1141` 不可达**，
  不等于不在 bundle 里。
- **N0 无法通过自己设的 ≥3KB 门，所以 N3 永久阻塞。**

### CLAIM 3：N3 的 `development` 条件**在 Vite 下有效**，但 CJS 嵌套错误

- 执行计划说「Node 默认不走 `development` 条件」—— 对。
- 但说「Vite 也不走」—— **错**。实测 Vite 5.4 的 dev 模式 **确实** resolve 到
  `cineview.dev.mjs`，production build 正确走生产产物。
- **真实缺陷**（计划漏掉）：把 `development` 条件提到 `import`/`require` 之上时，
  CJS `require('cineview')` 在 `--conditions=development` 下会拿到 ESM 文件 ⇒
  Node 18/20 抛 `ERR_REQUIRE_ESM`（Node 22 有 unflagged `require(esm)` 才通过）。
- 修法：把 `development` 嵌套进 `import` 和 `require` 内部，而非提到顶层。

### CLAIM 4：dist 确实零诊断，但 **console 移除不是 NODE_ENV 折叠的**

- `vite.config.ts:154` 设 `esbuild: {drop: ['console']}` —— 无条件剥离，与 `:34` 的
  `define` 无关。所以即使 un-fold NODE_ENV，console 输出仍然不存在。
- N3 的 fallback（把关键 guard 改走 `reportError`）**是唯一可行机制**，不是备选。
- 附带发现：`useSceneAnimationRegistry` 的 Problem/Fallback/Fix 模板字符串**已入包**
  （`Fix:` 在三个 UMD 各 4 次），因为它们在 `:246-252` 无条件构建、`:254` `devWarn`
  被 drop 时字符串已经存在。这是 N0 没列出的、唯一有意义的字节赢面（~4× 于 N0 列举项）。

### CLAIM 5：两个验收命令**都坏了**

- `artifacts.json` 没有 `gzipKB` 字段（只有 `file/module/budgetKB/label/entry`）。
- N0 的 `node -e "...u.gzipKB..."` 打印 `NaN`；N3 的 `u.gzipKB <= u.budgetKB` 打印
  **`false`**（`undefined <= 55` = false）—— 即 N3 门在**未改任何代码的干净树**上
  报告回归，是假阴性。
- 真实尺寸门在 `verify-build.js:404-411`，stat `.gz` 文件、不读 manifest。

### 其余 4 条（源码引用错误、headroom 数字陈旧、两项「零调用者」实为「不可达」）

略，见审计全文。

---

## 对执行计划的影响

1. **N0 节点必须废弃或重新定义门。** 当前 ≥3KB 门距实测上界差 8.7 倍，无路径达成。
   且 A1 的「顺序反了」判决（对抗评审的头条发现）崩塌：N3 需要 ~731 字节、现有
   253 字节，缺口 478 —— 而 N0 上界只有 358。**N0 作为 N3 前置条件的整个论证不成立。**

2. **N3 的 exports 写法需要修正。** `development` 必须嵌套进 `import`/`require` 内部，
   当前提到顶层会让 CJS 在该条件下 resolve 到 ESM 文件。

3. **两个验收命令必须重写。** `gzipKB` 字段不存在；N3 门在干净树上打印 false。

4. **dev 诊断恢复的唯一可行路径是 `reportError`，不是 un-fold NODE_ENV。**
   `esbuild.drop:['console']` 无条件剥离，与 NODE_ENV 折叠无关。

---

## 建议行动

- **丢弃 N0。** 它的门不可达，且作为 N3 前置的依据已被驳倒。
- **重写 N3：** ① exports 嵌套正确；② 走 `reportError` 恢复关键三条诊断（零 Scene /
  Scene 无子 / 无效 after id）—— 这是执行计划自己列的 fallback，现在是唯一路径；
  ③ 用 stat `.gz` 文件写验收命令，不读 `gzipKB`。
- **独立清理 `useSceneAnimationRegistry` 的文案泄漏** —— 这是审计发现的、比 N0 全部
  列举项加起来还大 4× 的真实字节赢面。

审计结果见 `/private/tmp/.../tasks/a8a519fb1f060fb69.output`。

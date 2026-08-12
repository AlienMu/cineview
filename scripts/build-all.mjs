/**
 * 按模式分包的多趟构建：**3 趟出 4 个产物**。
 *
 * 为什么必须分趟：UMD 是单文件格式，Rollup 明确拒绝 `UMD + code-splitting`
 * （`Invalid value "umd" for option "output.format"`），而一次 Rollup 构建只有
 * 一个 input。所以「按模式的单引擎 UMD」只能各自单独一趟。
 *
 * 产物集（预算见 `passes[].artifacts[].budgetKB`）：
 *   cineview.es.mjs           全量，运行时按 mode 派发（ESM）
 *   cineview.umd.js           全量，运行时按 mode 派发（UMD/CJS）
 *   cineview-drag.umd.js      仅拖拽引擎（UMD/CJS）
 *   cineview-scroll.umd.js    仅滚动引擎（UMD/CJS）
 *
 * **root 的两种格式能力一致**：`require('cineview')` 与 `import('cineview')` 都拿到
 * 按 `mode` 派发的全量组件。这是 conditional exports 的本意 —— 同一套 API 走不同
 * 模块格式，而不是不同格式给不同 API。
 * 上一版曾让 `cineview.umd.js` 承载**仅拖拽**的产物，理由写的是「现有 script-tag
 * 消费者改名会 404」。那个前提**是假的**：包从未发布（npm 404、零 git tag、仓库内
 * 零 UMD 消费者）。它造成的后果是 CJS 与 ESM 能力不同，而两者共用
 * `dist/index.d.ts`（含 `mode:'scroll'` 的完整联合）⇒ TS 放行、运行时抛错。
 * 见 task-flows/2026-08-05-skill-conformance-review.md 的 R2。
 *
 * 按模式的子路径（`cineview/drag`、`cineview/scroll`）**只服务单文件格式**，
 * 即只有 `require` 条件。子路径存在的唯一理由就是 UMD 不能代码拆分；ESM 消费者
 * 从 root 拿全量（在预算内），不需要子路径。代价是 ESM 侧只用一种模式时仍带两套
 * 引擎（派发器静态引用，tree-shaking 保不住）—— 接受，等真有 ESM 消费者反馈体积
 * 再加，那时是真实需求而不是假设场景。
 *
 * 只有第一趟清空 dist 并生成 `index.d.ts`（`dts` 门控在 `CLEAN_OUT_DIR`）。
 * 子路径的 `.d.ts` 由本脚本末尾手写生成 —— `vite-plugin-dts` 配的是
 * `include:['src'] + rollupTypes`，它把整个 src 汇总成单个 `index.d.ts`，
 * **不按入口分名**。
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

/**
 * 产物集的**唯一真相**。
 *
 * `artifacts[].budgetKB` 是该产物的 gzip 上限。压缩清单
 * （`minify-library-entries.mjs`）与体积门（`verify-build.js`）都从这里派生 ——
 * 经 `dist/artifacts.json`。这是为了让「新增一个产物却忘了压缩/忘了设门」在结构上
 * 不可能发生：本轮实测踩过，5 个产物里有 2 个（按模式的 ES）既没过 terser、
 * 也没被门量，其中一个 47398 字节、距门只剩 3.7 KB 却无人看守。
 *
 * 为什么全量 UMD 的预算是 55 而非 50：UMD 是单文件格式（Rollup 明确拒绝
 * `UMD + code-splitting`），而 `mode` 是运行时 prop，故全量 UMD **必须**同时内联
 * 拖拽与滚动两套引擎 —— 实测 51503 字节，**结构上不可能**塞进 50 KB。
 * 而 50 KB 这道门的实际用途是「知道自己要哪种模式的消费者，能拿到的最小产物」，
 * 那三个产物（41473 / 45730 / 43134）都达标。全量 UMD 是「图方便、什么都带」的
 * 那一个，单独给上限并写明理由，比让门宣称一个它从未实现的不变量诚实。
 * 见 task-flows/2026-08-05-skill-conformance-review.md 的 R1/R2。
 */
const passes = [
  {
    entry: 'src/index.ts',
    outBase: 'cineview',
    formats: 'es,umd',
    label: '全量 ES + 全量 UMD + 类型',
    artifacts: [
      {
        file: 'cineview.es.mjs',
        module: true,
        budgetKB: 50,
        label: '全量 ESM（运行时按 mode 派发）',
      },
      {
        file: 'cineview.umd.js',
        module: false,
        budgetKB: 55,
        label: '全量 UMD（运行时按 mode 派发）',
      },
    ],
  },
  {
    entry: 'src/entry-drag.ts',
    outBase: 'cineview-drag',
    formats: 'umd',
    label: '拖拽 UMD',
    artifacts: [
      { file: 'cineview-drag.umd.js', module: false, budgetKB: 50, label: 'UMD（仅拖拽引擎）' },
    ],
  },
  {
    entry: 'src/entry-scroll.ts',
    outBase: 'cineview-scroll',
    formats: 'umd',
    label: '滚动 UMD',
    artifacts: [
      { file: 'cineview-scroll.umd.js', module: false, budgetKB: 50, label: 'UMD（仅滚动引擎）' },
    ],
  },
];

for (const [index, pass] of passes.entries()) {
  process.stdout.write(`\n── 第 ${index + 1}/${passes.length} 趟：${pass.label} (${pass.entry})\n`);
  const result = spawnSync('npx', ['vite', 'build'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      CINEVIEW_ENTRY: pass.entry,
      CINEVIEW_OUT_BASE: pass.outBase,
      CINEVIEW_FORMATS: pass.formats,
      // 只有第一趟清空 dist（见 vite.config.ts 的 CLEAN_OUT_DIR）。
      CINEVIEW_CLEAN: index === 0 ? '1' : '0',
    },
  });
  if (result.status !== 0) {
    process.stderr.write(`\n构建失败于第 ${index + 1} 趟（${pass.entry}）\n`);
    process.exit(result.status ?? 1);
  }
}

// ── 产物清单 ──────────────────────────────────────────────────────────────
// 写出 `dist/artifacts.json`，供压缩脚本与体积门**派生**各自的清单。
// 这是 R1 的落地：让「新增产物却漏掉压缩/漏掉设门」在结构上不可能。
// `verify-build.js` 若读不到本文件，必须判失败 —— 缺清单意味着无人看守。
const manifest = {
  generatedBy: 'scripts/build-all.mjs',
  artifacts: passes.flatMap((pass) => pass.artifacts.map((a) => ({ ...a, entry: pass.entry }))),
};
writeFileSync('dist/artifacts.json', `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(`\n产物清单：dist/artifacts.json（${manifest.artifacts.length} 个产物）\n`);

// ── 子路径类型 ────────────────────────────────────────────────────────────
// `vite-plugin-dts` 配的是 `include:['src'] + rollupTypes`，它把整个 src 的类型面
// 汇总成单个 `index.d.ts`，**不按入口分名** —— 所以三趟 ES 产出的是同一份全量类型
// （内容正确，但 `entry-drag.d.ts` / `entry-scroll.d.ts` 根本不会出现）。
// package.json 的子路径 `types` 必须有真文件可指，否则 TS 消费者
// `import "cineview/drag"` 直接解析失败。故在此生成两个薄声明：
// 星号再导出全量面 + 用本地声明**遮蔽** `CineView`（.d.ts 里显式声明优先于
// `export *`，与 ES 模块语义一致），把它收窄成不接受 `mode` 的单模式签名。
// 这样类型与运行时一致：拖拽入口传 `mode` 编译期就报错，而不是等运行时抛。
// Props 从已导出的 `CineViewProps` 联合里**提取对应分支**再去掉 `mode`，而不是引用
// `CineViewBaseProps` —— 后者在 index.d.ts 里是 `declare interface`（未导出，因为
// public-api.ts 没再导出它），引用它会 TS2724。也不为此扩大公共类型面。
// 注意：`Omit` 施加在**单个分支**上是安全的；施加在整个联合上会抹掉 `mode` 判别式、
// 把 callbacks 塌成两模式的并集（src/entry-drag.ts 文件头记了这个坑）。
const subpathTypes = [
  {
    file: 'dist/entry-drag.d.ts',
    propsName: 'CineViewDragProps',
    branch: "Extract<CineViewProps, { mode?: 'drag' }>",
    engine: '拖拽',
    sibling: 'cineview/scroll',
  },
  {
    file: 'dist/entry-scroll.d.ts',
    propsName: 'CineViewScrollProps',
    branch: "Extract<CineViewProps, { mode: 'scroll' }>",
    engine: '滚动',
    sibling: 'cineview/drag',
  },
];

for (const t of subpathTypes) {
  const source = `// 由 scripts/build-all.mjs 生成，请勿手改。
// ${t.engine}专用入口的类型面：与全量入口的唯一差异是 \`CineView\` 不接受 \`mode\`
// （本产物只含${t.engine}引擎；需要另一种模式请用 "${t.sibling}"，
// 需要运行时按 mode 切换请用 "cineview"）。
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type { CineViewProps, CineViewRef } from './index';

export * from './index';

export declare type ${t.propsName} = Omit<${t.branch}, 'mode'>;

export declare const CineView: ForwardRefExoticComponent<
    ${t.propsName} & RefAttributes<CineViewRef>
>;
`;
  writeFileSync(t.file, source, 'utf8');
  process.stdout.write(`生成子路径类型：${t.file}\n`);
}

process.stdout.write('\n构建完成\n');

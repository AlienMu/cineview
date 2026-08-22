# 2026-08-22 M 级整改：共享运行时迁移 + 动画驱动收敛

来源：四维结构评审建议项 top2（零阻断，属结构债）：
- 2.1 Scene↔CineView 双向依赖 → 共享运行时设施迁出 CineView 目录
- 1.2+1.3 useMixedValue/useNumericValue 三拷贝 + 属性 lane 双枚举 → 单点收敛

硬约束：**行为保持型重构**（纯移动/去重/参数化），零语义变化；
1.3 触及 drag/scroll 热路径，每帧成本不得增加（仍是同一批 useTransform 结构）。

## 节点

- [x] N1 (2.1) 共享运行时设施迁移 → `src/components/runtime/` ✅
  - git mv：runtimeContext.tsx / scrollSceneFrameStore.ts / scrollExternalStore.ts
    (+co-located scrollExternalStore.test.ts)
  - 34 处 import 重写（Scene/Animate/Position 侧 `../CineView/X`→`../runtime/X`；
    CineView 侧 `./X`→`../runtime/X`——**踩坑记录**：runtime 与 CineView 是兄弟目录，
    首轮误写 `./runtime/X` 致 TS2307×14，改 `../runtime/` 后归零）
  - scrollSceneFrameStore 的 directScrollHelpers 改跨目录 type-only import
  - runtime/README.md 定位注释；type-check 0 错 + 1574/1574 全绿
- [x] N2 (1.2) useMixedValue/useNumericValue 三份拷贝合并 ✅（与 N3 合并落地）
- [x] N3 (1.3) 属性 lane 手工枚举两份 → 单工厂 ✅
  - 新文件 `useAnimatedPropertyLanes.ts`：useMixedPropertyLane / useNumericPropertyLane
    （可选 resolveNumericValue）/ useAnimatedPropertyLanes（固定 10 lane + style 键序）；
    framer-motion 运行时 import 仅 useTransform（稀疏 mock 约束）
  - animateInterpolation.ts 新增 SceneVariantRecords（drag CachedVariants 与 scroll
    四处内联三字段统一；arrival 两字段形状保持独立 ArrivalVariantRecords）
  - 三驱动接入：scroll（resolver=resolveScrollPropertyValue）/ arrival（mixed=内联
    lerpTransformValue，numeric=parse-两端算术，**经可选参数注入**——修正 Plan agent
    抓出的语义漂移漏洞）/ drag（resolver=resolveDragPropertyValue，null 守卫保持
    mixed 形态 fallback）
  - 每步套件绿：scroll 89/89（含 hotpath 零重渲染）、arrival 11/11、drag 128/128
  - 新增回归测试：`useAnimatedPropertyLanes.test.tsx`（4 例契约：tween-to-fallback /
    hold-snap 边界文档化 / 双路径 parseable 一致 / style 键序锁定）+
    `useAnimateArrival.lanes.test.tsx`（wiring 锁，真 framer-motion，set+rerender
    同步驱动）。变异验证：摘掉 arrival 的 resolveNumericValue → 红 → 恢复 → 绿
  - 残留 grep `useMixedValue|useNumericValue` 归零（含 1 处过期注释清理）
- [x] N4 门禁：`pnpm verify:framework:static` **GATE-EXIT=0**（format×2/type-check×2/
      lint/覆盖率 ≥90%/examples 测试/jscpd/build:verify 14/14/failure-injection 5/5）
  - ⚠ **附带发现并修复预存门禁缺陷**（非本轮引入，git log 佐证 4660d96 manifest 预算
    改造时弄坏、a4005a9 注入期望串从一开始就不匹配实际输出）：
    `CINEVIEW_MAX_BUNDLE_SIZE_KB` 只做缺省兜底、压不过 artifacts.json 的 budgetKB
    → bundle-size 注入永远不红 → `pnpm verify`（prepublishOnly 链）自 08-12 起即失效。
    修法：显式提供该 env（含 0）时为全产物硬覆盖（BUDGET_OVERRIDE_KB）+ 注入期望串
    '超过目标'→'超过预算'。验证：注入 exit=1 且 4 处'超过预算'（ES+3 UMD 全看守）、
    无 env 常规跑 exit=0、注入套件 5/5
  - 踩坑：首轮 `pnpm ... | tail` 吞了真实退出码——聚合门必须直接判 `$?`
- [x] N5 fresh agent 对抗复审：**PASS** + 提交
  - 七项全核：N1 迁移字节级比对（三文件除 import 路径零语义 diff）/ hooks 顺序逐位
    等价 / resolver 逐值等价推演（无可达反例）/ 门禁副作用 / 3 变异（测后零残留，
    drag null 守卫删改 4 套件 60 测试红 = 有覆盖）/ 独立复跑 1579+ 全绿 / 死码清点
  - 复审 LOW×2（门禁 env 解析：垃圾值→NaN 静默禁门、空串→错杀 55 预算）已修：
    非有限数字响亮 exit 1、空串视为未提供。四 env 场景 + 注入 5/5 复验
  - 复审 INFO×2：key-order 测试锁返回键序非 hook 创建序（等价，记录）；lane helper
    导出收敛为私有（仅工厂/类型/接口三项导出）
  - 过程：503 打断一次（死在变异恢复中，盘上核实已恢复后续跑）
- [ ] N6 上线终审（含真机浏览器验收 lane——发布硬条件，待环境就绪）

## 后续（本 task-flow 不含，另行排期）

- 阶段 3 官网文档续作（2026-06-30-official-site-docs.md，按当前框架能力更新任务清单）
- 教学级 minimal example（单列 task-flow）
- grill-me 细节沟通（上线评审通过后，用户点名）

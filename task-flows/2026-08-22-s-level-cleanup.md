# 2026-08-22 S 级清理：死码 ×3 + 预设 union 单点化 + devLog 统一

来源：2026-08-21 四维结构评审（复用 7/维护 6/扩展 7/开箱 8）建议项中的 S 级 +
两轮独立确认的死码。M 级项（2.1 共享运行时迁移、1.2+1.3 属性 lane 工厂）本轮不做，
待用户单独裁决。

## 节点

- [x] N1 死码删除（两轮评审独立确认 + 主会话 grep 复核）：
  a) `src/utils/throttle.ts` + `throttle.test.ts` 已删（全仓零 import）
  b) `useSceneScrollZoneTimeline` 生产导出已删；`useSceneScrollZoneSelection`（底层泛型）
     转为导出，三个测试文件各自内联同名 identity helper（保留订阅机制重渲染断言语义，
     调用点零改动）
  c) `ScrollSceneFrameStore.getSnapshot` 接口+实现已删（test 的 `.store.getSnapshot()`
     是 keyed store 的同名方法，主会话逐一核实非误删）
  受影响 7 套件 146/146 绿
- [x] N2 预设名双 union 单点化：presets/index.ts 44 行手维护 union 删除，改为
  `import type { PresetAnimation as PresetAnimationName } from '../../types'`
  （别名 import 避开本地同名接口；零外部消费者无需 re-export；types 文件纯类型无环）。
  type-check 0 错误 = 编译器证明两份 union 本就一致；Record 完备性检查从此单点哨兵
- [x] N3 告警统一：devLog 新增 devWarnOnce/devErrorOnce（跨实例 Set 去重）；
  CineViewContext 两处手写 flag+console → devErrorOnce/devWarnOnce（顺带 4.4：
  文案改为 within a <CineView> component）；Animate.tsx 两处 NODE_ENV+console.warn
  → devWarn，前缀统一 [CineView]；branches 测试两处断言改 join(' ')。
  注：Scene dependencyChecker 的 `[CineView Warning]` 另有测试断言钉住，不在本批
- [x] N4 门禁：**1574/1574**（净 −10 来自删除的 throttle 测试）、type-check 0、
      lint 0、build:verify 14/14（ES gzip 45.81KB / UMD 54.24KB 不变）
- [x] N5 fresh agent 对抗复审：**PASS**（503 中断两次，笔记落盘接力）
  - 逐项核实：throttle 零引用 / helper 语义等价（含 barrel 检查——
    useSceneScrollZoneSelection 未进公共面）/ frame store getSnapshot 同名甄别正确
    （keyed store 方法非误删，setSnapshot 保留有消费）/ union 43 成员逐一比对一致、
    无环无遮蔽 / once 语义等价（NODE_ENV 先于 Set-add，顺序依赖为既有意图且测试有注释）
  - 变异抽查：progressPx→-999 → 58/89 红 → 回滚 → 89/89 绿
  - 主会话独立复核：131/131 绿（变异残留必红）+ 笔记证据
  - P3 观察项（记档）：'[CineView Warning]' 旧前缀在另外 10 处未触碰站点继续存在，
    双前缀风格并存（Scene dependencyChecker 等，有测试钉住其文案）

## 收口

提交见本文件 git log。M 级项（2.1 共享运行时迁移 / 1.2+1.3 属性 lane 工厂）
与真机浏览器验收 lane 待用户裁决，未包含在本批。

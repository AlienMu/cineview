# N4 写作指令（每批 agent 必读）

## 事实源纪律（最高优先级）
1. 唯一事实源 = `task-flows/2026-08-27-docs-factsheet.md`。**只有标 ✅ 的条目可以写进正文**；`📥`/`⚠️` 不可写。
2. 需要 factsheet 未覆盖的事实时，**自己回源码核实并给出 file:line**，不确定就不写。禁止凭记忆或惯例写 API。
3. `DESIGN.md` 有 5 处过期（见 `2026-08-27-docs-spec-gap.md`），不得照抄；冲突以源码为准。
4. 禁止引用 `src/utils/gestureDetector.ts` 的任何数值——它是零消费死代码，其 `minSwipeDistance:50/maxSwipeTime:300` 不是框架真实阈值。

## 文风（用户明确要求「保持目前的风格」）
权威样本：`site/src/content/docs/zh/concepts/02-timeline.md` 与 `zh/advanced/07-common-pitfalls.md`。先读这两页再动笔。

- 开篇一句话点题，不写「本文将介绍」类预告腔
- 表格给事实（prop / 类型 / 默认 / 说明），散文只讲表格讲不了的因果
- 默认值必须写出；没有默认写 `无`（en 写 `none`），不留空
- 坑走「症状 → 根因 → 正解」三段式，症状一句话可对号入座
- **散文区禁用 `—` / `–` / `——`**（代码块豁免）；用句号、逗号、冒号或括号
- 不用营销词（赋能/无缝/一站式/强大）；**不写修复史**（「已修复」「曾经」「旧版本」一律不出现）
- 中文用「」引号；术语保留英文原词：zone / takeover / scrub / center-lock / phase / commit
- 交叉引用写 `见 [页名](/docs/slug)`；页末保留「下一步」或「相关页面」
- 每页 frontmatter 的 `title` / `eyebrow` 保持现值不改

## 结构
每页四段：**它是什么 → 完整 props/字段表（含真实默认值）→ 隐性约束 → 相关页**。

## 硬性约束
- 只改分配给你的文件，**中英双语都要写**，两语言结构必须同构（同样的 h2/h3 数量与顺序）
- 页内 h2/h3 标题在**同一页内不得重名**（契约测试会红）
- 只能链接到实际存在的 slug（契约测试会红）。全部 40 个 slug 见 `site/src/content/docs/zh/*/*.md` 文件名
- 不改任何 `.ts`/`.tsx`/`.css`

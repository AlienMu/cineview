# 2026-08-27 scroll + stagger + infiniteAnimation 分支错用（框架侧缺陷，已由测试确证）

来源：文档轮（`2026-08-27-docs-coverage-shell.md`）N7 对抗复审附带发现，用户裁决单独立档排查。**根因已定，未改代码。**

## 结论（先写，因为中途推翻过一次）

**确证缺陷只有一个，且很小**：`Animate.tsx:927`（scroll + `infiniteAnimation` 分支）绑的是原始 scrub style `scrollResult.style`，而非中和后的 `scrollOuterStyle`。其余三个返回分支都绑中和值。

**一处我先前的误判已证伪**：我曾断言「`STAGGER_NEUTRAL_STYLE` 中和路径整体失效、scroll + stagger 基本不可用」。**这是错的**，见下方「证伪过程」。中和工作正常。

## 决定性对照（同页、同变体、唯一变量是 stagger）

```
STAG wrapper="opacity: 1; …"          kids=[0.297,0.149]   ← 中和生效，子元素错峰
NONE wrapper="opacity: 0.098; …"      kids=[1,1]           ← 未 stagger，外层自己 scrub
STAG wrapper="opacity: 1; …"          kids=[0.652,0.535]
NONE wrapper="opacity: 0.495; …"      kids=[1,1]
```

**stagger 生效时外层恒 `opacity: 1`，子元素逐个揭示** —— 这正是 `:900-905` 注释声称的行为。中和没有坏。

## 证伪过程（记录，避免重犯）

先前那轮探针我读到「stagger 组 wrapper 恒 0、子元素在动 ⇒ 整组不可见」，据此判 P1。错在**采样时机**：那些读数取自元素自身可见性闸门尚未开启的位置（`relBottom` 还没进入 `vh - enterMargin`），此时外层停在 initial 帧 `opacity: 0` 是**正确行为**，不是缺陷。子元素之所以「在动」，是 stagger 的子项补间独立于外层闸门。

两组都读到 0，本该是「对照组也 0 ⇒ 变量不成立」的信号，我当时却把它当成「连正确分支也坏了」。**教训：对照组与实验组给出同一结果时，第一反应应是探针没有隔离变量，而不是缺陷范围更大。** 与 [[probe-must-assert-intent]] 同源。

已排除的其他嫌疑（都做了独立 fixture）：
- **frozen 常量对象作 style**：`Object.freeze({opacity:1})` 与普通对象行为一致，framer 正常写入
- **空变体 tag-carrier 与 style 竞争**：`variants={{initial:{},animate:{},exit:{}}}` + `style` 并存时 framer 仍写 `opacity: 1`
- **style 所有权切换丢值**：MotionValue style → frozen 常量的切换，framer 会写回 1（实测 `opacity: 0` → `1`）
- **dist 陈旧**：`dist` 构建时间晚于 src，且 shipped 代码含本缺陷
- **`useAnimatedPropertyLanes` 每渲染新建 style 对象**（`:121-122` 无 memo）：客观存在，但不导致本现象（stagger 时该对象根本不上外层）

## 仍然成立的缺陷（P2）

`Animate.tsx:927` vs 另三分支：

```js
// dist/cineview.es.mjs 实证（ut = Object.freeze({opacity:1})，gt = staggerActive）
Lt = gt ? ut : wt.style
// infinite 分支： style: wt.style   ← 丢掉 Lt，用原始 scrub style
// 其余三分支：    style: Lt / Ot    ← 用中和值
```

drag 孪生分支（`:952`）绑的是中和后的 `dragOuterStyle`，**这个不对称本身就是它是笔误而非设计的证据**。

**触发条件**：`mode="scroll"` + `stagger` + `infiniteAnimation` 三者同现。
**后果**：外层容器与子元素双重动画 —— 容器整体 scrub 淡入，同时子元素各自错峰揭示，两层 opacity 相乘，节奏与单独 stagger 不一致。正是 `:900-905` 注释明令要防的事。
**严重度**：低。视觉退化而非内容丢失（不会整组不可见 —— 那是我先前的误判）；且需三条件同现，现网未撞上。
**影响面**：全仓零测试覆盖此组合（`StaggerContainer.test.tsx` 与 `Animate.test.tsx` 均无用例），这解释了它为何存活。

## 修法建议（未实施）

一行：`:927` 的 `style={scrollResult.style}` → `style={scrollOuterStyle}`。

配套回归测试（现完全缺失）：断言 `mode="scroll"` + `stagger` + `infiniteAnimation` 时 `.cineview-animate` 的 opacity 不随 zone 进度变化（应恒 1），且子元素仍错峰。

**注意**：不要照我先前说的「修 P2 前必须先修 P1」——P1 不存在。

## 文档侧

无需回改。文档从未声称 scroll + stagger 不可用，`concepts/04-orchestration.md` 与 `reference/03-animate.md` 的 stagger 段落描述的都是实测行为（时间驱动、不 scrub、子元素逐个揭示）。


---

## 测试确证（2026-08-27，用户裁决「只加测试、不动实现」）

新增 `src/components/Animate/animateStaggerOuterStyle.test.tsx`，按 **mode × stagger × infinite** 铺分支矩阵。这一步解决了前面所有真机 fixture 都无法解决的问题：**在受控环境里隔离出单一变量。**

结果（5/5 通过，其中缺陷格用 `it.failing` 记录）：

| 分支 | 外层 opacity | 判定 |
|---|---|---|
| drag，无 infinite | `1` | 中和生效 ✅ |
| drag + infinite | `1` | 中和生效 ✅ |
| scroll，无 infinite | `1` | 中和生效 ✅ |
| **scroll + infinite** | **`0`** | **缺陷确证** ❌ |
| 无 stagger（反向守卫） | `0` | 中和未泄漏 ✅ |

**关键收获：`scroll + stagger`（不含 infinite）读到 `1`，中和完全正常。** 这彻底否掉了「中和路径整体失效」那条假设（我曾据此判 P1、又自行翻案、又被外部复审翻回来）。之前 6 个真机 fixture 全部归零，是 fixture 自身缺陷，与框架无关——**受控测试给出了真机探针给不出的隔离度**。

### 后果（现在可以准确回答）

`scroll + stagger + infiniteAnimation` 时外层停在 scrub 轨的初始帧 `opacity: 0`，同时子元素各自错峰揭示到 1。两层相乘 ⇒ 该组合在入场初期整组不可见，随 zone 进度推进才逐渐显现。这既不是我最初说的「双重动画」（外层没在正常 scrub，而是停在初始帧），也不是「永久不可见」（会随进度恢复）。

### 缺陷格的处理

用 `it.failing` 而非 `skip`：这样它现在通过（记录缺陷存在），而**一旦有人修了实现、这条会立刻失败并提醒把 `.failing` 去掉**，从而自动转为防回归守卫。修法与去标注方式写在该用例的注释里。

### 门

`animateStaggerOuterStyle` 5/5；`src/components/Animate` 全量 **307/307**（25 suites）；`eslint` 0；`tsc -p tsconfig.framework.json` 0；prettier 已格式化。**实现代码零改动。**

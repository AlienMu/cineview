# 双页主题基调审计 — /scroll 暖色为主 · /drag 暗色为主（2026-08-15）

> 只读设计审计，不改码。逐点位 file:line。用户方向：「暖色调——/scroll 是暖色为主 /drag 暗色为主，设计优化，看看有没有什么可以改的」。
> 前提：scroll 页 19 项 accent 派生微调昨日已落地（见本目录 `style-audit.md`，代码已核实应用：齿孔条/分隔线/投影/scrim/act5 光晕均已派生）。本轮只找**残留偏离**，不重审已知项。
> 真机证据：`scripts/_theme-audit-shots.mjs` 于 `localhost:4000/drag` 实拍五幕（`review/20260814-adv/drag-act{1..5}.png`，390×844，每幕 settle 6.5s 后截帧）。

---

## A. /drag 暗色主题审计（重点）

### A-1【红】Act 04 整幕蓝/紫，与 film-grade 三色契约（amber/teal/rec）断链
- 现状：`site/src/styles/temporal-scenes-03-05.css:615-625`（`.tp-scene--04` 自立 palette：`--tp-sig: #72bfff`、`--tp-accent: #a9d8ff`、`--tp-accent-soft: #5a8ec7`、底 `#030407` + 蓝紫 radial）、`:630-640`（三列时间码蓝紫着色）、`:723-739`（镜头玻璃 `#102b70`/`#0f74ca` 深蓝盘）、`:813-852`（蓝紫镜头反射）、`ApertureCanvas.tsx:283-286`（叶片 sheen 蓝）。真机截图 `drag-act4.png` 视觉确证：中央物体读作**饱和蓝镜头**，全幕冷蓝主导。
- 问题：`temporal-drag.css:24-31` 的 palette 契约明文「**No blue, no magenta** — they read as arbitrary the moment they appear next to the grade」，冷极角色由 `--tp-sig-teal: #409ba8`（`:46`）承担。Act 04 重做为光学快门后另立了整套**蓝色家族**（不是 teal：#72bfff 的 hue≈207° vs teal #409ba8 hue≈187°，且带紫伴随 rgba(111,69,143)），第四幕在三色系统里没有座位——这是对 temporal-drag-palette 定稿最大的单点偏离。五幕色温行程现状是「amber(1) → amber(2) → amber(3) → **蓝紫(4)** → amber(5)」。
- 提案（两个方向，需拍板）：
  - **(a) 收编回 teal 族**：`--tp-sig` → teal 提亮档（如 `#5cb8c9`，保持 187° hue），镜头玻璃从 `#102b70/#0f74ca` 平移到深青（如 `#0a3a44/#15808f`），紫反射 `rgba(111,69,143,·)` 删或转 teal 低 alpha。第四幕仍读作「冷的一幕」，但回到契约的冷极。
  - **(b) 承认镜头蓝为「物体色」**：光学镜头镀膜本来就是蓝的（物体色 ≠ 信号色），保留现值，但必须同步改 `temporal-drag.css:24-45` 契约注释（见 A-2），并在契约里写明「act4 蓝是 props 色、不进信号系统」。
- 风险：(a) 是视觉重定位，需真机五幕连拖验收色温行程；(b) 零视觉风险但契约文档要跟上。
- 边界：**[红]** —— 与 temporal-drag-palette memory 定稿（三色系、No blue）直接冲突，选哪个方向都是对定稿的修订，需用户拍板。

### A-2【绿】palette 契约注释双过期：teal「无消费者」的叙述描述的是两代之前的 act4
- 现状：`site/src/styles/temporal-drag.css:39-47` —— 注释说 act4「recoloured to a night-fluorescent green (#39ff88)」所以 teal 失去消费者；`:209-214` 又说 04/05 的旧副本是「04 teal vs the act's fluorescent green」。真实现状：act4 已经不是荧光绿日食，是蓝紫光学快门（A-1），绿也不存在了。
- 问题：三色契约的「冷极」目前**页面上零承载**（teal token 无消费者、act4 另立蓝色），而文件里两段注释都指向一个不存在的中间版本——下一个人按注释去找「act4 的绿」会找到蓝，按契约去找冷极会找到空 token。文档即契约，契约已与实现三向脱节。
- 提案：随 A-1 裁决一并修注释——冷极的实际归属（teal 恢复消费 / act4 蓝豁免 / teal 删除）三选一写清。纯注释改动零风险。
- 边界：[绿]（注释本身），内容跟随 A-1 裁决。

### A-3【红】rec 信号红已无任何渲染消费者——三色实际只剩 1.5 色
- 现状：`--tp-sig-rec: #e64536`（temporal-drag.css:48）唯一消费路径是 `--tp-rec`（:66-67）→ `.tp-rec*` 规则（:231-262）→ `RecBadge.tsx`。全仓 grep 确认 **`<RecBadge>` 无任何挂载点**（HUD/footer chrome 带删除时一并失联；act5 旧 CUT CTA 也在重写中删除）。`RecBadge.tsx` + `.tp-rec*` 全组 CSS 是死代码。
- 问题：契约里 rec 的角色是「terminal / commit / CTA signal」——终局信号。现在终局（act5 THE END、credits）与 CTA（act1 `tp-btn--primary`，temporal-drag.css:1251-1255 **amber 实底**）全部由 amber 承担。amber 一色两役（resting pole + terminal），「三色各司其职」在运行时退化为「amber 通页 + act4 蓝」。真机截图 `drag-act1.png` 视觉确认：唯一的强暖亮面就是 amber CTA 按钮，它读作「金色按钮」而非「终局信号」。
- 提案（需拍板，动机制）：
  - (a) 复活终局信号：act1 主 CTA `tp-btn--primary` 底色从 amber 改 rec（暗底上 #e64536 实底 + 深字，tally 灯语义回归「按下去=开拍」）；或 act5 THE END 时间码着 rec。`RecBadge.tsx`/`.tp-rec*` 若不复活则删净（含 index.ts barrel 导出）。
  - (b) 接受两色系统：删 `--tp-sig-rec`/`--tp-rec*`/`RecBadge.tsx`，契约改两色（amber 暖极 + teal/蓝冷极）。省一套死代码。
- 风险：(a) 改 CTA 色是转化件的视觉变更；(b) 若日后要「CUT」终局节拍需重建。
- 边界：**[红]** —— 三色定稿是 memory 载明的用户裁决，砍掉一色或改 CTA 语义都需拍板。

### A-4【绿】`.drag-page` 透明底 → overscroll/回弹露出暖白 body，暗色页边界破功
- 现状：`site/src/design/global.css:73-76`（`.drag-page { background: transparent }`）；`tokens.css:97-103`（`body { background: var(--film-white) /* #faf8f4 暖白 */ }`）。`.drag-temporal`（temporal-drag.css:107-116）自身 `100svh` 不透明暗底盖住正常视口，但垂直 overscroll（iOS 橡皮筋、桌面惯性与地址栏收缩）会拖出 `.drag-temporal` 之外的 body 区域——暗色页四周闪暖白。
- 问题：独立 tab 访问 `/drag` 时这是暗色基调最直接的「暖色泄漏」点位；首页 iframe 内嵌时 iframe 高度恰好 100%，触发面小但存在（手机内拖拽到边界的回弹）。与「/drag 暗色为主」直接冲突。
- 提案：`.drag-page { background: #0c0a0c; }`（= `--tp-bg`，写死避免跨 token 依赖），可再加 `overscroll-behavior-y: none` 双保险。纯底色，零每帧成本。
- 风险：零。
- 边界：[绿]

### A-5【绿】act3 剪辑台微字号下限偏低，amber 标签的有效对比在阈值边缘
- 现状：`temporal-scenes-03-05.css:141-151`（`.s03-preview__tag`：`rgba(232,183,102,0.72)`，`font-size: clamp(7px, 1.8cqw, 9px)`）；`:251-257`（`.s03-track-row__label`：`rgba(232,183,102,0.66)`，`clamp(7px, 1.9cqw, 10px)`）；`:186`（ruler `rgba(232,183,102,0.6)` 7-10px）。
- 问题：#e8b766 @0.72 alpha 压在 `rgba(9,8,11,0.7)` 床上有效对比约 5.5:1、@0.6 约 4.6:1——数值上过 4.5:1，但 **7px 是低于任何 WCAG 可读基线的字号**（小字放大镜法则：字号越小、需要的对比越高）。真机 `drag-act3.png` 里 ruler/标签在 390px 宽确实贴着可读下限。这是暗色阶梯（A-6 总体成立）里最弱的一档。
- 提案：三处 alpha 统一抬一档（0.72→0.85、0.66→0.8、0.6→0.75），字号下限 7px→8px。仍在「颜色质感微调」权限内。
- 风险：几乎为零（静态文字色）。
- 边界：[绿]

### A-6 暗色层级阶梯核对——成立（零改动记录）
- 现状：背景链 `#08070a / #0c0a0c`（body 级）→ `#050506`（act3/act5 内容面）→ `#15131a`（elevated）；文字链 `#ede8e0`（ink）→ `#b4ada1`（soft）→ `#9a9287`（mute，6.4:1，注释有实测沿革）；accent `#d8a24a` 与 `#e1a45b`（act5）同 amber 族。真机五幕截图确认：1/2/3/5 幕全部读作「暖黑 + amber 打点」，阶梯清晰、无平面死黑（lit-room 基座 + 环境光层起效）。
- 结论：暗色基调本体健康；偏离全部集中在 A-1（act4 蓝）、A-3（rec 缺位）、A-4（overscroll 露白）三个结构点位。[绿]（核对项）

### A-7 与 scroll 页的嵌套边界核对——同族黑，过渡和谐（零改动记录）
- 现状：scroll act5 熄灯 overlay `#0a0909` @0.94（Scene5Cinema.css:21-27，留 6% 暖底）→ 手机机身 `#0b0a0c`（:381）→ 屏幕槽 `#060507`（:395、:442 iframe 底）→ iframe 内 drag 页 `#0c0a0c` → drag act5 黑幕 `#050506→#0c0d11` + 顶部暖 radial `rgba(255,226,183,0.2)`（temporal-drag.css:143-153）。
- 核对：五种近黑的 hue 差全部 ≤3 个 R−B 单位（均中性偏微冷/微暖交替在噪声级），亮度构成「0.94 暖露底 → 机身 → 屏槽 → 内容 → act5 纯黑」的可辨纵深序；drag act5 黑幕的暖 radial 与 scroll act5 的「留一线暖底」裁决（Scene5Cinema.tsx:33 LIGHTS_OFF_MAX=0.94，用户明示避免纯黑）**同族同向**。`.tp-act5-black` 淡入只做 opacity、不随场景框平移，边界无滑动接缝。两种黑不是「两种黑」。[绿]（核对项）

---

## B. /scroll 暖色主题审计（快速过）

### B-1【绿】tokens.css 静态回退色未随 08-14 LUT[0] 回奶白桃同步——注释声称同步、实际漂了一档
- 现状：`site/src/design/tokens.css:27-34`：`--bg-grad-top: #faf0df` / `--bg-grad-bot: #fbf5ea` / `--accent: #c98a6a` / `--accent-ink: #9c6249`，注释（:28-29）明文「与新 LUT 停靠 0（design/lut.ts，2026-08-13）同步：无容器页面的 ribbon 回退色 = 暖象牙」。但 `lut.ts:27` 的停靠 0 已于 08-14 回奶白桃 `#fcede4 / #faf8f4 / #d59273 / #a86247`。
- 问题：三个消费面吃到旧暖象牙——① `/docs` `/demo` 无容器页的 ribbon 底色；② 首页 JS 写入前的首帧回退（`global.css:22` 的 `var(--bg-grad-top, #faf0df)` 与 `--a3-plate` 等 fallback 同理）；③ `::selection`/focus 在 accent 未写入时的 `--accent` 回退 #c98a6a（与 LUT[0] 的 #d59273 差一个饱和度档）。首页暖色内部出现「奶白桃段内嵌一块暖象牙」的换温面。
- 提案：四值对齐 LUT[0]（`#fcede4/#faf8f4/#d59273/#a86247`）+ 注释改为「2026-08-14 同步」；若 /docs 刻意要更中性的暖象牙（阅读页降饱和是合理动机），则保留值、改注释明示「docs 专用回退，非同步」。
- 风险：极小（回退色只在 JS 写入前/无容器页生效）。
- 边界：[绿]

### B-2 全屏表面残留冷色/纯白扫描——五幕内干净，/docs /demo 有页外残留（记录）
- 现状核对：五幕全屏表面全部中性/渐变派生——hero 透明（global.css:42-44）；act2 film-track 半透暖白 + blur（CapabilityScene.css:211）、codecard `rgba(252,247,241,0.94)` 暖白（:457）；act3 `--a3-plate` color-mix 派生（Act3DollyScene.css:74-76）；act4 scrim 派生（DemoVideoScene.css:65-66，昨日已改）；act5 `#0a0909` 刻意影院暗段。**无残留冷色/纯白全屏面**。
- 页外（非本轮两页范围，仅记录）：`global.css:581-585`（docs code block 冷蓝黑 `#1b1f24`）、`:732`（demo-stage scroll 场 `#dce7df` **冷绿**）、`:689`（demo-stage `#ece9e2`）。若「暖为主」日后扩到全站，`#dce7df` 是第一个要动的冷面。
- 边界：[绿]（核对项 + 页外记录）

### B-3【绿】tokens.css `--lut-*` 四族（dawn/sky/lavender/mint）死 token
- 现状：`tokens.css:18-26` 四组八值，注释自称「更早设计残留，仅作历史保留」。全仓 grep 零消费（唯一出现处即 tokens.css 自身）。
- 问题：与 CLAUDE.md 收口原则（不留零消费字段）相悖；且 `--lut-sky-top: #e6eef6` / `--lut-lavender-top: #ece6f4` 是**冷色/紫** token——在「暖为主」的系统里留着冷色 LUT 族，被误用的概率不为零（补全菜单会推荐它们）。
- 提案：删除八值 + 注释（历史在 git）。
- 风险：零（无消费者，删除不可能改变任何渲染）。
- 边界：[绿]

### B-4 LUT 六锚与暖 token 协调性核对——协调（零改动记录）
- 现状：`lut.ts:27-32` 六锚 hue 行程 24→28→35→30→30→25（全暖、无粉、单向流动），与 `--film-white #faf8f4`（hue≈33 暖白）、`--ink #1a1814`（暖墨）、`--rec #c4453f`（信号红，独立于镜头色）无 hue 冲突；`--frame-line #e4dfd6` 暖灰线条族与 LUT bot 端（亮度 244-249）拉开约一档明度。08-14 首屏锚 #fcede4（R−B=41）与其余五锚（R−B 33-45）同带。结论：协调，不动。[绿]（核对项）

---

## C. 双页共享组件

### C-1 LangToggle 双态成立，`--drag` 变体存在且正确（零改动记录）
- 现状：基态（暖底，global.css:117-154）：无底、ink-mute 字、hover accent 派生光晕（昨日已改 color-mix）。暖页暗段态（global.css:187-199）：`body:has(.scene5-cinema[data-cinema-stage=…])` 切 `#9a948a` 字 + 冷白细环光晕。drag 变体（temporal-drag.css:331-340）：`lang-toggle--drag` 存在，暗药丸 `rgba(12,10,8,0.78)` + 44px 触达区，z47 避环境光板，由 SceneRolling GatedLangToggle 挂在 act1 内随时间轴进退场（SceneRolling.tsx:468-489）。
- 核对：三个态色温各归其主；drag 变体保留背景是「lit plate 上小字对比」的实测例外（注释在案），与暖页 08-09「去底」裁决不冲突（那是对亮底药丸）。配色沿用注释明示与 act5 :has() 态同源。无改动。
- 小瑕疵（可做可不做）：`.lang-toggle--drag` 的字色 `#9a948a` 与 `--tp-ink-mute #9a9287` 是两个手写近同值——可改 `var(--tp-ink-mute)` 消除双源。[绿]

### C-2 滚动条：仅 scroll 页存在，已定稿（零改动记录）
- 现状：`HomePage.tsx:60-67` thumb `var(--accent)` 流动、track 中性墨 0.06；`/drag` 的 CineView 未配置 scrollbar（TemporalDragExperience.tsx:216-236，drag 模式无滚动条）。昨日「明确不动」清单第 11 条继续有效。[绿]（核对项）

### C-3 `.tp-btn` 为 `.drag-temporal` 作用域内样式，不跨页泄漏（零改动记录）
- 现状：`temporal-drag.css:1214-1262` 全部选择器带 `.drag-temporal` 前缀；文件头注释（:1-2）明示「self-contained so the dark edit-suite palette cannot leak into the warm official-site surfaces」。scroll 页按钮走 global.css `.btn` 族（accent-ink 底）。两套按钮语汇各自成立。[绿]（核对项）

---

## 优先级排序

1. **A-4** `.drag-page` overscroll 露暖白 —— [绿] 一行改动，暗色页最直接的暖泄漏，收益/成本比最高。
2. **A-1 + A-2** act4 蓝紫 vs 三色契约 —— [红] 本轮最大的主题基调裁决点：/drag 的「暗」是成立的，但「暗里的冷极」该归谁（teal 还是镜头蓝）决定五幕色温行程的叙事完整性。拍板后 A-2 注释随行。
3. **A-3** rec 信号缺位 + RecBadge 死代码 —— [红] 决定三色系统是「修回三色」还是「裁成两色」；无论选哪个，`RecBadge.tsx` + `.tp-rec*` 的死代码清理都该做。
4. **B-1** tokens 回退色与 LUT[0] 脱钩 —— [绿] 消除首页暖色内部的换温面（含首帧/docs/selection）。
5. **A-5** act3 微字对比 —— [绿] 抛光项。
6. **B-3** `--lut-*` 死 token 删除 —— [绿] 减熵项。
7. **C-1 尾注** `#9a948a` → `var(--tp-ink-mute)` —— [绿] 消双源，顺手项。

## 明确不动清单

1. **act2 钨丝灯金 + 光束**（temporal-drag.css:677-683、:792-825）—— act2 是 user decree「颜色改为暗金色不要用青色」的定稿落点，beam/pool/haze 全 amber 族，正是暗色页里「暖 accent」的正确用法（真机 `drag-act2.png` 确认光束是唯一的暖亮面且体积感成立）。不动。
2. **act5 黑幕根级层结构与暖 radial**（temporal-drag.css:143-153 + TemporalDragExperience.tsx 三态编排）—— 2026-08-13 整改定稿（黑幕只淡出不下移），暖 radial 与 scroll act5「避免纯黑」裁决同族。不动。
3. **scroll act5 影院暗段**（Scene5Cinema.css overlay 0.94/三层黑/星光）—— 刻意的影院叙事；昨日审计点位 1/2/3/4/6 已全部处理或核对完毕，本轮 A-7 又确认与 /drag 黑同族。不动。
4. **`--tp-ink-mute #9a9287` 的两次提亮沿革**（temporal-drag.css:12-21 注释实测链）—— 有像素级实测背书，不重开。
5. **act4 时间码白字 `#d5ecff` 与蓝 glow**（temporal-scenes-03-05.css:884-891）—— 属 A-1 裁决范围的一部分，A-1 选 (b) 则整体不动，选 (a) 则随行；不单独立项。
6. **LUT 六锚数值**（lut.ts:27-32）—— 08-13/08-14 两轮用户裁决刚定稿（全程暖、无粉、首屏奶白桃），无新证据不重开。
7. **滚动条三色 / `--rec` tokens.css 族 / docs、demo 页配色** —— 昨日「明确不动」清单第 11/12 条继续有效；docs/demo 冷面（B-2 页外记录）留待「暖色扩全站」专项。
8. **BackgroundRibbon 在 /drag 路由的挂载**（App.tsx:22 无条件渲染）—— 被不透明 `.drag-temporal` 全遮盖，浪费一个 fixed 层但零视觉影响；若 A-4 改底色时想顺手关掉，属 App 结构微调，本轮不提案。

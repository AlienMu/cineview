# 对抗审查:2026-08-09 scene5 退场时序/文案/暖色批(v2)

审查范围:`git diff` 未提交改动中 site/src 下 8 文件(task-flows/2026-08-09-scene5-exit-seq-copy-warm.md 声明)。
实际工作树状态确认:Scene5Cinema.tsx / Act3DollyScene.css **不在 git status 列表**(scene5 tsx 与 act3 css 相对 HEAD 无差异——说明这两文件的改动已在基线 commit `41aae22` 内,本批实际未提交 diff 集中于 TemporalDragExperience.tsx、Scene5Cinema.css、CapabilityScene.css、i18n、global.css)。对 tsx 侧逻辑按当前文件内容审查(与 diff 等价,因基线即本批改后态)。

## 中期发现(逐文件追加)

### F1. Scene5Cinema.tsx(已读全 453 行)

- 注释 L16「总预算由 cinema-clock lane 唯一决定(1600ms → 1600px 锁定滚动 ≈150vh@1080p)」与 L24 `TOTAL_MS = 2200` **不一致**;L442 注释同样残留「1600px」。L21-23 的预算注释已更新为 2200,但 L16/L442 未同步。轻微:注释漂移,不影响行为,但违反「注释声称的行为必须能在代码指认」的准确性。
- LIGHTS_OFF_MIN=0 路径:`lightsOffVariant()` initial opacity=0、animate 0.94 duration:0,由 phase {start:0,end:0.4} scrub。progress=0 时 initial=0 ⇒ 无初始跳变(0→0.94 全程线性)。P4 初步 PASS,待确认 Animate phase 语义下 progress=0 是否取 initial(下方对照其他 phase 用例)。
- 协议:handleMessage 对 finished→setSplit(true)/unfinished→setSplit(false),幂等。freeze effect(滚出视口)也 setSplit(false)。两写者都是 Scene5Cinema 自身,符合唯一所有者。潜在交互:子页发 unfinished 的同帧若用户已把整幕滚出视口,freeze 的 setSplit(false) 与消息的 setSplit(false) 同值,无冲突。反向:消息先到(开始退场动画)→ 用户立刻滚出视口 → freeze setSplit(false) 同值重复,无抖动(React 同值 setState 不重渲染)。待看 CSS 确认退场动画期间被打断的行为。
- aria:L435 `aria-hidden={!split}`。退场时 split 立即 false ⇒ aria-hidden 立即 true,而文字 CSS 淡出需 ~0.95s(待 CSS 确认)。视觉可见但朗读树已除名。需评估:退场期间屏幕阅读器用户正在读该文本时会被**中途切断**(比「延迟可读」更糟的方向)。严重度取决于退场时用户是否可能在读——分栏退场发生于用户正在子页 iframe 内反向拖拽,注意力在手机上,副标题/标题被读到的概率低但非零。记为 LOW-MEDIUM 观察项,确认 CSS 淡出时长后定级。

### F2. Scene5Cinema.css(已读全 402 行)+ 时序链算术核对

P1 时序链(transition 读目标态 timing 前提成立,逐方向推导):

- 入场(→ is-split):
  - phone-slot gap: is-split 态 `transition-delay: 0s`(L137),时长 1.1s ⇒ 位移 0–1.1s ✓
  - text-col basis/width: is-split 态 `transition-delay: 0s`(L179),时长 1.1s ⇒ 与 gap 同步 0–1.1s ✓
  - title: is-split 态 `transition-delay: 1.1s`(L277),时长 0.7s ⇒ 1.1–1.8s fade+上浮 ✓(位移段播完才开始,严格串行)
  - subtitle: is-split 态 `transition-delay: 1.35s`(L308),时长 0.6s ⇒ 1.35–1.95s fade ✓(标题起步后 +0.25s)
  ⇒ 入场 = 位移1.1s → 标题(1.1s) → 副标题(1.35s)。与裁决一致。✓

- 退场(移除 is-split → 基态):
  - subtitle 基态 L303 `transition: opacity 0.6s var(--ease-out) 0s` ⇒ delay 0,0–0.6s 最先出 ✓
  - title 基态 L269-271 `opacity 0.7s ... 0.25s, transform 0.7s ... 0.25s` ⇒ 0.25–0.95s ✓
  - phone-slot gap 基态 L131 `transition: gap 1.1s var(--ease-out) 1.05s` ⇒ delay 1.05s,1.05–2.15s 收 ✓
  - text-col 基态 L169-171 basis/width delay 1.05s ⇒ 同步收 ✓
  - 文字净空时刻 = max(sub 0.6, title 0.95) = 0.95s ≤ 位移起步 1.05s ⇒ 0.1s 余量,无重叠 ✓
  ⇒ 退场 = 副标题(0) → 标题(0.25s) → 位移收(1.05s)。与裁决一致。✓

- 列上 opacity 残留检查:text-col(L159-172)与 is-split text-col(L175-180)均无 opacity 声明/transition;opacity 只在 title/subtitle 子元素上。✓(grep 全文件 transition 仅 8 处,无遗漏)
- aria 淡出时长:退场视觉可见窗口 = 副标题 0.6s / 标题 0.95s,与 tsx L434 注释说的「立即 aria-hidden 会切掉淡出期朗读」吻合。
- 注释一致性:CSS L113-121 的时序注释与规则精确对应;L130「副 0.6s + 标题 0.25+0.7s ⇒ ~1.05s」算术正确(0.25+0.7=0.95,取整 1.05 留 0.1s 余量,注释用 ~ 合理)。
- ⚠️ 发现(轻微注释漂移):CSS L312 残留「max-height 由 75vh 收到 68vh:给上方标题让出稳定空档(D4)」——那是纵向布局时代的注释,L313 起已被 90vh 裁决取代,但旧句没删。无害但属半程注释。

### F3. TemporalDragExperience.tsx(已读全 178 行)+ 框架 onSceneDidChange 语义核对

- notifySceneSettled:`toIndex === LAST_SCENE_INDEX(4)` → finished,否则 unfinished。五幕 0..4,4 即末幕 ✓。幂等 ✓,deferred 门控 ✓,同源 origin ✓。
- 框架语义:CineView.tsx L355-370 处 onSceneDidChange 在 commit(render arm)时回调,detail 含 fromIndex/toIndex;useSceneManager L170 注释确认「fires at COMMIT (render arm)」。注意点:commit 是 page-slide 到目标的瞬间,不等于 element arm settle 完成——但注释 L71-72 声明的意图就是「转场结算」而非「动画全停」,与 split 触发时机需求一致(手指松开、页面已切到末幕)。✓
- ⚠️ 需记录的非阻断观察:onSceneDidChange 在 commit 时发,而末幕 commit 后还有 element settle(~720ms);若用户在 settle 未完成时立即反拖 commit 回 scene 3,会紧接着收到 unfinished。父层 split true→false,CSS 从入场中段直接切到退场 delay——这是 transition 的正常反向行为(从当前值向新目标按退场 timing 收),无跳变。可接受。
- 与 freeze effect 冲突检查:子页 freeze(setStage('frozen'))后 CineView 卸载,不再发任何消息;父层 freeze effect 自行 setSplit(false)。两路径同值,不抖动 ✓。
- 反向 commit 只在「commit 离开末幕」发 unfinished:若用户在末幕反拖但**未过 threshold**(cancel 回弹),不 commit ⇒ 不发 ⇒ split 保持 true。正确——分栏只在确认离开末幕后才退。✓(与 memory「probe must assert intent」一致:cancel 路径不触发退场。)

### F4. Act3DollyScene.css + global.css 色带/accent + i18n + lang-toggle

- --a3-plate 三色:plate (246,241,235) R−B=+11;bar (250,245,239) R−B=+11;foot (245,240,234) R−B=+11 ⇒ 全部暖近白,与注释硬约束「R−B ≈ +10」一致 ✓。注释 L39-49 的 T1 色温原理、与色带谷段联动说明准确。
- 冷色残留:全仓 grep `#eaeef1/#e7edf2/#eeeaee/#8098aa/#52697c/238,242,246` 只剩 3 处,全部是注释中的**历史记录**(global.css L16 去蓝说明、L95 accent 说明、CapabilityScene.css L373 T1 修复原理引用旧谷色)——活值已清零 ✓。CapabilityScene L373 注释说「背景走到冷 (#e7edf2)」现在描述的是**旧状态**,但该注释语境是 2026-08-06 的修复记录,且 08-09 注释未更新此行来反映谷段已去蓝 ⇒ 轻微注释时态问题:读者会以为当前背景仍「走到冷」。记录为 LOW。
- 色带新值(global.css L51-58):33% #efe9e3 (R−B=+12)、40% #ece7e2 (R−B=+10)、52% #f1e9e3 (R−B=+14) ⇒ 全部暖中性 ✓。兜底 #f7dfcc 同时是 background-color(L41)与末锚(L61),越界不露白 ✓。scene5 tsx L61 注释声称的「容器兜底 #f7dfcc」可在 global.css L41 指认 ✓。
- 第三幕 accent:`.home-scene--shot3` 已改 #a08c80/#6e5c52(grep 确认),与注释 L94-95 一致 ✓。
- lang-toggle 去底:基态无 background 声明、无 backdrop-filter(全文件仅 L168 注释提及,属变更记录)✓;:has() 深色块(L224-237)只改 color/box-shadow,无 background/border-color ✓。基态保留 `border: 1px solid transparent`——不算残留「底」,hover 也不改 border-color(border-color 在 transition 列表里但无规则写它 ⇒ transition 列表里有一个永不变化的属性,零开销但属噪音。LOW)。
- i18n:scene5.title/subtitle/frameTitle 三键 zh/en 齐备,文案与裁决方向 A 一致(zh「两种模式,一套体系」/ en「Two modes, one system」)✓;subtitle 内嵌 `\n` 与 CSS `white-space: pre-line`(Scene5Cinema.css L299)配套 ✓。cap.shot2.* 旧键删除后 grep 无任何消费方(shot2 已被 shot3 取代),无孤儿引用 ✓。

### F5. P4 LIGHTS_OFF_MIN=0 初始跳变(框架语义已核实)

- useAnimateScroll zone scrub:`progressPx <= phaseStartPx ⇒ visualMotion.set(0)`(L837-840);0 = initial frame(opacity=LIGHTS_OFF_MIN=0)。progress 0→0.4 线性 lerp 到 animate(opacity 0.94,duration:0 即 scrub 跟随,无内部 tween)。⇒ progress=0 时 opacity=0,**无初始跳变** ✓。
- 熄灯段 0→CREATE_AT=0.4 内 0→0.94 全程线性、反向可逆(反向 progress 回落时 visualMotion 同步回落)✓ 与 tsx L11 注释「0–0.4 熄灯(黑 overlay 线性变黑,反向可逆)」一致。
- 代价知情:CREATE_AT 前(progress<0.4 即接管前滑入段)overlay=0 ⇒ 透色带尾段暖色 #f7dfcc,这正是用户 08-09 裁决要的「过渡不黑」。与注释 L61-64 的「已知代价:~900px 暖色空屏」声明一致(有意反转 08-08 ISSUE-B 修复,注释明确记录)。

### F6. P7 零每帧开销

- Scene5Cinema.tsx:split/interactive/stage/live 都是阈值穿越或消息触发的 setState,非每帧;CinemaLatchProjection 的 onProgress 是 MotionValue 'change' 订阅,回调内全部 ref 比较后才 setState(handleProgress L232-256 每个分支都有 ref 守卫)✓。
- TemporalDragExperience:notifySceneSettled 只在 onSceneDidChange(commit 事件,离散)发消息,非每帧 ✓。无新增 MotionValue/rAF/interval。
- CSS:全部改动是静态 transition 声明(一次性状态切换,非 animation infinite)✓ 符合 CLAUDE.md 规则 6 豁免说明(tsx L389-390 有注释指认)。

### F7. 注释/代码一致性汇总(发现 3 处漂移)

1. Scene5Cinema.tsx L16 + L442:「1600ms → 1600px」与 TOTAL_MS=2200 矛盾(应为 2200ms→2200px)。LOW(行为正确,注释旧值)。
2. Scene5Cinema.css L312:「max-height 由 75vh 收到 68vh:给上方标题让出稳定空档(D4)」——纵向布局时代残留,L313 起的新注释已取代它,旧句未删。LOW。
3. CapabilityScene.css L373:「背景色温跨幕变化 −24,走到冷 (#e7edf2)」——08-09 谷段去蓝后不再「走到冷」,该注释的「实测」语境是历史修复记录,但未加时间状语限定。LOW(在 T1 修复叙事里引用旧值尚可辩护,记为观察项)。

### F8. 补查(global.css diff 面 + CapabilityScene 注释时态 + 键完整性)

- global.css diff 确认:lang-toggle 的 `background: rgba(250,248,244,0.5)` 与两行 backdrop-filter(含 -webkit 前缀)在 diff 中为删除行 ✓;:has() 深色块注释明确「不再设 background/border-color」,规则体内确实没有 ✓。
- CapabilityScene.css L376-377 已有 08-09 更新句(「谷段 40% 锚点改为 #ece7e2,R−B≈+10…机制不变」)⇒ 我之前 F4 记的「L373 未加时间状语」**降级**:同一段落 3 行后就有更新注记,读者不会误读当前状态。F4 第 3 条作废,不算漂移。
- zh scene5 三键(L126-128)与 en 对应齐备 ✓。「同一套时间轴,同一种动画声明」/「Same timeline, same animation grammar.」与裁决原文逐字一致 ✓。
- global.css 其他 background 行(L445/612/719/762/769)属各幕自身底色,非本批改动范围,不评。

## 总结论

**PASS(带 3 条 LOW 级注释漂移,无行为缺陷)**

逐条裁决:

1. **P1 时序链算术:PASS**。transition 读目标态 timing 前提成立,逐方向推导:入场 = 位移 0–1.1s(gap+basis/width delay 0)→ 标题 1.1–1.8s(delay 1.1s,fade+上浮)→ 副标题 1.35–1.95s;退场 = 副标题 0–0.6s(delay 0)→ 标题 0.25–0.95s → 位移 1.05–2.15s 收。文字净空 0.95s ≤ 位移起步 1.05s,0.1s 余量无重叠。列上无 opacity 残留(全文件 8 处 transition 逐条核对,opacity 只在 title/subtitle 子元素)。严格串行 + 镜像退场与裁决一致。
2. **P2 协议双向:PASS**。LAST_SCENE_INDEX=4 与五幕 sceneId 一致;onSceneDidChange 在 commit(render arm)发(useSceneManager L170 注释证实),即「手指松开+页面切换结算」,符合触发语义;cancel 回弹不 commit 不发 unfinished,分栏不会在误拖时闪退。两向消息幂等;freeze effect 的 setSplit(false) 与 unfinished 路径同值无冲突;两写者同为 Scene5Cinema,唯一所有者成立。
3. **P3 aria 时序:PASS(附 LOW 观察项)**。退场时 aria-hidden 立即 true、视觉淡出 0.95s——方向是「朗读树先行除名」,会中断正在进行的朗读。但触发场景是用户正在 iframe 内反向拖拽(注意力在手机上),且退场后整段文字本就该除名;相比修复前「从进幕起就被念出」的方向性错误,当前是较小的不一致。记 LOW 观察项,不阻断。
4. **P4 LIGHTS_OFF_MIN=0:PASS**。框架语义核实:progress≤phaseStart ⇒ visualMotion=0=initial frame=opacity 0,0→0.4 全程线性 scrub 到 0.94,无初始跳变,反向可逆。容器兜底 #f7dfcc 在 global.css L41 可指认。
5. **P5 冷色残留:PASS**。旧冷值(#eaeef1/#e7edf2/#eeeaee/#8098aa/#52697c/238,242,246)全仓只剩注释历史记录,活值清零;--a3-plate 三色 R−B 均 +11(暖)✓;色带三锚点 #efe9e3/#ece7e2/#f1e9e3 全部暖中性 ✓;shot3 accent #a08c80/#6e5c52 已换 ✓。
6. **P6 lang-toggle 去底:PASS**。background/backdrop-filter(含 -webkit)在 diff 中删除;:has() 深色块只剩 color/box-shadow。附 LOW:基态 transition 列表仍含 border-color,但无任何规则写 border-color(初始 transparent 恒不变)——零行为影响的噪音项。
7. **P7 零每帧开销:PASS**。全部 setState 有 ref/阈值/事件门控;无新增 MotionValue/rAF;CSS 改动全为静态一次性 transition(规则 6 豁免有注释指认)。
8. **P8 注释一致性:FAIL→ 降级 PASS-with-findings**(3 条 LOW,均不涉行为):
   - Scene5Cinema.tsx L16 & L442:「1600ms → 1600px」与 TOTAL_MS=2200 矛盾(预算注释 L21-23 已更新,这两处未同步)。
   - Scene5Cinema.css L312:残留「max-height 由 75vh 收到 68vh(D4)」旧句,与 L313 起的 90vh 裁决注释并存,未删。
   - global.css lang-toggle transition 列表含无消费者的 border-color(F6 附项)。

CONFIRMED 级发现(全部 LOW,无行为缺陷):

- Scene5Cinema.tsx:16 — 注释「1600ms → 1600px 锁定滚动 ≈150vh@1080p」与 L24 TOTAL_MS=2200 不一致;失效场景:读者按注释推算预算会得错误滚动距离(实际 2200px ≈ 204vh@1080p)。
- Scene5Cinema.tsx:442 — 同上残留「1600px 锁定滚动」。
- Scene5Cinema.css:312 — 残留纵向布局时代的「max-height 75vh→68vh(D4)」句,与现行 90vh 裁决矛盾;失效场景:后续维护者按此句以为仍有 max-height 约束。
- Scene5Cinema.tsx:435 — aria-hidden 立即除名 vs 0.95s 视觉淡出(退场窗口内屏幕阅读器中途切断);失效场景:用户在分栏态反向拖拽瞬间正在朗读副标题。LOW,触发概率低。
- global.css:181 — transition 列表含 border-color 但无规则消费;零行为影响,纯噪音。


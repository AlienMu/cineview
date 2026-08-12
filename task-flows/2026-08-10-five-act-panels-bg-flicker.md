# 2026-08-10 五幕面板/色带/闪烁整改

来源:2026-08-10 用户 grill-me 连环访谈(原任务 `2026-08-09-scene5-exit-seq-copy-warm.md` 的 N13 延伸 + 新一轮面板/色带/闪烁需求)。

> ⚠️ 本文件每一项实现后,必须按 CLAUDE.md 规则:由**独立验收 agent** 在真实浏览器(localhost:4000)跑通对应手势路径,并由**全新对抗复审 subagent** 返回显式 PASS 才可勾掉。单测绿 ≠ 视觉正确。

## 背景事实(已核,勿再争)

- 无级色带 = `.home-page .cineview-container` 上两层 background:层1 明度纱 `attachment:fixed`(视口锁定、永不移动,结构性消除接缝);层2 色相长带 `attachment:local`(随内容滚动,8 锚色铺 4800vh,任一屏穿过 1/48)。global.css:40-71。
- Act2 代码框 `.film-codecard`(CapabilityScene.css:387 / .tsx:430-468):位置固定、恒定 50% 半透磨砂(:396)、恒定阴影(:400)、head 写死中性墨(:410)。唯一 lane `film-code-selection` 只管卡内 code/desc 行随选中帧 180ms 交叉淡(filmSelectionVariant 'code',.tsx:142-204),**整卡无入场/退场**。
- Act2 胶带帧:9 帧各自 `enterAnimation={frame.preset}`(fade/slide/zoom/rotate/bounce/shake/flip/elastic/blur),作用在**整块 .film-frame**(icon+name+no 一起动)。.tsx:374-408。
- Act3 `.a3-panel` 底板写死 `--a3-plate: rgba(246,241,235,0.82)`(Act3DollyScene.css:50)。
- Scene5 标题 `white-space:nowrap` + `font-size:clamp(26px,3.75vw,46px)`(Scene5Cinema.css:298,303),按旧英文 439px 算单行;现英文 "Two modes, one system"(23 字符)≈520px+ ⇒ nowrap 下右侧裁切。中文 10 字符窄可放。

## 用户裁决记录(grill-me 已逐项拍板)

- 闪烁:滚动才闪、停住不闪;闪过的是**暖橙**(正常态是暖白)。⇒ 层2 `attachment:local` 合成器滚动与内容不同步,某帧错位露暖色锚段。
- 变色范围:**保留**「滚动时色相缓慢变化」,且**全部主体颜色都要随色带变,不止背景**。
- 变色机制:**B 台阶跟随**(每幕一个色阶,不逐帧插值——逐帧违反 CLAUDE.md 规则 2)。✓
- panel 指 **Act2 代码框**,非 Act3。
- codecard 整卡入/退场:**A 整卡层**(不是卡内行切换层)。✓
- codecard 入/退场挂轴:**B 独立短轴**(waitFor 'film-title'),不跟 film-pan 同轴。✓
- 卡内选中切换方向:**A 旧行下移淡出 / 新行从上方下落淡入**(「往下走」阅读流)。✓
- 胶带帧入场预设:**只作用图标+标题;序号(01–09)9 格全程常显**(裁决 A,不随帧出现)。✓
- Act3 panel 背景:**改成随色带台阶色**(同 codecard 那套),替代写死 `--a3-plate`。✓
- Act3 背景偏冷:**指全局色带谷段(33–40% 锚点 #efe9e3/#ece7e2)调暖**,动整页色带。✓
- Scene5 英文标题:**B 放开 nowrap,允许英文折两行、中文仍单行**,不靠缩字号塞单行。✓

## 改动清单(逐项验收后才勾)

### 无级色带(global.css)
- [~] C1 修「滚动暖色闪过」——**已实现,验收中**。长带从 `.cineview-container` 的
      `background-attachment: local` 迁到新组件 `<HomeBackdrop>`(CineView 的**兄弟节点且在其之前**):
      `.home-backdrop` fixed/inset:0/z-index:0/overflow:hidden + `#f7dfcc` 兜底;
      `.home-backdrop__band` height:200vh 长渐变 + `will-change:transform`,由 rAF 写
      `translate3d(0, -(scrollTop/maxScroll)×clientHeight, 0)`(合成器,与内容滚动同帧);
      `.home-backdrop__veil` 视口锁定明度纱,inset:0 无 transform,绘制在带之上。
      带高从 4800vh 改 **600vh** + **比例映射**(`translateY = -progress × (带高 − 视口高)`,
      带高由 CSS 唯一声明、JS 用 offsetHeight 读回)。
      **首版取 200vh 被独立验收判 D 项 FAIL**:视口恒显示色带 50% ⇒ 每滚一屏只走过
      色带 2.8%,锚色的明度落差被空间平均掉,「滚动时颜色缓慢改变」实测只剩 3.9 lum
      (旧 local 实现 12.2)。改 600vh 后视口显示 1/6、每屏约 2.4%(旧 2.08%),
      复测摆幅回到 **12.32 lum / 14.94 R−B**,与旧实现同量级(`review/20260810-c1/D-fix-600vh.json`)。
      ⚠️ **机制归因已修正**(原注释写错,已改):不是「主线程/合成器错位」
      (那只值约 1 个颜色单位:带最陡斜率 0.0014 lum/px,实测滞后上界 11.4px ⇒ Δlum 0.39),
      而是 `attachment: local` 把约 43200px(约 249MB)的带**并入滚动内容层** ⇒
      每次滚动整层失效、重新分块光栅 ⇒ 某个低分辨率/错缩放 tile 落屏 = 一整屏错色。
      fixed + transform 之所以有效,是**把带移出滚动内容层**(滚动不再触发重新光栅)。
      独立验收:A/B/C/E PASS(fixed 在 21 个 scrollTop 下 rect 恒等视口;translateY 偏差 0.00px;
      band 是独立合成层;空闲 HomeBackdrop rAF = 0,滚动时每档恰好 1 次)。
- [~] C2 色带谷段调暖 ——**已实现,验收中**。33%/40% 锚点 `#efe9e3`/`#ece7e2`(R−B +12/+10)
      → `#f4dfd0`/`#f1dbca`(R−B +36/+39),24%/52%/68% 同步顺色;保留明度下沉
      (逐锚均亮 240→234→230→224→**218**→224→229→232→226,谷仍在 40%)。
      自检截图 `review/20260810-c1/act3-mid-sy17000.png`:Act3 已明确读暖。
      ⚠️ 已知偏离:`--a3-plate`(Act3 panel 底板)仍是旧近白,与新谷段有色温差 ⇒ **C9 必须紧跟**
      (否则触发 Act3DollyScene.css 注释里警告过的 T1 色温翻转频闪)。

### Act2 代码框 codecard(CapabilityScene)
- [ ] C3 整卡入场「上移+淡入」/ 退场「下移+淡出」,独立短轴(waitFor 'film-title')。验收:卡首次出现上移淡入、整幕释放前下移淡出,正反可逆。
- [ ] C4 卡内选中切换:旧行下移淡出 / 新行从上方下落淡入,放慢(180ms 快闪 → 更从容)。验收:快速滚动切帧时不再读作「闪」。
- [ ] C5 head(`.film-codecard__bar`)背景改随色带台阶色。验收:跨幕时 head 背景色跟随该幕色带档,不再恒中性墨。
- [ ] C6 修阴影截断:「下移淡出」时 box-shadow 不被外层裁边。验收:退场全程阴影完整渐隐。
- [ ] C7 修「播完弹回半透明」:播完应定格(不透明或稳定态),不持续半透闪。验收:胶带播完 hold 段,卡面板稳定不闪。

### Act2 胶带帧(CapabilityScene)
- [ ] C8 帧内入场预设只作用图标+标题;序号 9 格全程常显。验收:任一帧播预设时,该帧序号不动;9 个序号全程可见。

### Act3 panel(Act3DollyScene)
- [ ] C9 panel 底板改随色带台阶色(同 C5 那套),替代写死 `--a3-plate`。验收:Act3 panel 底色与本幕色带档同色系,推进铺满时整屏色温不翻转。

### Scene5 英文标题(Scene5Cinema.css)
- [ ] C10 放开 `nowrap`,英文允许折两行、中文仍单行;不靠缩字号。验收:英文 "Two modes, one system" 完整显示不被裁,中文一行;副标题不被顶到。

## 新发现(2026-08-10 C1 独立验收带出,待用户裁决)

- [ ] **N14 ISSUE-B 段现在是「暖色闪过」的头号剩余嫌疑,且 C2 让它更显眼。**
      位置 sy 28500–29160(第四幕 sticky 壳滚出视口的空屏段)。实测反向单帧
      **edge Δlum +51.3 / ΔR−B +9.0**,画面是**一整屏空的暖桃底**
      (`review/20260810-c1/geom-sy28800-sy28800.png`)—— 这个观感就是用户说的
      「某个瞬间颜色被覆盖了,然后又变回去」。C2 把该段从奶白(R−B 20.3)调到
      R−B 33.1,**比之前更扎眼**。
      与 2026-08-09 N13 的 B 项 FAIL 同一处(当时判为「滚动位置量化,-120 真实档下
      仅 14.3 lum」,但另一轮纯 -120 实测在海报边缘穿越点达 +34.6)。
      机制是**幕间构图缺口**(本幕内任何层都填不了那 900px,见 DemoVideoScene.tsx:290 注释),
      不是 opacity 频闪,CSS 斜坡限制器无效。可选方向:第四幕内容层延长/海报随壳同步滚出的
      连续化、或第五幕熄灯起点前移接住这段。**需用户裁决是否修、修到什么程度。**
- [ ] N15 第四幕视频底板入场(sy≈25080)edge ΔR−B −7.6 单帧 —— 量级小,记录备查。

## 待办(实现前)

- [ ] T1 创建本文件的实现节点细分(每项实现 agent → 独立验收 agent → 对抗复审)。
- [ ] T2 确认 dev server 在 localhost:4000 实际服务最新代码(站点 consume dist 记忆:框架层改动需 `pnpm build` + 重启;本轮多为 site CSS/TSX,确认是否触发)。

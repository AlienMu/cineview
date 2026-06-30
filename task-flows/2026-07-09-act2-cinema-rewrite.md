# Task Flow — Act 2 重写(胶片带 + 舞台抽屉,2026-07-09)

**日期**: 2026-07-09
**前置**: 2026-07-07-act2-framework-as-demo.md(现版 v2,已验收 N0-N9,未验收 N10;用户对设计不满意,要求重做)
**设计访谈**: 已用 grill-me + frontend-design 完整对齐,规格见下方「设计规格摘要」

---

## 设计规格摘要(冻结,勿在实施中重新发明)

### 整体结构
- Act2 从三镜减为**两镜**(原 SHOT03 预设剧场取消,预设内容并入 SHOT01)
- 每镜独立计时,各自锁定滚动预算 ≥8000px(≈8秒+)
- 视觉延续 Act1 暖白胶片质感,全走 tokens.css/global.css 变量

### 贯穿签名:时间码胶囊(TimecodeAxis 重做)
- 位置:左上角小胶囊(不是通栏横条),`top:40px; left:80px`
- 内部从左到右:镜号(两位数,不带 `/NN`)→ 竖分隔线 → REC 红点(常驻呼吸+光晕,**不受 waitFor 编排**,挂载即播,贯穿全镜不暂停)→ "REC" 文字 → 时间读数(`00:00:N` 格式,随本镜滚动进度递增)
- 删除原进度条(`tc-axis__rule`)+ 游标(`tc-axis__head`)整段 DOM
- 新增 token:`--rec: #c4453f`, `--rec-glow: rgba(196,69,63,0.32)`

### SHOT01 — 胶片带镜(装配+预设合并)
1. 标题先入场(SplitTitle,em 陶土色)
2. 胶片带容器(1140×260,居中,上下齿孔条)从左向右生长,用 render-prop 手写 `width`(不走 enterAnimation,因 width 不在 10 属性白名单)
3. 6 个预设帧格,滚入视口播一次原生预设动画并定格(不循环):fade-in/slide-up/zoom-in/rotate-in/bounce/shake,各配电影器材线性图标(光圈/推轨/变焦/胶卷/场记板/手持,16×16,strokeWidth 1.5,同 IconArrow 语法)
4. 活跃帧高亮:scale(1.12)+双层光晕,纯 CSS transition(非 Animate 变体),打破网格均匀感
5. 胶带上方(y=330):当前活跃帧预设名+一句话描述,随帧联动切换(CSS opacity 交叉淡出淡入)
6. 胶带下方(y=700):常驻代码卡片,随活跃帧联动切换代码内容
7. 预算:title 640 + growth(delay120,enter7560,与frame链并行) + frame01(waitFor title,delay400) + frame02-06(各 delay280+enter980) = 实际链总长约 8320ms

### SHOT02 — 舞台抽屉镜(结算链重做)
1. 中央大舞台(640×480,居中),三面板依次在同一位置播放,不同时铺开
2. Panel1=waitFor链(微型结构树3节点+2连线逐个高亮)/ Panel2=stagger错峰(6方块横排真实用`<Animate stagger>`) / Panel3=Position双轴定位(3卡片各标坐标数字),各配一行代码,各预算4000ms(enter3200+exit800)
3. 每面板播完立刻用 exitAnimation(x:-540,scale:0.42,合规白名单内)飞入左侧抽屉,堆叠错位(y错位36px/层,像插文件夹),露出条显示特性标签+缩小图标
4. 左侧抽屉不预留占位框,内容随播放自然生长
5. 三面板全部收纳后,右侧依次出现:标题(waitFor panel3,400ms)→紧接着总结陈述(waitFor 标题,delay100,2500ms)
6. 预算合计 15000ms

### 框架能力边界(已用 explore agent 核实,实施时严格遵守)
- CustomAnimation 的 initial/animate/exit 只有 10 个属性生效:`opacity/x/y/scale/rotate/rotateX/rotateY/skewX/skewY/filter`(白名单在 `animateInterpolation.ts:17-27`)。**没有 width/height/boxShadow**——胶带生长必须用 render-prop 手写 style,不能用 enterAnimation variant。
- `stagger` 要求:children 必须是单个有效 JSX 元素(非函数),且必须有 `enterAnimation`(非 render-prop),否则不生效。stagger 走原生 framer variant 传播,绕过 10 属性白名单(子元素可用任意 framer 属性),但本次 Panel2 方案只用 opacity+y,不需要用到这个绕过能力。
- render-prop children 必须搭配 `enterAnimation`,否则不会注册 zone 预算,waitFor 链会断裂、enterProgress 不更新(2026-07-07 版本已踩过的坑,`cap1-growth` 这类 render-prop-only 轨道也要挂 `enterAnimation="fade-in"`)。
- Position 双轴换算是分轴独立缩放(scaleX≠scaleY 除非视口比例=设计比例),所有像素坐标基于 1440×900 画布,必须保证 `CineView config.width/height` 也是 1440×900。
- infiniteAnimation 一样受 10 属性白名单 + 会在元素离屏/被覆盖时自动暂停 → REC 常驻动效**不能用 infiniteAnimation**,必须用纯 CSS keyframes(不包 Animate),才能保证"贯穿全镜不间断"。

---

## 实施节点

- [x] N0 创建本 task-flow 文件
- [x] N1 i18n 补键:`zh.ts`/`en.ts` 补齐 SHOT01/SHOT02 新文案键(标题/6预设描述/6代码行/3面板代码/总结陈述),中英同构校验通过
- [x] N2 重做 `TimecodeAxis.tsx`:胶囊形态+REC+去掉进度条,`TimecodeAxis.css` 或并入 `CapabilityScene.css`(样式并入 CapabilityScene.css;新增 `seconds` prop 使两镜读数满格秒数各自对齐预算 8s/15s)
- [x] N3 重写 `CapabilityAssemblyScene`(SHOT01 胶片带):标题+生长胶带+6预设帧+活跃帧高亮+联动说明+代码区(导出更名 `CapabilityFilmStripScene`;活跃帧用 6 条镜像 render-prop 探针轨道同步回 React 状态)
- [x] N4 新建 6 个电影器材图标组件(光圈/推轨/变焦/胶卷/场记板/手持,16×16 线性 SVG)(`CapabilityIcons.tsx`)
- [x] N5 重写 SHOT02(舞台抽屉镜):中央舞台+3面板(结构树/stagger方块/坐标卡片)+抽屉收纳+标题总结(导出 `CapabilityStageDrawerScene`;面板 exit 显式 `opacity:1` 以留在抽屉可见——exit 相位缺省 opacity=0)
- [x] N6 删除 `CapabilityPresetTheaterScene`(SHOT03 已取消),清理其 i18n 死键
- [x] N7 `CapabilityScene.css` 全量重写:胶囊/胶片带/齿孔/活跃帧/抽屉堆叠/舞台,复用 tokens.css 变量
- [x] N8 `HomePage.tsx` 路由更新:三个 Scene 改两个,移除 preset-theater scene,`TimecodeAxis` props 调整(shotTotal 相关如已删除则同步)
- [x] N9 `pnpm type-check` 0 错误 + `pnpm lint` 0 错误 0 警告(root + site type-check 均通过)
- [x] N10 `pnpm build` / `vite build` 通过
- [ ] N11 dev server 手动 smoke check(console 0 error,两镜滚动可跑通,REC 常驻不暂停)
- [ ] N12 **独立 agent 真实浏览器验收**(localhost:3000 或 4000,`#/` 首页滚动,规则4强制)

## 验收标准(供 N12 独立 agent 使用)

- [ ] 两镜各自 center-lock 接管,预算 ≥8000px(~8秒+),无拖沓感
- [ ] 元素无越界(1440×900 画布内,overflow:hidden 兜底)
- [ ] 时间码胶囊:左上角,镜号无斜杠总数,REC 红点全程呼吸闪烁+光晕、不因场景内容编排暂停,时间读数随滚动递增
- [ ] SHOT01:胶片带从左向右随滚动生长,6 帧预设动画各滚入播一次并定格(不循环、不重播),活跃帧有明显高亮(scale+光晕)区别于其余帧,联动说明与代码区随活跃帧切换
- [ ] SHOT01 图标:6 个电影器材图标与预设语义对应正确,视觉风格与 IconArrow/IconBook 一致(16px线性)
- [ ] SHOT02:三面板依次在中央舞台播放(结构树/方块stagger/坐标卡片各异),播完各自飞入左侧堆叠抽屉(错位露边),抽屉不预留空占位
- [ ] SHOT02:标题+总结陈述在三面板全部收纳后才在右侧出现,顺序为标题先、总结紧接
- [ ] 左右视觉重量:两镜均无"一侧塞满一侧空白"的失衡构图
- [ ] 反向滚动两镜重新揭示,无永久消失
- [ ] 中英文切换文案正确、无缺键报错
- [ ] console 0 error / 0 warning(除 React Router future flag)
- [ ] reduced-motion 下:Animate duration/delay 归零瞬间到位,REC 呼吸动效改为静止常亮(不完全消失),活跃帧 CSS transition 归零

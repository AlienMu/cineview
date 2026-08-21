# Act3 视频全关键帧重编码 + V1 拼接提前量（2026-08-20）

## 用户报告（原文）

> /drag页面下的act3，视频未完整播放，后面半截都是停顿的，然后最终就直接到末尾了，
> 并且我希望v1那一列的帧，能在动画播放到那个环境之前，先拼接好，也就是先执行完毕动画，
> 并且你还需要算上已有的动画时间等，所以你需要仔细计算一下。

两个独立问题：

1. **视频后半截停顿、结尾跳末帧**。根因（ffprobe 实证）：`site/public/act3-edit.mp4`
   全片 241 帧**只有 1 个关键帧（0.000s）**。VideoFrameRenderer 每帧 timeline 变化直接
   `currentTime = t`（`videoPlaybackOwnership.ts` 的 seek command，无 coalesce），H.264 无
   前向 keyframe 时每次 seek 都从 0 解码到 t——前半段解码量小跟得上，后半段每次 seek 要
   解一两百帧，解码线程打满 → 画面冻结；scene clock 走满时最后一次 seek 直落 10.08s →
   「跳到末尾」。DESIGN.md §3.5 钦定修法：`-g 1 -keyint_min 1` 全关键帧重编码。
   框架代码零改动（编码问题，非组件可解——VideoFrameRenderer 头注释原话）。

2. **V1 拼接必须先于播放抵达**。现状：clip k 的 stroke 终点 = 播放进入第 k 段的**那一刻**
   （零提前量的 JIT），且 V2 字幕反而领先整整一段——act 内部逻辑本就主张「提前一段备好」，
   V1 违反了它。用户要求：播放到该段之前，拼接动画**已执行完毕**，且重排时必须算上
   既有动画时间（clip 入场 600→2300、preview 显影 0→2400、scrub 3200 起）。

## 时序计算（LEAD = 800ms 的推导）

场景钟 = `ACT3_MEDIA_CLOCK_MS` = 3200 + 10000 = **13200ms**。播放映射：
elapsed T ∈ [3200, 13200] → mediaTime = (T−3200)/1000 s；第 j 段（clip j+1 的内容）
播于 T ∈ [3200+2000j, 3200+2000(j+1)]。

不变量（全部保留）：
- stroke 长 = 恰一段 SEGMENT（2000ms）→ 相邻 stroke 首尾相接（契约测试已锁）；
- seam 徽章 = 对应 stroke 的终点（因首尾相接，= 下一 clip 的 assembly 起点，推导形式不变）；
- 两段式（用户钦定返工）：全部 clip 入场完毕（末块止于 2300）之后才允许 stroke；
- 预算表所有 exit ≤ 720ms transitionDuration。

约束求解：stroke_k 终点 = D_k − LEAD（D_k = 播放进入第 k 段 = 3200+2000k），
stroke_k = [1200+2000k−LEAD, 3200+2000k−LEAD]。首个 stroke（k=1）起点 3200−LEAD ≥ 2300
⇒ **LEAD ≤ 900**。取 **LEAD = 800**：
- 首 stroke 起点 2400 = preview 显影完成时刻（画面就绪 → 剪辑开始），且距末块入场
  （2300）留 100ms 呼吸；
- 每个 stroke 在播放抵达该段前 **800ms**（一段的 40%）落定——「先拼接好」无可争议；
- 800 < 900，满足入场不重叠约束。

重排后的 V1 装配时序（scene ms）：

| lane | 起点 | 终点 | 播放抵达该段 | 提前量 |
| --- | --- | --- | --- | --- |
| clip2 stroke/selection | 2400 | 4400 | 5200 | 800 |
| clip3 stroke/selection | 4400 | 6400 | 7200 | 800 |
| clip4 stroke/selection | 6400 | 8400 | 9200 | 800 |
| clip5 stroke/selection | 8400 | 10400 | 11200 | 800 |
| seam1..4 | 4400/6400/8400/10400 | +240 | — | — |

10400 起全轨装配完毕，末段（11200→13200）在完整剪辑台上播完。V2 字幕、playhead、
scrub、clock、exit 预算全部不动（V2 本就锚在 clipSelectionStartMs，语义是播放侧）。

实现：`act3MediaTimeline.ts` 新增 `ACT3_CLIP_ASSEMBLY_LEAD_MS` + `clipAssemblyStartMs(i)`
（= `clipSelectionStartMs(i) − LEAD`，**派生**而非并行算术——遵守该文件「节拍函数唯一」
戒律）；`SceneSync.tsx` 的 `clipSequenceTimeline` 与 `ClipSeam` 换用之；文件头预算表
连同过期数字（3 clip 时代残留：x2、scrub+6000、tSelf 9200、V2 track 1580）一并刷新。

## 节点

- [x] N0 复现红证：`site/scripts/a3-intra-lead.mjs`。红证（旧视频+旧时序）：已呈现帧
      滞后峰值 **8.119s**、结尾单步跳 **8.33s**、scrub 全程 readyState≥2 占 0%、
      拼接提前量仅 67/34/18/17ms。⚠️ `currentTime` 恒跟手（seek 目标值），是假阴性
      信号；真信号 = rVFC 已呈现帧 mediaTime + seeking→seeked 延迟。
- [x] N1 `act3-edit.mp4` 全关键帧重编码：libx264 -preset slow -crf 23 -g 1
      -keyint_min 1 -sc_threshold 0 -pix_fmt yuv420p -c:a copy -movflags +faststart。
      ffprobe 验证 **241/241 关键帧**、时长 10.08s 不变；CRF 20 时 14.2MB（1.55×）超
      预算，CRF 23 定稿 **10.55MB**（1.15×）。原文件备份 /tmp/act3-edit.inter.mp4。
- [x] N2 V1 装配提前 800ms：`ACT3_CLIP_ASSEMBLY_LEAD_MS` + `clipAssemblyStartMs`（派生
      自 clipSelectionStartMs）；SceneSync 的 clipSequenceTimeline / ClipSeam 换用；
      文件头预算表刷新（顺带修正 3-clip 时代过期数字：x2→x4、scrub+6000→+10000、
      tSelf 9200→13200、V2 track 1580→900、preview +500→+2400）。
- [x] N3 契约测试补 lead 断言（stroke 终点 = 段抵达 − LEAD、seam = stroke 终点相等）；
      site 契约套件 16/16、全 site 套件 54/54、root+site type-check 0 错误。
- [x] N4 探针复跑绿证：seek p50 **0.3ms**（旧 8.9ms，n 90→600）、呈现帧滞后峰值
      **0.050s**、零停滞零尾跳、拼接提前量 **868/837/819/818ms**、clip1 不动、
      末态五块并拢 9.9×4px、0 page error。readyState 断言删除（连续 retarget seek 下
      恒为 1，假阴性发生器——修复后仍 0% 而滞后仅 0.05s）。
- [x] N5 独立 agent 真机验收（规则 4，drag 完整手势路径）+ 对抗性子代理评审（node gate）
      - 对抗评审：**PASS**。四条变异（JIT 打回 / LEAD=950 撞上界 / seam 漏平移 /
        V2 误换锚点）全红→恢复→全绿；算术独立复核与预算表逐项一致。整改落定：
        ① 7 处 3-clip 时代过期表述修正（含测试名）；② 补「首 stroke 起点 = preview
        显影终点」结构不变量（M5 实证 LEAD=100 旧断言全绿的洞——联立后结构性钉死
        LEAD=800，无魔法数）；③ 复跑 site 54/54 + 双侧 type-check 绿。实现者独立复核
        git 基线（diff --stat 一致、grep MUTATION=0、契约 12/12）。
      - 真机验收：**PASS**。独立判据 19/19（自写 `_accept-act3-independent.mjs`，
        判据自定不复抄实现者）：呈现帧滞后峰值 0.159s、无停滞段、无 >0.5s 尾跳、
        **0.25s 时间箱覆盖率 38/38**（「后半截停顿」的直接反证）、末呈现帧 10.00s
        播完；拼接提前 1067/934/883/868ms；clip1 波动 0.0px；末态并拢 9.6px×4；
        五幕签名节点齐全、反向拖拽 re-entry 正常（呈现帧恢复、像素非黑、timecode
        与 transport 吻合）；console/pageerror/slow-seek 告警全 0。CRF 23 视觉复验
        （监视器中段截图 + V1 缩略图 + poster）：无块效应/色带/拖影，定性「无可感知
        劣化」。产物：`_accept-act3-independent.mjs` + `_accept-shots/`（5 张）保留。
      - 验收 agent 抓到实现者探针缺陷并已修：rVFC 经 MutationObserver 无 guard 重挂，
        单轮 78210 个回调（≈52 路并发循环）——改为元素身份 guard 后 1205 个，
        判定不变，复跑全绿。
      - ⚠️ 评审流程警告：未提交状态下任何人跑 `git checkout --` 会把本轮工作连同分支
        既有 WIP 一并回退（评审 agent M1 恢复时实际触发过，已逐字节重建并三重验证）。
        收口后建议尽快 commit——等用户指示。
      - 验收 agent 知会（不阻断，非本次引入）：播放完成后首次外向 grab 预览会把已并拢
        的 clip 回退最多 53.9px 再回拢——框架反向 scrub 语义（memory:
        drag-reverse-scrub-validated，设计行为），真机「拖一半松手」可见，已向用户披露。
- [x] N6 CLAUDE.md 自检四条 + 收口
      1. **整改真的完成**：两症状均根因→修复→红绿证据闭环（停顿：呈现帧滞后
         8.119s→0.05s；JIT→800ms 提前）；无 TODO/半程状态；readyState 断言删除有
         实证理由并留档注释。
      2. **无冗余**：新增仅 1 派生函数 + 1 常量 + 探针 + 测试断言，全部有消费方
         （grep 复核）；未用 import 已清；过期注释净删 7 处——注释层净减熵。
      3. **可控性**：SceneSync 仅注释与锚点函数替换，无行数/props/上下文膨胀。
      4. **运行时性能**：零热路径代码改动（纯常量/锚点，渲染期一次性解析）；每帧
         seek 成本骤降（p50 8.9ms→0.3ms，n 90→600）；冷启动 +1.4MB（9.15→10.55MB）
         已知会；探针侧 rVFC 泄漏已修。motionValue/单一所有者纪律未触碰。

## 第二轮（同日追加）：V2 字幕 4/5 段不显示

用户报告：「字母未修复。v2前三个会出现字母后面两个不会」。

- 根因：**CSS 只改一半**。2026-08-18 的 5-clip 改造把 i18n key（sub4=节奏/PACE、
  sub5=时序/TIMING）和 DOM 节点扩到 5，但 `temporal-scenes-03-05.css` 的两处
  active-media 揭示选择器（画面词 opacity 0→1；轨道块 0.34→1 提亮）都只写到
  index 2 —— 第 4/5 段双通道全灭。
- [x] N7 修复：① 两处选择器列表补 index 3/4（值不动，仅扩覆盖——不碰视觉原值）；
  ② i18n zh/en 两段双料过期注释（「sub1..3」「刻意模糊」——模糊 8-19 已撤）重写；
  ③ 契约测试新增覆盖率断言：两条选择器列表逐一钉住 V2_IDS 的每个 index；
  ④ 探针加「断言 3」：第 k 段窗口内画面词与轨道块计算 opacity 均须 >0.9。
- [x] 红绿证据：探针先跑红（第 4/5 段双 ✗），修复后 16/16 全绿（其余断言无回退）；
  site 套件 54/54、type-check 干净。
- [~] N8 fresh agent 节点验收（node gate + 规则 4）：**未完成**——agent 因上游 API
      限额（429，5 小时上限）中途死亡，未产出判定。其未竟职责并入 N11 统一验收。
      实现者自跑探针 16/16 + site 54/54 作为过渡证据（不构成规则 4 收口）。

## 第三轮（同日追加）：act5 收尾栏间距 + V1 帧同图

用户报告：「act5文案间距还是需要调整，把标题下面的几排文字和按钮全部加长一下
间距，底部不动。并且act3的v1帧为什么都长一样？」

- act5 定位：首页 `/` 第五幕 Scene5Cinema 的**右栏收尾层**（分栏态：标题 → 副标题
  → CTA(lead/buttons/body) → footer 钉列底）——不是 /drag 的 SceneCut（无按钮）。
- V1 同图根因：`V1_CLIPS` 五块的 `poster` 全部指向同一张 `ACT3_POSTER_SRC`
  （act3-edit-poster.jpg，帧 0 附近）。5-clip 改造只加了块，没给每段配帧。

- [x] N9 V1 每段独立缩略帧：ffmpeg 于每段中点（1/3/5/7/9s）抽帧 →
      `act3-clip-poster-1..5.jpg`（scale 360，各 ~30-39KB，md5 五路唯一）；
      `act3MediaTimeline` 导出 `ACT3_CLIP_POSTERS`（按 ACT3_CLIP_COUNT 派生）；
      V1_CLIPS 换用（map 注入，段数耦合）。探针「断言 4」：五帧 src 两两不同 +
      8×8 灰度指纹最小曼哈顿距离 **514** > 40（差异极大）；契约测试钉
      pairwise-distinct（55/55 绿）。注：红证为构造性（旧代码五 src 相同，
      Set.size=1 必红）+ 404 中间态真实出现过（ffmpeg 被分类器故障挡住时
      SceneSync 已指向不存在的文件），未回滚实测。
- [x] N10 act5 收尾栏间距：列 gap 归零、间距改由段 wrapper 显式 margin 表达
      （标题↔副标题 14u、副标题↔CTA 48u、CTA 内部 20u；footer margin-top:auto
      钉底不动）。`a5-spacing.mjs` 几何探针（外页滚底 + iframe 内 postMessage
      cineview-embed-finished 进分栏态，1440×900）：实测 **13.5 / 46.8 / 19.8 /
      19.8px**（设计 14/48/20/20 ±1.5），footer 贴底 4px（≤8），0 页面错误。
      注：红证未执行（CSS 先于探针落盘）；断言阈值按旧值必然打红（8/30/14）。
- [x] N11 fresh agent 统一验收（规则 4 + node gate，覆盖 N7/N9/N10）+ 实现者自检
      - **验收执行的非典型路径（如实记录）**：fresh agent 三次被打断——429（限额）、
        503（网关无可用 key）、宿主会话重启。它死前已完成：源码审查、两支判据完全
        自定（且严于实现者：画面词「持续可见占比」而非单帧峰值、localStorage 强切
        zh 验文案、B3 段中点对拍）的探针 `_accept-r3-drag.mjs` / `_accept-r3-home.mjs`、
        三张截图、ffmpeg 级 poster 对拍（其脚本注释记录距离 1-4）。实现者代跑其探针
        完成收尾——判据全部出自该 agent，实现者只执行与记录。
      - 判定：**PASS**。/drag（A+B）：五段双通道「峰值 1.00 / 持续 100%」、zh 文案
        逐词吻合、complete 后画面词归零（174 帧最大 0.000）、五帧 src 唯一且 360px
        全加载、clip1 波动 0.0px、末态并拢 9.9×4、幕末呈现帧 10.00s、0 错误 0 告警。
        B3 浏览器侧对拍两次被 Vite HMR 重放导航杀死（环境问题非产品），改在 ffmpeg
        层完成同一断言：**最近邻完美恒等**（对角距离 0-2 ≈ 像素同帧，非对角 300+，
        最近/次近比 ≤0.004）——poster 就是段中点帧。
        首页（C+窄屏）：13.5/46.8/19.8/19.8px 全入窗、footer 钉底 4px 且位于 CTA
        body 之下；窄屏纵向 footer 在位、标题/列不溢出；0 错误 0 告警。
      - 变异抽查（agent 未竟，实现者补做，反向 Edit 恢复、未用 git checkout）：
        M1 删 CSS 揭示选择器 index 3/4 → 契约套件红（1 failed）→ 恢复绿；
        M2 五帧打回共用 act3-edit-poster.jpg → 红（poster 测试）→ 恢复绿。
        终态 55/55、git diff --stat 与变异前基线**逐字节一致**。

## 验收判据（探针必须断言意图，非代理信号）

1. `video.currentTime` 相对 `data-mediaTime`（transport 投影）的滞后：全程无
   「mediaTime 前进 >300ms 而 currentTime 前进 <30ms」的停滞段；结尾无 >1s 单步跳变。
2. clip k（1..4）stroke 落定时刻 < mediaTime 跨 2k 秒的时刻 − 600ms（lead 800 − 采样余量）。
3. clip1 全程不动；末态五块并拢重叠（既有断言不回退）。

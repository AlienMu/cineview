// 集中式短文案字典(官网 + demo + 导航)。文档长文走 content/docs/zh/*.md,不在此。
// zh 不标注类型:作为 DictKey 的唯一真相源,key 须保持字面量推断(见 types.ts)。
export const zh = {
  // ── 顶栏 / 导航 ──
  'nav.home': '首页',
  'nav.demo': '演示',
  'nav.docs': '文档',
  'nav.github': 'GitHub',
  'nav.lang': 'EN',
  'nav.langLabel': '切换语言',

  // ── 第1幕 Hero ──
  // 三排:title(中)/ slogan(最大,流光)/ intro(小)
  'hero.title': 'CineView',
  'hero.slogan': '像导演一样\n控制每一帧',
  'hero.intro': '滚动是胶片,拖拽是分镜。\n把每一次位移,都交给时间线。',
  'hero.ctaStart': '开始使用',
  'hero.ctaApi': 'API 文档',
  'hero.ctaGithub': 'GitHub',
  'hero.scrollHint': '向下滚动,胶片开始走动',

  // ── 第2幕 理念 ──
  'idea.eyebrow': '为什么是 CineView',
  'idea.title': '滚动不该只是位移,\n而是被排好的时间线',
  'idea.body':
    '传统页面里,滚动只是把内容往上推。在 CineView 里,滚动是胶片推进——每一段位移都映射到场景的进退场时间轴,元素按 delay 与 after 依次入场,像分镜表一样被精确排进时间线。',

  // ── 第2幕 能力展示（框架即演示 · 两镜 + 贯穿时间码胶囊）──
  // 标题用 '|' 分隔：竖线后半段渲染为 Fraunces 斜体陶土强调（语言无关）。
  // slate/code 为 API 字面量，中英一致（等宽）。
  'cap.tc.rec': 'REC',

  'cap.shot1.slate': 'SCENE TIMELINE',
  'cap.shot1.title': '像挑镜头一样|挑一种入场',
  'cap.shot1.intro':
    '四十余种进场预设内置其中——从淡入到震颤，改一个 prop 便从容切换，不必手写一行动画曲线。',
  'cap.shot1.preset.fadeIn.title': '淡入登场',
  'cap.shot1.preset.fadeIn.name': 'fade-in',
  'cap.shot1.preset.fadeIn.desc': '透明度从 0 淡入至 1，最基础的进场语义。',
  'cap.shot1.preset.fadeIn.code': '<Animate enterAnimation="fade-in" />',
  'cap.shot1.preset.slideUp.title': '上滑入场',
  'cap.shot1.preset.slideUp.name': 'slide-up',
  'cap.shot1.preset.slideUp.desc': '从下方滑入，带一点位移的分量感。',
  'cap.shot1.preset.slideUp.code': '<Animate enterAnimation="slide-up" />',
  'cap.shot1.preset.zoomIn.title': '缩放推近',
  'cap.shot1.preset.zoomIn.name': 'zoom-in',
  'cap.shot1.preset.zoomIn.desc': '由小及大缩放入场，像镜头缓缓推近。',
  'cap.shot1.preset.zoomIn.code': '<Animate enterAnimation="zoom-in" />',
  'cap.shot1.preset.rotateIn.title': '旋转登场',
  'cap.shot1.preset.rotateIn.name': 'rotate-in',
  'cap.shot1.preset.rotateIn.desc': '带旋转角度的入场，增添一分戏剧性。',
  'cap.shot1.preset.rotateIn.code': '<Animate enterAnimation="rotate-in" />',
  'cap.shot1.preset.bounce.title': '弹性回弹',
  'cap.shot1.preset.bounce.name': 'bounce',
  'cap.shot1.preset.bounce.desc': '弹性回弹收尾，留一点顽皮的余韵。',
  'cap.shot1.preset.bounce.code': '<Animate enterAnimation="bounce" />',
  'cap.shot1.preset.shake.title': '震颤强调',
  'cap.shot1.preset.shake.name': 'shake',
  'cap.shot1.preset.shake.desc': '左右震颤强调，常用于提示与警示。',
  'cap.shot1.preset.shake.code': '<Animate enterAnimation="shake" />',
  'cap.shot1.preset.flip.title': '翻转登场',
  'cap.shot1.preset.flip.name': 'flip',
  'cap.shot1.preset.flip.desc': '沿 Y 轴翻转登场，像卡片翻面。',
  'cap.shot1.preset.flip.code': '<Animate enterAnimation="flip" />',
  'cap.shot1.preset.elastic.title': '弹性缩放',
  'cap.shot1.preset.elastic.name': 'elastic',
  'cap.shot1.preset.elastic.desc': '带弹性的缩放入场，落定时轻轻回弹。',
  'cap.shot1.preset.elastic.code': '<Animate enterAnimation="elastic" />',
  'cap.shot1.preset.blur.title': '虚焦聚拢',
  'cap.shot1.preset.blur.name': 'blur-in',
  'cap.shot1.preset.blur.desc': '由虚焦到清晰，像镜头缓缓对上焦。',
  'cap.shot1.preset.blur.code': '<Animate enterAnimation="blur-in" />',

  // ── 第3幕 推镜(dolly in)──
  'cap.shot3.slate': 'DOLLY IN · DECLARATIVE TIMELINE',
  'cap.shot3.card.chain.label': '链式时间线',
  'cap.shot3.card.stagger.label': '错峰级联',
  'cap.shot3.card.position.label': '基准定位',
  'cap.shot3.card.container.label': '尺寸换算',
  'cap.shot3.card.scrub.label': '滚动接管',
  'cap.shot3.card.image.label': '资源预加载',
  /* 2026-08-16 用户指令：zh 与 en 一样换行，但走首页 hero 的错位换行
   * （\n 断行 + 行内 ±44u 静态横移，见 Act3DollyScene 的分行渲染）。 */
  'cap.shot3.title': '时间随滚动流转，\n画面随叙事前行',

  // ── 第3幕 双引擎 ──
  'engines.eyebrow': '双引擎',
  'engines.title': '一套场景,两种驱动',
  'engines.dragName': 'drag · 移动端',
  'engines.dragDesc':
    '手指拖拽分页,释放后按惯性结算。页面滑动与元素时间轴解耦——release 后元素以创作速率继续完成,而非生硬回弹。',
  'engines.scrollName': 'scroll · 桌面端',
  'engines.scrollDesc':
    '接管真实文档滚动,center-lock 把关键场景锁定在视口中心,滚动距离即动画进度(1ms=1px),正反向天然可逆。',

  // ── 第4幕 手机高光场景 ──
  'phone.eyebrow': '此刻 · 亲手体验',
  'phone.title': '一台手机,\n装着 drag 模式',
  'phone.body':
    '滚动到这里,镜头推近,一台手机从模糊中浮现并对焦。它清晰之后,屏幕里就是真实运行的 drag 模式——用鼠标按住上下拖动,体验移动端的分镜叙事。',
  'phone.unlockHint': '↑ 按住屏幕上下拖动',
  'phone.locked': '对焦中…',

  // 手机内 drag demo 4 屏
  'demoDrag.s1.eyebrow': '第一镜',
  'demoDrag.s1.title': 'CineView',
  'demoDrag.s1.sub': '影院级叙事,触手可及',
  'demoDrag.s2.eyebrow': '第二镜 · 时间线',
  'demoDrag.s2.title': '元素依次入场',
  'demoDrag.s2.line1': '标题先到',
  'demoDrag.s2.line2': '副标题等它(after)',
  'demoDrag.s2.line3': '正文延迟 300ms 跟上',
  'demoDrag.s3.eyebrow': '第三镜 · 定位',
  'demoDrag.s3.title': '设计稿坐标定位',
  'demoDrag.s3.badge': '固定层',
  'demoDrag.s3.sub': '元素按设计稿坐标精确落位',
  'demoDrag.s4.eyebrow': '第四镜 · 预设',
  'demoDrag.s4.title': '40+ 动画预设',
  'demoDrag.s4.sub': 'fade / zoom / flip / blur 任意组合',

  // ── 首页第五幕 Cinema Entrance（熄屏入场）──
  /* 标题+副标题（2026-08-09 重写，用户访谈裁决「方向 A：点破双模式同框」）。
     这一幕的客观事实：页面本身是 scroll 模式、手机里是 drag 模式，观众正同时
     看着两种模式跑同一个框架 —— 文案直接点破它。第一行副标题用「它」回指标题
     的「一套体系」，第二行落到可核对的框架事实（时间轴语义 / 动画声明同源）。
     刻意不写成宣传语：全站语气是「示范给你看」，不是「告诉你它很好」。 */
  'scene5.title': '两种模式，一套体系',
  'scene5.subtitle': '指尖拖拽的是它，这一页滚动的也是它。\n同一套时间轴，同一种动画声明。',
  'scene5.frameTitle': 'CineView 拖拽体验',

  // ── 第5幕 能力矩阵 ──
  'caps.eyebrow': '能力',
  'caps.title': '为叙事而生的工具箱',
  'caps.1.title': '40+ 动画预设',
  'caps.1.desc':
    'fade、slide、zoom、flip、bounce、blur、elastic 等多类预设,支持 sequential / parallel 组合。',
  'caps.2.title': '单基准响应式换算',
  'caps.2.desc': '按设计稿坐标书写,横纵长度共用同一个认宽的换算基准,无需手写媒体查询且绝不形变。',
  'caps.3.title': 'after 时间线',
  'caps.3.desc': '元素之间用 after 串成依赖链,delay 精确控制节奏,循环依赖会被静态检测。',
  'caps.4.title': '图片预加载',
  'caps.4.desc': '首屏优先资源就绪后再启动入场动画,超时可恢复,杜绝白屏闪烁。',
  'caps.5.title': 'center-lock 接管',
  'caps.5.desc': 'scroll 模式把关键场景锁定视口中心,滚动距离即进度,大幅滑动也不跳帧。',
  'caps.6.title': 'scene-scoped 固定层',
  'caps.6.desc': '固定层限定在场景内,跨场景不漂浮,Position 直接挂载,层级清晰可控。',

  // ── 第6幕 CTA / Footer ──
  'cta.title': '现在,开始你的第一镜',
  'cta.body': '安装、写下第一个场景,几分钟就能跑起一段电影感叙事。',
  'cta.start': '快速开始',
  'cta.github': 'Star on GitHub',
  'footer.tagline': '影院级叙事 · React UI 框架',
  'footer.docs': '文档',
  'footer.license': 'MIT 协议',

  // ── Demo Hub ──
  'demoHub.title': '亲手体验双引擎',
  'demoHub.subtitle': '切换 drag 与 scroll,感受两种驱动下的同一套场景语言。',
  'demoHub.tabDrag': 'drag · 移动端',
  'demoHub.tabScroll': 'scroll · 桌面端',
  'demoHub.dragHint': '在手机壳内按住上下拖动',
  'demoHub.scrollHint': '向下滚动,关键场景会锁定在中心',
  'demoHub.backHome': '返回首页',

  // ── Demo · AnimateVideo(或许，也能驱动视频？）──
  'demoVideo.slate': 'SCROLL-DRIVEN VIDEO',
  'demoVideo.title': '或许|也能驱动视频？',
  'demoVideo.intro':
    '从逐帧跳动，\n到光影长卷——\n所有动态，共用一种节奏；\n解锁画面，让故事自由上演。',
  'demoVideo.code':
    '<Scene scroll={{ zoneId: "hero-video", trigger: "center-lock" }}>\n  <AnimateVideo\n    src="/video.mp4"\n    duration={{ enter: 2000 }}\n    timeline={{ after: "intro" }}\n  />\n</Scene>',
  'demoVideo.desc': '滚动即时间轴：进度 0→1 映射到视频首帧→末帧，反向滚动天然倒放。',

  // ── 文档外壳 ──
  'docs.title': '文档',
  'docs.search': '搜索',
  'docs.onThisPage': '本页目录',
  'docs.prev': '上一篇',
  'docs.next': '下一篇',
  'docs.editTip': '内容随框架版本更新',
  'docs.notFound': '未找到该文档',

  // 文档导航分组（条目标题走各语言 md frontmatter，不再经 i18n）
  'docs.group.getting-started': '上手',
  'docs.group.concepts': '核心概念',
  'docs.group.drag': 'drag 引擎',
  'docs.group.scroll': 'scroll 引擎',
  'docs.group.components': '组件',
  'docs.group.advanced': '进阶',

  // ── 通用 ──
  'common.timecode': '时间码',

  // ── /drag 时间叙事体验（仅译叙事文案；电影术语保留英文）──
  'dragTemporal.s01.eyebrow': 'CINEMATIC UI FRAMEWORK',
  'dragTemporal.s01.footerHint': '释放后，时间继续完成',
  'dragTemporal.s01.dialLabel': '时间校准盘',
  'dragTemporal.s01.dragHintLabel': '上下拖动',
  'dragTemporal.s01.actionsLabel': '主导航',
  'dragTemporal.s01.btnDocs': '阅读文档',
  'dragTemporal.s01.btnHome': '在 GitHub 查看',
  'dragTemporal.s02.footerHint': '打板——镜头开始运转',
  'dragTemporal.s02.slateLabel': '02 / SLATE',
  'dragTemporal.s02.actionWord': 'ACTION',
  'dragTemporal.s02.clapperLabel': '粒子汇聚成场记板',
  'dragTemporal.s03.name': '调度',
  'dragTemporal.s03.footerHint': '拖拽穿梭',
  'dragTemporal.s03.stripLabel': '贴在剪辑台上的五段代码',
  'dragTemporal.s03.card1': '进场',
  'dragTemporal.s03.card2': '错峰',
  'dragTemporal.s03.card3': '停留',
  'dragTemporal.s03.card4': '退场',
  'dragTemporal.s03.card5': '倒带',
  // 剪辑台（act 03 重写）新增。previewLabel / timelineLabel 是 aria-label——只给读屏，
  // 屏幕上不显示。sub1..5 是 V2 字幕轨的五个词（2026-08-18 起 10s 源五段；设计档 §3.3
  // 的刻意模糊已于 2026-08-19 撤销，现为可读文案）：既印在轨道块上，也随 active-media
  // 逐段点亮在预览画面上。CSS 侧的揭示选择器必须与这里的数量同步——契约测试已钉。
  'dragTemporal.s03.previewLabel': '节目预览监视器',
  'dragTemporal.s03.timelineLabel': '剪辑时间线',
  'dragTemporal.s03.sub1': '剪辑',
  'dragTemporal.s03.sub2': '调度',
  'dragTemporal.s03.sub3': '控制',
  'dragTemporal.s03.sub4': '节奏',
  'dragTemporal.s03.sub5': '时序',
  'dragTemporal.s04.equationLabel': 'DRAG DISTANCE = TIME',
  'dragTemporal.s04.footerHint': '拖拽距离化作时间',
  'dragTemporal.s04.rulerLabel': '拖拽进度标尺',
  'dragTemporal.s05.actionsLabel': '尾场导航',
  'dragTemporal.s05.btnHome': '返回首页',
  'dragTemporal.s05.btnDocs': '阅读文档',
  'dragTemporal.s05.reelLabel': '胶片尾段',
  'dragTemporal.s05.creditsLabel': 'CineView 谢幕演职员表',
  'dragTemporal.s05.title': '灯光落下，戏散场。',
  'dragTemporal.s05.director': '导演',
  'dragTemporal.s05.editor': '剪辑',
  'dragTemporal.s05.cinematography': '摄影',
  'dragTemporal.s05.performance': '动态演出',
  'dragTemporal.s05.starring': '领衔主演',
  'dragTemporal.s05.sceneEngine': '场景调度引擎',
  'dragTemporal.s05.timeline': '统一时间线',
  'dragTemporal.s05.scrollDrag': '滚动与拖拽',
  'dragTemporal.s05.motionRuntime': '可逆动效运行时',
  'dragTemporal.s05.yourStory': '你的叙事',
  'dragTemporal.s05.salute1': '封神',
  'dragTemporal.s05.salute2': '帧听你的',
  'dragTemporal.s05.salute3': '一镜到底',
  'dragTemporal.s05.footerHint': '灯落，故事仍在时间线上',
  'dragTemporal.hud.metaLabel': '拍摄元数据',
};

// Centralized short-copy dictionary (website + demo + navigation). Long-form documentation goes to content/docs/zh/*.md, not here.
// zh does not annotate types: as the sole source of truth for DictKey, keys must maintain literal inference (see types.ts).
export const zh = {
  // ── Top bar / Navigation ──
  'nav.home': '首页',
  'nav.demo': '演示',
  'nav.docs': '文档',
  'nav.github': 'GitHub',
  'nav.lang': 'EN',
  'nav.langLabel': '切换语言',

  // ── Act 1 Hero ──
  // Three rows: title (center) / slogan (largest, shimmer) / intro (small)
  'hero.title': 'Cineview',
  'hero.slogan': '像导演一样\n控制每一帧',
  'hero.intro': '滚动是胶片,拖拽是分镜。\n把每一次位移,都交给时间线。',
  'hero.ctaStart': '开始使用',
  'hero.ctaApi': 'API 文档',
  'hero.ctaGithub': 'GitHub',

  // ── Act 2 Philosophy ──
  'idea.eyebrow': '为什么是 Cineview',
  'idea.title': '滚动不该只是位移,\n而是被排好的时间线',
  'idea.body':
    '传统页面里,滚动只是把内容往上推。在 Cineview 里,滚动是胶片推进——每一段位移都映射到场景的进退场时间轴,元素按 delay 与 after 依次入场,像分镜表一样被精确排进时间线。',

  // ── Act 2 Capability showcase (framework as demo · two shots + through-line timecode capsule) ──
  // Title uses "|" separator: the right-hand segment renders as Fraunces italic terracotta emphasis (language-agnostic).
  // slate/code are API literals, identical across zh/en (monospace).
  'cap.tc.rec': 'REC',

  'cap.shot1.slate': 'SCENE TIMELINE',
  'cap.shot1.title': '选一种入场|试试不同动效',
  'cap.shot1.intro': '淡入、滑动、缩放，选择预设即可使用。搭配延迟与先后顺序，让元素依次出现。',
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

  // ── Act 3 Dolly in ──
  'cap.shot3.slate': 'DOLLY IN · DECLARATIVE TIMELINE',
  'cap.shot3.card.chain.label': '链式时间线',
  'cap.shot3.card.stagger.label': '错峰级联',
  'cap.shot3.card.position.label': '基准定位',
  'cap.shot3.card.container.label': '尺寸换算',
  'cap.shot3.card.scrub.label': '滚动接管',
  'cap.shot3.card.image.label': '资源预加载',
  /* 2026-08-16 user directive: zh uses same line breaks as en, but follows the homepage hero staggered line-break pattern
   * (\n line break + inline ±44u static horizontal shift, see Act3DollyScene split-line rendering). */
  'cap.shot3.title': '时间随滚动流转，\n画面随叙事前行',

  // ── Act 3 Dual engines ──
  'engines.eyebrow': '双引擎',
  'engines.title': '一套场景,两种驱动',
  'engines.dragName': 'drag · 移动端',
  'engines.dragDesc':
    '手指拖拽分页,释放后按惯性结算。页面滑动与元素时间轴解耦——release 后元素以创作速率继续完成,而非生硬回弹。',
  'engines.scrollName': 'scroll · 桌面端',
  'engines.scrollDesc':
    '接管真实文档滚动,center-lock 把关键场景锁定在视口中心,滚动距离即动画进度(1ms=1px),正反向天然可逆。',

  // ── Act 4 Phone highlight scene ──
  'phone.eyebrow': '此刻 · 亲手体验',
  'phone.title': '一台手机,\n装着 drag 模式',
  'phone.body':
    '滚动到这里,镜头推近,一台手机从模糊中浮现并对焦。它清晰之后,屏幕里就是真实运行的 drag 模式——用鼠标按住上下拖动,体验移动端的分镜叙事。',
  'phone.unlockHint': '↑ 按住屏幕上下拖动',
  'phone.locked': '对焦中…',

  // Phone interior drag demo 4 screens
  'demoDrag.s1.eyebrow': '第一镜',
  'demoDrag.s1.title': 'Cineview',
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

  // Homepage closing copy, outside the embedded /drag experience.
  'scene5.title': '也有另一种不同的模式',
  'scene5.subtitle': '专为移动端设计',
  'scene5.dragLead': '拖动下一幕，画面和其中的动画都会跟着手势前进。',
  'scene5.timelineDetail':
    '每个元素在同一条时间线上有自己的起点：标题延迟 100ms 开始，持续 600ms；说明接在标题之后，再延迟 100ms，从 800ms 开始。',
  'scene5.releaseDetail':
    '松手确认切换后，动画从当前进度继续。若已经拖过 800ms，说明会在松手前出现。',
  'scene5.rulerTitle': '100ms · 标题',
  'scene5.rulerDetail': '800ms · 说明',
  'scene5.frameTitle': 'Cineview 拖拽体验',
  'scene5.dragHint': '按住画面上下拖动',

  // ── Act 5 Capability matrix ──
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

  // Homepage closing action and footer.
  'cta.title': '从第一个场景开始',
  'cta.start': '阅读快速入门',
  'cta.github': '查看 GitHub',
  'footer.tagline': 'Cineview · React 场景与动画框架',
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

  // ── Demo · AnimateVideo (perhaps, can also drive video?) ──
  'demoVideo.slate': 'SCROLL-DRIVEN VIDEO',
  'demoVideo.title': '或许|也能驱动视频？',
  'demoVideo.intro':
    '从逐帧跳动，\n到光影长卷——\n所有动态，共用一种节奏；\n解锁画面，让故事自由上演。',
  'demoVideo.code':
    '<Scene scroll={{ zoneId: "hero-video" }}>\n  <AnimateVideo\n    src="/video.mp4"\n    duration={{ enter: 2000 }}\n    timeline={{ after: "intro" }}\n  />\n</Scene>',
  'demoVideo.desc': '滚动即时间轴：进度 0→1 映射到视频首帧→末帧，反向滚动天然倒放。',

  // ── Documentation shell ──
  'docs.title': '文档',
  'docs.search': '搜索',
  'docs.onThisPage': '本页目录',
  'docs.prev': '上一篇',
  'docs.next': '下一篇',
  'docs.editTip': '内容随框架版本更新',
  'docs.notFound': '未找到该文档',

  // Documentation navigation groups (entry titles come from each language's md frontmatter, no longer through i18n)
  'docs.group.getting-started': '开始使用',
  'docs.group.concepts': '核心概念',
  'docs.group.drag': '拖动模式',
  'docs.group.scroll': '滚动模式',
  'docs.group.components': '组件参考',
  'docs.group.advanced': '进阶用法',

  // ── Common ──
  'common.timecode': '时间码',

  // ── /drag temporal narrative experience (only translate narrative copy; preserve film terminology in English) ──
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
  // Editing desk (act 03 rewrite) new additions. previewLabel / timelineLabel are aria-labels — screen-reader only,
  // not displayed on screen. sub1..5 are the five words on the V2 subtitle track (2026-08-18 onwards 10s source five segments; design doc §3.3
  // deliberate blur was revoked 2026-08-19, now readable copy): both printed on track blocks and progressively highlighted
  // on the preview frame with active-media. CSS-side reveal selectors must stay in sync with the count here — contract test pinned.
  'dragTemporal.s03.previewLabel': '节目预览监视器',
  'dragTemporal.s03.timelineLabel': '剪辑时间线',
  'dragTemporal.s03.sub1': '剪辑',
  'dragTemporal.s03.sub2': '调度',
  'dragTemporal.s03.sub3': '控制',
  'dragTemporal.s03.sub4': '节奏',
  'dragTemporal.s03.sub5': '时序',
  'dragTemporal.s04.title': '画面聚焦于你',
  'dragTemporal.s04.equationLabel': 'DRAG DISTANCE = TIME',
  'dragTemporal.s04.footerHint': '拖拽距离化作时间',
  'dragTemporal.s04.rulerLabel': '拖拽进度标尺',
  'dragTemporal.s05.reelLabel': '胶片尾段',
  'dragTemporal.s05.creditsLabel': 'Cineview 谢幕演职员表',
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

import type { Dict } from './types';

export const en: Dict = {
  // ── Topbar / nav ──
  'nav.home': 'Home',
  'nav.demo': 'Demo',
  'nav.docs': 'Docs',
  'nav.github': 'GitHub',
  'nav.lang': 'ZH',
  'nav.langLabel': 'Switch language',

  // ── Act 1 Hero ──
  'hero.title': 'CineView',
  'hero.slogan': 'Direct every frame\nlike a filmmaker',
  'hero.intro':
    'Scroll becomes film, drag becomes frame.\nEvery motion, handed to time you direct.',
  'hero.ctaStart': 'Get Started',
  'hero.ctaApi': 'API Reference',
  'hero.ctaGithub': 'GitHub',
  'hero.scrollHint': 'Scroll down — the film starts rolling',

  // ── Act 2 Idea ──
  'idea.eyebrow': 'Why CineView',
  'idea.title': 'Scroll should not be mere\ntranslation, but choreographed time',
  'idea.body':
    'On a normal page, scrolling just pushes content up. In CineView, scrolling advances the film — every bit of travel maps to a scene’s enter/exit timeline, and elements arrive in turn by delay and waitFor, choreographed as precisely as a shot list.',

  // ── Act 2 Capabilities (framework-as-demo · two shots + timecode capsule) ──
  // Title uses '|' split: the part after the bar renders as italic Fraunces accent.
  // slate/code are API literals, identical zh/en (mono).
  'cap.tc.rec': 'REC',

  'cap.shot1.slate': 'SCENE ORCHESTRATION',
  'cap.shot1.title': 'Pick an entrance|like picking a shot',
  'cap.shot1.intro':
    'Forty-odd entrance presets built in — from fade to shake, swap with a single prop, never hand-writing a motion curve.',
  'cap.shot1.preset.fadeIn.title': 'Fade into view',
  'cap.shot1.preset.fadeIn.name': 'fade-in',
  'cap.shot1.preset.fadeIn.desc': 'Opacity rises from 0 to 1 — the simplest enter semantic.',
  'cap.shot1.preset.fadeIn.code': '<Animate enterAnimation="fade-in" />',
  'cap.shot1.preset.slideUp.title': 'Slide up in',
  'cap.shot1.preset.slideUp.name': 'slide-up',
  'cap.shot1.preset.slideUp.desc': 'Slides in from below, carrying a sense of weight.',
  'cap.shot1.preset.slideUp.code': '<Animate enterAnimation="slide-up" />',
  'cap.shot1.preset.zoomIn.title': 'Zoom in close',
  'cap.shot1.preset.zoomIn.name': 'zoom-in',
  'cap.shot1.preset.zoomIn.desc': 'Scales up from small, like a lens easing into a push-in.',
  'cap.shot1.preset.zoomIn.code': '<Animate enterAnimation="zoom-in" />',
  'cap.shot1.preset.rotateIn.title': 'Rotate in',
  'cap.shot1.preset.rotateIn.name': 'rotate-in',
  'cap.shot1.preset.rotateIn.desc': 'Enters with a turn of angle, a touch of drama.',
  'cap.shot1.preset.rotateIn.code': '<Animate enterAnimation="rotate-in" />',
  'cap.shot1.preset.bounce.title': 'Springy bounce',
  'cap.shot1.preset.bounce.name': 'bounce',
  'cap.shot1.preset.bounce.desc': 'Settles with an elastic rebound, a playful finish.',
  'cap.shot1.preset.bounce.code': '<Animate enterAnimation="bounce" />',
  'cap.shot1.preset.shake.title': 'Attention shake',
  'cap.shot1.preset.shake.name': 'shake',
  'cap.shot1.preset.shake.desc': 'A side-to-side tremor for emphasis or alert.',
  'cap.shot1.preset.shake.code': '<Animate enterAnimation="shake" />',
  'cap.shot1.preset.flip.title': 'Flip in',
  'cap.shot1.preset.flip.name': 'flip',
  'cap.shot1.preset.flip.desc': 'Flips in around the Y axis, like turning a card.',
  'cap.shot1.preset.flip.code': '<Animate enterAnimation="flip" />',
  'cap.shot1.preset.elastic.title': 'Elastic scale',
  'cap.shot1.preset.elastic.name': 'elastic',
  'cap.shot1.preset.elastic.desc': 'Scales in with an elastic overshoot, a gentle rebound.',
  'cap.shot1.preset.elastic.code': '<Animate enterAnimation="elastic" />',
  'cap.shot1.preset.blur.title': 'Focus in',
  'cap.shot1.preset.blur.name': 'blur-in',
  'cap.shot1.preset.blur.desc': 'From blur to sharp, like a lens finding focus.',
  'cap.shot1.preset.blur.code': '<Animate enterAnimation="blur-in" />',

  // ── Act 3 Dolly in ──
  'cap.shot3.slate': 'DOLLY IN · DECLARATIVE TIMELINE',
  'cap.shot3.card.chain.label': 'Chained order',
  'cap.shot3.card.stagger.label': 'Staggered cascade',
  'cap.shot3.card.position.label': 'One-ruler placement',
  'cap.shot3.card.container.label': 'Box conversion',
  'cap.shot3.card.scrub.label': 'Scroll takeover',
  'cap.shot3.card.image.label': 'Asset preloading',
  'cap.shot3.title': 'Time flows with scroll, scenes move with the story',

  // ── Act 3 Engines ──
  'engines.eyebrow': 'Two engines',
  'engines.title': 'One scene model, two drivers',
  'engines.dragName': 'drag · mobile',
  'engines.dragDesc':
    'Drag to page through; release settles on momentum. Page slide is decoupled from the element timeline — after release, elements finish at their authored rate instead of snapping back.',
  'engines.scrollName': 'scroll · desktop',
  'engines.scrollDesc':
    'Takes over real document scroll. Center-lock pins key scenes to the viewport center; scroll distance is animation progress (1ms=1px), reversible by construction.',

  // ── Act 4 Phone hero ──
  'phone.eyebrow': 'Right now · hands on',
  'phone.title': 'One phone,\nrunning drag mode',
  'phone.body':
    'Scroll here and the camera pushes in — a phone surfaces from blur and snaps into focus. Once sharp, its screen is a live drag-mode app. Press and drag up or down to feel mobile storyboard storytelling.',
  'phone.unlockHint': '↑ Press and drag the screen',
  'phone.locked': 'Focusing…',

  // Phone drag demo — 4 scenes
  'demoDrag.s1.eyebrow': 'Shot one',
  'demoDrag.s1.title': 'CineView',
  'demoDrag.s1.sub': 'Cinematic storytelling, within reach',
  'demoDrag.s2.eyebrow': 'Shot two · choreography',
  'demoDrag.s2.title': 'Elements arrive in turn',
  'demoDrag.s2.line1': 'Title lands first',
  'demoDrag.s2.line2': 'Subtitle waits for it (waitFor)',
  'demoDrag.s2.line3': 'Body follows, delayed 300ms',
  'demoDrag.s3.eyebrow': 'Shot three · positioning',
  'demoDrag.s3.title': 'Single-ruler coordinates',
  'demoDrag.s3.badge': 'Fixed layer',
  'demoDrag.s3.sub': 'Elements land exactly on design-draft coords',
  'demoDrag.s4.eyebrow': 'Shot four · presets',
  'demoDrag.s4.title': '40+ animation presets',
  'demoDrag.s4.sub': 'fade / zoom / flip / blur, freely composed',

  // ── Homepage act 5 · Cinema Entrance ──
  /* Title + subtitle (rewritten 2026-08-09, direction A: call out the two-mode
     simultaneity). The scene's plain fact: this page IS scroll mode while the
     phone runs drag mode — the reader is watching both modes of one framework
     at once. See the zh copy for the full rationale. */
  'scene5.title': 'Two modes, one system',
  'scene5.subtitle':
    'Drag it in the phone; scroll it on this page.\nSame timeline, same animation grammar.',
  'scene5.frameTitle': 'CineView drag experience',

  // ── Act 5 Capabilities ──
  'caps.eyebrow': 'Capabilities',
  'caps.title': 'A toolbox built for narrative',
  'caps.1.title': '40+ animation presets',
  'caps.1.desc':
    'fade, slide, zoom, flip, bounce, blur, elastic and more — composable sequentially or in parallel.',
  'caps.2.title': 'Single-ruler responsive',
  'caps.2.desc':
    'Write in design-draft coordinates; every length shares one width-based scale, preserving shape without hand-written media queries.',
  'caps.3.title': 'waitFor choreography',
  'caps.3.desc':
    'Chain elements into dependency links with waitFor, pace them with delay; circular dependencies are detected statically.',
  'caps.4.title': 'Image preloading',
  'caps.4.desc':
    'Enter animations start only after first-screen priority assets are ready; recoverable on timeout, no white-flash.',
  'caps.5.title': 'center-lock takeover',
  'caps.5.desc':
    'Scroll mode pins key scenes to the viewport center; scroll distance is progress, so even fast flicks never skip frames.',
  'caps.6.title': 'scene-scoped fixed layer',
  'caps.6.desc':
    'Fixed layers stay within their scene — no cross-scene drift. Mount straight from Position with clear, controllable stacking.',

  // ── Act 6 CTA / Footer ──
  'cta.title': 'Now, shoot your first frame',
  'cta.body': 'Install, write your first scene, and have a cinematic narrative running in minutes.',
  'cta.start': 'Quick Start',
  'cta.github': 'Star on GitHub',
  'footer.tagline': 'Cinematic storytelling · React UI framework',
  'footer.docs': 'Docs',
  'footer.demo': 'Demo',
  'footer.license': 'MIT License',

  // ── Demo Hub ──
  'demoHub.title': 'Experience both engines',
  'demoHub.subtitle':
    'Switch between drag and scroll to feel one scene language under two drivers.',
  'demoHub.tabDrag': 'drag · mobile',
  'demoHub.tabScroll': 'scroll · desktop',
  'demoHub.dragHint': 'Press and drag up/down inside the phone',
  'demoHub.scrollHint': 'Scroll down — key scenes lock to the center',
  'demoHub.backHome': 'Back to home',

  // ── Demo · scroll-driven video ──
  'demoVideo.slate': 'SCROLL-DRIVEN VIDEO',
  'demoVideo.title': 'Perhaps|it can drive video too?',
  'demoVideo.intro':
    'From frame-by-frame,\nto a scroll of light and shadow —\nevery motion shares one rhythm;\nunlock the frame, and let the story play freely.',
  'demoVideo.code':
    '<Scene scroll={{ zoneId: "hero-video", trigger: "center-lock" }}>\n  <AnimateVideo\n    src="/video.mp4"\n    duration={{ enter: 2000 }}\n    timeline={{ waitFor: "intro" }}\n  />\n</Scene>',
  'demoVideo.desc':
    'Scroll is the timeline: progress 0→1 maps to first frame→last, and scrolling back plays it in reverse.',

  // ── Docs shell ──
  'docs.title': 'Docs',
  'docs.search': 'Search',
  'docs.onThisPage': 'On this page',
  'docs.prev': 'Previous',
  'docs.next': 'Next',
  'docs.editTip': 'Content tracks the framework version',
  'docs.notFound': 'Document not found',

  // Docs nav groups (page titles live in per-language md frontmatter, not i18n)
  'docs.group.start': 'Getting Started',
  'docs.group.concepts': 'Core Concepts',
  'docs.group.components': 'Components',
  'docs.group.animation': 'Animation',
  'docs.group.advanced': 'Advanced',

  // ── Common ──
  'common.timecode': 'Timecode',

  // ── /drag temporal experience (narrative copy only; film terms stay English) ──
  'dragTemporal.s01.eyebrow': 'CINEMATIC UI FRAMEWORK',
  'dragTemporal.s01.footerHint': 'After release, time keeps finishing',
  'dragTemporal.s01.dialLabel': 'Temporal calibration dial',
  'dragTemporal.s01.dragHintLabel': 'Drag up or down',
  'dragTemporal.s01.actionsLabel': 'Primary navigation',
  'dragTemporal.s01.btnDocs': 'Read the docs',
  'dragTemporal.s01.btnHome': 'View on GitHub',
  'dragTemporal.s02.footerHint': 'Mark it — scene in motion',
  'dragTemporal.s02.slateLabel': '02 / SLATE',
  'dragTemporal.s02.actionWord': 'ACTION',
  'dragTemporal.s02.clapperLabel': 'Clapperboard forming from particles',
  // The act's only on-screen text. The eyebrow/title/body1/body2/signoff keys that stood
  // here were four paragraphs of prose, removed with the copy block they fed
  // (「去掉文案 ... 然后给一个名称，就叫调度」).
  'dragTemporal.s03.name': 'DIRECTING',
  'dragTemporal.s03.footerHint': 'One timeline directs every frame',
  'dragTemporal.s03.stripLabel': 'Five code strips taped to the cutting-room bench',
  'dragTemporal.s03.card1': 'ENTER',
  'dragTemporal.s03.card2': 'STAGGER',
  'dragTemporal.s03.card3': 'HOLD',
  'dragTemporal.s03.card4': 'EXIT',
  'dragTemporal.s03.card5': 'REWIND',
  // Added by the act-03 rewrite. previewLabel / timelineLabel are aria-labels — screen
  // readers only, never painted. sub1..5 are the five words on the V2 subtitle track
  // (five segments since the 2026-08-18 10s-source rework; the 设计档 §3.3 deliberate
  // blur was removed 2026-08-19, so they are legible copy): printed on the track blocks
  // and lit on the preview picture per segment via active-media. The CSS reveal selector
  // lists must stay in sync with this count — pinned by the motion-contract test.
  'dragTemporal.s03.previewLabel': 'Program preview monitor',
  'dragTemporal.s03.timelineLabel': 'Editing timeline',
  'dragTemporal.s03.sub1': 'CUT',
  'dragTemporal.s03.sub2': 'DIRECT',
  'dragTemporal.s03.sub3': 'CONTROL',
  'dragTemporal.s03.sub4': 'PACE',
  'dragTemporal.s03.sub5': 'TIMING',
  'dragTemporal.s04.equationLabel': 'DRAG DISTANCE = TIME',
  'dragTemporal.s04.footerHint': 'Drag distance becomes time',
  'dragTemporal.s04.rulerLabel': 'Drag progress ruler',
  'dragTemporal.s05.actionsLabel': 'Final scene navigation',
  'dragTemporal.s05.btnHome': 'Back to home',
  'dragTemporal.s05.btnDocs': 'Read docs',
  'dragTemporal.s05.reelLabel': 'End of reel',
  'dragTemporal.s05.creditsLabel': 'CineView curtain-call credits',
  'dragTemporal.s05.title': 'The lights come down.',
  'dragTemporal.s05.director': 'DIRECTOR',
  'dragTemporal.s05.editor': 'EDITOR',
  'dragTemporal.s05.cinematography': 'CINEMATOGRAPHY',
  'dragTemporal.s05.performance': 'MOTION PERFORMANCE',
  'dragTemporal.s05.starring': 'STARRING',
  'dragTemporal.s05.sceneEngine': 'Scene Engine',
  'dragTemporal.s05.timeline': 'Unified Timeline',
  'dragTemporal.s05.scrollDrag': 'Scroll + Drag',
  'dragTemporal.s05.motionRuntime': 'Reversible Motion Runtime',
  'dragTemporal.s05.yourStory': 'Your Story',
  'dragTemporal.s05.salute1': 'FRAME PERFECT',
  'dragTemporal.s05.salute2': 'YOURS TO DIRECT',
  'dragTemporal.s05.salute3': 'ONE CONTINUOUS TAKE',
  'dragTemporal.s05.footerHint': 'Lights down — the story stays on the timeline',
  'dragTemporal.hud.metaLabel': 'Capture metadata',
};

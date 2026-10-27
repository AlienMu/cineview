// Cineview homepage preview (/hero/). Loads the 2.0 runtime from /v2/, then runs the page-owned
// parts: Act 1's highlight and ink (measured paths the v2 loop cannot express) and the language
// switch. Act 2's timing is declared in the markup; the script only translates its labels.
import '/v2/cineview.js';

{
  const root = document.documentElement;
  const hero = document.getElementById('hero');
  const langButtons = [...document.querySelectorAll('[data-set-lang]')];
  const rows = [1, 2].map((n) => {
    const row = hero.querySelector('.row-' + n);
    return {
      row,
      words: row.querySelector('.words'),
      base: row.querySelector('.base'),
      glint: row.querySelector('.glint'),
      ext: row.querySelector('.ext'),
      ink: row.querySelector('.ink'),
    };
  });

  const NBSP = String.fromCharCode(160);
  const COPY = {
    zh: {
      lang: 'zh-CN',
      rows: ['以分镜落笔', '为页面写出灵动的故事'],
      row0: '以分镜落笔',
      row1: '为页面写出灵动的故事',
      join: '，',
      kicker: '影院式框架',
      bridge: '分镜和放映之间，只差一条时间线。',
      bridge1: '分镜和放映之间，',
      bridge2: '只差一条时间线。',
      desc0: '根据设计，拍出想要的镜头；根据内容，排出合适的设计。',
      desc1: '让 AI 读懂框架与技能，直接设计、开发每一场。',
      primary: '开始使用',
      secondary: 'API 文档',
      docs: '文档',
      nav: '主导航',
      language: '页面语言',
      t2title: '一个场景，一条时间线',
      t2text0: '像拍电影一样，把页面分成几场。',
      t2text1: '每一场都有自己的时间线，文字和图片谁接着谁出场、停留多久，都排在这条线上。',
      t2plate: '一张落地页线图：标题、两行说明、两个按钮，右侧一张图片，一条线把文字连到图片',
      t2tracks: '这一场的时间线',
      t4title: '先和 AI 讨论怎么做',
      t4text: '把需求和 Cineview 的设计技能交给 AI。它先问清内容，再给出分场、时间和排版，你确认后才写代码。',
      t4label: '你的需求',
      t4brief: '我想做一个介绍软件的页面，手上有三张截图和两段文字。\n访客要先明白它是做什么的，再看具体功能。\n请推荐合适的呈现方式，给出开头、变化和完成时的样子。\n先用 Cineview 设计技能讨论，确认后再写代码。',
      t4copy: '复制需求',
      t4copied: '已复制',
      t4select: '已选中，按 ⌘C 复制',
      t4guide: '阅读设计流程',
      t4note: '设计讨论示例',
      t4who: 'Cineview 设计技能',
      t4a: '三张截图各在讲什么？最希望访客记住哪一个功能？',
      t4b: '可以把图片固定在右侧，左侧放三段说明。读到下一段时，右边也换成对应的图。',
      t4c: '先看开头、换图和结束时的样子。这几处确认后，再开始写代码。',
      t5title1: '从一个想法，',
      t5title2: '变成一页设计',
      t5text: '先写清页面要讲什么，再分成几场，最后把时间写进去。每一步的结论都留在上面，下一步接着往下做。',
      t5c1: '需求要点',
      t5c1t: '先写清页面要讲什么，挑好图片。',
      t5c2: '场景计划',
      t5c2t: '决定哪些内容同屏，分成几场。',
      t5c3: '页面实现',
      t5c3t: '把时间写进每一场，在浏览器里验收。',
      t5rtitle1: '不同的页面，',
      t5rtitle2: '不同的做法',
      t5rtext: '产品介绍、作品集、活动页、文档首页、品牌故事，各有各的节奏。先定讲法，再挑动画。',
      t5p1: '产品介绍',
      t5p2: '作品集',
      t5p3: '活动页',
      t5p4: '文档首页',
      t5c1a: '读者是谁，要记住什么',
      t5c1b: '手上有哪些文字和图片',
      t5c1c: '最先要看到的一句话',
      t5c2a: '每一场只讲一件事',
      t5c2b: '谁先出场，停留多久',
      t5c2c: '哪一场锁定，哪一场自然滚过',
      t5c3a: '写下 duration 和 after',
      t5c3b: '停手、往回、快速跳都试一遍',
      t5c3c: '窄屏和减弱动态效果也要看',
      t5tag1: '内容',
      t5tag2: '分场',
      t5tag3: '实现',
      t5o1: '产出：一页需求说明',
      t5o2: '产出：分场表和时间安排',
      t5o3: '产出：能在浏览器里跑的页面',
      t5p1t: '先讲用途，再一屏一个功能。',
      t5p2t: '每件作品一场，图先到，说明随后。',
      t5p3t: '倒计时、议程和报名，按时间往下排。',
      t5p4t: '从入门到进阶，一段一段带读者往下走。',
      t5p5: '品牌故事',
      t5p5t: '用几场画面讲完来历，最后停在一句话上。',
      t5use: '适合',
      t5ex: '示例',
      t5ex1: '「一款帮团队把想法做成落地页的框架。」',
      t5ex2a: '开场',
      t5ex2b: '功能',
      t5ex2c: '收尾',
      t5flow: '设计的三步',
      t5f1: '想法',
      t5f2: '分场',
      t5f3: '页面',
      t5p1l: '「十分钟，做出第一页。」',
      t5p2l: '「每一件作品，都值得一整屏。」',
      t5p3l: '「还有 3 天，我们在上海见。」',
      t5p4l: '「一行命令，装好就能用。」',
      t5p5l: '「从一间小工作室开始。」',
      t5pace: '节奏',
      t5fxl: '效果',
      t5p1s1: '开场一句话',
      t5p1s2: '三个功能',
      t5p1s3: '开始使用',
      t5p2s1: '封面',
      t5p2s2: '一件一场',
      t5p2s3: '联系方式',
      t5p3s1: '倒计时',
      t5p3s2: '议程',
      t5p3s3: '报名',
      t5p4s1: '一行安装',
      t5p4s2: '三步上手',
      t5p4s3: '进阶',
      t5p5s1: '起点',
      t5p5s2: '转折',
      t5p5s3: '一句话',
      t5p1u: '新品发布、功能更新',
      t5p2u: '设计师、工作室',
      t5p3u: '发布会、线下活动',
      t5p4u: '开源项目、开发者工具',
      t5p5u: '品牌官网、周年专题',
      t6title: '画面也可以叠加处理',
      t6text: '给你的画面一些想象的空间。',
      t6video: '一段夜骑短片，随滚动逐帧播放',
      t6s1: '对焦',
      t6s2: '双色',
      t6s3: '放映',
      t6strip: '一条五帧胶片：画面依次对焦、印成双色，中间一格展开并播放夜骑短片',
      t8title1: '更灵活的扩展，',
      t8title2: '给你丰富的想象力',
      t8text: '框架没有提供的效果，你可以自己画。Canvas、SVG 或 WebGL 订阅元素的 timeline，就能和页面用同一个进度。右边这台放映机就是这样画出来的：往下滚，碎片一片片飞回原位，拼成放映机，胶片盘转起来，光束渐渐亮起；按住还能拖动，转着看。',
      t8code: '// 0 到 1，与页面同一个进度',
      t8drag: '拖动或用方向键转动放映机',
      t8figure: '一台放映机：往下滚，碎片拼成放映机、胶片盘转动、光束亮起；按住可以拖动转着看',
      t9title: '一套语言，两种模式',
      t9text: '刚才滚动看过的每一场，换成拖拽也能放：同样的场景、同样的时间线，手指往上推，画面就往下一幕走。',
      t9hint: '按住画面上下拖',
      t9frame: 'Cineview 拖拽体验',
      t9endTitle: '开始你的表演',
      t9endText: '从入门示例开始，或者带着需求，和 AI 一起讨论设计。',
      t9q: '阅读入门指南',
      t9docs: '查阅文档',
      t9sSub: '滚动与拖拽，同一份场景',
      t2c1: '标题',
      t2c2: '说明',
      t2c3: '主按钮',
      t2c4: '次按钮',
      t2c5: '图片',
      t2c6: '连线',
      t2from: '，从 {0} ms 开始',
      t2after: '，接在{0}后面',
    },
    en: {
      lang: 'en',
      rows: ['Storyboard it,', 'and write a lively story for your page'],
      row0: 'Storyboard it,',
      row1: 'and write a lively story for your page',
      join: NBSP,
      kicker: 'a cinema-style framework',
      bridge: 'Between the storyboard and the screen, there is just a timeline.',
      bridge1: 'Between storyboard and screen,',
      bridge2: 'there is just a timeline.',
      desc0: 'Shoot the frames your design calls for, or design from your content.',
      desc1: 'Your AI learns the framework and its skills, then builds each scene.',
      primary: 'Get started',
      secondary: 'API reference',
      docs: 'Docs',
      nav: 'Main navigation',
      language: 'Page language',
      t2title: 'One scene, one timeline',
      t2text0: 'Like a film, the page is split into scenes.',
      t2text1: 'Each scene has its own timeline, where you set what follows what and how long each part stays.',
      t2plate: 'A landing page drawing: a title, two lines of text and two buttons, a picture on the right, and a line from the text to the picture',
      t2tracks: "This scene's timeline",
      t4title: 'Work out the design with your AI',
      t4text: "Give your AI the brief and Cineview's design skill. It asks about your content first, then proposes the scenes, timing and layout, and writes code once you agree.",
      t4label: 'Your brief',
      t4brief: 'I want a page that explains my software. I have three screenshots and two paragraphs.\nVisitors should first understand what it does, then look at the features.\nRecommend a presentation, and show the opening, the changes and the finished state.\nDiscuss it with the Cineview design skill first, and write code after we agree.',
      t4copy: 'Copy the brief',
      t4copied: 'Copied',
      t4select: 'Selected: press Ctrl+C',
      t4guide: 'Read the design workflow',
      t4note: 'A design discussion, as an example',
      t4who: 'Cineview design skill',
      t4a: 'What does each screenshot show? Which feature should visitors remember most?',
      t4b: 'Keep the pictures on the right and three passages on the left. When the reader reaches the next passage, the picture changes to match.',
      t4c: 'Check the opening, the picture changes and the end first. Once those are agreed, start on the code.',
      t5title1: 'From one idea, ',
      t5title2: 'to a page design',
      t5text: 'First write down what the page has to say, then split it into scenes, then write in the timing. Each step’s conclusion stays in view while the next one builds on it.',
      t5c1: 'The brief',
      t5c1t: 'Say what the page is for and pick the pictures.',
      t5c2: 'The scene plan',
      t5c2t: 'Decide what shares a screen, and how many scenes.',
      t5c3: 'The build',
      t5c3t: 'Write the timing into each scene and check it in a browser.',
      t5rtitle1: 'Different pages, ',
      t5rtitle2: 'different approaches',
      t5rtext: 'A product page, a portfolio, an event, a docs home, a brand story: each has its own pace. Settle how to tell it first, then pick the motion.',
      t5p1: 'Product page',
      t5p2: 'Portfolio',
      t5p3: 'Event page',
      t5p4: 'Docs home',
      t5c1a: 'Who reads it, and what they should remember',
      t5c1b: 'Which text and pictures you have',
      t5c1c: 'The one line they should see first',
      t5c2a: 'One point per scene',
      t5c2b: 'Who enters first, and for how long',
      t5c2c: 'Which scenes hold, which scroll past',
      t5c3a: 'Write the duration and after',
      t5c3b: 'Try stopping, scrolling back and jumping',
      t5c3c: 'Check narrow screens and reduced motion',
      t5tag1: 'Content',
      t5tag2: 'Scenes',
      t5tag3: 'Build',
      t5o1: 'Output: a one-page brief',
      t5o2: 'Output: a scene list with timings',
      t5o3: 'Output: a page that runs in the browser',
      t5p1t: 'Say what it is for, then one feature per screen.',
      t5p2t: 'One scene per piece: the picture first, the words after.',
      t5p3t: 'Countdown, agenda and sign-up, in the order of the day.',
      t5p4t: 'From the first steps to the advanced parts, one section at a time.',
      t5p5: 'Brand story',
      t5p5t: 'Tell the history in a few scenes and end on one line.',
      t5use: 'For',
      t5ex: 'Example',
      t5ex1: '“A framework that turns a team’s idea into a landing page.”',
      t5ex2a: 'Opening',
      t5ex2b: 'Features',
      t5ex2c: 'Closing',
      t5flow: 'Three steps of design',
      t5f1: 'Idea',
      t5f2: 'Scenes',
      t5f3: 'Page',
      t5p1l: '“Your first page in ten minutes.”',
      t5p2l: '“Every piece deserves a whole screen.”',
      t5p3l: '“Three days to go. See you in Shanghai.”',
      t5p4l: '“One command, and you’re ready.”',
      t5p5l: '“It started in a small studio.”',
      t5pace: 'Pace',
      t5fxl: 'Effects',
      t5p1s1: 'One line',
      t5p1s2: 'Three features',
      t5p1s3: 'Get started',
      t5p2s1: 'Cover',
      t5p2s2: 'One piece a scene',
      t5p2s3: 'Contact',
      t5p3s1: 'Countdown',
      t5p3s2: 'Agenda',
      t5p3s3: 'Sign up',
      t5p4s1: 'One-line install',
      t5p4s2: 'Three steps',
      t5p4s3: 'Going further',
      t5p5s1: 'Where it began',
      t5p5s2: 'The turn',
      t5p5s3: 'One line',
      t5p1u: 'launches and feature updates',
      t5p2u: 'designers and studios',
      t5p3u: 'launch events and meetups',
      t5p4u: 'open-source projects and developer tools',
      t5p5u: 'brand sites and anniversaries',
      t6title: 'Treatments can be layered',
      t6text: 'Give your pictures some room to imagine.',
      t6video: 'A short night ride, played frame by frame as you scroll',
      t6s1: 'Focus',
      t6s2: 'Two inks',
      t6s3: 'Play',
      t6strip: 'A five-frame film strip: the frames come into focus, are printed in two inks, and the middle one opens to play a night ride',
      t8title1: 'More room to extend, ',
      t8title2: 'more room to imagine',
      t8text: 'When the framework has no effect for it, draw your own. Canvas, SVG or WebGL subscribe to an element’s timeline and move on the same progress as the page. The projector on the right is drawn that way: scroll, and its pieces fly back into place, the reels start turning and the beam slowly lights; hold and drag to turn it round.',
      t8code: '// 0 to 1, the same progress as the page',
      t8drag: 'Drag, or use the arrow keys, to turn the projector',
      t8figure: 'A film projector: scroll and its pieces assemble, the reels turn and the beam comes on; hold and drag to turn it',
      t9title: 'One language, two modes',
      t9text: 'Every scene you just scrolled through can be dragged instead: the same scenes, the same timeline; push up with a finger and the picture moves on to the next scene.',
      t9hint: 'Hold and drag up or down',
      t9frame: 'Cineview drag experience',
      t9endTitle: 'Start your show',
      t9endText: 'Start with the quickstart example, or bring your brief and work out the design with your AI.',
      t9q: 'Read the quickstart',
      t9docs: 'Browse the docs',
      t9sSub: 'Scroll and drag, the same scenes',
      t2c1: 'Title',
      t2c2: 'Text',
      t2c3: 'Button',
      t2c4: 'Outline',
      t2c5: 'Picture',
      t2c6: 'Link',
      t2from: ', from {0} ms',
      t2after: ', after {0}',
    },
  };

  // The signal: one forward pass (6 s) through row one, both lines and row two; a rest; the same path
  // backward; a rest. Slow over glyphs, 2.2x faster along the lines.
  const CYCLE = 16;
  const PASS = 6;
  const BACK = 8;
  const FAST = 2.2;
  const HEAD = 200; // design px: the length of the thick stroke
  const INK_LIFE = 1.6; // s: how long a drop of ink takes to spread and fade
  const INK_STEP = 4; // design px between drops
  const ENTRY_MS = 2900;
  const SIGNAL_DELAY_MS = 1000;

  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let lang = 'zh';
  let heroInView = true;
  let entryDone = false;
  let entryTimer = 0;
  let signalAt = Infinity;
  let signalTime = 0;
  let lastNow = 0;
  let inkTime = 0;
  const inkMode = 'bleed'; // the confirmed line: brush with ink ('bar': the thick stroke alone)
  let lastForward = -1;
  let geo = null;
  const ring = hero.querySelector('.primary .ring');

  const unit = () => Math.min(innerWidth, innerHeight * 1.7778) / 1920;

  // One soft drop of clay ink (--clay, #994f36), drawn once and stamped at different sizes and strengths.
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  (() => {
    const g = sprite.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(153, 79, 54, 1)');
    grad.addColorStop(0.45, 'rgba(153, 79, 54, 0.55)');
    grad.addColorStop(1, 'rgba(153, 79, 54, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  })();

  rows.forEach((row) => {
    row.ctx = row.ink.getContext('2d');
    row.drops = [];
    row.head = null; // { centre, dir } in line px while the stroke is on the line
    row.tip = null; // where the brush tip was on the last frame
    row.dirty = false;
  });

  function clearInk() {
    rows.forEach((row) => {
      row.drops.length = 0;
      row.tip = null;
      row.dirty = false;
      row.ctx.setTransform(1, 0, 0, 1, 0, 0);
      row.ctx.clearRect(0, 0, row.ink.width, row.ink.height);
    });
  }

  // Stamp ink behind the moving tip, draw the drops that are still wet, then the stroke on top.
  function paintInk(row, len) {
    const size = row.size;
    if (!size) return;
    const u = size.u;
    if (row.head && inkMode === 'bleed') {
      const tip = row.head.centre + row.head.dir * (HEAD / 2) * u;
      const from = row.tip === null ? tip : row.tip;
      const n = Math.max(1, Math.ceil(Math.abs(tip - from) / (INK_STEP * u)));
      for (let i = 1; i <= n; i++) {
        const x = from + ((tip - from) * i) / n;
        if (x >= 0 && x <= len) {
          row.drops.push({
            x,
            born: inkTime,
            k: 0.6 + Math.random() * 0.9,
            a: 0.7 + Math.random() * 0.6,
            dy: (Math.random() - 0.5) * 3,
          });
        }
      }
      row.tip = tip;
    } else {
      row.tip = null;
    }
    const ctx = row.ctx;
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    const cy = size.h / 2;
    const fade = 40 * u;
    let keep = 0;
    for (const drop of row.drops) {
      const t = (inkTime - drop.born) / INK_LIFE;
      if (t >= 1) continue;
      row.drops[keep++] = drop;
      const spread = 1 - Math.pow(1 - t, 3);
      const edge = Math.min(1, Math.max(0, Math.min(drop.x, len - drop.x) / fade));
      const x = size.pad + drop.x;
      const y = cy + drop.dy * u * spread;
      // Halo: spreads into the paper and fades.
      const rx = (6 + 22 * spread) * u * drop.k;
      const ry = (2 + 13 * spread) * u * drop.k;
      ctx.globalAlpha = 0.28 * drop.a * Math.pow(1 - t, 1.4) * edge;
      ctx.drawImage(sprite, x - rx, y - ry, 2 * rx, 2 * ry);
      // Core: the wet line itself, darker and thin, drying faster.
      const cr = (3 + 4 * spread) * u;
      ctx.globalAlpha = 0.5 * drop.a * Math.pow(Math.max(0, 1 - t * 1.6), 2) * edge;
      ctx.drawImage(sprite, x - 2.4 * cr, cy - cr * 0.55, 4.8 * cr, 1.1 * cr);
    }
    row.drops.length = keep;
    ctx.globalAlpha = 1;
    // A drop's halo is wider than its distance to the line's ends: keep the ink within the line,
    // fading to nothing at both ends, so the bleed is never longer than the rule.
    if (keep) {
      const x0 = size.pad;
      const x1 = size.pad + len;
      const mask = ctx.createLinearGradient(x0, 0, x1, 0);
      const f = Math.min(0.5, fade / Math.max(len, 1));
      mask.addColorStop(0, 'rgba(0,0,0,0)');
      mask.addColorStop(f, 'rgba(0,0,0,1)');
      mask.addColorStop(1 - f, 'rgba(0,0,0,1)');
      mask.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = mask;
      ctx.fillRect(0, 0, size.w, size.h);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (row.head) drawStroke(row, len, cy);
  }

  // The thick stroke, clipped to the line. 'bleed' fades from its tail to a solid tip; 'bar' is
  // the plain thick line, solid in the middle and faded at both ends.
  function drawStroke(row, len, cy) {
    const size = row.size;
    const ctx = row.ctx;
    const half = (HEAD / 2) * size.u;
    const tail = size.pad + row.head.centre - row.head.dir * half;
    const tip = size.pad + row.head.centre + row.head.dir * half;
    ctx.save();
    ctx.beginPath();
    ctx.rect(size.pad, 0, len, size.h);
    ctx.clip();
    const grad = ctx.createLinearGradient(tail, 0, tip, 0);
    const stops = inkMode === 'bleed' ? [[0, 0.15], [0.55, 0.75], [0.92, 1], [1, 1]] : [[0, 0], [0.3, 1], [0.7, 1], [1, 0]];
    stops.forEach(([at, alpha]) => grad.addColorStop(at, 'rgba(153, 79, 54, ' + alpha + ')'));
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(2.5, 3.4 * size.u);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tail, cy);
    ctx.lineTo(tip, cy);
    ctx.stroke();
    if (inkMode === 'bleed') {
      const r = 7 * size.u;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(sprite, tip - r, cy - r * 0.8, 2 * r, 1.6 * r);
    }
    ctx.restore();
  }

  function fireRing() {
    if (!ring) return;
    ring.classList.remove('is-on');
    void ring.offsetWidth;
    ring.classList.add('is-on');
  }

  const isStatic = () => reducedQuery.matches;

  // The reel turns only while it is on screen.
  const reel = document.querySelector('.reel');
  if (reel) new IntersectionObserver(([e]) => reel.classList.toggle('in-view', e.isIntersecting)).observe(reel);

  // The ink already on the line keeps drying after the stroke has gone.
  function hideRow(row) {
    row.glint.style.backgroundPosition = '-9999px 0';
    row.head = null;
    row.tip = null;
  }

  function hideSignal() {
    rows.forEach(hideRow);
  }

  // The longer row may take 1320 of the 1920 design width, leaving 360 for its line; past that both rows shrink.
  function fitTitle() {
    const margin = parseFloat(getComputedStyle(rows[0].row).paddingLeft);
    const limit = hero.clientWidth - 2 * margin - 360 * unit();
    const current = parseFloat(hero.style.getPropertyValue('--title-scale')) || 1;
    const widest = Math.max(...rows.map((row) => row.words.offsetWidth)) / current;
    const scale = Math.min(1, limit / Math.max(widest, 1));
    hero.style.setProperty('--title-scale', scale.toFixed(4));
  }

  function measure() {
    fitTitle();
    const u = unit();
    // Each canvas spans the page plus the 40-px margins, so it fits the line at any parting distance.
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = hero.clientWidth + 80 * u;
    const h = 56 * u;
    rows.forEach((row) => {
      row.ink.style.width = w + 'px';
      row.ink.style.height = h + 'px';
      row.ink.width = Math.round(w * dpr);
      row.ink.height = Math.round(h * dpr);
      row.size = { w, h, pad: 40 * u, dpr, u };
      row.drops.length = 0;
      row.tip = null;
    });
    const partNow = parseFloat(hero.style.getPropertyValue('--part')) || 0;
    const partDist = 154 * u;
    const parts = rows.map((row, i) => {
      const size = parseFloat(getComputedStyle(row.words).fontSize);
      const extStyle = getComputedStyle(row.ext);
      return {
        w: row.words.offsetWidth,
        bh: 1.2 * size,
        gap: parseFloat(i === 0 ? extStyle.marginLeft : extStyle.marginRight),
        // The rule at rest: parting the rows (--part, while scrolled down) lengthens it by
        // part * part-dist, and a measure taken then (a language change, a resize) must not keep that.
        len: Math.max(row.ext.offsetWidth - partNow * partDist, 1),
        ph: (HEAD / 2) * u,
      };
    });
    const [a, b] = parts;
    const slow = [a.w + a.bh, b.w + b.bh];
    const fast = [a.gap + a.len + a.ph, b.gap + b.len + b.ph];
    const vSlow = (slow[0] + slow[1] + (fast[0] + fast[1]) / FAST) / PASS;
    const vFast = vSlow * FAST;
    geo = {
      parts,
      legs: [
        { row: 0, x0: -a.bh, x1: a.w, dur: slow[0] / vSlow },
        { row: 0, x0: a.w, x1: a.w + fast[0], dur: fast[0] / vFast },
        { row: 1, x0: -fast[1], x1: 0, dur: fast[1] / vFast },
        { row: 1, x0: 0, x1: b.w + b.bh, dur: slow[1] / vSlow },
      ],
    };
  }

  // x is measured from the start of the row's text: row one's line starts at w + gap, row two's ends at -gap.
  // dir is 1 on the forward pass and -1 on the way back.
  function drawAt(r, x, dir) {
    const part = geo.parts[r];
    const row = rows[r];
    row.glint.style.backgroundPosition = (x - part.bh).toFixed(1) + 'px 0';
    const f = r === 0 ? (x - part.w - part.gap) / part.len : (x + part.gap + part.len) / part.len;
    const half = part.ph / part.len;
    row.head = f > -half && f < 1 + half ? { centre: f * part.len, dir } : null;
    if (!row.head) row.tip = null;
    hideRow(rows[1 - r]);
  }

  function renderSignal(t) {
    let p;
    if (t < PASS) p = t;
    else if (t >= BACK && t < BACK + PASS) p = BACK + PASS - t;
    else {
      hideSignal();
      lastForward = -1;
      return;
    }
    // The forward pass reaching the end of row two's line rings the primary button once.
    if (t < PASS) {
      const end = geo.legs[0].dur + geo.legs[1].dur + geo.legs[2].dur;
      if (lastForward >= 0 && lastForward < end && p >= end) fireRing();
      lastForward = p;
    }
    let acc = 0;
    for (let i = 0; i < geo.legs.length; i++) {
      const leg = geo.legs[i];
      if (p <= acc + leg.dur || i === geo.legs.length - 1) {
        const k = Math.min(Math.max((p - acc) / leg.dur, 0), 1);
        drawAt(leg.row, leg.x0 + (leg.x1 - leg.x0) * k, t < PASS ? 1 : -1);
        return;
      }
      acc += leg.dur;
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = lastNow ? Math.min((now - lastNow) / 1000, 0.1) : 0;
    lastNow = now;
    const running =
      geo && entryDone && !isStatic() && heroInView && !document.hidden && now >= signalAt;
    if (!running) return;
    inkTime += dt;
    signalTime = (signalTime + dt) % CYCLE;
    renderSignal(signalTime);
    // A canvas is drawn while it has a stroke or wet ink, and once more to clear it.
    rows.forEach((row, i) => {
      if (!row.head && !row.drops.length && !row.dirty) return;
      paintInk(row, geo.parts[i].len);
      row.dirty = Boolean(row.head || row.drops.length);
    });
  }

  // The stage starts paused (index.html) so its clock-played motion, the reel, waits for the entry.
  const stage = document.getElementById('home');

  function playEntry() {
    stage.removeAttribute('paused');
    clearTimeout(entryTimer);
    hideSignal();
    clearInk();
    entryDone = false;
    signalTime = 0;
    lastForward = -1;
    signalAt = Infinity;
    hero.classList.remove('is-playing', 'entry-done');
    void hero.offsetWidth;
    root.classList.remove('pre-entry');
    if (isStatic()) {
      entryDone = true;
      return;
    }
    hero.classList.add('is-playing');
    // The reel (on the Act 1/2 boundary) is drawn once, with the headline; it never redraws.
    reel?.classList.add('is-drawn');
    entryTimer = setTimeout(() => {
      entryDone = true;
      hero.classList.add('entry-done');
      signalAt = performance.now() + SIGNAL_DELAY_MS;
    }, ENTRY_MS);
  }

  let scrollQueued = false;
  function onScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      // The rows part over the first screen (the opening also holds the reel's tail below it).
      const height = innerHeight || 1;
      const part = isStatic() ? 0 : Math.min(Math.max(window.scrollY / height, 0), 1);
      hero.style.setProperty('--part', part.toFixed(4));
      root.classList.toggle('is-scrolled', window.scrollY > 24);
    });
  }

  function applyStatic() {
    root.classList.toggle('is-static', isStatic());
    if (isStatic()) {
      hideSignal();
      clearInk();
      entryDone = true;
      hero.classList.add('entry-done');
    } else if (!hero.classList.contains('is-playing')) {
      playEntry();
    } else if (entryDone && signalAt === Infinity) {
      signalAt = performance.now() + SIGNAL_DELAY_MS;
    }
    onScroll();
  }

  // Google Fonts serves Chinese in slices: ask for every glyph the copy uses.
  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const zhTitle = COPY.zh.rows.join('') + COPY.zh.t2title;
    const zhBody = Object.values(COPY.zh).join('');
    const enTitle = COPY.en.rows.join(' ') + ' ' + COPY.en.t2title;
    const enBody = Object.values(COPY.en).join(' ');
    const loads = Promise.all([
      document.fonts.load('300 200px "Noto Serif SC"', zhTitle),
      document.fonts.load('400 24px "Noto Serif SC"', zhBody),
      document.fonts.load('300 188px "Fraunces"', enTitle),
      document.fonts.load('400 24px "Fraunces"', enBody),
      document.fonts.load('500 34px "Fraunces"', 'Cineview'),
    ]).catch(() => {});
    return Promise.race([loads, new Promise((resolve) => setTimeout(resolve, 1800))]);
  }

  // Text changes in place: the v2 text watcher re-measures split lines, so nothing replays.
  function applyCopy() {
    const copy = COPY[lang];
    root.lang = copy.lang;
    hero.dataset.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const value = copy[el.dataset.i18n];
      if (value !== undefined && el.textContent !== value) el.textContent = value;
    });
    document.querySelectorAll('[data-from]').forEach((el) => {
      const after = el.dataset.after ? copy.t2after.replace('{0}', copy[el.dataset.after]) : '';
      el.textContent = after + copy.t2from.replace('{0}', el.dataset.from);
    });
    document.querySelectorAll('[data-i18n-label]').forEach((el) => {
      el.setAttribute('aria-label', copy[el.dataset.i18nLabel]);
    });
    document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
      el.setAttribute('alt', copy[el.dataset.i18nAlt]);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.setAttribute('title', copy[el.dataset.i18nTitle]);
    });
    langButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.setLang === lang));
    });
    try {
      localStorage.setItem('cineview-site-lang', lang);
    } catch {}
    measure();
    loadFonts().then(measure);
  }

  langButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.setLang === lang) return;
      lang = button.dataset.setLang;
      applyCopy();
      // The drag page in the phone reads the language when it loads: load it again.
      const dragFrame = document.getElementById('drag-frame');
      try {
        if (dragFrame && dragFrame.contentWindow) dragFrame.contentWindow.location.reload();
      } catch {}
    });
  });

  if (reducedQuery.addEventListener) reducedQuery.addEventListener('change', applyStatic);
  addEventListener('scroll', onScroll, { passive: true });
  new IntersectionObserver(([entry]) => {
    heroInView = entry.isIntersecting;
  }).observe(hero);
  new ResizeObserver(() => {
    if (geo) measure();
  }).observe(hero);

  // Act 4: copy the brief. Clipboard first; where it is refused, select the text for the reader.
  const briefCopy = document.getElementById('brief-copy');
  const briefStatus = document.getElementById('brief-status');
  briefCopy.addEventListener('click', async () => {
    const text = document.getElementById('brief').textContent;
    try {
      await navigator.clipboard.writeText(text);
      briefStatus.textContent = COPY[lang].t4copied;
    } catch {
      const range = document.createRange();
      range.selectNodeContents(document.getElementById('brief'));
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      briefStatus.textContent = COPY[lang].t4select;
    }
    clearTimeout(briefCopy.timer);
    briefCopy.timer = setTimeout(() => (briefStatus.textContent = ''), 2400);
  });

  // Act 8: a flat-shaded, low-poly projector (WebGL), on a canvas the size of the act, under its
  // text. Its faces start as a few shards drifting behind the text; as the scene's timeline runs
  // (subscribed to #projector-time) each shard tumbles back to its place and the projector forms,
  // its reels turn and its beam lights. The reader turns it by dragging the square on the right (or
  // with the arrow keys). The GPU places every vertex from a few uniforms; it runs only on screen.
  {
    const act = document.getElementById('extend');
    const view = document.getElementById('projector-view');
    const canvas = document.getElementById('projector-canvas');
    const time = document.getElementById('projector-time');
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
    if (!gl) canvas.hidden = true;
    let seed = 11;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // Per vertex: pos(3) centre(3) normal(3) start(3: x, y in -1..1, tumble) info(3: part, wait, -) colour(3).
    // Parts: 0 body, 1 reel A, 2 reel B, 3 lens, 4 brass, 5 beam, 6 arm.
    const COL = { 0: [0.74, 0.39, 0.25], 1: [0.93, 0.8, 0.62], 2: [0.93, 0.8, 0.62], 3: [0.3, 0.22, 0.17], 4: [0.86, 0.66, 0.41], 5: [0.96, 0.78, 0.52], 6: [0.42, 0.29, 0.21] };
    const V = [];
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const norm = (a) => { const m = Math.hypot(...a) || 1; return a.map((x) => x / m); };
    const tri = (a, b, c, part, wait, n) => {
      const ctr = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
      const nn = n || norm(cross(sub(b, a), sub(c, a)));
      const st = [rand() * 2 - 1, rand() * 2 - 1, rand() * 6.283];
      for (const v of [a, b, c]) V.push(...v, ...ctr, ...nn, ...st, part, wait + rand() * 0.06, 0, ...COL[part]);
    };
    const quad = (a, b, c, d, part, wait, n) => { tri(a, b, c, part, wait, n); tri(a, c, d, part, wait, n); };
    // Body: a box, each face cut into a 3 x 2 grid of tiles (so it forms from pieces).
    const W = 400, H = 220, D = 210;
    const face = (o, u, v, n, wait) => {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        const p = (s, t) => [o[0] + u[0] * s + v[0] * t, o[1] + u[1] * s + v[1] * t, o[2] + u[2] * s + v[2] * t];
        quad(p(i / 3, j / 2), p((i + 1) / 3, j / 2), p((i + 1) / 3, (j + 1) / 2), p(i / 3, (j + 1) / 2), 0, wait, n);
      }
    };
    face([-W / 2, -H / 2, D / 2], [W, 0, 0], [0, H, 0], [0, 0, 1], 0.02);
    face([W / 2, -H / 2, -D / 2], [-W, 0, 0], [0, H, 0], [0, 0, -1], 0.04);
    face([W / 2, -H / 2, D / 2], [0, 0, -D], [0, H, 0], [1, 0, 0], 0.06);
    face([-W / 2, -H / 2, -D / 2], [0, 0, D], [0, H, 0], [-1, 0, 0], 0.06);
    face([-W / 2, -H / 2, -D / 2], [W, 0, 0], [0, 0, D], [0, -1, 0], 0);
    face([-W / 2, H / 2, D / 2], [W, 0, 0], [0, 0, -D], [0, 1, 0], 0.08);
    // Reels: a rim ring, five spokes and a hub on both faces, and the rim's edge band.
    const R = 118, T = 30, reelY = -(H / 2 + R + 16), SEG = 16;
    for (const [part, cx] of [[1, -96], [2, 96]]) {
      const wait = 0.16 + (part - 1) * 0.08;
      const at = (r, a, z) => [cx + r * Math.cos(a), reelY + r * Math.sin(a), z];
      for (const z of [T / 2, -T / 2]) {
        const n = [0, 0, Math.sign(z)];
        for (let k = 0; k < SEG; k++) {
          const a0 = (k / SEG) * Math.PI * 2, a1 = ((k + 1) / SEG) * Math.PI * 2;
          quad(at(R - 16, a0, z), at(R, a0, z), at(R, a1, z), at(R - 16, a1, z), part, wait, n);
        }
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 - Math.PI / 2, d = 0.13;
          quad(at(30, a - d * 2.2, z), at(R - 16, a - d, z), at(R - 16, a + d, z), at(30, a + d * 2.2, z), part, wait + 0.03, n);
        }
        for (let k = 0; k < 8; k++) {
          const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2;
          tri([cx, reelY, z], at(30, a0, z), at(30, a1, z), part, wait + 0.05, n);
        }
      }
      for (let k = 0; k < SEG; k++) {
        const a0 = (k / SEG) * Math.PI * 2, a1 = ((k + 1) / SEG) * Math.PI * 2, am = (a0 + a1) / 2;
        quad(at(R, a0, T / 2), at(R, a0, -T / 2), at(R, a1, -T / 2), at(R, a1, T / 2), part, wait + 0.02, [Math.cos(am), Math.sin(am), 0]);
      }
      quad([cx - 7, -H / 2, 5], [cx + 7, -H / 2, 5], [cx + 7, reelY, 5], [cx - 7, reelY, 5], 6, 0.12, [0, 0, 1]);
      quad([cx + 7, -H / 2, -5], [cx - 7, -H / 2, -5], [cx - 7, reelY, -5], [cx + 7, reelY, -5], 6, 0.12, [0, 0, -1]);
    }
    // Lens: a ten-sided barrel out of the right face, a brass ring and the glass.
    const lr = 48, LL = 130, ly = 26, LS = 10;
    const ring = (x, r, a) => [x, ly + r * Math.sin(a), r * Math.cos(a)];
    for (let k = 0; k < LS; k++) {
      const a0 = (k / LS) * Math.PI * 2, a1 = ((k + 1) / LS) * Math.PI * 2, am = (a0 + a1) / 2;
      const n = [0, Math.sin(am), Math.cos(am)];
      quad(ring(W / 2, lr, a0), ring(W / 2 + LL - 28, lr, a0), ring(W / 2 + LL - 28, lr, a1), ring(W / 2, lr, a1), 3, 0.28, n);
      quad(ring(W / 2 + LL - 28, lr + 3, a0), ring(W / 2 + LL, lr + 3, a0), ring(W / 2 + LL, lr + 3, a1), ring(W / 2 + LL - 28, lr + 3, a1), 4, 0.3, n);
      quad(ring(W / 2 + LL, lr + 3, a0), ring(W / 2 + LL, 34, a0), ring(W / 2 + LL, 34, a1), ring(W / 2 + LL, lr + 3, a1), 4, 0.32, [1, 0, 0]);
      tri([W / 2 + LL - 4, ly, 0], ring(W / 2 + LL - 4, 34, a0), ring(W / 2 + LL - 4, 34, a1), 3, 0.34, [1, 0, 0]);
    }
    const modelCount = V.length / 18;
    // Beam: two crossed wedges out of the lens, translucent, as bright as the lamp.
    const bx = W / 2 + LL;
    tri([bx, ly - 26, 0], [bx + 820, ly - 230, 0], [bx + 820, ly + 230, 0], 5, 0.45, [0, 0, 1]);
    tri([bx, ly + 26, 0], [bx, ly - 26, 0], [bx + 820, ly + 230, 0], 5, 0.45, [0, 0, 1]);
    tri([bx, ly, -26], [bx + 820, ly, -230], [bx + 820, ly, 230], 5, 0.45, [0, 1, 0]);
    tri([bx, ly, 26], [bx, ly, -26], [bx + 820, ly, 230], 5, 0.45, [0, 1, 0]);
    const count = V.length / 18;
    const data = V;
    const VS = `
      attribute vec3 a_pos; attribute vec3 a_ctr; attribute vec3 a_n; attribute vec3 a_start; attribute vec3 a_info; attribute vec3 a_col;
      uniform vec2 u_view; uniform vec2 u_centre; uniform float u_scale;
      uniform float u_rx; uniform float u_ry; uniform float u_progress; uniform float u_time;
      varying vec3 v_col; varying float v_alpha;
      vec3 turnY(vec3 p, float a) { return vec3(p.x * cos(a) + p.z * sin(a), p.y, -p.x * sin(a) + p.z * cos(a)); }
      vec3 turnX(vec3 p, float a) { return vec3(p.x, p.y * cos(a) - p.z * sin(a), p.y * sin(a) + p.z * cos(a)); }
      vec3 spinZ(vec3 p, vec2 c, float a) { vec2 d = p.xy - c; return vec3(c + vec2(d.x * cos(a) - d.y * sin(a), d.x * sin(a) + d.y * cos(a)), p.z); }
      void main() {
        float part = a_info.x;
        vec3 p = a_pos, c = a_ctr, n = a_n;
        if (part > 0.5 && part < 2.5) {
          vec2 rc = vec2(part < 1.5 ? -96.0 : 96.0, ${reelY}.0);
          float ang = (part < 1.5 ? 1.0 : -1.0) * u_progress * 12.566;
          p = spinZ(p, rc, ang); c = spinZ(c, rc, ang); n = spinZ(n, vec2(0.0), ang);
        }
        float g = clamp((u_progress - a_info.y) / 0.42, 0.0, 1.0);
        g = 1.0 - pow(1.0 - g, 3.0);
        float beam = part > 4.5 && part < 5.5 ? 1.0 : 0.0;
        if (beam > 0.5) g = 1.0;
        // A shard: the face shrunk about its centre and tumbled, far from its place; it grows,
        // straightens and flies home as g goes to 1.
        float tumble = (1.0 - g) * (a_start.z + u_time * 0.4);
        vec3 local = turnX(turnY(p - c, tumble), tumble * 0.7) * mix(0.55, 1.0, g);
        vec3 q = turnX(turnY(c + local, u_ry), u_rx);
        vec3 qn = turnX(turnY(n, u_ry), u_rx);
        float k = 1600.0 / (1600.0 - q.z);
        vec2 px = u_centre + vec2(q.x - 60.0, q.y + 60.0) * u_scale * k;
        vec2 home = vec2(px.x / u_view.x * 2.0 - 1.0, 1.0 - px.y / u_view.y * 2.0);
        vec2 drift = 0.04 * vec2(sin(u_time * 0.3 + a_start.z), cos(u_time * 0.26 + a_start.z * 1.3));
        vec2 away = a_start.xy * 0.95 + drift;
        vec2 shardOffset = (home - vec2(u_centre.x / u_view.x * 2.0 - 1.0, 1.0 - u_centre.y / u_view.y * 2.0));
        vec2 pos = mix(away + shardOffset * 0.25 * (1.0 - g), home, g);
        gl_Position = vec4(pos, beam > 0.5 ? 0.0 : clamp(-q.z / 1400.0, -1.0, 1.0) * 0.5, 1.0);
        float lit = max(0.0, dot(qn, normalize(vec3(-0.45, -0.6, 0.66))));
        float rim = pow(1.0 - abs(qn.z), 2.0) * 0.12;
        v_col = beam > 0.5 ? a_col : a_col * (0.58 + 0.62 * lit + rim);
        float lamp = clamp((u_progress - 0.45) / 0.4, 0.0, 1.0);
        v_alpha = beam > 0.5 ? lamp * 0.16 : mix(0.35, 1.0, g);
      }`;
    const FS = `
      precision mediump float;
      varying vec3 v_col; varying float v_alpha;
      void main() { gl_FragColor = vec4(v_col * v_alpha, v_alpha); }`;
    if (gl) {
      const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
      const prog = gl.createProgram();
      gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      const stride = 18 * 4;
      [['a_pos', 0], ['a_ctr', 3], ['a_n', 6], ['a_start', 9], ['a_info', 12], ['a_col', 15]].forEach(([name, off]) => {
        const loc = gl.getAttribLocation(prog, name);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, stride, off * 4);
      });
      const U = Object.fromEntries(['u_view', 'u_centre', 'u_scale', 'u_rx', 'u_ry', 'u_progress', 'u_time'].map((n) => [n, gl.getUniformLocation(prog, n)]));
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      let rx = -16, ry = -34, progress = 0, w = 0, h = 0, dpr = 1;
      const t0 = performance.now();
      const draw = (now = performance.now()) => {
        if (!w) return;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        const box = view.getBoundingClientRect();
        const cb = canvas.getBoundingClientRect();
        gl.uniform2f(U.u_view, w, h);
        gl.uniform2f(U.u_centre, box.left - cb.left + box.width / 2, box.top - cb.top + box.height / 2);
        gl.uniform1f(U.u_scale, Math.min(box.width, box.height) / 980);
        gl.uniform1f(U.u_rx, (rx * Math.PI) / 180);
        gl.uniform1f(U.u_ry, (ry * Math.PI) / 180);
        gl.uniform1f(U.u_progress, progress);
        gl.uniform1f(U.u_time, (now - t0) / 1000);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(true);
        gl.drawArrays(gl.TRIANGLES, 0, modelCount);
        if (progress > 0.45) {
          gl.depthMask(false);
          gl.drawArrays(gl.TRIANGLES, modelCount, count - modelCount);
        }
      };
      const resize = () => {
        const r = canvas.getBoundingClientRect();
        dpr = Math.min(devicePixelRatio || 1, 2);
        w = r.width; h = r.height;
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        draw();
      };
      new ResizeObserver(resize).observe(canvas);
      // Moving only while the shards drift (before the projector has formed) and while dragged.
      let onScreen = false, loop = 0;
      const tick = (now) => {
        loop = 0;
        if (!onScreen || document.hidden) return;
        draw(reducedQuery.matches ? t0 : now);
        if (!reducedQuery.matches && progress < 0.85) loop = requestAnimationFrame(tick);
      };
      const start = () => { if (!loop && onScreen && !document.hidden) loop = requestAnimationFrame(tick); };
      new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) start(); }).observe(act);
      document.addEventListener('visibilitychange', start);
      const redraw = () => { if (loop) return; requestAnimationFrame(() => draw()); start(); };
      let vx = 0, vy = 0, drag = null, coast = 0;
      const clampX = (v) => Math.max(-50, Math.min(25, v));
      const glide = () => {
        coast = 0;
        if (Math.abs(vx) < 0.03 && Math.abs(vy) < 0.03) return;
        ry += vx; rx = clampX(rx + vy); vx *= 0.93; vy *= 0.88;
        redraw();
        coast = requestAnimationFrame(glide);
      };
      view.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        cancelAnimationFrame(coast);
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
        view.setPointerCapture(e.pointerId);
      });
      view.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y, now = performance.now(), dt = Math.max(now - drag.t, 1);
        ry += dx * 0.45; rx = clampX(rx - dy * 0.3);
        vx = ((dx * 0.45) / dt) * 16; vy = ((-dy * 0.3) / dt) * 16;
        drag = { ...drag, x: e.clientX, y: e.clientY, t: now };
        redraw();
      });
      const end = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        drag = null;
        if (!reducedQuery.matches) coast = requestAnimationFrame(glide);
      };
      view.addEventListener('pointerup', end);
      view.addEventListener('pointercancel', end);
      view.addEventListener('keydown', (e) => {
        const k = { ArrowLeft: [0, -12], ArrowRight: [0, 12], ArrowUp: [6, 0], ArrowDown: [-6, 0] }[e.key];
        if (!k) return;
        e.preventDefault();
        rx = clampX(rx + k[0]); ry += k[1];
        redraw();
      });
      customElements.whenDefined('cv-animate').then(() => {
        const take = (frame) => {
          const p = Math.min(Math.max(frame.progress, 0), 1);
          if (Math.abs(p - progress) < 0.0005) return;
          progress = p;
          redraw();
        };
        time.timeline.subscribe(take);
        take(time.timeline.frame);
      });
    }
  }

  // Act 9 (v1 Scene5Cinema protocol): the drag page in the phone starts on cineview-activate once
  // the cinema scene holds the screen, pauses on cineview-freeze when it is left, and its
  // cineview-embed-finished / -unfinished moves the phone left and brings the summary in (or back).
  {
    const frame = document.getElementById('drag-frame');
    const cinema = document.getElementById('cinema');
    let ready = false;
    let active = false;
    let dragDone = false;
    let scrolledOut = false;
    const send = (msg) => frame.contentWindow && frame.contentWindow.postMessage(msg, location.origin);
    const sync = () => {
      const r = cinema.getBoundingClientRect();
      const inView = r.top <= innerHeight * 0.5 && r.bottom >= innerHeight * 0.5;
      if (!ready || inView === active) return;
      active = inView;
      send(active ? 'cineview-activate' : 'cineview-freeze');
    };
    addEventListener('message', (e) => {
      if (e.origin !== location.origin || e.source !== frame.contentWindow) return;
      if (e.data === 'cineview-embed-ready') {
        // A ready frame is a fresh one (first load, or reloaded for a language change): it starts
        // as the dark shell, so it needs activating again if the act is on screen.
        ready = true;
        active = false;
        sync();
      } else if (typeof e.data === 'string' && e.data.startsWith('cineview-embed-lang:')) {
        // The phone's own toggle: the page follows, so one screen shows one language.
        const next = e.data.slice('cineview-embed-lang:'.length);
        if ((next === 'zh' || next === 'en') && next !== lang) {
          lang = next;
          applyCopy();
        }
      } else if (e.data === 'cineview-embed-finished') {
        dragDone = true;
        show();
      } else if (e.data === 'cineview-embed-unfinished') {
        dragDone = false;
        show();
      }
    });
    addEventListener('scroll', sync, { passive: true });
    // The bar turns clear once the cinema act's top has reached its bottom edge.
    const bar = document.querySelector('.bar');
    const underBar = () => {
      const t = cinema.getBoundingClientRect().top;
      document.documentElement.classList.toggle('cinema-under-bar', t <= (bar ? bar.getBoundingClientRect().height : 0) + 1);
    };
    addEventListener('scroll', underBar, { passive: true });
    underBar();
    // The copy (and the closing under it) shows once the drag reaches its last scene, or when the
    // reader scrolls to the end of the act without dragging, so the ways in are never out of reach.
    const show = () => cinema.classList.toggle('is-finished', dragDone || scrolledOut);
    // Scrolling back (the act's progress falling) puts the copy away, also when it came from the
    // drag: the phone returns to the middle, and reaching the end again brings the copy back.
    let lastProgress = 0;
    cinema.addEventListener('cv-progress', (e) => {
      const d = e.detail;
      if (!d || d.kind !== 'zone') return;
      const back = d.progress < lastProgress - 0.015;
      lastProgress = d.progress;
      const next = d.progress >= 0.9 ? true : d.progress < 0.8 ? false : scrolledOut;
      if (back && dragDone) dragDone = false;
      if (next !== scrolledOut || back) {
        scrolledOut = next && !back ? true : d.progress >= 0.9 && !back;
        show();
      }
    });
    // The frame may have loaded (and announced itself) before this script ran: a loaded same-origin
    // document counts as ready; otherwise its load event does.
    const loaded = () => {
      ready = true;
      sync();
    };
    if (frame.contentDocument && frame.contentDocument.readyState === 'complete' && frame.contentWindow.location.href !== 'about:blank') loaded();
    else frame.addEventListener('load', loaded, { once: true });
  }

  // Act 4: a typewriter. When the act comes into view the brief is typed out, then each answer
  // card shows a typing indicator and types its reply. The full text is in the DOM from the start
  // (readers and copy see it); only a visual mask reveals it. Reduced motion shows it at once.
  {
    const method = document.getElementById('method');
    const targets = [...method.querySelectorAll('[data-type]')];
    const CHAR_MS = { brief: 18, card: 26 };
    let played = false;
    let timer = 0;
    const wrap = (el) => {
      const text = el.textContent;
      el.dataset.full = text;
      el.textContent = '';
      const shown = document.createElement('span');
      const rest = document.createElement('span');
      shown.className = 'type-shown';
      rest.className = 'type-rest';
      rest.textContent = text;
      el.append(shown, rest);
      return { el, text, shown, rest };
    };
    const reset = () => {
      clearTimeout(timer);
      for (const el of targets) {
        if (el.dataset.full !== undefined) el.textContent = el.dataset.full;
        el.classList.remove('is-typing', 'is-waiting', 'is-typed');
      }
    };
    const play = () => {
      if (played || isStatic()) return;
      played = true;
      const runs = targets.map((el) => {
        const target = el.matches('code') ? el : el.querySelector('code') || el;
        return { ...wrap(target), host: el, kind: el.dataset.type };
      });
      runs.forEach((r) => r.host.classList.add('is-waiting'));
      let i = 0;
      const next = () => {
        const r = runs[i++];
        if (!r) return;
        r.host.classList.remove('is-waiting');
        r.host.classList.add('is-typing');
        let n = 0;
        const step = () => {
          n += r.text[n] === '\n' ? 1 : 1;
          r.shown.textContent = r.text.slice(0, n);
          r.rest.textContent = r.text.slice(n);
          if (n < r.text.length) timer = setTimeout(step, CHAR_MS[r.kind] || 22);
          else {
            r.host.classList.remove('is-typing');
            r.host.classList.add('is-typed');
            timer = setTimeout(next, r.kind === 'brief' ? 360 : 260);
          }
        };
        timer = setTimeout(step, r.kind === 'card' ? 520 : 0);
      };
      next();
    };
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && e.intersectionRatio > 0.35) play();
    }, { threshold: [0, 0.35, 0.6] }).observe(method);
    // A language change rewrites the text: show it whole.
    document.querySelectorAll('[data-set-lang]').forEach((b) => b.addEventListener('click', () => {
      reset();
      played = true;
    }));
  }

  // Where the reader is: the scene at the eye line, the offset into it, and the act's theme, kept
  // for this tab so a reload (or back/forward) can come back to the same place (index.html head).
  {
    const home = document.getElementById('home');
    const root = document.documentElement;
    const scenes = () => [...home.querySelectorAll(':scope > cv-scene')];
    // The current scene is the one the stage marks (data-cv-current): a held (stack) scene stays
    // pinned on screen after its turn, so geometry alone would pick it. The offset is measured in
    // document flow (the scene's place in the page), which a pinned box no longer reflects.
    const place = () => {
      const s = home.querySelector(':scope > cv-scene[data-cv-current]');
      if (!s) return null;
      const flowTop = s.offsetTop;
      return { id: s.id, offset: Math.round(scrollY - flowTop), theme: home.getAttribute('data-cv-theme') };
    };
    let pending = 0;
    const save = () => {
      pending = 0;
      if (root.classList.contains('restoring')) return;
      const p = place();
      try {
        if (p) sessionStorage.setItem('hero-place', JSON.stringify({ ...p, ground: getComputedStyle(document.documentElement).getPropertyValue('--scroll-ground').trim() }));
      } catch {}
    };
    addEventListener('scroll', () => { if (!pending) pending = requestAnimationFrame(save); }, { passive: true });
    addEventListener('pagehide', save);
    if (root.classList.contains('restoring')) {
      let saved = null;
      try { saved = JSON.parse(sessionStorage.getItem('hero-place') || 'null'); } catch {}
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        root.classList.remove('restoring');
        root.removeAttribute('data-boot-theme');
      };
      const go = () => {
        const s = saved && document.getElementById(saved.id);
        if (s) scrollTo(0, s.offsetTop + saved.offset);
        // Two frames: the stage reads the new position, sets the act's theme and frames.
        requestAnimationFrame(() => requestAnimationFrame(finish));
      };
      let went = false;
      const once = () => { if (!went) { went = true; go(); } };
      customElements.whenDefined('cv-stage').then(() => (home.ready ? home.ready.then(once) : once()));
      home.addEventListener('cv-ready', once, { once: true });
      setTimeout(() => { once(); finish(); }, 2500);
    }
  }

  // The ground follows the scroll: a few colour stops over the page's light part (cream to apricot
  // and back), mixed for the current position and written only when the colour changes. The dark
  // cinema keeps its own theme colour (the stage's theme overrides --ground there).
  {
    const STOPS = [[0, [251, 239, 221]], [0.3, [249, 230, 207]], [0.55, [246, 223, 198]], [0.8, [248, 231, 210]], [1, [251, 239, 221]]];
    const rootEl = document.documentElement;
    const cinemaAct = document.getElementById('cinema');
    let lastColour = '';
    let queuedGround = false;
    const paint = () => {
      // While a reload is restoring the reader's place, keep the colour the head script set.
      if (rootEl.classList.contains('restoring')) {
        requestAnimationFrame(paint);
        return;
      }
      queuedGround = false;
      const end = cinemaAct ? cinemaAct.offsetTop : document.documentElement.scrollHeight;
      const f = Math.min(1, Math.max(0, (scrollY + innerHeight / 2) / Math.max(end, 1)));
      let i = 1;
      while (i < STOPS.length - 1 && STOPS[i][0] < f) i++;
      const [a, ca] = STOPS[i - 1];
      const [b, cb] = STOPS[i];
      const t = (f - a) / Math.max(b - a, 1e-6);
      const col = ca.map((v, k) => Math.round(v + (cb[k] - v) * t));
      const css = `rgb(${col[0]} ${col[1]} ${col[2]})`;
      if (css === lastColour) return;
      lastColour = css;
      rootEl.style.setProperty('--scroll-ground', css);
    };
    const queue = () => { if (!queuedGround) { queuedGround = true; requestAnimationFrame(paint); } };
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    paint();
  }

  // The deck shows each covered card's head row and nothing below it: the stack's step is the head's
  // real height at this width (design units do not scale the step, which is in px).
  {
    const deck = document.querySelector('cv-stack.deck');
    const fit = () => {
      const card = deck && deck.querySelector('.deck-card');
      const head = card && card.querySelector('.deck-head');
      if (!head) return;
      // Layout offsets, not boxes: a card may be scaled (receding) or moving when this runs.
      let y = 0;
      for (let n = head; n && n !== card; n = n.offsetParent) y += n.offsetTop;
      const step = Math.round(y + head.offsetHeight + 8);
      if (deck.getAttribute('step') !== String(step)) deck.setAttribute('step', String(step));
      // Dealt cards are drawn i * step below the deck's box: make the box that much taller at the
      // bottom, so the grid centres the deck as it is drawn, not its first card.
      const extra = step * (deck.querySelectorAll('.deck-card').length - 1);
      deck.style.paddingBottom = extra + 'px';
    };
    if (deck) {
      new ResizeObserver(fit).observe(deck);
      document.fonts.ready.then(fit);
      fit();
    }
  }

  // The site remembers the reader's language (site/src/i18n, same key).
  try {
    const stored = localStorage.getItem('cineview-site-lang');
    if (stored === 'en' || stored === 'zh') lang = stored;
  } catch {}
  if (lang !== 'zh') applyCopy();

  root.classList.toggle('is-static', isStatic());
  loadFonts().then(() => {
    measure();
    playEntry();
    onScroll();
    requestAnimationFrame(frame);
  });
}

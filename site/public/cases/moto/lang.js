// Language switch (checks.md K1). Classic script at the end of <body>: runs before the Cineview module.
// Chinese is the default; ?lang=en, or the reader's last choice, opens the English page.
(function () {
  var TEXT = {
    zh: {
      'page.title': '途岚 Wander 400 · 400cc 复古街车',
      'page.desc': '途岚 Wander 400，一台 400cc 复古街车。好骑，好看，2.98 万起。预约试驾，来骑一程。',
      'bar.home': '途岚摩托，回到开头', 'bar.langs': '语言',
      'open.video': '占位视频：城市夜骑，随滚动播放', 'ride.video': '占位视频：山路骑行，随滚动播放',
      'ph.video': '占位视频 · 正式宣传片到后替换', 'ph.tag': '占位', 'ph.value': '数值待填', 'ph.logo': 'logo 占位',
      'ph.link': '预约链接待补',
      'name.brand': '途岚', 'open.l1': '下班以后，', 'open.l2': '绕远一点回家。', 'open.cue': '向下滑动',
      'look.title': '停下来，也好看。', 'ph.side': '棚拍图 · 侧面全车',
      'ph.d1': '棚拍图 · 仪表特写', 'ph.d2': '棚拍图 · 油箱特写', 'ph.d3': '棚拍图 · 座椅特写', 'ph.d4': '棚拍图 · 排气特写',
      'd1.name': '仪表', 'd2.name': '油箱', 'd3.name': '座椅', 'd4.name': '排气', 'd.text': '说明占位，看过棚拍图后补写',
      'ride.title': '比你想的好骑。',
      's1.k': '座高', 's2.k': '整备质量', 's3.k': '最大马力', 's4.k': '最大扭矩', 's3.u': '单位照参数表',
      'ph.front': '棚拍图 · 前 45 度',
      'price.kicker': '你的第一台大排量', 'price.pre': '', 'price.fig': '2.98', 'price.unit': '万起',
      'price.note': '以上市公布价格为准',
      'close.logo': '途岚', 'close.title': '来骑一程。', 'close.text': '好不好骑，坐上去就知道。', 'close.cta': '预约试驾',
      'foot.co': '© 途岚摩托 · 公司全称待补', 'foot.icp': '备案号待补（页面放在官网域名下时需要）'
    },
    en: {
      'page.title': 'Tulan Wander 400 · a 400cc retro street bike',
      'page.desc': 'Tulan Wander 400, a 400cc retro street bike. Easy to ride, good to look at, from ¥29,800. Book a test ride.',
      'bar.home': 'Tulan Motorcycles, back to the start', 'bar.langs': 'Language',
      'open.video': 'Stand-in clip: a night ride through the city, played as you scroll',
      'ride.video': 'Stand-in clip: a ride on a mountain road, played as you scroll',
      'ph.video': 'Stand-in clip · the final film replaces it', 'ph.tag': 'Placeholder', 'ph.value': 'Value to come',
      'ph.logo': 'Logo placeholder', 'ph.link': 'Booking link to come',
      'name.brand': 'Tulan', 'open.l1': 'After work,', 'open.l2': 'take the long way home.', 'open.cue': 'Scroll',
      'look.title': 'Looks just as good standing still.', 'ph.side': 'Studio photo · side view',
      'ph.d1': 'Studio photo · instruments', 'ph.d2': 'Studio photo · fuel tank', 'ph.d3': 'Studio photo · seat',
      'ph.d4': 'Studio photo · exhaust',
      'd1.name': 'Instruments', 'd2.name': 'Fuel tank', 'd3.name': 'Seat', 'd4.name': 'Exhaust',
      'd.text': 'Caption to come, once we have seen the photos',
      'ride.title': 'Easier to ride than you think.',
      's1.k': 'Seat height', 's2.k': 'Curb weight', 's3.k': 'Max power', 's4.k': 'Max torque',
      's3.u': 'unit from the spec sheet',
      'ph.front': 'Studio photo · front three-quarter view',
      'price.kicker': 'Your first big bike', 'price.pre': 'From ¥', 'price.fig': '29,800', 'price.unit': '',
      'price.note': 'Final price as announced at launch',
      'close.logo': 'TULAN', 'close.title': 'Come for a ride.', 'close.text': "You'll know once you're in the saddle.",
      'close.cta': 'Book a test ride',
      'foot.co': '© Tulan Motorcycles · full company name to come',
      'foot.icp': 'ICP number to come (needed on the official domain)'
    }
  };
  var KEY = 'tulan-lang';

  function pick() {
    var asked = new URLSearchParams(location.search).get('lang');
    if (asked && TEXT[asked]) return asked;
    try { var kept = localStorage.getItem(KEY); if (kept && TEXT[kept]) return kept; } catch (e) {}
    return 'zh';
  }

  function setLanguage(lang) {
    var t = TEXT[lang];
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t[el.dataset.i18n]; });
    document.querySelectorAll('[data-i18n-label]').forEach(function (el) { el.setAttribute('aria-label', t[el.dataset.i18nLabel]); });
    document.title = t['page.title'];
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', t['page.desc']);
    document.querySelectorAll('[data-set-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)); });
    try { localStorage.setItem(KEY, lang); } catch (e) {}
  }

  setLanguage(pick());
  document.querySelectorAll('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = new URL(location.href);
      if (url.searchParams.has('lang')) { url.searchParams.set('lang', b.dataset.setLang); history.replaceState(history.state, '', url); }
      setLanguage(b.dataset.setLang);
    });
  });

  // The booking link is a placeholder until the real address arrives: keep the reader where they are.
  document.querySelectorAll('[data-placeholder-link]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });
})();

// Language switch. Classic script, runs before page.js. English is the default; ?lang=zh, or the
// reader's last choice, opens the Chinese original.
(function () {
  var TEXT = {
    zh: {
      'page.title': '我们要结婚了 · 十月二十九日 · 重庆解放碑',
      'page.desc': '二〇二六年十月二十九日上午，重庆解放碑。不用带礼物，带一枝花来就好。',
      'bar.brand': '我们的婚礼', 'bar.nav': '主导航', 'bar.langs': '语言',
      'nav.day': '这一天', 'nav.place': '在哪儿', 'nav.flower': '送花',
      'open.kicker1': '邀请函', 'open.kicker2': '十月二十九日',
      'open.title': '我们要结婚了',
      'open.sub': '二〇二六年十月二十九日，上午，重庆解放碑。',
      'open.link': '先看这一天的安排', 'open.cue': '往下看',
      'cta.flowers': '我要送花',
      'ph.groom': '新郎名字', 'ph.bride': '新娘名字', 'ph.contact': '联系人名字', 'ph.phone': '联系方式',
      'day.eyebrow': '这一天', 'day.t1': '从上午十点，', 'day.t2': '到吃完这顿饭',
      'day.text': '我们想在碑下见你一面。来了先把花放到花台，再找个位置坐下；仪式不长，之后有茶点和午饭。',
      'day.list': '这一天的安排',
      'point1.name': '花台开放', 'point1.note': '先把花放好，我们会替你插上',
      'point2.name': '入场签到', 'point2.note': '在门口写下你的名字',
      'point3.name': '仪式', 'point3.note': '大约二十分钟，站着就好',
      'point4.name': '合影与茶点', 'point4.note': '在碑前拍照，别怕挤',
      'point5.name': '午宴', 'point5.note': '就在旁边，走两步就到',
      'place.eyebrow': '在哪儿', 'place.t1': '解放碑，', 'place.t2': '碑下见',
      'place.text': '重庆市渝中区民族路 177 号，解放碑步行街。轻轨 2 号线临江门站 A 口出来，走六分钟；开车的话停大都会东方广场车库。',
      'place.map': '一张简图：从临江门站 A 口沿民族路步行到解放碑，约六分钟',
      'copy.label': '复制地址', 'copy.done': '已复制', 'copy.ok': '地址已复制', 'copy.fail': '复制失败，请手动选择地址',
      'map.a': '临江门站 A 口', 'map.b': '解放碑', 'map.note': '步行约 6 分钟',
      'flower.eyebrow': '送花', 'flower.t1': '不用带礼物，', 'flower.t2': '带一枝花就好',
      'flower.text': '我们想用大家带来的花，把花台填满。什么花都行，一枝就够；如果你来不了，也可以托朋友带一枝。',
      'card1.name': '挑一枝',
      'card1.text': '路过花店时，挑一枝你看着顺眼的。玫瑰、洋桔梗、一把小雏菊，或者干脆一段带叶子的枝条，都可以。',
      'card2.name': '写一句话',
      'card2.text': '花台上有一叠卡片。写下想对我们说的话，字丑没关系，别写太久，后面的人还等着笔。',
      'card3.name': '放上花台',
      'card3.text': '进门左手边就是花台，交给那儿的朋友。我们会把每一枝都留着，仪式结束后一起带走。',
      'note.label': '来不了？',
      'note.text1': '花可以寄到「重庆市渝中区民族路 177 号」，收件人写',
      'note.text2': '，电话', 'note.text3': '。十月二十八日前寄到，我们替你摆上。',
      'end.t1': '十月二十九日，', 'end.t2': '见',
      'end.text': '有什么想问的，直接找我们。到了找不到地方，也打电话。',
      'end.link': '再看一遍时间',
      'foot.date': '二〇二六年十月二十九日 · 重庆解放碑',
      'foot.note': '这个页面用 Cineview 做成，滚动即时间。'
    },
    en: {
      'page.title': "We're getting married · 29 October · Jiefangbei, Chongqing",
      'page.desc': '29 October 2026, in the morning, at Jiefangbei in Chongqing. No gifts needed; just bring a flower.',
      'bar.brand': 'Our wedding', 'bar.nav': 'Main navigation', 'bar.langs': 'Language',
      'nav.day': 'The day', 'nav.place': 'Where', 'nav.flower': 'Flowers',
      'open.kicker1': 'Invitation', 'open.kicker2': '29 October',
      'open.title': "We're getting married",
      'open.sub': '29 October 2026, in the morning, at Jiefangbei in Chongqing.',
      'open.link': 'See how the day goes', 'open.cue': 'Scroll',
      'cta.flowers': "I'll bring a flower",
      'ph.groom': "Groom's name", 'ph.bride': "Bride's name", 'ph.contact': 'contact name', 'ph.phone': 'contact number',
      'day.eyebrow': 'The day', 'day.t1': 'From ten in the morning,', 'day.t2': 'to the end of lunch',
      'day.text': "We'd like to see you at the monument. Put your flower on the table first, then find a seat; the ceremony is short, with tea and lunch after.",
      'day.list': 'How the day goes',
      'point1.name': 'Flower table opens', 'point1.note': "Leave your flower first; we'll arrange it for you",
      'point2.name': 'Doors and sign-in', 'point2.note': 'Write your name at the door',
      'point3.name': 'Ceremony', 'point3.note': 'About twenty minutes; standing is fine',
      'point4.name': 'Photos and tea', 'point4.note': "Pictures by the monument; don't mind the crowd",
      'point5.name': 'Lunch', 'point5.note': 'Right nearby, a couple of steps away',
      'place.eyebrow': 'Where', 'place.t1': 'Jiefangbei,', 'place.t2': 'meet at the monument',
      'place.text': "177 Minzu Road, Yuzhong District, Chongqing, on the Jiefangbei pedestrian street. From Linjiangmen station, exit A on metro Line 2, it is six minutes on foot; by car, park in the Metropolitan Oriental Plaza garage.",
      'place.map': 'A simple map: from Linjiangmen exit A along Minzu Road to Jiefangbei, about six minutes',
      'copy.label': 'Copy the address', 'copy.done': 'Copied', 'copy.ok': 'Address copied',
      'copy.fail': "Couldn't copy; select the address by hand",
      'map.a': 'Linjiangmen, exit A', 'map.b': 'Jiefangbei', 'map.note': 'About 6 minutes on foot',
      'flower.eyebrow': 'Flowers', 'flower.t1': 'No gifts needed,', 'flower.t2': 'just bring a flower',
      'flower.text': "We'd like to fill the flower table with what everyone brings. Any flower will do, one is enough; if you can't come, ask a friend to bring one.",
      'card1.name': 'Pick one',
      'card1.text': 'On your way, pick one you like the look of. A rose, a lisianthus, a bunch of daisies, or just a leafy stem; any of them is fine.',
      'card2.name': 'Write a line',
      'card2.text': "There's a stack of cards on the table. Write what you'd like to say to us; bad handwriting is fine, just don't take long, others are waiting for the pen.",
      'card3.name': 'Put it on the table',
      'card3.text': "The flower table is on your left as you come in; hand it to the friend there. We'll keep every stem and take them all with us after the ceremony.",
      'note.label': "Can't come?",
      'note.text1': 'You can post flowers to “177 Minzu Road, Yuzhong District, Chongqing”, addressed to ',
      'note.text2': ', phone ',
      'note.text3': ". Send them by 28 October and we'll place them for you.",
      'end.t1': '29 October,', 'end.t2': 'see you',
      'end.text': "If you have a question, just ask us. If you can't find the place, call too.",
      'end.link': 'See the times again',
      'foot.date': '29 October 2026 · Jiefangbei, Chongqing',
      'foot.note': 'This page is made with Cineview; scrolling is time.'
    }
  };
  var KEY = 'wedding-lang';
  var lang = 'en';

  function pick() {
    var asked = new URLSearchParams(location.search).get('lang');
    if (asked && TEXT[asked]) return asked;
    try { var kept = localStorage.getItem(KEY); if (kept && TEXT[kept]) return kept; } catch (e) {}
    return 'en';
  }

  function t(key) { return TEXT[lang][key]; }

  function setLanguage(next) {
    lang = next;
    var words = TEXT[lang];
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = words[el.dataset.i18n]; });
    document.querySelectorAll('[data-i18n-label]').forEach(function (el) { el.setAttribute('aria-label', words[el.dataset.i18nLabel]); });
    document.title = words['page.title'];
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', words['page.desc']);
    document.querySelectorAll('[data-set-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)); });
    try { localStorage.setItem(KEY, lang); } catch (e) {}
  }

  window.weddingLang = { t: t, get lang() { return lang; } };

  setLanguage(pick());
  document.querySelectorAll('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = new URL(location.href);
      if (url.searchParams.has('lang')) { url.searchParams.set('lang', b.dataset.setLang); history.replaceState(history.state, '', url); }
      setLanguage(b.dataset.setLang);
      // The scenes measure their own text; let them re-measure after the swap.
      window.dispatchEvent(new Event('resize'));
    });
  });
})();

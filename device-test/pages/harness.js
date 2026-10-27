// Shared by every device test page. Records errors, cv-error events, frame intervals, the stage's
// ready time and viewport changes, and shows a panel with the page's checks: each one gets
// "OK" or "Problem" plus an optional note, sent to the Mac with the measurements.
//
// A page declares its checks before loading this file:
//   window.DEVICE_TEST = { id: 'scroll', title: '…', checks: [{ id: 'reverse', text: '…' }] };
(function () {
  var test = window.DEVICE_TEST || { id: 'page', title: document.title, checks: [] };
  var params = new URLSearchParams(location.search);
  var session = params.get('session') || localStorage.getItem('device-session') || '';
  if (!session) {
    session = 'device-' + new Date().toISOString().slice(0, 10) + '-' + Math.random().toString(36).slice(2, 6);
  }
  try { localStorage.setItem('device-session', session); } catch (e) {}
  var t0 = performance.now();
  var log = { errors: [], cvErrors: [], viewports: [], events: [] };
  var frames = [];
  var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;

  addEventListener('error', function (e) { log.errors.push(String(e.message || e).slice(0, 200)); });
  addEventListener('unhandledrejection', function (e) { log.errors.push('promise: ' + String(e.reason).slice(0, 200)); });
  document.addEventListener('cv-error', function (e) { log.cvErrors.push(e.detail.code + ': ' + String(e.detail.message).slice(0, 160)); });
  ['cv-enter', 'cv-dragend', 'cv-dragcancel', 'cv-dragblocked', 'cv-timeout'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (log.events.length < 200) log.events.push([Math.round(performance.now() - t0), type, (e.target && e.target.id) || '']);
    });
  });
  var vp = function () {
    var v = window.visualViewport;
    log.viewports.push([Math.round(performance.now() - t0), innerWidth, innerHeight, v ? Math.round(v.height) : null, screen.orientation ? screen.orientation.type : String(window.orientation)]);
    if (log.viewports.length > 60) log.viewports.shift();
  };
  vp();
  addEventListener('resize', vp);

  // Frame intervals while the page moves (the last 4000 gaps).
  var last = 0;
  var tick = function (now) {
    if (last) { frames.push(now - last); if (frames.length > 4000) frames.shift(); }
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  var stats = function () {
    if (!frames.length) return null;
    var s = frames.slice().sort(function (a, b) { return a - b; });
    var q = function (p) { return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))] * 10) / 10; };
    var mean = frames.reduce(function (a, b) { return a + b; }, 0) / frames.length;
    return { n: frames.length, meanHz: Math.round(1000 / mean), p50: q(0.5), p95: q(0.95), max: q(1), over50: frames.filter(function (g) { return g > 50; }).length };
  };

  var ready = null;
  var stage = function () { return document.querySelector('cv-stage'); };
  customElements.whenDefined('cv-stage').then(function () {
    var s = stage();
    if (s && s.ready) s.ready.then(function () { ready = Math.round(performance.now()); });
  });

  // The panel.
  var answers = {};
  var css = document.createElement('style');
  css.textContent =
    '.dt{position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;font:14px/1.4 -apple-system,system-ui,sans-serif;color:#111;background:#fff;border:1px solid #ccc;border-radius:12px;box-shadow:0 6px 24px rgb(0 0 0/.2);max-height:60svh;overflow:auto;touch-action:pan-y}' +
    '.dt[data-closed] .dt-body{display:none}.dt-bar{display:flex;gap:8px;align-items:center;padding:8px 10px}.dt-bar b{flex:1}' +
    '.dt button{font:inherit;padding:6px 10px;border-radius:8px;border:1px solid #bbb;background:#f4f4f4;color:#111}.dt button[aria-pressed=true]{background:#111;color:#fff;border-color:#111}' +
    '.dt-body{padding:0 10px 10px}.dt-check{border-top:1px solid #eee;padding:8px 0}.dt-check p{margin:0 0 6px}.dt-row{display:flex;gap:6px;flex-wrap:wrap}' +
    '.dt textarea{width:100%;box-sizing:border-box;margin-top:6px;font:inherit;min-height:2.6em;border:1px solid #ccc;border-radius:8px;padding:6px}' +
    '.dt-send{margin-top:8px;width:100%;padding:10px!important;background:#1f6feb!important;color:#fff!important;border-color:#1f6feb!important}.dt-status{margin-top:6px;color:#555}';
  document.head.appendChild(css);
  var panel = document.createElement('div');
  panel.className = 'dt';
  panel.setAttribute('data-cv-ignore-drag', '');
  panel.setAttribute('data-closed', '');
  var html = '<div class="dt-bar"><b>' + test.title + '</b><button type="button" class="dt-toggle">检查清单 Checks</button></div><div class="dt-body">';
  test.checks.forEach(function (c, i) {
    html += '<div class="dt-check" data-id="' + c.id + '"><p>' + (i + 1) + '. ' + c.text + '</p><div class="dt-row">' +
      '<button type="button" data-v="ok">正常 OK</button><button type="button" data-v="problem">有问题 Problem</button><button type="button" data-v="skip">没法测 Skip</button></div>' +
      '<textarea placeholder="备注（有问题时写看到了什么） Note"></textarea></div>';
  });
  html += '<button type="button" class="dt-send">提交结果 Send</button><div class="dt-status">会话 Session: ' + session + '</div></div>';
  panel.innerHTML = html;
  var mount = function () { document.body.appendChild(panel); };
  if (document.body) mount(); else addEventListener('DOMContentLoaded', mount);
  panel.querySelector('.dt-toggle').addEventListener('click', function () {
    if (panel.hasAttribute('data-closed')) panel.removeAttribute('data-closed'); else panel.setAttribute('data-closed', '');
  });
  panel.querySelectorAll('.dt-check').forEach(function (row) {
    row.querySelectorAll('[data-v]').forEach(function (b) {
      b.addEventListener('click', function () {
        answers[row.getAttribute('data-id')] = b.getAttribute('data-v');
        row.querySelectorAll('[data-v]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
    });
  });
  var report = function (kind) {
    var notes = {};
    panel.querySelectorAll('.dt-check').forEach(function (row) {
      var v = row.querySelector('textarea').value.trim();
      if (v) notes[row.getAttribute('data-id')] = v;
    });
    var s = stage();
    return {
      session: session, kind: kind, test: test.id, page: location.pathname + location.search,
      answers: answers, notes: notes, frames: stats(), readyMs: ready,
      navigation: nav ? nav.type : null, dpr: devicePixelRatio, lang: document.documentElement.lang,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      stage: s ? { input: s.input, current: s.current, scrollY: Math.round(scrollY) } : null,
      errors: log.errors, cvErrors: log.cvErrors, viewports: log.viewports, events: log.events,
      extra: window.DEVICE_EXTRA ? window.DEVICE_EXTRA() : null,
    };
  };
  var send = function (body, done) {
    var x = new XMLHttpRequest();
    x.open('POST', '/report');
    x.setRequestHeader('content-type', 'application/json');
    x.onload = function () { done && done(x.status === 200); };
    x.onerror = function () { done && done(false); };
    x.send(JSON.stringify(body));
  };
  panel.querySelector('.dt-send').addEventListener('click', function () {
    var status = panel.querySelector('.dt-status');
    status.textContent = '提交中… Sending';
    send(report('answers'), function (ok) {
      status.textContent = ok ? '已提交，可以回到目录 Sent ✓' : '提交失败，请确认 Mac 上的服务还在运行 Not sent';
    });
  });
  // An automatic report too, so measurements arrive even without answers (6 s in, and on leaving).
  setTimeout(function () { send(report('auto')); }, 6000);
  addEventListener('pagehide', function () {
    try { navigator.sendBeacon('/report', new Blob([JSON.stringify(report('leave'))], { type: 'application/json' })); } catch (e) {}
  });
  window.DEVICE_REPORT = report;
})();

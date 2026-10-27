// Documentation examples: `?lang=zh` swaps each element's text for its data-zh value (and
// aria-label for data-zh-label) before the framework module runs; English otherwise.
(function () {
  var zh = new URLSearchParams(location.search).get('lang') === 'zh';
  document.documentElement.lang = zh ? 'zh-CN' : 'en';
  if (!zh) return;
  document.querySelectorAll('[data-zh]').forEach(function (el) {
    el.textContent = el.getAttribute('data-zh');
  });
  document.querySelectorAll('[data-zh-label]').forEach(function (el) {
    el.setAttribute('aria-label', el.getAttribute('data-zh-label'));
  });
})();

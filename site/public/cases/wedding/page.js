// Wedding invitation. The timeline is declared in the markup; this file only does the
// page-owned parts: copying the address, hiding the scroll hint, and reporting cv-error.
const stage = document.getElementById('invite');

// Every cv-error is a mistake in the page; surface it while developing.
stage.addEventListener('cv-error', (event) => {
  console.warn('[cineview]', event.detail.code, event.detail.message);
});

// The "scroll down" hint is only useful before the first scroll.
{
  const hint = document.getElementById('scroll-hint');
  const hide = () => {
    if (!hint || hint.hidden) return;
    hint.hidden = true;
  };
  window.addEventListener('scroll', hide, { once: true, passive: true });
  window.addEventListener('wheel', hide, { once: true, passive: true });
  window.addEventListener('touchmove', hide, { once: true, passive: true });
  window.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'PageDown', ' ', 'End'].includes(e.key)) hide();
  });
}

// Read progress, painted on the top bar. The runtime's page-source timeline does not
// attach in this build, so the bar is driven here instead of by a cv-animate.
{
  const fill = document.getElementById('progress-fill');
  let queued = false;

  const paint = () => {
    queued = false;
    if (!fill) return;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    fill.style.transform = `scaleX(${ratio.toFixed(4)})`;
  };

  paint();
  window.addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(paint);
    },
    { passive: true }
  );
  window.addEventListener('resize', paint, { passive: true });
}

// Copy the venue address, with a fallback for browsers without the async clipboard.
{  const ADDRESS = '重庆市渝中区民族路177号 解放碑步行街';
  const button = document.getElementById('copy-addr');
  const label = document.getElementById('copy-label');
  const status = document.getElementById('copy-status');

  const announce = (text) => {
    if (!status) return;
    status.textContent = text;
    window.clearTimeout(announce.timer);
    announce.timer = window.setTimeout(() => {
      status.textContent = '';
    }, 2600);
  };

  button?.addEventListener('click', async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(ADDRESS);
      } else {
        const field = document.createElement('textarea');
        field.value = ADDRESS;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.append(field);
        field.select();
        document.execCommand('copy');
        field.remove();
      }
      if (label) label.textContent = '已复制';
      announce('地址已复制');
    } catch {
      announce('复制失败，请手动选择地址');
    }
  });
}

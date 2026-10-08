// Author-side heavy content for gate fixture (c): a 2D canvas particle field and a looping video.
// Shared by the 1.x (React) and 2.0 (custom elements) versions so the per-scene work is identical.
export const VIDEO_URL = '/@fs/Users/alienmu/Documents/alien/cineView/cineview/site/public/act3-edit.mp4';

export function startParticles(canvas, count = 600) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = (canvas.width = Math.round(canvas.clientWidth * dpr));
  const h = (canvas.height = Math.round(canvas.clientHeight * dpr));
  const p = Array.from({ length: count }, (_, i) => ({ x: (i * 97) % w, y: (i * 57) % h, vx: ((i % 7) - 3) * 0.4, vy: ((i % 5) - 2) * 0.4 }));
  let raf = 0;
  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,220,160,.85)';
    for (const q of p) {
      q.x = (q.x + q.vx + w) % w;
      q.y = (q.y + q.vy + h) % h;
      ctx.fillRect(q.x, q.y, 3 * dpr, 3 * dpr);
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(raf);
}

export function attachVideo(video) {
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.src = VIDEO_URL;
  void video.play().catch(() => {});
  return () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
  };
}

/** Static DOM weight per scene (copy blocks), used to calibrate 1.x entry long frames. */
export function copyBlock(n) {
  let html = '';
  for (let i = 0; i < n; i++) html += `<p style="margin:4px 0;font:14px/1.4 system-ui;color:#eee">Paragraph ${i} — cinematic copy with <b>emphasis</b> and <i>style</i>.</p>`;
  return html;
}

const endpoint = 'http://127.0.0.1:9223/json';
const tabs = await fetch(endpoint).then((r) => r.json());
const pageTarget = tabs.find((target) => target.type === 'page' && target.url.includes('/?debugScrollTakeover=1')) ?? tabs.find((target) => target.type === 'page');
if (!pageTarget) throw new Error('No page target');
const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();
const consoleEvents = [];
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.consoleAPICalled') {
    const args = message.params.args?.map((arg) => arg.value ?? arg.description ?? arg.type) ?? [];
    const text = args.join(' ');
    if (text.includes('cineview-scroll-takeover')) {
      consoleEvents.push(text);
    }
  }
});
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
await send('Runtime.enable');
await send('Page.enable');
await send('Input.setIgnoreInputEvents', { ignore: false });
await send('Page.bringToFront');
await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
async function evalValue(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function wheel(deltaY) {
  await send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: 420,
    y: 420,
    deltaX: 0,
    deltaY,
    pointerType: 'mouse',
  });
}
const snapshotExpr = `(() => {
  const root = document.querySelector('[data-cineview-container="true"]');
  const round = (value) => Math.round(value * 100) / 100;
  const shells = Array.from(document.querySelectorAll('[data-cineview-takeover-shell]')).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      index: el.getAttribute('data-cineview-takeover-shell'),
      activeZone: el.getAttribute('data-cineview-takeover-active-zone'),
      progressPx: Number(el.getAttribute('data-cineview-takeover-progress-px') || NaN),
      totalBudgetPx: Number(el.getAttribute('data-cineview-takeover-total-budget-px') || NaN),
      captureOffset: Number(el.getAttribute('data-cineview-takeover-capture-offset') || NaN),
      visualOffset: Number(el.getAttribute('data-cineview-takeover-visual-offset') || 0),
      viewportOffset: Number(el.getAttribute('data-cineview-takeover-viewport-offset') || NaN),
      top: round(r.top),
      bottom: round(r.bottom),
      transform: getComputedStyle(el).transform,
    };
  });
  const logs = window.__CINEVIEW_SCROLL_TAKEOVER_LOGS__ ?? [];
  return {
    href: location.href,
    scrollTop: root?.scrollTop ?? null,
    maxScrollTop: root ? root.scrollHeight - root.clientHeight : null,
    logCount: logs.length,
    lastLogs: logs.slice(-8),
    shells,
  };
})()`;
async function snap(label) {
  return { label, ...(await evalValue(snapshotExpr)), consoleTail: consoleEvents.slice(-5) };
}
const output = [];
output.push(await snap('initial'));
for (let i = 0; i < 90; i += 1) {
  await wheel(900);
  await new Promise((resolve) => setTimeout(resolve, 70));
  const s = await snap(`forward-${i + 1}`);
  if (i % 5 === 0 || s.scrollTop >= s.maxScrollTop - 2) output.push(s);
  if (s.scrollTop >= s.maxScrollTop - 2) break;
}
output.push(await snap('after-forward'));
for (let i = 0; i < 18; i += 1) {
  await wheel(-900);
  await new Promise((resolve) => setTimeout(resolve, 90));
  output.push(await snap(`reverse-${i + 1}`));
}
console.log(JSON.stringify({ output, consoleEventsTail: consoleEvents.slice(-40) }, null, 2));
ws.close();

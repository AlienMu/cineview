import { measure } from '../harness.mjs';
const s = await measure({ impl: 'v1-heavy', trace: true, debug: true, timeoutMs: 90000, config: { mode: 'drag', scenes: 20, animations: 16, copy: 40 } });
console.log(s.hang ? 'HANG' : JSON.stringify({ hz: s.hz, p95: s.p95, loaf50: s.loaf50, loafMax: s.loafMax, readyMs: s.readyMs }));

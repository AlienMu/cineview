// Real-device test server: serves the test pages, the built runtime (dist) and the clip on the
// Mac's private network, and appends each report a phone posts to results/<session>.jsonl.
//
//   node device-test/serve.mjs            then open the printed address on the phone
//
// Run `node build.mjs` first so the runtime is current.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { appendFile, mkdir, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(here, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
// URL prefix -> directory. Everything else is a test page.
const MOUNTS = [
  ['/v2/', resolve(root, 'dist')],
  ['/media/', resolve(root, 'site/public')],
  ['/', resolve(here, 'pages')],
];

/** The Mac's private IPv4 address (192.168/10/172.16-31), or 127.0.0.1. */
export function lanAddress() {
  for (const list of Object.values(networkInterfaces()))
    for (const a of list ?? [])
      if (a.family === 'IPv4' && !a.internal && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(a.address)) return a.address;
  return '127.0.0.1';
}

export function startDeviceServer(port = 4368, host = lanAddress()) {
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (req.method === 'POST' && path === '/report') {
        let body = '';
        for await (const part of req) body += part;
        const report = JSON.parse(body);
        const session = String(report.session ?? 'device').replace(/[^\w-]/g, '').slice(0, 60) || 'device';
        await mkdir(resolve(here, 'results'), { recursive: true });
        await appendFile(resolve(here, 'results', `${session}.jsonl`), JSON.stringify({ at: new Date().toISOString(), ua: req.headers['user-agent'], ...report }) + '\n');
        res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
        return;
      }
      const [prefix, dir] = MOUNTS.find(([p]) => path.startsWith(p));
      let file = resolve(dir, path.slice(prefix.length) || 'index.html');
      if (!file.startsWith(dir + sep) && file !== dir) return void res.writeHead(403).end();
      let info = await stat(file).catch(() => null);
      if (info?.isDirectory()) info = await stat((file = resolve(file, 'index.html'))).catch(() => null);
      if (!info?.isFile()) return void res.writeHead(404).end('not found');
      const headers = { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store', 'accept-ranges': 'bytes' };
      const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '');
      if (range) {
        const start = Number(range[1]);
        const end = Math.min(range[2] ? Number(range[2]) : info.size - 1, info.size - 1);
        if (start > end) return void res.writeHead(416).end();
        res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${info.size}`, 'content-length': end - start + 1 });
        createReadStream(file, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { ...headers, 'content-length': info.size });
        createReadStream(file).pipe(res);
      }
    } catch (e) {
      res.writeHead(500).end(String(e));
    }
  });
  server.listen(port, host, () => console.log(`Device tests: http://${host}:${port}/  (results in device-test/results/)`));
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) startDeviceServer();

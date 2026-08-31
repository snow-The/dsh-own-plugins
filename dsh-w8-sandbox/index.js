// dsh-w8-sandbox server entry: serves the w8 sandbox demo iframe page
// and a small state API (reads kb/catalog/w8.sqlite when present).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const name = '@snow-the/dsh-w8-sandbox';
export const inject = ['web-server'];

const KB = join(process.env.USERPROFILE || '.', 'source', 'repos', 'w8', 'kb');
const send = (res, type, body) => { res.writeHead(200, { 'content-type': type }); res.end(body); };

export const apply = (ctx) => {
  const ws = ctx.webServer;
  if (!ws) return;
  const web = new URL('./web/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const read = (f) => { try { return readFileSync(join(web, f), 'utf8'); } catch { return null; } };
  ws.register({ kind: 'exact', path: '/w8', handler: (_req, res) => { res.writeHead(302, { location: '/w8/' }); res.end(); } });
  ws.register({ kind: 'exact', path: '/w8/', handler: async (_req, res) => { const h = read('sandbox.html'); if (h == null) { res.writeHead(404); res.end('sandbox.html missing'); return; } send(res, 'text/html; charset=utf-8', h); } });
    ws.register({ kind: 'exact', path: '/w8/state', handler: (_req, res) => {
    // lightweight: count rows of kb/data CSVs (no native sqlite dependency)
    const rows = (f) => { try { const t = readFileSync(join(KB, 'data', f), 'utf8'); return Math.max(0, t.split(/\r?\n/).filter(l => l.trim()).length - 1); } catch { return -1; } };
    const st = { books: rows('books.csv'), assets: rows('assets.csv'), resources: rows('resources.csv') };
    send(res, 'application/json', JSON.stringify(st));
  } });
};

function awaitImport(m) { return import(m); }

#!/usr/bin/env node
/**
 * 修复【活跃】的 dsh-session-handoff 副本：
 *   C:\Users\snow\source\repos\dsh-session-handoff  (v0.18.13，被 profile 硬链接安装)
 * 与 _p0/apply.mjs 同样的规则，但针对这个真实路径。
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'C:\\Users\\snow\\source\\repos\\dsh-session-handoff';
const PKG = path.join(DIR, 'package.json');
const WRITE = process.argv.includes('--write');
const STAMP = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const FLOOR = '>=0.2.0-rc.1';
const DEAD = '@deepseek-ai/dsh-client-runtime';

const raw = fs.readFileSync(PKG, 'utf8');
const pkg = JSON.parse(raw);

// --- 先扫它实际 value-import 的官方包 ---
const official = new Set();
const walk = (d, depth = 0) => {
  if (depth > 5) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build'].includes(e.name)) continue;
      walk(path.join(d, e.name), depth + 1);
    } else if (/\.(ts|tsx|js|mjs|cjs)$/.test(e.name)) {
      const t = fs.readFileSync(path.join(d, e.name), 'utf8');
      for (const m of t.matchAll(/(?:from|require\()\s*['"](@deepseek-ai\/[^'"]+)['"]/g)) official.add(m[1]);
    }
  }
};
walk(DIR);

const wanted = ['@deepseek-ai/dsh', ...[...official].filter((s) => s === '@deepseek-ai/dsh' || s.startsWith('@deepseek-ai/dsh-') || s === '@deepseek-ai/cordis').filter((s) => s !== '@deepseek-ai/dsh')].sort();

console.log(`  扫描到官方 value-import: ${[...official].sort().join(', ') || '(无)'}`);
console.log(`  将声明 peer: ${wanted.join(', ')}\n`);

// --- (a) peers ---
const peers = { ...(pkg.peerDependencies || {}) };
for (const n of wanted) peers[n] = FLOOR;
pkg.peerDependencies = Object.fromEntries(Object.entries(peers).sort(([a], [b]) => a.localeCompare(b)));

// --- (b) compatibility ---
pkg.dsh = pkg.dsh || {};
if (!pkg.dsh.compatibility) {
  pkg.dsh.compatibility = { dshReleases: ['0.2.0-rc.1', '0.2.0-rc.2'], verifiedAgainst: '0.2.0-rc.2' };
}

// --- (c) 删消亡包 ---
const before = [...(pkg.dsh.client?.inject || [])];
if (before.includes(DEAD)) pkg.dsh.client.inject = before.filter((x) => x !== DEAD);

const text = JSON.stringify(pkg, null, 2) + '\n';
console.log(`  peers      : ${Object.keys(JSON.parse(raw).peerDependencies || {}).length} → ${Object.keys(pkg.peerDependencies).length}`);
console.log(`  compat     : ${Boolean(JSON.parse(raw).dsh?.compatibility)} → true`);
console.log(`  inject     : ${JSON.stringify(before)}`);
console.log(`            → ${JSON.stringify(pkg.dsh.client.inject)}`);

if (!WRITE) { console.log('\n  (干跑 —— 未写入。加 --write 执行)'); process.exit(0); }

const bak = `${PKG}.p0-backup-${STAMP}`;
fs.copyFileSync(PKG, bak);
fs.writeFileSync(PKG, text, 'utf8');
const check = JSON.parse(fs.readFileSync(PKG, 'utf8'));
if (!check.peerDependencies || !check.dsh?.compatibility || check.dsh.client.inject.includes(DEAD)) {
  fs.copyFileSync(bak, PKG);
  throw new Error('写后校验失败，已回滚');
}
console.log(`\n  ✓ 已写入。备份: ${path.basename(bak)}`);
console.log(`  校验: peers=${Object.keys(check.peerDependencies).length} compat=${Boolean(check.dsh.compatibility)} inject=${JSON.stringify(check.dsh.client.inject)}`);

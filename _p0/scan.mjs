#!/usr/bin/env node
/**
 * P0 只读侦察 v2：修正 monorepo 根导致的提前 return。
 * 不改任何文件。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
const ROOTS = [
  path.join(HOME, '.dsh-starter', 'plugins'),
  path.join(HOME, 'dsh-session-handoff'),
];
const OFFICIAL = '@deepseek-ai/';
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.turbo', 'coverage', 'refs', '.rlab']);

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }

function collectSources(dir, depth = 0, acc = []) {
  if (depth > 7) return acc;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
      collectSources(path.join(dir, e.name), depth + 1, acc);
    } else if (/\.(ts|tsx|js|mjs|cjs|jsx)$/.test(e.name)) {
      acc.push(path.join(dir, e.name));
    }
  }
  return acc;
}

/** 找所有 @snow-the/* 清单；monorepo 根（非 @snow-the）继续下探 */
function findPlugins(dir, depth, out) {
  if (depth > 4) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  const pkgPath = path.join(dir, 'package.json');
  if (entries.some((e) => e.isFile() && e.name === 'package.json')) {
    const j = readJson(pkgPath);
    if (j && String(j.name || '').startsWith('@snow-the/')) {
      out.push({ dir, pkgPath, pkg: j });
      return; // 叶子，不再下探
    }
    // 非 @snow-the 的清单（monorepo 根 / 工具包）→ 继续下探
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
    findPlugins(path.join(dir, e.name), depth + 1, out);
  }
}

const plugins = [];
const seen = new Set();
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  const found = [];
  findPlugins(root, 0, found);
  for (const f of found) { if (!seen.has(f.pkgPath)) { seen.add(f.pkgPath); plugins.push(f); } }
}

const rows = [];
for (const { dir, pkgPath, pkg } of plugins) {
  const files = collectSources(dir);
  const valueImports = new Set();
  const typeImports = new Set();
  const ctxServices = new Set();
  const deadRefs = new Set();

  const importRe = /(?:from|require\()\s*['"](@deepseek-ai\/[^'"]+)['"]/g;
  const typeImportRe = /import\s+type\s+[^;]*?from\s*['"](@deepseek-ai\/[^'"]+)['"]/g;
  const ctxRe = /\bctx\.([a-zA-Z][a-zA-Z0-9_]*)/g;

  for (const f of files) {
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
    if (text.length > 3_000_000) continue;
    for (const m of text.matchAll(importRe)) valueImports.add(m[1]);
    for (const m of text.matchAll(typeImportRe)) typeImports.add(m[1]);
    for (const m of text.matchAll(ctxRe)) ctxServices.add(m[1]);
  }

  // 清单自身所有字符串值里是否引用消亡包
  const flat = JSON.stringify(pkg);
  if (flat.includes('dsh-client-runtime')) deadRefs.add('dsh-client-runtime');

  const peers = { ...(pkg.peerDependencies || {}) };
  const deps = { ...(pkg.dependencies || {}) };
  const officialPeers = Object.keys(peers).filter((k) => k === `${OFFICIAL}dsh` || k.startsWith(`${OFFICIAL}dsh-`));
  const nonOfficialPeers = Object.keys(peers).filter((k) => !officialPeers.includes(k));
  const officialImports = [...valueImports].filter((s) => s.startsWith(OFFICIAL)).sort();
  const officialTypes = [...typeImports].filter((s) => s.startsWith(OFFICIAL)).sort();
  const officialDeps = Object.keys(deps).filter((k) => k === `${OFFICIAL}dsh` || k.startsWith(`${OFFICIAL}dsh-`));

  rows.push({
    name: pkg.name, version: pkg.version, dir, pkgPath,
    private: Boolean(pkg.private),
    fileCount: files.length,
    officialPeers, nonOfficialPeers, officialDeps,
    officialImports, officialTypes,
    clientInject: pkg.dsh?.client?.inject || null,
    dshKeys: Object.keys(pkg.dsh || {}),
    hasCompatField: Boolean(pkg.dsh?.compatibility),
    ctxServices: [...ctxServices].sort(),
    deadRefs: [...deadRefs],
    hasBuild: Boolean(pkg.scripts?.build),
    hasTest: Boolean(pkg.scripts?.test),
  });
}

rows.sort((a, b) => a.name.localeCompare(b.name));
const outDir = path.join(HOME, '.dsh-starter', 'refs', 'analysis', '_p0');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'scan.json'), JSON.stringify(rows, null, 2), 'utf8');

const R = (s) => String(s).replace(OFFICIAL, '');
const L = [];
L.push(`# P0 侦察 v2：${rows.length} 个自研插件\n`);
L.push('| 插件 | 版本 | 文件 | 官方 peer | 非官方 peer | dsh.compatibility | client.inject | 消亡包 |');
L.push('|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  L.push(`| ${r.name}@${r.version} | | ${r.fileCount} | ${r.officialPeers.length ? r.officialPeers.map(R).join(', ') : '**无**'} | ${r.nonOfficialPeers.length ? r.nonOfficialPeers.map(R).join(', ') : '—'} | ${r.hasCompatField ? '有' : '**无**'} | ${r.clientInject ? r.clientInject.map(R).join(', ') : '—'} | ${r.deadRefs.length ? '⚠️ ' + r.deadRefs.join(',') : '—'} |`);
}

L.push('\n## 逐插件明细\n');
for (const r of rows) {
  L.push(`### ${r.name}@${r.version}`);
  L.push(`- \`${r.dir}\`  (${r.fileCount} 源文件)`);
  L.push(`- value import: ${r.officialImports.length ? r.officialImports.join(', ') : '（无）'}`);
  L.push(`- type import : ${r.officialTypes.length ? r.officialTypes.join(', ') : '（无）'}`);
  L.push(`- deps 官方包 : ${r.officialDeps.length ? r.officialDeps.join(', ') : '（无）'}`);
  L.push(`- peers 官方包: ${r.officialPeers.length ? r.officialPeers.join(', ') : '（无）'}`);
  L.push(`- peers 其它  : ${r.nonOfficialPeers.length ? r.nonOfficialPeers.join(', ') : '（无）'}`);
  L.push(`- dsh.* 键    : ${r.dshKeys.length ? r.dshKeys.join(', ') : '（无）'}`);
  L.push(`- ctx.* 用到  : ${r.ctxServices.length ? r.ctxServices.join(', ') : '（无）'}`);
  if (r.deadRefs.length) L.push(`- ⚠️ **引用已消亡包**: ${r.deadRefs.join(', ')}`);
  L.push('');
}

L.push('## 汇总\n');
L.push(`- 插件总数: **${rows.length}**`);
L.push(`- 零官方 peer: **${rows.filter((r) => r.officialPeers.length === 0).length}**`);
L.push(`- 无 dsh.compatibility: **${rows.filter((r) => !r.hasCompatField).length}**`);
const dead = rows.filter((r) => r.deadRefs.length);
L.push(`- 引用 dsh-client-runtime: **${dead.length}** — ${dead.map((r) => r.name).join(', ') || '（无）'}`);
L.push(`- 有 build 脚本: ${rows.filter((r) => r.hasBuild).length} / 有 test 脚本: ${rows.filter((r) => r.hasTest).length}`);

const md = L.join('\n');
fs.writeFileSync(path.join(outDir, 'scan.md'), md, 'utf8');
console.log(md);

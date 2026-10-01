#!/usr/bin/env node
/**
 * 审计并修复：peerDependencies 的 key 必须是【包名】，不能带子路径。
 * 判据：@scope/name 之后不应再有 "/"。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
const WRITE = process.argv.includes('--write');
const STAMP = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const DIRS = [
  ...fs.readdirSync(path.join(HOME, '.dsh-starter', 'plugins'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== '_p0')
    .map((e) => path.join(HOME, '.dsh-starter', 'plugins', e.name)),
  path.join(HOME, 'dsh-session-handoff'),
  path.join(HOME, 'source', 'repos', 'dsh-session-handoff'),
];

/** 合法包名：@scope/name 或 name，之后不能再有 / */
const isValidPkgName = (n) => /^(?:@[^/]+\/)?[^/@]+$/.test(n);

let bad = 0, fixed = 0;
const report = [];

for (const dir of DIRS) {
  const p = path.join(dir, 'package.json');
  if (!fs.existsSync(p)) continue;
  let raw, pkg;
  try { raw = fs.readFileSync(p, 'utf8'); pkg = JSON.parse(raw); } catch { continue; }
  const peers = pkg.peerDependencies || {};
  const offenders = Object.keys(peers).filter((k) => !isValidPkgName(k));
  if (offenders.length === 0) continue;

  bad++;
  console.log(`  [${WRITE ? '修' : '待修'}] ${pkg.name}@${pkg.version}`);
  const next = { ...peers };
  for (const o of offenders) {
    const pkgName = o.split('/').slice(0, 2).join('/'); // @scope/name
    console.log(`         ${JSON.stringify(o)}`);
    console.log(`      →  ${JSON.stringify(pkgName)}`);
    delete next[o];
    if (!Object.hasOwn(next, pkgName)) next[pkgName] = peers[o];
    fixed++;
  }
  pkg.peerDependencies = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
  if (WRITE) {
    const bak = `${p}.p0pkgname-backup-${STAMP}`;
    fs.copyFileSync(p, bak);
    fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    const chk = JSON.parse(fs.readFileSync(p, 'utf8'));
    const still = Object.keys(chk.peerDependencies).filter((k) => !isValidPkgName(k));
    if (still.length) { fs.copyFileSync(bak, p); throw new Error(`回滚 ${pkg.name}: 仍有非法 key`); }
  }
  report.push(pkg.name);
}

console.log(`\n  含非法 peer key 的插件: ${bad} | 修正条目: ${fixed}`);
if (WRITE && bad) console.log(`  已修: ${report.join(', ')}`);

// 终局审计：全部清单的 peer key 是否都合法
console.log('\n=== 终局审计：所有清单的 peer key ===');
let total = 0, illegal = 0;
for (const dir of DIRS) {
  const p = path.join(dir, 'package.json');
  if (!fs.existsSync(p)) continue;
  let pkg; try { pkg = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
  const keys = Object.keys(pkg.peerDependencies || {});
  const off = keys.filter((k) => !isValidPkgName(k));
  total += keys.length; illegal += off.length;
  if (keys.length) console.log(`  ${pkg.name.padEnd(38)} ${keys.length} peer  ${off.length ? '❌ ' + off.join(',') : '✓'}`);
}
console.log(`\n  合计 peer 条目 ${total} | 非法 ${illegal}`);

#!/usr/bin/env node
/**
 * 验证：用【宿主自己的 evaluatePluginCompatibility】跑全部 20 个真实 package.json。
 * 这是唯一能证明"插件不会被静默禁用"的方法。
 * 同时对照原备份，量化本次变更。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const HOME = os.homedir();
const NM = path.join(HOME, 'AppData', 'Local', 'npm-cache', '_npx', '7eff65a5cfe9d1d1', 'node_modules');
const A = path.join(NM, '@deepseek-ai');

const boot = await import(pathToFileURL(path.join(A, 'dsh-app-boot', 'lib', 'index.js')).href);
const evaluate = boot.evaluatePluginCompatibility;

const RT = '0.2.0-rc.2';
const PLUGINS_DIR = path.join(HOME, '.dsh-starter', 'plugins');

function findManifests(dir, depth, out) {
  if (depth > 4) return out;
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  if (entries.some((e) => e.isFile() && e.name === 'package.json')) {
    const p = path.join(dir, 'package.json');
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (String(j.name || '').startsWith('@snow-the/')) { out.push({ dir, p, j }); return out; }
    } catch {}
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (['node_modules', '.git', 'dist', 'build', '.rlab', 'refs'].includes(e.name) || e.name.startsWith('.')) continue;
    findManifests(path.join(dir, e.name), depth + 1, out);
  }
  return out;
}

const targets = findManifests(PLUGINS_DIR, 0, []);
const shDir = path.join(HOME, 'dsh-session-handoff');
if (fs.existsSync(path.join(shDir, 'package.json'))) {
  targets.push({ dir: shDir, p: path.join(shDir, 'package.json'), j: JSON.parse(fs.readFileSync(path.join(shDir, 'package.json'), 'utf8')) });
}
targets.sort((a, b) => a.j.name.localeCompare(b.j.name));

let pass = 0, fail = 0, deadLeft = 0;
const deadNames = ['@deepseek-ai/dsh-client-runtime'];

console.log('=== 宿主 app-boot 判定（runtimeVersion 由它自己的 package.json 决定）===');
console.log(`  runtimeVersion = ${RT}\n`);
console.log('  插件'.padEnd(42) + '官方peer  ' + '宿主判定');
console.log('  ' + '-'.repeat(78));
for (const { j } of targets) {
  const off = Object.keys(j.peerDependencies || {}).filter((k) => k === '@deepseek-ai/dsh' || k.startsWith('@deepseek-ai/dsh-'));
  const res = evaluate(j, {}, RT);
  const ok = res === undefined;
  if (ok) pass++; else fail++;
  // client.inject 里是否还有消亡包
  const inj = j.dsh?.client?.inject || [];
  const bad = inj.filter((x) => deadNames.includes(x));
  if (bad.length) deadLeft++;
  console.log(
    '  ' + `${j.name}@${j.version}`.padEnd(40) +
    String(off.length).padStart(4) + '     ' +
    (ok ? 'PASS 不会被禁用' : 'FAIL ' + JSON.stringify(res.peers)) +
    (bad.length ? `   ⚠️ inject 仍含消亡包: ${bad.join(',')}` : '')
  );
}

console.log('\n  ' + '-'.repeat(78));
console.log(`  插件总数 ${targets.length} | 宿主判定 PASS ${pass} | FAIL ${fail} | inject 仍含消亡包 ${deadLeft}`);

// ---- 对照备份，量化变更 ----
console.log('\n=== 与写入前备份的差异量化 ===');
let totalPeersBefore = 0, totalPeersAfter = 0, compatBefore = 0, compatAfter = 0, injectChanged = 0;
for (const { dir } of targets) {
  const baks = fs.readdirSync(dir).filter((f) => f.startsWith('package.json.p0-backup-'));
  if (!baks.length) continue;
  const before = JSON.parse(fs.readFileSync(path.join(dir, baks[0]), 'utf8'));
  const after = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const pb = Object.keys(before.peerDependencies || {}).filter((k) => k === '@deepseek-ai/dsh' || k.startsWith('@deepseek-ai/dsh-')).length;
  const pa = Object.keys(after.peerDependencies || {}).filter((k) => k === '@deepseek-ai/dsh' || k.startsWith('@deepseek-ai/dsh-')).length;
  totalPeersBefore += pb; totalPeersAfter += pa;
  if (before.dsh?.compatibility) compatBefore++;
  if (after.dsh?.compatibility) compatAfter++;
  if (JSON.stringify(before.dsh?.client?.inject) !== JSON.stringify(after.dsh?.client?.inject)) {
    injectChanged++;
    console.log(`  inject 变更: ${after.name}`);
    console.log(`    前: ${JSON.stringify(before.dsh?.client?.inject)}`);
    console.log(`    后: ${JSON.stringify(after.dsh?.client?.inject)}`);
  }
}
console.log(`\n  官方 peer 声明总数 : ${totalPeersBefore} → ${totalPeersAfter}`);
console.log(`  有 dsh.compatibility: ${compatBefore} → ${compatAfter}`);
console.log(`  client.inject 被修正: ${injectChanged} 个插件`);

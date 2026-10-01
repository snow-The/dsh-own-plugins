#!/usr/bin/env node
/**
 * 用【宿主自己的 semver 与它自己的 evaluatePluginCompatibility】验证声明是否安全。
 * 这是写入前唯一会致命的假设：范围不满足 → 20 个插件全部被禁用。
 */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const NM = path.join(os.homedir(), 'AppData', 'Local', 'npm-cache', '_npx', '7eff65a5cfe9d1d1', 'node_modules');
const A = path.join(NM, '@deepseek-ai');

const semver = (await import(pathToFileURL(path.join(NM, 'semver', 'index.js')).href)).default;

// 宿主自己的实现
const boot = await import(pathToFileURL(path.join(A, 'dsh-app-boot', 'lib', 'index.js')).href);
const evaluate = boot.evaluatePluginCompatibility;

console.log('=== 宿主 app-boot 的 runtimeVersion（它会拿来比对所有 peer）===');
const bootPkg = JSON.parse((await import('node:fs')).readFileSync(path.join(A, 'dsh-app-boot', 'package.json'), 'utf8'));
console.log(`  dsh-app-boot version = ${bootPkg.version}`);

const RUNTIMES = ['0.1.7-rc.2', '0.1.8', '0.2.0-rc.1', '0.2.0-rc.2', '0.2.0-rc.3', '0.2.0', '0.2.1', '0.3.0'];
const RANGES = [
  ['>=0.2.0-rc.1', '新声明（本次要写入的）'],
  ['>=0.2.0-rc.2', '若把下界钉死在实测版本'],
  ['^0.2.0-rc.1', '插入符（隐含上界 <0.3.0）'],
  ['>=0.1.1-rc.2 <0.2.0', 'busyloop 原范围'],
  ['>=0.1.0-rc.6', 'skill-pack 原范围'],
];

console.log('\n=== semver.satisfies(runtime, range, { includePrerelease: true }) —— 宿主 :300 用的正是这个 ===');
const w = 22;
process.stdout.write('  ' + 'range'.padEnd(w));
for (const r of RUNTIMES) process.stdout.write(r.padStart(13));
console.log();
for (const [range, note] of RANGES) {
  process.stdout.write('  ' + range.padEnd(w));
  for (const r of RUNTIMES) {
    const ok = semver.satisfies(r, range, { includePrerelease: true });
    process.stdout.write((ok ? 'PASS' : 'fail').padStart(13));
  }
  console.log(`   ${note}`);
}

console.log('\n=== 用宿主自己的 evaluatePluginCompatibility 端到端验证一个真清单 ===');
const manifest = {
  name: '@snow-the/dsh-search',
  version: '0.5.1',
  peerDependencies: {
    '@deepseek-ai/dsh': '>=0.2.0-rc.1',
    '@deepseek-ai/dsh-tools': '>=0.2.0-rc.1',
  },
};
for (const rt of ['0.2.0-rc.2', '0.2.0', '0.3.0', '0.1.7-rc.2']) {
  const res = evaluate(manifest, {}, rt);
  console.log(`  runtime ${rt.padEnd(12)} → ${res === undefined ? 'PASS（无冲突，不会被禁用）' : 'FAIL: ' + JSON.stringify(res.peers)}`);
}

console.log('\n=== 反向对照：一个真的不兼容的声明，确认这道门确实会落闸 ===');
const bad = { name: 'x', version: '1.0.0', peerDependencies: { '@deepseek-ai/dsh-tools': '>=0.3.0' } };
const r = evaluate(bad, {}, '0.2.0-rc.2');
console.log(`  >=0.3.0 on 0.2.0-rc.2 → ${r === undefined ? 'PASS（意外！门没落闸）' : 'FAIL 落闸 ✓ peers=' + JSON.stringify(r.peers)}`);

#!/usr/bin/env node
/**
 * 声明覆盖率审计：我们自己的插件里，还有谁没声明 0.2.0 世代？
 *
 * 存在理由很具体：P0 那一批给 21 个插件加了 peerDependencies + dsh.compatibility，
 * 但扫描按 `@snow-the/*` 过滤 —— 于是无 scope 的 `dsh-ark-plan` 整个漏掉了。
 * 它装在两个 profile 里，却既没有 peer 也没有 compatibility，正是那一批要消灭的静默状态。
 *
 * 本脚本【不】靠命名约定判断归属，而是读 _p0/own-plugins.json 里的显式清单。
 *
 * 用法：node audit-declarations.mjs
 * 退出码：0 = 全部已声明；1 = 有遗漏
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOME = os.homedir();
const OWN_CFG = JSON.parse(fs.readFileSync(path.join(HERE, 'own-plugins.json'), 'utf8'));
const EXTRA = new Set(OWN_CFG.extraOwnPlugins ?? []);

/** 是我们的插件吗 —— @snow-the/* 或显式清单里的名字。 */
const isOurs = (name) => String(name || '').startsWith('@snow-the/') || EXTRA.has(name);

/** 在一个 node_modules 里找出所有我们的插件。 */
function findOurs(nodeModules) {
  const found = [];
  if (!fs.existsSync(nodeModules)) return found;
  const readPkg = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
  for (const e of fs.readdirSync(nodeModules, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('@')) {
      const scopeDir = path.join(nodeModules, e.name);
      for (const s of fs.readdirSync(scopeDir, { withFileTypes: true })) {
        if (!s.isDirectory()) continue;
        const j = readPkg(path.join(scopeDir, s.name, 'package.json'));
        if (j && isOurs(j.name)) found.push({ dir: path.join(scopeDir, s.name), pkg: j });
      }
    } else {
      const j = readPkg(path.join(nodeModules, e.name, 'package.json'));
      if (j && isOurs(j.name)) found.push({ dir: path.join(nodeModules, e.name), pkg: j });
    }
  }
  return found;
}

const problems = [];
const fine = [];

for (const prof of ['web', 'web2']) {
  const nm = path.join(HOME, '.dsh', 'profiles', prof, 'node_modules');
  const ours = findOurs(nm);
  console.log(`\n### profiles/${prof} —— 找到 ${ours.length} 个我们的插件`);
  if (ours.length === 0) { console.log('    （未安装或目录不存在）'); continue; }

  for (const { pkg } of ours.sort((a, b) => a.pkg.name.localeCompare(b.pkg.name))) {
    const off = Object.entries(pkg.peerDependencies ?? {})
      .filter(([k]) => k === '@deepseek-ai/dsh' || k.startsWith('@deepseek-ai/dsh-'));
    const compat = pkg.dsh?.compatibility;
    const miss = [];
    if (off.length === 0) miss.push('无 dsh peer');
    if (!compat) miss.push('无 dsh.compatibility');
    const line = `   ${pkg.name}@${pkg.version}`.padEnd(48) +
      (off.length ? off.map(([k, v]) => `${k.replace('@deepseek-ai/', '')} ${v}`).join(', ') : '—').padEnd(28) +
      (compat ? `compat ${JSON.stringify(compat.dshReleases ?? null)}` : '—');
    if (miss.length) { console.log(line + `   ⚠️ ${miss.join(' / ')}`); problems.push(`${prof}: ${pkg.name} (${miss.join(', ')})`); }
    else { console.log(line); fine.push(pkg.name); }
  }
}

console.log(`\n==== ${fine.length} 个已声明 · ${problems.length} 处遗漏 ====`);
for (const p of problems) console.log(`  ⚠️ ${p}`);
if (problems.length) {
  console.log('\n修法：把缺的插件补上 peerDependencies（纯下界，无上界）+ dsh.compatibility，');
  console.log('然后重跑本脚本 + _p0/compat-ci.mjs 确认。');
  console.log('若那个插件不在 @snow-the/* 下，记得先把它的名字加进 _p0/own-plugins.json。');
}
process.exit(problems.length ? 1 : 0);

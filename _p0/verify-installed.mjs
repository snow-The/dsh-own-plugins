#!/usr/bin/env node
/**
 * P0-1e 最终验证：对 profile node_modules 里【宿主实际读取的】清单跑宿主自己的判定。
 * 源码对了不等于生效 —— 必须验宿主读的那一份。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const HOME = os.homedir();
const NM = path.join(HOME, 'AppData', 'Local', 'npm-cache', '_npx', '7eff65a5cfe9d1d1', 'node_modules');
const boot = await import(pathToFileURL(path.join(NM, '@deepseek-ai', 'dsh-app-boot', 'lib', 'index.js')).href);
const evaluate = boot.evaluatePluginCompatibility;
const RT = '0.2.0-rc.2';
const DEAD = '@deepseek-ai/dsh-client-runtime';

let totalPass = 0, totalFail = 0, deadInInject = 0;

for (const prof of ['web', 'web2']) {
  const scope = path.join(HOME, '.dsh', 'profiles', prof, 'node_modules', '@snow-the');
  if (!fs.existsSync(scope)) { console.log(`\n### profiles/${prof}: 无 @snow-the`); continue; }
  const names = fs.readdirSync(scope).filter((n) => fs.existsSync(path.join(scope, n, 'package.json')));
  console.log(`\n### profiles/${prof}  (${names.length} 个 @snow-the 插件)`);
  console.log('  插件'.padEnd(44) + 'peer  ' + '宿主判定');
  console.log('  ' + '-'.repeat(76));
  let pass = 0, fail = 0;
  for (const n of names.sort()) {
    const p = path.join(scope, n, 'package.json');
    let j; try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
    const off = Object.keys(j.peerDependencies || {}).filter((k) => k === '@deepseek-ai/dsh' || k.startsWith('@deepseek-ai/dsh-'));
    const res = evaluate(j, {}, RT);
    const ok = res === undefined;
    ok ? pass++ : fail++;
    const inj = j.dsh?.client?.inject || [];
    const dead = inj.includes(DEAD);
    if (dead) deadInInject++;
    console.log('  ' + `${j.name}@${j.version}`.padEnd(42) + String(off.length).padStart(3) + '   ' +
      (ok ? 'PASS' : 'FAIL ' + JSON.stringify(res.peers)) + (dead ? '  ⚠️inject 仍含消亡包' : ''));
  }
  console.log('  ' + '-'.repeat(76));
  console.log(`  ${prof}: PASS ${pass} / FAIL ${fail}`);
  totalPass += pass; totalFail += fail;
}

console.log(`\n==== 合计 PASS ${totalPass} / FAIL ${totalFail} / inject 含消亡包 ${deadInInject} ====`);
process.exit(totalFail === 0 && deadInInject === 0 ? 0 : 1);

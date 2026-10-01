#!/usr/bin/env node
/**
 * P0-1 收尾：
 *   1) 把散落的 *.p0-backup-* / *.p0pkgname-backup-* 收拢到 _p0/backups/<plugin>/
 *   2) 在 17 个嵌套仓库 + 3 个普通目录所在仓库 + 父仓库 逐一本地下提交（不 push）
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const HOME = os.homedir();
const P = path.join(HOME, '.dsh-starter', 'plugins');
const STAMP = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const EXEC = process.argv.includes('--exec');

const MSG_FILE = process.env.P0_MSG_FILE ?? path.join(P, '_p0', 'commit-msg.txt');
const MSG = fs.existsSync(MSG_FILE)
  ? fs.readFileSync(MSG_FILE, 'utf8')
  : `chore(compat): declare dsh peers + dsh.compatibility, drop dead client module

- peerDependencies: "@deepseek-ai/dsh" + every official package this plugin
  value-imports, all pinned to the >=0.2.0-rc.1 generation floor with NO upper
  bound (an upper bound passes today only because the host compares with
  includePrerelease, and would disable the plugin at 0.2.0 final).
- dsh.compatibility: records what this build was verified against. NOTE: the
  DSH host does NOT read this field; the enforced gate is peerDependencies and
  the profile-level exemption file is <profile>/compatibility.json.
- remove "@deepseek-ai/dsh-client-runtime" from dsh.client.inject: that package
  does not exist in 0.2.0-rc.2 (only dsh-client-modules / dsh-client-store).

Verified with the host's own evaluatePluginCompatibility at 0.2.0-rc.2:
PASS on all manifests, and a clean dsh web boot (empty stderr).`;

const run = (args, cwd) => {
  try { return { ok: true, out: execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() }; }
  catch (e) { return { ok: false, out: (e.stderr || e.message || '').toString().trim() }; }
};

// ---- 1) 收拢备份 ----
const backupRoot = path.join(P, '_p0', 'backups');
let moved = 0;
const moveBackups = (dir) => {
  for (const f of fs.readdirSync(dir)) {
    if (/\.p0(-pkgname)?-backup-\d+$/.test(f) || /\.p0-backup-\d+$/.test(f)) {
      const dest = path.join(backupRoot, path.basename(dir));
      fs.mkdirSync(dest, { recursive: true });
      fs.renameSync(path.join(dir, f), path.join(dest, f));
      moved++;
    }
  }
};
for (const e of fs.readdirSync(P, { withFileTypes: true })) {
  if (e.isDirectory() && !e.name.startsWith('.')) moveBackups(path.join(P, e.name));
}
const shDirs = [
  path.join(HOME, 'dsh-session-handoff'),
  path.join(HOME, 'source', 'repos', 'dsh-session-handoff'),
];
for (const d of shDirs) if (fs.existsSync(d)) moveBackups(d);
console.log(`  收拢备份文件: ${moved} 个 → _p0/backups/<plugin>/`);

// ---- 2) 逐仓库提交 ----
const targets = [];
for (const e of fs.readdirSync(P, { withFileTypes: true })) {
  if (!e.isDirectory() || e.name.startsWith('.')) continue;
  const d = path.join(P, e.name);
  if (fs.existsSync(path.join(d, '.git'))) targets.push({ name: e.name, dir: d });
}
targets.push({ name: 'dsh-own-plugins (父仓库)', dir: P });
for (const d of shDirs) if (fs.existsSync(path.join(d, '.git'))) targets.push({ name: path.basename(path.dirname(d)) + '/' + path.basename(d), dir: d });

console.log(`\n  待提交仓库: ${targets.length}\n`);
let committed = 0, clean = 0, failed = 0;
const msgFile = path.join(P, '_p0', 'commit-msg.txt');
fs.writeFileSync(msgFile, MSG, 'utf8');

for (const t of targets) {
  const st = run(['status', '--porcelain'], t.dir);
  const dirty = st.ok && st.out.split('\n').filter((l) => l.trim() && !l.includes('_p0/backups')).length > 0;
  if (!dirty) { console.log(`  [干净] ${t.name}`); clean++; continue; }
  if (!EXEC) { console.log(`  [待提交] ${t.name}`); committed++; continue; }
  // 父仓库只暂存本次相关路径，避免把无关的 .rlab 变更混进这个提交
  const isParent = t.dir === P;
  const add = isParent
    ? run(['add', '--', ...targets.filter((x) => x.dir !== P && x.dir.startsWith(P)).map((x) => path.relative(P, x.dir)), '_p0', 'dsh-llm-copilot.disabled', 'dsh-w8-sandbox', '.gitignore'], t.dir)
    : run(['add', '-A'], t.dir);
  if (!add.ok) { console.log(`  [失败-add] ${t.name}: ${add.out.split('\n')[0]}`); failed++; continue; }
  const c = run(['commit', '-F', msgFile], t.dir);
  if (c.ok) { console.log(`  [已提交] ${t.name}  ${c.out.split('\n')[0].slice(0, 70)}`); committed++; }
  else { console.log(`  [失败-commit] ${t.name}: ${c.out.split('\n')[0].slice(0, 90)}`); failed++; }
}

console.log(`\n  ==== ${EXEC ? '已提交' : '待提交'} ${committed} | 干净 ${clean} | 失败 ${failed} ====`);
if (!EXEC) console.log('  (干跑。加 --exec 执行)');
else { try { fs.unlinkSync(msgFile); } catch {} }

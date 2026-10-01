#!/usr/bin/env node
/**
 * 推送所有本地领先的 @snow-the 仓库到 GitHub。
 *
 * 安全约束（推送是发布动作）：
 *   1) 推送前核对 origin URL 的 owner 必须是 snow-The —— 绝不推到别处
 *   2) 用实际远端分支名，不用 origin/HEAD（某些仓库没有它，会静默跳过）
 *   3) 失败逐条报告，不中断其余
 *   4) 只推 fast-forward；非 fast-forward 一律拒绝并报告，绝不 force
 *
 * 用法：node push-all.mjs          # 干跑
 *       node push-all.mjs --exec   # 真推
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const HOME = os.homedir();
const EXEC = process.argv.includes('--exec');
const OWNER = 'snow-The';
const P = path.join(HOME, '.dsh-starter', 'plugins');

const run = (args, cwd) => {
  try { return { ok: true, out: execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 }).trim() }; }
  catch (e) { return { ok: false, out: ((e.stderr || '') + (e.stdout || '') || e.message || '').toString().trim() }; }
};

const targets = [];
for (const e of fs.readdirSync(P, { withFileTypes: true })) {
  if (!e.isDirectory() || e.name.startsWith('.')) continue;
  const d = path.join(P, e.name);
  if (fs.existsSync(path.join(d, '.git'))) targets.push({ name: e.name, dir: d });
}
targets.push({ name: 'dsh-own-plugins (父仓库)', dir: P });
for (const d of [path.join(HOME, 'dsh-session-handoff'), path.join(HOME, 'source', 'repos', 'dsh-session-handoff')]) {
  if (fs.existsSync(path.join(d, '.git'))) targets.push({ name: d.replace(HOME, '~'), dir: d });
}

console.log(`  候选仓库 ${targets.length} 个\n`);
let pushed = 0, uptodate = 0, refused = 0, failed = 0;
const report = [];

for (const t of targets) {
  const url = run(['remote', 'get-url', 'origin'], t.dir);
  if (!url.ok || !url.out) { console.log(`  [跳过] ${t.name}: 无 origin`); refused++; continue; }
  // 守卫 1：远端 owner 必须是 snow-The
  if (!url.out.includes(`github.com/${OWNER}/`) && !url.out.includes(`github.com:${OWNER}/`)) {
    console.log(`  [拒绝] ${t.name}: origin 不是 ${OWNER} → ${url.out}`);
    refused++; continue;
  }
  const br = run(['rev-parse', '--abbrev-ref', 'HEAD'], t.dir);
  if (!br.ok || !br.out || br.out === 'HEAD') { console.log(`  [跳过] ${t.name}: 不在分支上`); refused++; continue; }
  const branch = br.out;

  // 远端分支必须已存在（否则是首次推送，交给人工判断）
  const exists = run(['ls-remote', '--heads', 'origin', branch], t.dir);
  if (!exists.ok || !exists.out) {
    console.log(`  [跳过] ${t.name}: 远端没有 ${branch} 分支（首次推送需人工确认）`);
    refused++; continue;
  }

  // 必须先 fetch：本地 origin/* 可能过期，拿过期状态算 fast-forward 会误判。
  // 这一点是实测出来的 —— 两份 dsh-session-handoff 克隆指向同一个远端，未 fetch 时
  // 双方各自看似 fast-forward，实际上不可能同时成立。
  const f = run(['fetch', '--quiet', 'origin', branch], t.dir);
  if (!f.ok) { console.log(`  [跳过] ${t.name}: fetch 失败 ${f.out.split('\n')[0].slice(0, 80)}`); refused++; continue; }

  const ahead = run(['rev-list', '--count', `origin/${branch}..HEAD`], t.dir);
  const behind = run(['rev-list', '--count', `HEAD..origin/${branch}`], t.dir);
  const n = Number(ahead.out || 0);
  const b = Number(behind.out || 0);

  if (n === 0) { console.log(`  [最新] ${t.name}  (${branch})`); uptodate++; continue; }
  // 守卫 2：落后即非 fast-forward，绝不 force
  if (b > 0) {
    console.log(`  [拒绝] ${t.name}: 领先 ${n} 但落后 ${b} —— 非 fast-forward，需人工处理（绝不 force）`);
    refused++; continue;
  }

  if (!EXEC) { console.log(`  [待推] ${t.name.padEnd(26)} ${branch.padEnd(7)} +${n} 个提交  → ${url.out.replace(/^.*github\.com[:/]/, '')}`); pushed++; continue; }

  const r = run(['push', 'origin', branch], t.dir);
  if (r.ok) { console.log(`  [已推] ${t.name.padEnd(26)} ${branch.padEnd(7)} +${n}  →  ${(r.out.split('\n').pop() || '').slice(0, 80)}`); pushed++; report.push({ name: t.name, branch, commits: n, ok: true }); }
  else { console.log(`  [失败] ${t.name}: ${r.out.split('\n').slice(0, 2).join(' | ').slice(0, 160)}`); failed++; report.push({ name: t.name, branch, commits: n, ok: false, error: r.out.slice(0, 300) }); }
}

console.log(`\n  ==== ${EXEC ? '已推' : '待推'} ${pushed} | 最新 ${uptodate} | 拒绝/跳过 ${refused} | 失败 ${failed} ====`);
if (!EXEC) console.log('  (干跑。加 --exec 执行)');
else {
  const out = path.join(P, '_p0', 'out');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `push-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}.json`), JSON.stringify(report, null, 2), 'utf8');
}

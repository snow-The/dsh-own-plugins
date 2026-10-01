#!/usr/bin/env node
/**
 * P0-1 应用：为 20 个自研插件写入
 *   (a) peerDependencies  —— 宿主唯一门禁（dsh-app-boot/lib/index.js:286-313）
 *   (b) dsh.compatibility —— 我们自己的记录（宿主不读，见 docs/compatibility.md）
 *   (c) 修 dsh.client.inject 里的消亡包 dsh-client-runtime
 *
 * 安全：逐文件备份 .p0-backup-<stamp>，写后重新解析校验；任何异常即中止该项。
 * 用法：node apply.mjs          # 干跑（默认）
 *       node apply.mjs --write  # 真正写入
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
const WRITE = process.argv.includes('--write');
const STAMP = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

/** 代际下界。无上界 —— 生态规则：DSH peer 一律浮动，绝不钉精确/带上界。 */
const FLOOR = '>=0.2.0-rc.1';
const DSH = '@deepseek-ai/dsh';
const fn = (n) => `@deepseek-ai/${n}`;

/**
 * 显式声明表。peers = 该插件【实际 value-import 的】官方包；
 * 每个插件都含 "@deepseek-ai/dsh"（宿主本体）作为代际契约。
 */
const PLAN = {
  'dsh-acp-memory':    { extra: [fn('dsh-tools'), fn('dsh-llm')] },
  'dsh-browser':       { extra: [fn('dsh-tools')] },
  'dsh-busyloop':      { extra: [fn('dsh-tools'), fn('dsh-llm'), fn('dsh-llm-deepseek')] },
  'dsh-busyloop-tools':{ extra: [fn('dsh-tools'), fn('dsh-llm'), fn('dsh-llm-deepseek')] },
  'dsh-codex.frozen':  { extra: [fn('dsh-tools')], note: '冻结插件（dir 名 .frozen）' },
  'dsh-eigenflux':     { extra: [fn('dsh-tools')] },
  'dsh-gitkit':        { extra: [] },
  'dsh-lib-analyzer':  { extra: [] },
  'dsh-llm-copilot.disabled': { extra: [fn('dsh-llm')], note: '已停用（dir 名 .disabled）' },
  'dsh-notemap':       { extra: [fn('dsh-tools')] },
  'dsh-plugin-doctor': { extra: [] },
  'dsh-plugin-guide':  { extra: [fn('dsh-tools')] },
  'dsh-research-lab':  { extra: [fn('dsh-tools')] },
  'dsh-search':        { extra: [fn('dsh-tools')] },
  'dsh-session-handoff': { dir: path.join(HOME, 'dsh-session-handoff'), extra: [fn('dsh-tools'), fn('dsh-home-paths')] },
  'dsh-session-repair':{ extra: [] },
  'dsh-skill-pack':    { extra: [fn('dsh-tools'), fn('dsh-skill-filesystem')] },
  'dsh-snapshot':      { extra: [] },
  'dsh-ui-shim':       { extra: [] },
  'dsh-w8-sandbox':    { extra: [] },
};

/** client.inject 修复：删掉消亡的 dsh-client-runtime */
const DEAD_CLIENT = '@deepseek-ai/dsh-client-runtime';
const CLIENT_FIX = {
  'dsh-ui-shim': [],                                   // 源码自身 client.js:75 就是 []
  'dsh-session-handoff': ['dsh-client-locale', 'dsh-client-ui-settings', 'dsh-client-ui-slots'].map(fn),
};

const PLUGINS_DIR = path.join(HOME, '.dsh-starter', 'plugins');
const log = [];
const P = (s) => { log.push(s); console.log(s); };

let stats = { changed: 0, skipped: 0, failed: 0, peersAdded: 0, peersNormalized: 0, compatAdded: 0, clientFixed: 0 };
const backups = [];

for (const [dirName, plan] of Object.entries(PLAN)) {
  const dir = plan.dir || path.join(PLUGINS_DIR, dirName);
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) { P(`  [跳过] ${dirName}: 无 package.json`); stats.skipped++; continue; }

  let raw, pkg;
  try { raw = fs.readFileSync(pkgPath, 'utf8'); pkg = JSON.parse(raw); }
  catch (e) { P(`  [失败] ${dirName}: 解析失败 ${e.message}`); stats.failed++; continue; }

  const before = { peers: Object.keys(pkg.peerDependencies || {}).length, compat: Boolean(pkg.dsh?.compatibility), inject: JSON.stringify(pkg.dsh?.client?.inject ?? null) };

  // ---- (a) peerDependencies ----
  // 规则（机械、可陈述）：每个插件声明 "@deepseek-ai/dsh" + 它实际 value-import 的官方包，
  // 且全部归一到 FLOOR。已存在的官方 peer 若不同（旧下界、或带上界）一律改写并报告。
  const peers = { ...(pkg.peerDependencies || {}) };
  const wanted = [DSH, ...plan.extra];
  for (const name of wanted) {
    const cur = peers[name];
    if (cur === undefined) { peers[name] = FLOOR; stats.peersAdded++; }
    else if (cur !== FLOOR) {
      peers[name] = FLOOR;
      P(`      ~ ${dirName}: ${name} ${JSON.stringify(cur)} → ${JSON.stringify(FLOOR)}`);
      stats.peersNormalized++;
    }
  }
  pkg.peerDependencies = Object.fromEntries(Object.entries(peers).sort(([a], [b]) => a.localeCompare(b)));

  // ---- (b) dsh.compatibility（我们的记录；宿主不读）----
  pkg.dsh = pkg.dsh || {};
  if (!pkg.dsh.compatibility) {
    pkg.dsh.compatibility = {
      dshReleases: ['0.2.0-rc.1', '0.2.0-rc.2'],
      verifiedAgainst: '0.2.0-rc.2',
    };
    stats.compatAdded++;
  }

  // ---- (c) client.inject 修复 ----
  let clientNote = '';
  if (Object.hasOwn(CLIENT_FIX, dirName) && pkg.dsh.client) {
    const fixed = CLIENT_FIX[dirName];
    const cur = pkg.dsh.client.inject;
    if (JSON.stringify(cur) !== JSON.stringify(fixed)) {
      pkg.dsh.client.inject = fixed;
      clientNote = ` inject ${JSON.stringify(cur)} → ${JSON.stringify(fixed)}`;
      stats.clientFixed++;
    }
  } else if (pkg.dsh.client?.inject?.includes(DEAD_CLIENT)) {
    const fixed = pkg.dsh.client.inject.filter((x) => x !== DEAD_CLIENT);
    pkg.dsh.client.inject = fixed;
    clientNote = ` inject 删除消亡包 → ${JSON.stringify(fixed)}`;
    stats.clientFixed++;
  }

  const after = { peers: Object.keys(pkg.peerDependencies).length, compat: true, inject: JSON.stringify(pkg.dsh?.client?.inject ?? null) };
  const text = JSON.stringify(pkg, null, 2) + '\n';

  if (text === raw) { P(`  [无变化] ${dirName}`); stats.skipped++; continue; }

  P(`  [${WRITE ? '写入' : '待写'}] ${dirName}@${pkg.version}${plan.note ? '  (' + plan.note + ')' : ''}`);
  P(`      peers ${before.peers} → ${after.peers} : ${wanted.join(', ')}`);
  if (!before.compat) P(`      + dsh.compatibility (dshReleases 0.2.0-rc.1/rc.2)`);
  if (clientNote) P(`      ${clientNote}`);

  if (WRITE) {
    const bak = `${pkgPath}.p0-backup-${STAMP}`;
    try {
      fs.copyFileSync(pkgPath, bak);
      backups.push(bak);
      fs.writeFileSync(pkgPath, text, 'utf8');
      const check = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (!check.peerDependencies || !check.dsh?.compatibility) throw new Error('写后校验缺字段');
      stats.changed++;
    } catch (e) {
      P(`      [失败] ${e.message} —— 回滚`);
      try { fs.copyFileSync(bak, pkgPath); } catch {}
      stats.failed++;
    }
  } else {
    stats.changed++;
  }
}

P('');
P('==== 汇总 ====');
P(`  模式            : ${WRITE ? '写入 (--write)' : '干跑（未改任何文件）'}`);
P(`  将变更插件      : ${stats.changed}`);
P(`  无变化/跳过     : ${stats.skipped}`);
P(`  失败            : ${stats.failed}`);
P(`  新增 peer 条目  : ${stats.peersAdded}`);
P(`  归一既有 peer   : ${stats.peersNormalized}`);
P(`  新增 compatibility: ${stats.compatAdded}`);
P(`  修复 client.inject: ${stats.clientFixed}`);
if (WRITE) {
  P(`  备份文件        : ${backups.length} 个 (*.p0-backup-${STAMP})`);
  const outDir = path.join(HOME, '.dsh-starter', 'refs', 'analysis', '_p0');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `apply-${STAMP}.log`), log.join('\n'), 'utf8');
}

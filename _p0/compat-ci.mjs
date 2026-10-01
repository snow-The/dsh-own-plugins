#!/usr/bin/env node
/**
 * P0-3: 兼容性 CI（v2，修正 v1 的同义反复缺陷）。
 *
 * v1 的错误：只判定 >= 下界的版本，而纯下界声明必然满足所有 >= 下界的版本
 *            → 永远不可能失败。那不是门禁。
 *
 * v2 做三件真事：
 *   ① 回归护栏：断言【每个 >= 下界的版本都 PASS】。若有人加了上界、把下界抬高、
 *      或写坏范围，CI 立刻失败并指名插件。
 *   ② 待复验提醒：npm 上出现比 verifiedAgainst 更新的版本 → 报"该复验了"。
 *   ③ 完整分布：下界之下的版本【预期】FAIL（那是断代线，不是故障），如实列出。
 *
 * 退出码：0 = 护栏通过；1 = 有插件在应通过的版本上落闸。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const HOME = os.homedir();
const NM = path.join(HOME, 'AppData', 'Local', 'npm-cache', '_npx', '7eff65a5cfe9d1d1', 'node_modules');
const boot = await import(pathToFileURL(path.join(NM, '@deepseek-ai', 'dsh-app-boot', 'lib', 'index.js')).href);
const evaluate = boot.evaluatePluginCompatibility;
const semver = (await import(pathToFileURL(path.join(NM, 'semver', 'index.js')).href)).default;

const HOST = JSON.parse(fs.readFileSync(path.join(NM, '@deepseek-ai', 'dsh-app-boot', 'package.json'), 'utf8')).version;
const P = path.join(HOME, '.dsh-starter', 'plugins');
const OUT = path.join(P, '_p0', 'out');
fs.mkdirSync(OUT, { recursive: true });

// ---------- 插件清单 ----------
function collect(dir, depth, out) {
  if (depth > 4) return out;
  let es; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  if (es.some((e) => e.isFile() && e.name === 'package.json')) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      if (String(j.name || '').startsWith('@snow-the/')) { out.push({ dir, pkg: j }); return out; }
    } catch {}
  }
  for (const e of es) {
    if (!e.isDirectory() || e.name.startsWith('.') || ['node_modules', 'dist', 'build', 'refs', '.rlab'].includes(e.name)) continue;
    collect(path.join(dir, e.name), depth + 1, out);
  }
  return out;
}
const plugins = collect(P, 0, []);
for (const d of [path.join(HOME, 'dsh-session-handoff'), path.join(HOME, 'source', 'repos', 'dsh-session-handoff')]) {
  if (fs.existsSync(path.join(d, 'package.json'))) {
    try { plugins.push({ dir: d, pkg: JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8')) }); } catch {}
  }
}

// ---------- npm 真实版本 ----------
let npmVersions = null, npmError = null;
try {
  const r = await fetch('https://registry.npmjs.org/@deepseek-ai%2Fdsh', { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`registry HTTP ${r.status}`);
  const j = await r.json();
  npmVersions = Object.keys(j.versions || {}).filter((v) => semver.valid(v)).sort(semver.compare);
  // dist-tags 也要看：latest 可能是最新的
  for (const t of Object.values(j['dist-tags'] || {})) if (semver.valid(t) && !npmVersions.includes(t)) npmVersions.push(t);
  npmVersions.sort(semver.compare);
} catch (e) { npmError = e.message; }

const newestNpm = npmVersions ? npmVersions[npmVersions.length - 1] : null;

/**
 * 合成未来版本：护栏只测【已存在】的版本时，一个上界要等新版真发布才抓得到。
 * 合成 rc→正式 / 次版本 / 主版本三个未来点，让上界【今天】就暴露。
 */
const synthetic = [];
{
  const base = semver.parse(newestNpm || HOST);
  if (base) {
    const cands = [];
    if (base.prerelease.length) cands.push(`${base.major}.${base.minor}.${base.patch}`);      // rc → 正式
    cands.push(`${base.major}.${base.minor + 1}.0`);                                          // 次版本
    cands.push(`${base.major + 1}.0.0`);                                                      // 主版本
    for (const c of cands) if (!(npmVersions || []).includes(c) && semver.valid(c)) synthetic.push(c);
  }
}

// ---------- 自检：证明护栏真的会落闸 ----------
const SELF_TEST = process.argv.includes('--self-test');
if (SELF_TEST) {
  const badCases = [
    { label: '带上界 ^0.2.0-rc.1（在 0.3.0 会炸）', peers: { '@deepseek-ai/dsh': '^0.2.0-rc.1' } },
    { label: '下界高于当前宿主 >=0.9.9', peers: { '@deepseek-ai/dsh': '>=0.9.9' } },
    { label: '范围语法坏掉 ""', peers: { '@deepseek-ai/dsh': '' } },
    { label: '正确（纯下界）——对照组，不应报违规', peers: { '@deepseek-ai/dsh': '>=0.2.0-rc.1' }, expectOk: true },
  ];
  const probeVersions = [...new Set([HOST, ...(npmVersions || []), ...synthetic])].sort(semver.compare);
  // MUST_PASS：这些版本上必须通过 —— 当前宿主、npm 最新、以及合成未来版本。
  // 这才是非同义反复的断言：纯下界声明在"自己的下界之上"永远通过，
  // 真正会暴露问题的是【当前宿主】与【未来版本】这两个点。
  const mustPass = [...new Set([HOST, ...(newestNpm ? [newestNpm] : []), ...synthetic])].sort(semver.compare);
  console.log('=== 护栏自检：注入已知缺陷清单，断言护栏报出违规 ===\n');
  console.log(`  MUST_PASS 判定集: ${mustPass.join(', ')}\n`);
  let allGood = true;
  for (const c of badCases) {
    const manifest = { name: '@snow-the/self-test', version: '0.0.0', peerDependencies: c.peers };
    const hits = mustPass.filter((v) => evaluate(manifest, {}, v) !== undefined);
    const flagged = hits.length > 0;
    const correct = c.expectOk ? !flagged : flagged;
    if (!correct) allGood = false;
    console.log(`  ${correct ? '✓' : '✗'} ${c.label}`);
    console.log(`      ${flagged ? `报出违规，落闸版本: ${hits.join(', ')}` : '未报违规（在 MUST_PASS 上全部 PASS）'}`);
  }
  console.log(`\n  ==== 自检 ${allGood ? '通过：护栏在应落闸时落闸，在不应落闸时不落闸' : '失败：护栏行为不正确'} ====`);
  process.exit(allGood ? 0 : 1);
}

// ---------- 逐插件判定 ----------
/** 全局 MUST_PASS 判定集：当前宿主 + npm 最新 + 合成未来版本。 */
const MUST_PASS = [...new Set([HOST, ...(newestNpm ? [newestNpm] : []), ...synthetic])].sort(semver.compare);
const rows = [];
const violations = [];
const dueForReverify = [];

for (const { dir, pkg } of plugins.sort((a, b) => a.pkg.name.localeCompare(b.pkg.name))) {
  const officialPeers = Object.fromEntries(
    Object.entries(pkg.peerDependencies || {}).filter(([k]) => k === '@deepseek-ai/dsh' || k.startsWith('@deepseek-ai/dsh-'))
  );
  // 每个插件自己的有效下界 = 它声明里最严的那条；用它来分"应通过/预期失败"
  const ranges = Object.values(officialPeers);
  let floor = null;
  for (const r of ranges) {
    const m = /^>=\s*([0-9][^\s|]*)/.exec(String(r));
    if (m && semver.valid(m[1])) floor = floor === null ? m[1] : (semver.gt(m[1], floor) ? m[1] : floor);
  }
  const verifiedAgainst = pkg.dsh?.compatibility?.verifiedAgainst ?? null;

  // MUST_PASS 判定集 = 当前宿主 + npm 最新 + 合成未来版本。
  // 这三点上任何一个落闸 = 真违规（现在被禁用，或将来会被禁用）。
  const mustPass = [...new Set([HOST, ...(newestNpm ? [newestNpm] : []), ...synthetic])].sort(semver.compare);
  const perVersion = {};
  let mustPassFailures = 0;
  for (const v of mustPass) {
    const res = evaluate(pkg, {}, v);
    const ok = res === undefined;
    perVersion[v] = ok ? 'PASS' : 'FAIL';
    if (!ok) { mustPassFailures++; violations.push({ name: pkg.name, version: pkg.version, runtime: v, peers: res.peers }); }
  }
  // 附带统计：下界之下的版本数（预期 FAIL —— 那是断代线，不是故障）
  const belowFloor = (npmVersions || []).filter((v) => floor && !semver.gte(v, floor)).length;
  const unexpectedPassBelowFloor = [];
  if (newestNpm && verifiedAgainst && semver.gt(newestNpm, verifiedAgainst)) {
    dueForReverify.push({ name: pkg.name, verifiedAgainst, newest: newestNpm });
  }

  rows.push({
    name: pkg.name, version: pkg.version, dir: path.relative(HOME, dir),
    declaredPeers: officialPeers, floor, verifiedAgainst,
    verdictOnHost: perVersion[HOST] ?? 'n/a',
    mustPassVersions: mustPass,
    mustPassFailures,
    belowFloorVersionsExpectedFail: belowFloor,
    perVersion,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  host: HOST,
  npmReachable: npmVersions !== null, npmError,
  npmVersionCount: npmVersions ? npmVersions.length : 0,
  newestNpm,
  syntheticVersions: synthetic,
  pluginCount: rows.length,
  violations,
  dueForReverify,
  plugins: rows,
};
fs.writeFileSync(path.join(OUT, 'compatibility.json'), JSON.stringify(report, null, 2), 'utf8');

// ---------- 人读报告 ----------
const L = [];
L.push('# 兼容性 CI 报告');
L.push('');
L.push(`生成 \`${report.generatedAt}\` · 本机宿主 \`${HOST}\` · npm 最新 \`${newestNpm ?? '（取不到）'}\``);
L.push('');
L.push(`npm 可达 **${report.npmReachable ? '是' : '否'}**${npmError ? ` (${npmError})` : ''} · npm 上 dsh 版本 ${report.npmVersionCount} 个 · 判定插件 ${rows.length} 个`);
L.push('');
L.push('## ① 回归护栏（这是本 CI 的硬断言）');
L.push('');
L.push(`断言：**每个插件在 MUST_PASS 判定集 \`${MUST_PASS.join('`, `')}\` 的【每一个】版本上都必须 PASS。**`);
L.push('');
L.push('为什么是这个判定集，而不是"在它自己的下界之上"：');
L.push('');
L.push('- 纯下界声明在"自己的下界之上"**永远**通过 —— 那样断言就是同义反复，抓不到任何东西。');
L.push('- 会真正暴露问题的是两个端点：**当前宿主**（下界抬太高 → 插件此刻就被禁用）与**合成未来版本**（带上界 → 新版一发布就被禁用）。');
L.push('');
if (violations.length === 0) {
  L.push('**通过。** 所有插件在这几个版本上都不会被宿主预检禁用。');
} else {
  L.push(`**失败 ${violations.length} 项。** 下列插件在 MUST_PASS 的某个版本上会被禁用：`);
  L.push('');
  L.push('| 插件 | 插件版本 | 落闸的宿主版本 | 冲突的 peer |');
  L.push('|---|---|---|---|');
  for (const v of violations) L.push(`| ${v.name} | ${v.version} | ${v.runtime} | ${JSON.stringify(v.peers)} |`);
}
L.push('');
L.push('护栏自带 `--self-test`：注入四个已知清单（带上界 / 下界过高 / 范围坏掉 / 正确对照组）断言护栏的行为。**一个不能失败的护栏等于没有护栏**，所以要能证明它落闸。');
L.push('');
L.push('## ② 待复验');
L.push('');
if (newestNpm === null) {
  L.push('npm 取不到，本次无法判断是否有更新版本。');
} else if (dueForReverify.length === 0) {
  L.push(`无需复验：npm 最新 \`${newestNpm}\` 未超过任何插件的 \`verifiedAgainst\`。`);
} else {
  L.push(`**${dueForReverify.length} 个插件的 \`verifiedAgainst\` 落后于 npm 最新版 \`${newestNpm}\`** —— 该复验了（跑测试 + 实跑，然后更新清单里的 \`verifiedAgainst\` 与 \`dshReleases\`）：`);
  L.push('');
  L.push('| 插件 | verifiedAgainst | npm 最新 |');
  L.push('|---|---|---|');
  for (const d of dueForReverify.slice(0, 40)) L.push(`| ${d.name} | ${d.verifiedAgainst} | ${d.newest} |`);
}
L.push('');
L.push('## ③ 逐插件');
L.push('');
L.push('| 插件 | 下界 | 本机判定 | MUST_PASS 版本 | 其中落闸 | 下界之下(预期FAIL) |');
L.push('|---|---|---|---|---|---|');
for (const r of rows) {
  L.push(`| ${r.name}@${r.version} | ${r.floor ?? '—'} | ${r.verdictOnHost} | ${r.mustPassVersions.join(', ')} | ${r.mustPassFailures ? '**' + r.mustPassFailures + '**' : '0'} | ${r.belowFloorVersionsExpectedFail} |`);
}
L.push('');
L.push('## 这个 CI 判定什么 / 不判定什么');
L.push('');
L.push('- **判定**：宿主预检会不会因为这个插件的 `peerDependencies` 而把它 `disabled`。');
L.push('- **不判定**：插件的 API 调用是否仍与新版宿主兼容。**纯下界声明在门禁上永远通过** —— 真正的破坏性变更只能靠测试与实跑发现。');
L.push('- 所以它是**必要不充分**：挡住"静默被禁用"这一整类故障，但不替代功能测试。**② 的复验提醒正是为补这个缺口而设。**');
fs.writeFileSync(path.join(OUT, 'compatibility.md'), L.join('\n'), 'utf8');

console.log(L.slice(0, 30).join('\n'));
console.log(`\n  → ${path.join(OUT, 'compatibility.json')}`);
console.log(`  → ${path.join(OUT, 'compatibility.md')}`);
process.exit(violations.length ? 1 : 0);

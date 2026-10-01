#!/usr/bin/env node
/**
 * P0-2: 为每个插件生成 docs/compatibility.md。
 *
 * 设计原则（吸取 taskboard 腐化教训）：
 *   - 文档由【真实数据】生成，不手写；改文档 = 改生成器。
 *   - 生成内容包含宿主自己的判定函数输出，可复现。
 *   - 必须写明【本次未验证什么】—— 门禁只证明"加载兼容"，不证明"功能兼容"。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const HOME = os.homedir();
const WRITE = process.argv.includes('--write');
const GEN_VERSION = '1.0.0';
const NM = path.join(HOME, 'AppData', 'Local', 'npm-cache', '_npx', '7eff65a5cfe9d1d1', 'node_modules');
const boot = await import(pathToFileURL(path.join(NM, '@deepseek-ai', 'dsh-app-boot', 'lib', 'index.js')).href);
const evaluate = boot.evaluatePluginCompatibility;

const HOST_VERSION = JSON.parse(fs.readFileSync(path.join(NM, '@deepseek-ai', 'dsh-app-boot', 'package.json'), 'utf8')).version;
const P = path.join(HOME, '.dsh-starter', 'plugins');
const scanPath = path.join(HOME, '.dsh-starter', 'refs', 'analysis', '_p0', 'scan.json');
const scan = fs.existsSync(scanPath) ? JSON.parse(fs.readFileSync(scanPath, 'utf8')) : [];
const scanByDir = new Map(scan.map((r) => [r.dir.toLowerCase(), r]));

const dirs = [];
for (const e of fs.readdirSync(P, { withFileTypes: true })) {
  if (!e.isDirectory() || e.name.startsWith('.') || e.name === '_p0' || e.name === 'docs') continue;
  if (fs.existsSync(path.join(P, e.name, 'package.json'))) dirs.push(path.join(P, e.name));
}
dirs.push(path.join(HOME, 'dsh-session-handoff'));
dirs.push(path.join(HOME, 'source', 'repos', 'dsh-session-handoff'));

let written = 0;
const summary = [];

for (const dir of dirs) {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const peers = pkg.peerDependencies || {};
  const officialPeers = Object.entries(peers).filter(([k]) => k === '@deepseek-ai/dsh' || k.startsWith('@deepseek-ai/dsh-'));
  const res = evaluate(pkg, {}, HOST_VERSION);
  const verdict = res === undefined ? 'PASS' : 'FAIL';

  const s = scanByDir.get(dir.toLowerCase());
  const ctxList = s?.ctxServices ?? [];
  const imports = [...new Set([...(s?.officialImports ?? []), ...(s?.officialTypes ?? [])])].sort();
  const inject = pkg.dsh?.client?.inject ?? null;
  const hasClient = Boolean(pkg.dsh?.client);
  const tests = fs.existsSync(path.join(dir, 'test')) || fs.existsSync(path.join(dir, 'tests'));
  const deprecationNote = pkg.dsh?.deprecated || null;

  const L = [];
  L.push('# Compatibility');
  L.push('');
  L.push('> 本文件由 `~/.dsh-starter/plugins/_p0/gen-compat-docs.mjs` 从插件清单与宿主实测**生成**。');
  L.push('> **请勿手改** —— 手改的内容会被下一次生成覆盖。要改，改生成器或改 `package.json`。');
  L.push('>');
  L.push(`> 生成器版本 \`${GEN_VERSION}\` · 宿主 \`${HOST_VERSION}\` · 插件 \`${pkg.name}@${pkg.version}\``);
  L.push('');
  L.push('## 支持的 dsh 版本');
  L.push('');
  L.push('| 项 | 值 |');
  L.push('|---|---|');
  L.push(`| \`dsh.compatibility.dshReleases\` | ${JSON.stringify(pkg.dsh?.compatibility?.dshReleases ?? null)} |`);
  L.push(`| \`dsh.compatibility.verifiedAgainst\` | \`${pkg.dsh?.compatibility?.verifiedAgainst ?? '—'}\` |`);
  L.push(`| 官方 peer 声明 | ${officialPeers.length ? officialPeers.map(([k, v]) => `\`${k.replace('@deepseek-ai/', '')}\` ${v}`).join('<br>') : '（无）'} |`);
  L.push(`| 本次宿主判定（\`${HOST_VERSION}\`） | **${verdict}** |`);
  L.push('');
  L.push('## 门禁到底是什么（宿主实际执行的判定）');
  L.push('');
  L.push('真正决定这个插件**会不会被静默禁用**的**只有 `peerDependencies`**。宿主逻辑：');
  L.push('');
  L.push('```js');
  L.push('// @deepseek-ai/dsh-app-boot/lib/index.js:286-313  evaluatePluginCompatibility()');
  L.push(':289  if (!Object.hasOwn(fields, "peerDependencies")) return void 0;   // 无 peerDependencies = 完全不检查');
  L.push(':294  if (name !== "@deepseek-ai/dsh" && !name.startsWith("@deepseek-ai/dsh-")) continue;  // 只查 dsh / dsh-*');
  L.push(':300  if (requirement.trim() === "" ||');
  L.push(':300      !semver.satisfies(runtimeVersion, requirement, { includePrerelease: true })) peers[name] = range;');
  L.push('```');
  L.push('');
  L.push('两个容易误解的点：');
  L.push('');
  L.push(`1. \`runtimeVersion\` **不是** \`dsh\` CLI 的版本，也不是每个包各自安装的版本 —— 它是 \`@deepseek-ai/dsh-app-boot\` **自己的 package.json** 版本（\`lib/index.js:271-275\`）。**所有 peer 都拿这同一个版本比对。**`);
  L.push('2. 比较带 `{ includePrerelease: true }`，所以 `0.2.0-rc.2` 满足 `<0.2.0`。**带上界的范围今天能过，到正式版就会落闸** —— 这就是本文件要求纯下界的原因。');
  L.push('');
  L.push('> ⚠️ **`dsh.compatibility` 这个清单字段，宿主【不读】。** 全安装树零处引用。它是**本仓库自己的记录**，供人读与 CI 用。');
  L.push('> profile 级别的豁免文件是另一回事：`<profile>/compatibility.json`，由 `dsh plugin allow-version` 写入。');
  L.push('');
  L.push('## 本次验证了什么');
  L.push('');
  L.push('用**宿主自己的** `evaluatePluginCompatibility`（不是我们自己实现的等价物）在本机安装树的版本上判定本插件的真实 `package.json`：');
  L.push('');
  L.push('```');
  L.push(`插件        ${pkg.name}@${pkg.version}`);
  L.push(`宿主        ${HOST_VERSION}`);
  L.push(`判定        ${verdict}${res ? '  ' + JSON.stringify(res.peers) : '（peerDependencies 无冲突，不会被禁用）'}`);
  L.push('```');
  L.push('');
  L.push('**这个判定的含义要说清楚：它只证明「宿主不会在预检阶段禁用本插件」。它不证明插件能正常工作。**');
  L.push('');
  L.push('## 本次【未】验证什么');
  L.push('');
  L.push('这一节是本文件最重要的部分。以下都**没有**被验证过：');
  L.push('');
  L.push('- **除上述宿主版本外的任何 dsh 版本。** 声明是纯下界，所以更高的版本会在门禁上通过 —— 但**通过门禁不等于 API 仍兼容**。');
  L.push('- **实际功能**。本插件的工具/路由/客户端是否真的工作，本次没有端到端跑过。');
  if (hasClient) L.push('- **客户端在浏览器里的真实挂载**。没有开浏览器验证 UI 是否出现、槽位是否被宿主声明。');
  else L.push('- （本插件无 `dsh.client` 块，故无客户端挂载问题。）');
  if (tests) L.push('- **本插件的测试套件**。仓库里有测试，但本次这一轮没有运行它们。');
  L.push('- **与其他插件的同时加载**。单个插件通过门禁不排除插件之间互相冲突。');
  L.push('- **卸载/升级路径**。');
  L.push('');
  L.push('## 能力面（由静态扫描得到，可能不精确）');
  L.push('');
  if (imports.length) {
    L.push('本插件 value/type import 的官方包：');
    L.push('');
    L.push(imports.map((i) => `- \`${i}\``).join('\n'));
    L.push('');
  } else {
    L.push('本插件不 import 任何官方包，只通过宿主注入的 ctx 服务工作。');
    L.push('');
  }
  if (ctxList.length) {
    L.push(`源码里出现的 ctx.<name> 调用（${ctxList.length} 个；含 ctx.get("...") 这类动态查找，**不代表全部真实依赖**）：`);
    L.push('');
    L.push('```');
    const shown = ctxList.slice(0, 60);
    L.push(shown.join(', ') + (ctxList.length > shown.length ? ` … 另 ${ctxList.length - shown.length} 个` : ''));
    L.push('```');
    L.push('');
  }
  if (hasClient) {
    L.push(`客户端面：\`dsh.client.platform = ${JSON.stringify(pkg.dsh.client.platform)}\`，\`inject = ${JSON.stringify(inject)}\`。`);
    L.push('');
    L.push('`dsh.client.inject` 列的是**包名**（客户端模块图里必须先加载的包），与服务注入（模块自己 `exports.inject` 里的**服务名**，如 `slots`/`locale`/`sessions`）**是两回事**。');
    L.push('');
  }
  L.push('## 如何重新验证');
  L.push('');
  L.push('```sh');
  L.push('# 用宿主自己的判定函数跑所有插件的真实清单');
  L.push('node ~/.dsh-starter/plugins/_p0/verify-applied.mjs');
  L.push('');
  L.push('# 对 profile 里【宿主实际读取的那一份】再跑一遍');
  L.push('node ~/.dsh-starter/plugins/_p0/verify-installed.mjs');
  L.push('');
  L.push('# 真启动测试（stderr 应为空）');
  L.push('dsh web --port <随机冷端口> --no-open');
  L.push('```');
  L.push('');
  L.push('## Scope');
  L.push('');
  L.push('本文件只覆盖**加载期兼容性**这一个问题。它不描述插件做什么、怎么用、配置项是什么 —— 那些看 `README.md`。');
  L.push('');

  const text = L.join('\n');
  const outPath = path.join(dir, 'docs', 'compatibility.md');
  if (WRITE) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, text, 'utf8');
  }
  written++;
  summary.push(`${pkg.name.padEnd(38)} ${verdict}  → docs/compatibility.md`);
}

console.log(summary.join('\n'));
console.log(`\n  ${WRITE ? '已写入' : '待写入'}: ${written} 个 docs/compatibility.md`);
if (!WRITE) console.log('  (干跑。加 --write 执行)');

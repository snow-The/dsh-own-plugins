# dsh-own-plugins

自研 DSH（DeepSeek Harness）插件集 —— **零运行时依赖**，只用 node 内建模块。

> **这个仓库的根是 `~/.dsh-starter/plugins/`**，不是 `~/.dsh-starter/`。
> 仓库外还有：`~/.dsh-starter/refs/`（参考语料）、`~/.dsh-starter/_retired/`（退役插件存档）、
> `~/dsh-ark-plan/`（一个不在本目录下的自研插件）。整体地图见 `~/.dsh-starter/README.md`。

## 代际线（0.2.0 起）

**本仓库的插件属于 0.2.0 世代。** 每个包都声明：

```json
"peerDependencies": { "@deepseek-ai/dsh": ">=0.2.0-rc.1" }
```

**纯下界，绝不加上界。** 宿主预检（`dsh-app-boot` 的 `evaluatePluginCompatibility`）拿这个范围比对它自己的版本，
不满足就**静默禁用**该插件（只在 stderr 留一行）。跑在 0.1.x 上的宿主会正确地拒绝这些插件 —— 这正是我们要的断代。

> 为什么不是 `>=0.2.0`：那会连 `0.2.0-rc.2` 都不满足（`includePrerelease` 语义），**当前全部 19 个插件会立刻被禁用**。
> 为什么不是 `^0.2.0`：上界会让下一个 minor 一发布就落闸。

维护工具在 `_p0/`：`audit-declarations.mjs`（查有无遗漏）、`compat-ci.mjs`（护栏 + `--self-test`）、
`apply.mjs`（`--write` 才落盘）、`gen-compat-docs.mjs`。**单一事实源是 `_p0/floor.json`。**

## 插件清单

17 个以**嵌套 git 仓库**（gitlink）形式存在，1 个是普通目录（已停用）。

| 目录 | 包 | 版本 | 做什么 | 状态 |
|---|---|---|---|---|
| `dsh-search` | `@snow-the/dsh-search` | 0.5.1 | 统一搜索工具箱：web search 多provider 回退链 + 缓存、页面抓取、GitHub 搜索、向量语料、深网探测、本地代码语义搜索 | ✅ |
| `dsh-notemap` | `@snow-the/dsh-notemap` | 0.15.0 | 共享知识图谱：带权/置信度的笔记关系、图算法（BFS/Dijkstra/中心性/PageRank）、快照、跨会话跨agent 融合检索 | ✅ |
| `dsh-skill-pack` | `@snow-the/dsh-skill-pack` | 0.3.1 | 精选工程技能：handoff、grilling、teach、spec/ticket 流程、写技能、DESIGN.md 格式。纯 SKILL.md 文本，跨平台 | ✅ |
| `dsh-research-lab` | `@snow-the/dsh-research-lab` | 0.2.3 | 研究实验室：AutoSci 式 wiki、ASI-Bench 级评测台账、arXiv 摘要、对抗式论文评审、学术写作检查 | ✅ |
| `dsh-busyloop` | `@snow-the/dsh-busyloop` | 0.1.26 | agent-loop 引擎：宿主 LLM 适配器（官方 `ctx.llm` 通道）+ 轻量 loop 骨架。codex 风格是可选层 | ✅ |
| `dsh-plugin-guide` | `@snow-the/dsh-plugin-guide` | 0.1.7 | 插件编写指南：启动安全打包的一致性扫描 + 官方能力地图（`ctx.*` 服务、官方 bundle、schedule/agent/tool 范式） | ✅ |
| `dsh-plugin-doctor` | `@snow-the/dsh-plugin-doctor` | 0.2.0 | 安装前静态审查：外泄、凭据访问、混淆、持久化、生命周期脚本红旗。**并含 `doctor_patch`** | ✅ 见下 |
| `dsh-browser` | `@snow-the/dsh-browser` | 0.2.0 | 用 playwright-core 经 CDP 驱动本机 Chrome/Edge：打开、快照、点击、输入、滚动、求值、截图 | ✅ |
| `dsh-busyloop-tools` | `@snow-the/dsh-busyloop-tools` | 0.1.1 | 把 busyloop 引擎暴露成 agent 工具：在指定 LLM 通道上跑一次性子循环，**不消耗主模型 token** | ✅ |
| `dsh-lib-analyzer` | `@snow-the/dsh-lib-analyzer` | 0.1.0 | 库吸收分析：扫描 `ref/` 语料、驱动吸收报告任务批、校验报告纪律、维护可检索的单库知识库 | ✅ |
| `dsh-acp-memory` | `@snow-the/dsh-acp-memory` | 0.1.0 | 统一本地记忆：ACP 图上的七层记忆（soul/user/project/fact/lesson/topic/rules），capture→recall→inject | ✅ |
| `dsh-session-repair` | `@snow-the/dsh-session-repair` | 0.1.0 | 会话日志修复：把单帧损坏的 zstd 重编码回多帧布局；把未知事件类型标记为可忽略 | ✅ |
| `dsh-eigenflux` | `@snow-the/dsh-eigenflux` | 0.1.0 | 驱动 EigenFlux agent 广播网络：状态、命令面自省、只读 feed、两步确认式发布。无定时器 | ✅ |
| `dsh-w8-sandbox` | `@snow-the/dsh-w8-sandbox` | 0.1.0 | w8 世界沙盒演示：浮动 iframe 展示沙盒示意图（地图层/角色/社会/叙事/T1-T3） | ✅ |
| `dsh-codex.frozen` | `@snow-the/dsh-busyloop-codex` | 0.1.5 | busyloop 家族范式 1：OpenAI Codex CLI 桥接（任务执行、代码评审、安全审计、AGENTS.md） | 🧊 冻结 |
| `dsh-gitkit` | `@snow-the/dsh-gitkit` | 0.1.0 | `git_status`/`git_diff`/`git_log`/`git_commit`/`git_branch`，带路径校验、免 shell | ⚠️ 已被原生取代 |
| `dsh-snapshot` | `@snow-the/dsh-snapshot` | 0.1.2 | `snapshot_backup`/`snapshot_list`/`snapshot_restore`，sha256 校验 + 路径穿越防护 | ⚠️ 已被原生取代 |
| `dsh-llm-copilot.disabled` | `@snow-the/dsh-llm-copilot` | 0.1.1 | GitHub Copilot LLM provider 适配器 | 🚫 停用 |

**目录外的第 19 个**：`~/dsh-ark-plan/`（`@snow-the/…` 之外的 `dsh-ark-plan`）——
火山方舟套餐作为 DSH 的 LLM 通道。因为不带 `@snow-the` scope，它被自动扫描漏过一次，
现已登记在 `_p0/own-plugins.json` 的 `extraOwnPlugins` 里。

### 关于"已被原生取代"

`dsh-gitkit`（5 个工具）和 `dsh-snapshot`（3 个工具）的功能**已全部被 DSH 原生工具覆盖**，保留作参考。

**但 `dsh-plugin-doctor` 不是这种情况** —— 原生有 `doctor_scan`/`doctor_scan_path`，
而它的 **`doctor_patch` 是原生没有的**（检测 cordis patch 文件的 loader 行冲突：
同文件重复 `id` 声明会被 `Object.fromEntries` 静默丢弃、跨文件重复会互相覆盖、悬空配置行指向未声明的 id）。
它仍在开发中，实测版本 0.2.0、20 个测试。

## 安装

新机器：profile 里用 GitHub 源（`github:snow-The/<name>`）。
本机开发：用 `file:`（pnpm `nodeLinker: hoisted` 对 `file:` 依赖用**硬链接**，原地编辑会直接生效）。

```
dsh plugin --profile web add file:~/.dsh-starter/plugins/dsh-lib-analyzer
# 改完重启 dsh web（工具在下一个会话出现）
```

`dsh plugin` 是 pnpm 的透传包装，**同时会跑宿主的兼容性判定并在不满足时打印补救命令** ——
所以装完看到 "no incompatible plugins" 才算过。

## 技能

技能在各包的 `skills/<name>/SKILL.md`，自动挂载。用法总览另见 `~/.agents/skills/` 下的 `dsh-own` 技能。

## dsh-lib-analyzer 的工作流

吸收 hindsight-coding-agents 的"知识页"思路，但页面**由已完成的吸收报告派生**（带 file:line 证据、可重建），
而不是从对话回忆里生成 —— 可审计、离线、不调模型。

```
<project>/
├── ref/                 # 只读参考语料
├── batch/
│   ├── tasks.jsonl      # 每行一个任务：id/target/focus/deliverable/output
│   └── out/*.md         # 吸收报告
└── .dsh-lib-analyzer/   # 自动维护的知识库
    ├── index.json
    └── pages/<lib>.md
```

1. `libtasks` — 按文件系统推导状态列出任务；`{"next": true}` 取下一个待办
2. `libscan {"root": "ref/<lib>"}` — 目录树、语言构成、**>1MB 大文件清单**（大文件纪律：绝不整读）
3. 只读研究，引用 `file:line` 证据，写报告（概览 / 关键机制 ✓◐✗ / 可吸收设计 / 落地章节建议 / 风险与教训 / 提取方式）
4. `libreport {"taskId","reportFile","library","sourceDir"}` — 校验纪律、沉淀知识页
5. `libsearch {"query"}` — 在重复劳动之前先搜页面和报告

## 测试

```
node --check <pkg>/lib/index.js          # 多数包
cd dsh-plugin-doctor && npm test          # 20 个测试
```

## License

MIT

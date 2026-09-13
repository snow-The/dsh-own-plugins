---
id: pending-activation-and-decisions
kind: todo
title: 待激活（需重启）与待拍板（阻塞 graph 线）
updated: 2026-09-13
tags: [todo, activation, graph-engineering, acp, search]
---

# 待激活（需重启）与待拍板（阻塞 graph 线）

## A. 重启后复核结果（2026-09-12 ✓ 已核） 

| # | 项 | 复核结论 |
|---|---|---|
| 1 | 搜索 ddg 优先 ＋ 相关性闸门 | ✅ **实测通过** ✓ —— `auto` 返回 `engine: ddg` ✓、命中 `github.com/snow-The/dsh-session-handoff` ✓，note 明写 `preferred "bing" failed, fell back to "ddg" (bing: 3 results share no query token)` ✓ —— **失败是响的** ✓ |
| 2 | ACP 行 hard 余量 | ⚠️ 部分 ✗ —— `acp_status` 里 soft/hard 余量都在 ✓；但**每轮那行仍是降级形** ✗（`ACP: N tokens — below soft limit…` 无窗口/百分比 ✓）→ 机制：**宿主按请求系列冻结 banner** ✓，该系列早于异步窗口解析 ✓；已加的 `rememberWindow` 只保证**下一个系列**正常 ✓。后续：把窗口解析提到同步/apply 阶段 ✓ |
| 3 | 阈值 88/95 | ✅ 生效 ✓（`acp_config` 确认 ✓） |
| 4 | 推荐器定价 | ✅ 生效 ✓（返回 soft 88% / hard 90% ✓，growth 5.3k/轮 ✓） |
| 5 | `acp_recommend` 崩溃 | ✅ 修好 ✓（返回正常 ✓） |

**顺带拿到的两条基线** ✓：成长 **5.3k/轮**（早前 15–30k ✗）、本会话压缩 **0 次** ✓。


| # | 改动 | commit | 生效后应看到 |
|---|---|---|---|
| 1 | 搜索：引擎顺序改 ddg 优先 ＋ **相关性闸门** | `8f90648` `8b41e70` | `platform_search(engine='auto')` 直接给 ddg 级结果 ✓（此前 auto 选 bing → 返回另一个话题 ✗） |
| 2 | ACP banner 显示 **hard 余量** ＋ 措辞改为余量制 | `995677f` 等 | 每轮那行含 `soft … — ~Nk left; hard … — ~Nk left` ✓ |
| 3 | **阈值重设**：soft 73%→**88%**、hard 90%→**95%** | 设置项 ✓ | 不再在 67% 就催压缩 ✓ |
| 4 | 推荐器**给压缩定价**（miss ≈ 9 轮携带成本）＋ bufferRounds 6→4 | `995677f` | `acp_recommend` 给出 ~84/90（旧模型给 73% ✗） |
| 5 | 修 `acp_recommend` **每次调用必崩**（作用域引用错 ✗，从未被调用过所以从没发现） | `995677f` | 工具能正常返回 ✓ |

**复核步骤**（重启后各一条命令 ✓）：
- `platform_search(engine='auto', query='dsh-session-handoff ACP compaction')` → 应含 `github.com/snow-The/dsh-session-handoff` ✓
- `acp_status` → 应显示 `soft 880000 — ~Nk left; hard 950000 — ~Nk left` ✓
- `acp_recommend` → 应返回推荐值而**不再抛错** ✓

## B. 阻塞 graph 线的三块板（决策页 `graph-plan-after-two-papers` 末尾）

1. **评估器位置**＝本仓库 `.rlab/bench/` ✓？
2. **外部任务集**：你指定 ✓ 还是我去找 ✓（要求：可判定 ✓、唯一答案 ✓、我们没参与构造 ✓）
3. **先只量基线**（零代码改动 ✓）还是同时开工 busyloop 的小旋钮 ✓

## C. 已明确不做（避免被重新提起 ✗）

- 开放图 DSL ✗（MASS 证明五块整数参数族就够 ✓）
- 用"感觉"代替评估器 ✗
- 把 SKILL.state 当质量提升来讲 ✗（它自己的数据不支持 ✓）
- 轮末收缩工具结果 ✗（在 DSH 里每轮 = 一次全量前缀 miss ✗）

## D. 顺手可清的零碎
- `dsh-own-plugins` 单一仓库里约 5 个未提交改动（各插件自身仓库也在被它跟踪所致 ✓）
- b02 的 `start-dsh-web.sh` cron ✗（会在 3080 空档抢起游离实例 ✓）—— 按用户指示暂时不动 ✓


---

## E. 候选外部任务集（已调研 ✓，仅候选，**未冻结** ✗）

| 候选 | 来源（外部 ✓ 我们没参与构造 ✓） | 判定方式 | 适配度 |
|---|---|---|---|
| **MBPP**（427 题 sanitized ✓） | `github.com/google-research/google-research/tree/master/mbpp` ✓ ／ HF 镜像 `Muennighoff/mbpp` ✓ `nlile/mbpp` ✓ | 每题自带 **单元测试** ✓ → pass/fail 客观 ✓ | **便宜、确定性、可直接跑** ✓✓（纯文本→代码 ✓ 无需容器 ✓）→ 适合做**第一版** ✓ |
| **Terminal-Bench** | `github.com/harbor-framework/terminal-bench` ✓ ／ `tbench.ai` ✓ | 确定性检查 ✓ | **更贴我们的工具面** ✓（真正考 agent 用终端 ✓）但**要容器** ✗ 更重 ✓ |

**建议** ✓：第一版用 **MBPP 取样 20 题并冻结** ✓ + 结果记 `{id, pass, tokens_in, tokens_out, wall_ms}` ✓ —— 因为 busyloop 的旋钮主要改**成本/延迟** ✗，所以**必须同时记 pass 与 token** ✓✓，只记对错会看不出收益 ✓。

**待你点头的仍只有**：① 位置 `.rlab/bench/` ✓ ② 任务集＝MBPP-20 ✓ 还是 Terminal-Bench ✓ ③ 先量基线 ✓

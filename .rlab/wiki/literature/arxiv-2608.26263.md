## 出处
arXiv `2608.26263v3` ｜ **SKILL.state: Scalable Long-Horizon Agent Skills** ｜ Sanket Badhe（Google LLC）, Priyanka Tiwari, Jonghyun Chung（Purdue）✓
全文（PaddleOCR-VL-1.6 转出，84KB）：`C:\Users\snow\Downloads\2608.26263v3.pdf_by_PaddleOCR-VL-1.6.md` ✓（**已精读** ✓，行号引自该文件）

## 机制（可复现级）
每步提示恰好是 **A_t = (P, Σ_t, O_t)** ✓：不可变流程规格 P ✓ + 结构化状态 Σ_t ✓ + 最新观察 O_t（Eq 2, L65）✓。
> "The language model never receives previous observations, previous actions, or previous reasoning traces"（L69）✓

模型每步产出 **(R_t, ΔΣ_t, a_t)** ✓：多步 CoT + **一个 JSON 字典补丁**（键置 null 即删除 ✓）+ 一个动作（Eq 3, L81–100）✓。运行时循环（Alg 1, L91–98）：收 O_t → 组提示 → 生成 → **校验 ΔΣ_t** → Σ_{t+1} = Σ_t ⊕ ΔΣ_t ✓（⊕ = 带 null 删除语义的字典合并 ✓, Eq 4, L108）→ 执行 a_t ✓。R_t 在"校验并应用后"**永久丢弃** ✓（L102 ✓），且提示里明确告诉模型"推理会在执行后被丢弃" ✓（App A.4, L471 ✓）。

响应契约（原文）✓：一个 JSON 块、**恰好两个键** ✓
`{"state_patch": {<dict; 置 null 删除>}, "action": "<cmd>"}`（App A.4, L472）✓

**谁写什么** ✓：**模型写 ΔΣ_t** ✓；**schema 与校验由确定性运行时拥有** ✓，合并也由运行时做 ✓（L337）✓。
**Schema 是"每域一次"而非每任务一次** ✓ —— 例：一个静态 5 字段 schema（discovered_flags / tested_hypotheses / active_files / working_dir / cmd_summary ✓）复用于 **全部 100 个 InterCode CTF 实例** ✓（Sec 3.1, L75）✓。**但撰写流程全文未描述** ✗，Σ_0 的构造也没给 ✗（Alg 1 只写"Require" ✓, L89）。

**校验门** ✓：运行时"确定性地校验所提状态转移"（L71）✓，**但校验什么从未说明** ✗（没有 schema / 类型 / 键白名单的细节 ✗）。Alg 1 **没有失败分支** ✗（L95）✓。全文唯一的失败说明在 Limitations ✓：畸形输出"无法破坏持久状态 Σ_t；非法补丁触发 **rollback-retry** 循环"（L337）✓ —— 是**重试**而非丢弃 ✓；**重试预算、退避、耗尽后的行为、a_t 是否仍执行，全部缺失** ✗。校验**失败时 R_t 是否丢弃也未定义** ✗（L102 是条件句 ✓）。

## 实验
- **SkillExecBench**（自建 ✓, Sec 4.1）：Env1 仓库 500 货架（Store/Ship/Move/Wait ✓）；Env2 软件仓库（Commit/CreatePR/Merge/FixCI/Wait ✓）；程序化生成、seed 42 ✓；评分 = 成功动作 / 可动作事件总数 ✓（L500）
- 公开集：**InterCode CTF**（100 个 Docker bash CTF ✓）、**Sierra τ-Bench**（Retail/Airline ✓），官方评测器 ✓
- 模型：**Gemini-3-Flash / Gemma-4-31B-it / Qwen-3-8B-it** ✓；temp 0.0, top-p 1.0 ✓
- 基线：Prompt(ReAct) / Memory(3 轮窗+摘要) / **Stateful(LangGraph 式：结构化状态 + 完整 transcript)** ✓；对照：Truncated / Summary-capped / ReAct+LLMLingua ✓；**合成任务 5 seeds、均值±SD、配对 t 检验 p<0.01（仅合成 ✓）**

## 数字（精确；含与作者结论冲突处 ✗）
| 场景 | SKILL.state | 基线 | 备注 |
|---|---|---|---|
| Warehouse T=100（Gemini ✓） | **0.94** / 65,408 tok | Stateful 0.91 / **1,062,387** tok | **16.2× token 缩减** ✓ |
| Warehouse T=200 | **0.94** | ReAct 0.74 / 2.6M tok | — |
| **Software T=25** | **0.88** | **Stateful 0.94** ✗ | **SKILL.state 输** ✗ |
| Software T=100 | 0.78 / 90,200 tok | Stateful 0.63 / 2,308,000 | 长程才反超 ✓ |
| **InterCode CTF** | **54.2%** pass@1 / 387k tok | ReAct 43.2% / 977k | +7.8pts ✓, −60.4% tok ✓ |
| **τ-Bench Retail** | 58.3% / **3,325** / 3.47M | ReAct 48.2% / 2,819 / 4.48M | **提示词反而最长** ✗ |
| τ-Bench Airline | 32.4% / 2,800 | ReAct 21.8% / 5,100 | −40.5% / −45.4% ✓ |
| **Gemma-4-31B T=100** | **0.42±4.1%** | Stateful **0.42±4.5%** ✗ | **准确率打平** ✗（token 65,480 vs 557,968 ✓） |
| Qwen-3-8B T=100 | 0.34±4.6% | Stateful 0.31±4.9% | 略胜 ✓ |
| 噪声（低/中 ✓） | 与 Memory **打平或输** ✗ | — | T=50 / 20 events：0.97 vs Memory 1.00 ✗ |

**唯一消融**是预算对齐对照（Table 5/11 ✓）：同 ~1,800 预算下 0.94 vs LLMLingua 0.22 / Truncated 0.18 ✓ → 说明**结构化**比统计压缩强 ✓，但**没有**任何消融能分离"丢弃 R_t"与"结构化 Σ" ✗，也没有 schema 字段数、没有 ⊕ 算子的消融 ✗。

## 作者承认的局限（Sec 7, L331–337）
Σ 必须是**充分统计量** ✓，仅在其成立处无损 ✓；三类必失败：① 无法预先知道固定 schema ✓；② 正确更新依赖一个**当时没意识到相关、因而从未提交**的观察 ✓；③ 目标定义在**轨迹本身**上 ✓。仅单 agent ✓；并发写需要冲突解决语义（⊕ 没有 ✓）；小模型产出畸形补丁 ✓，语法约束解码属未来工作 ✓。

## 作者未承认、但看得见的局限（**这才是关键** ✗）
1. **一个"格式正确但内容错误"的补丁是永久且不可纠正的** ✗ —— 没有 transcript 可交叉核对 ✗，**没有状态版本化、没有 undo** ✗。论文自己报的 **68% "Premature State Overwrite/Deletion"** 分类（L317 ✓）就是这个失败 ✓ —— 却只在开源权重上报 ✓、并被框成"遵循性问题" ✗
2. **"三个基准提示词都缩小"（Table 4 标题, L291）被它自己的 Retail 行推翻** ✗（3,325 > 全部基线 ✓）—— 大 schema 的必然后果 ✓，全文未讨论 ✗
3. Table 6 T=25 同样推翻"所有时程都不低于基线"（L248）✗
4. 公开集**没有显著性检验** ✗；字符数与 token **混用** ✗（指标定义为**字符长度** Sec 4.3 L214 ✓，预算却写 "~1,800 tokens" ✗ 与 "~1,800 characters" ✗，**未指明 tokenizer** ✗）
5. **摘要把 latency 列为第一动机，全文却没有任何 latency / wall-clock 测量** ✗，也没有成本/美元 ✓

## Context poisoning：作者点名却从未测量 ✗
摘要提到 context poisoning ✗，但**全文从未为 SKILL.state 测过它** ✗，也没有任何幸存案例研究 ✗。噪声实验**明确排除"会改动状态的干扰项"** ✗（App C.1, L598：噪声是 "Non-State-Altering… purely observational" ✓）→ **模仿状态的对抗干扰从未被测** ✗；过滤发生在模型生成补丁时，**不在运行时** ✓（L254）✗。唯一被承认的同类通道是局限 ② ✓。另有**两个场景所有 runtime 都失败** ✓（Table 3 D / Table 10 C ✓）→ 不具备区分力 ✗。

## 论文里没有的东西
无 latency/成本 ✗；**无校验失败率、重试次数与代价、超时行为** ✗；无 schema 撰写流程/成本/失败分析 ✗、无跨 schema 比较 ✗；无 Σ_0 初始化 ✗；**无代码/数据/制品发布声明** ✗；无 Gemini 的错误分类（只有开源权重 ✓）；**无每步 LLM 调用数** ✗（重试可能额外调用 ✓，未报 ✓）；公开集无方差/CI ✗；**没有把 state_patch 当作写原语的安全分析** ✗（尽管作者有前作 skill-security ✓）。Figure 1 在 OCR 里是坏图链接（L132–134 ✓）→ OCR-UNREADABLE ✓

## 对我们（ACP / busyloop）的映射 ✗✓
- **可靠收益是 token，不是准确率** ✗✓：长程省 16× token ✓，但准确率在软环境短程**输** ✗、在开源权重上**打平** ✗ → 若我们照搬，应当把它当**成本/延迟**手段 ✓，别当成质量提升 ✗
- **它的命门是"永久错误补丁"** ✗ —— 而**我们恰好有它没有的东西** ✓✓：会话日志是 append-only 且可恢复 ✓（`acp_decompress` + M1 块存可原样取回 ✓）→ 我们可以做"**状态优先 + 可回溯底账**" ✓，避开它的不可纠正失败 ✗✓
- **schema 越大越糟** ✗（Retail 提示词最长的实证 ✓）→ 我们若做 Σ，**必须小** ✓（5 字段那个规模 ✓）
- 与今日 prefix-cache 结论一致 ✓：P 不可变 ✓、O 每次都变 ✓、Σ 小 ✓ → 提示既小又稳 ✓✓

## 复现要点
本页所有数字均引自上述本地全文行号 ✓；**未读项已逐条标注** ✓；Figure 1 为 OCR 坏图 ✗。

## 出处
arXiv `2502.02533v2` ｜ **Multi-Agent Design: Optimizing Agents with Better Prompts and Topologies** ｜ Han Zhou, Xingchen Wan, Ruoxi Sun, Hamid Palangi, Shariq Iqbal, Ivan Vulić, Anna Korhonen, Sercan Ö. Arık（**Google** + University of Cambridge ✓）
全文：`C:\Users\snow\Downloads\2502.02533v2.pdf_by_PaddleOCR-VL-1.6.md`（157KB ✓，**已精读** ✓；另有一份提取稿 `2502.02533v2_MASS_extract.md` ✓）

## 机制（可复现级）
**搜索空间不是 DAG** ✗✓ —— 是**五个块 + 整数参数**（Table 3）✓：
| 块 | 取值 |
|---|---|
| Summarize | N_s ∈ {0,1,2,3,4} ✓ |
| Aggregate | N_a ∈ {1,3,5,7,9} ✓（决定并行链数 ✓） |
| Reflect | N_r ∈ {0,1,2,3,4} ✓ |
| Debate | N_d ∈ {0,1,2,3,4} ✓ |
| Execute | N_t ∈ {0,1} ✓ |

拓扑 = **顺序固定**的组合 `[summarize, reflect, debate, aggregate]` ✓ —— 顺序被规则钉死以砍组合爆炸 ✓（App B.3：顺序的影响小于配置 ✓）。**每个任务的可用块集合是手工指定的** ✓（Table 2 ✓：MATH/DROP 用 {Aggregate,Reflect,Debate} ✓；多跳 QA 四个块都用 ✓；代码用 {…Executor} ✓）。

**三阶段（交错，局部→全局，prompt→拓扑）** ✓：
1. **1PO** ✓：先在**最小构件**上做块级 prompt 优化 ✓（Table 3 的最小构件：Debate = 2 预测者 + 1 辩论者 ✓；Aggregate = 3+1 ✓；Reflect = 1+1 ✓）→ 记录验证分 E(a_i*) ✓ → 算**影响力 I = E(a_i*)/E(a0*)** ✓
2. **2TO** ✓：`p_a = Softmax(I_a, t=0.05)` ✓ → 循环 n<N：按 p 剪枝（u~Uniform 拒绝 u>p ✓）→ **拒绝采样**出满足 **agent 预算 B** 的拓扑 ✓（B 是个"最多 10 个 agent"的说法 ✓，**正文从未给出数值** ✗）→ 在规则顺序上装配、带上第一阶段 prompt ✓ → 评估、取 argmax ✓。**N=10 个拓扑** ✓
3. **3PO** ✓：在最优拓扑的**全部 agent** 上做联合 prompt 再优化 ✓（建模 agent 间相互依赖 ✓，Algorithm 1 ✓）

**成本模型**（Sec C.3 ✓）：`C(1PO)=Σ_j N(a_j)·M·K` ✓、`C(2TO)=Σ_n N(W_n)` ✓、`C(3PO)=N(W*)·M·K` ✓；**阶段 1–2 可并行** ✓（ADAS/AFlow 不行 ✓, Fig 6 ✓）。优化器超参：MIPRO ✓、3 个自举样例 ✓、每 agent 10 个指令候选 ✓、10 轮 ✓、T=0.7 ✓、输出上限 4096 ✓；**优化器与评估器用同一个 LLM** ✗。

## 实验
8 个任务 ✓：MATH、DROP ✓；HotpotQA、MuSiQue、2WikiMQA（LongBench ✓）；MBPP、HumanEval、LiveCodeBench 测试输出预测 ✓。验证 50–100 / 测试 100–200 样本 ✓。骨干：**gemini-1.5-pro-002 / flash-002** ✓、claude-3-5-sonnet-20240620 ✓、mistral-nemo-12b ✓。基线：CoT ✓、SC@9 ✓、Self-Refine(≤11 calls) ✓、MAD(10 calls) ✓、ADAS(30 rounds) ✓、AFlow(20 rounds, k=3) ✓。

## 数字（精确；含与作者结论冲突处 ✗）
- **Table 1（Gemini 1.5 Pro）**：MASS 平均 **78.79** ✓（MATH 84.67±0.47 ✓ / DROP 90.52 ✓ / HotpotQA 69.91 ✓ / MuSiQue 51.40 ✓ / 2WikiMQA 73.34 ✓ / MBPP 86.50 ✓ / HumanEval 91.67 ✓ / LCB 82.33 ✓）vs CoT 65.28 ✓、SC 68.18 ✓、Self-Refine 66.90 ✓、MAD 70.26 ✓、ADAS 69.72 ✓、AFlow* 76.00（部分任务 **– = 超时** ✗）
- **Flash**：MASS 平均 **74.30** ✓ vs CoT 60.87 ✓、SC 63.50 ✓、MAD 65.91 ✓、ADAS 64.75 ✓
- **Claude 3.5 / Mistral-Nemo-12B**：72.43 / **55.9** ✓ vs CoT 60.21 / 40.4 ✓；**MAD 在 MBPP 上 00.00±0.00** ✗
- **成本（Table 7，任务未点名 ✗）**：MASS 训练 **24M in / 11M out = $5.09** ✓，推理 6645/3263 = **$0.0014/query** ✓，Acc 81.0 ✓；ADAS 23M/13M/$5.61（72.7 ✓）；AFlow 11M/8M/$3.89（64.3 ✓）；SC $0.0010（69.3 ✓）
- **阶段曲线（Fig 5 左，8 任务均值）**：CoT 63.5 → APO 68.0 → 1PO 74.2 → 2TO 77.3 → 3PO **78.8** ✓；**归因：阶段 1 ≈ +6 分 ✓、拓扑 ≈ +3 ✓、阶段 3 ≈ +1.5 ✓** ✗✓
- Table 8：MASS 88.2 vs **GPTSwarm 80.5** ✓（作者把胜因归给 prompt 优化，**不是图搜索** ✓, Sec C.4 ✓）

## 消融（关键）
- Fig 5 右（HotpotQA, 2TO）：**无阶段 1 预热 = 61.5** ✓、**无剪枝 = 61.5** ✓、PO→TO 67.2 ✓ → **阶段 1 预热与影响力剪枝都是承重结构** ✓
- prompt 优化器：**MIPRO 81.0 > DSPy 78.2 > APE 73.3 > CoT 66.7** ✓（Table 9 ✓）
- 任务偏好（C.2 ✓）：Debate 赢多跳 QA ✓；MATH/DROP 偏好探索 ✓；代码偏好反思+执行 ✓

## 作者承认的局限（App A）
固定块空间可能漏掉别的拓扑 ✓；Debate 是全连接、未利用稀疏通信 ✓；尚未用贝叶斯优化器或带反馈的 prompt 优化器 ✓。

## 作者未承认、但看得见的局限（**关键** ✗）
1. **并非一致最优** ✗：Flash 上 **HotpotQA 输给 MAD**（66.53±0.38 vs **74.79±0.87** ✓）、**MuSiQue 输给 MAD/ADAS**（43.67 vs 46.27 / **48.81** ✓）—— 与"consistent improvements"的说法冲突 ✗
2. 表内不一致 ✗：Table 1 平均 78.79 vs Table 6 "+3PO" 78.40 ✓
3. **阶段 3 非单调** ✗：MuSiQue 52.61 → **51.40** ✓
4. **无显著性检验** ✗；仅 3 次运行、50–60 例验证集 ✓
5. 空间**按任务手工指定** ✓，且**每任务烧 24M token** ✗，**没有任何迁移性讨论** ✗
6. **优化器 = 评估器 = 执行器 同一个 LLM** ✗（自评偏置未被讨论 ✓）
7. **执行器会读 MBPP/HumanEval 的公开测试** ✗ → **污染问题全文未讨论** ✗
8. AFlow 对比**被作者自己承认不公平** ✗（App B.2 ✓），却仍用来支撑主结论 ✓
9. t=0.05 与固定块顺序是**未经审计的超参决策** ✗

## 论文里没有的东西
**没有拓扑的形式化定义** ✗（没有 graph/DAG 定义 ✓；深度/宽度只能从 N_r/N_d/N_a 反推 ✓）；**预算 B 从未给出数值** ✗；**没有搜索预算研究** ✗（为什么 N=10 ✓、剪枝率 ✓、对 t/M/K 的敏感性 ✓）；没有搜索随机种子的方差 ✓；**没有 wall-clock / 延迟** ✗；8 个任务没有完整的美元数字 ✓；**没有代码发布声明** ✗；**没有开放式 agentic 基准**（SWE-bench / GAIA / web ✗）、没有人评 ✓、没有 RAG ✓；块重复时（如 N_a=9 个预测者）第一阶段 prompt 如何"融合"只有 Fig 3 标题一句 ✓

## 对我们（busyloop / 图工程）的映射 ✗✓
1. **最重要的反直觉发现：收益主要来自 prompt，不是拓扑** ✗✓ —— 阶段 1 = **+6 分** ✓，拓扑 = **+3 分** ✓，全局 prompt 再优化 = **+1.5** ✓。⇒ **在建图机器之前，先把每个节点的指令优化好** ✓✓（我们的低垂果实很多：ACP 提示词、工具描述、子代理提示 ✓）
2. **它的"拓扑"是小整数旋钮族，不是任意 DAG** ✓✓ —— 这对 busyloop 是**直接可抄的形状** ✓：与其做开放图 DSL ✗，不如暴露几个整数旋钮 ✓（如 `refine: 0..2` ✓、`debate: 0..2` ✓、`aggregate: 1..5` ✓）
3. **影响力剪枝 + 带预算的拒绝采样** ✓ 是便宜可移植的搜索算法 ✓ —— 但**前提是有评估器** ✗✓：没有可测任务与评测集，搜索毫无意义 ✗（我们目前**没有** ✓）
4. **成本锚点** ✓：一次完整搜索 ≈ **$5/任务** ✓ + 推理 $0.0014/query ✓
5. **别抄它的结论，抄它的方法** ✗✓：它自己就有败例 ✗、无显著性检验 ✗、污染未讨论 ✗

## 复现要点
所有数字引自上述本地全文与提取稿 ✓；未读项已逐条标注 ✓；AFlow 行的 "–" 为原文超时 ✓。

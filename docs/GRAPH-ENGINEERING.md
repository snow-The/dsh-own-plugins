# Graph 工程 × 我们的三件套（acp / busyloop / notemap）

> 2026-09-12 ｜ 一手资料：Google ADK 文档与源码（adk-docs / adk-go / adk-js，逐条带出处）
> 本文只写**有出处的事实**和**我们实测的数字**；查无实据的说法单独列在第 9 节。

## 1. 结论摘要

- ADK **2.0 已从"层级式 agent 执行器"改为"图执行引擎"**：`BaseAgent` 继承 `BaseNode`，**Agent / Tool / 函数都是图中的节点** ✓（`docs/2.0/index.md`）
- 三大模式有**框架内建**：扇出（多行 `START` / 动态并发）✓、**join（框架自动合并，无需自写合并器）** ✓、路由（`Event(route=...)` + dict 边）✓（`docs/graphs/routes.md`、`docs/graphs/dynamic.md`）
- 数据流是**节点返回值 → 下一节点输入** ✓，state 只放小对象 ✓（`docs/graphs/index.md`、`docs/graphs/data-handling.md`）
- 可恢复性是**逐节点检查点 + 确定性执行 ID**，并行任务恢复时**只重跑没跑完的** ✓（`docs/graphs/dynamic.md`、`docs/runtime/resume.md`）
- 我们的现状：**执行图的拓扑已经在存** ✓（118 条父子边），但**边上没有任何语义** ✗；busyloop 有扇出**没有 join** ✗；notemap 27 个工具**全是数据图动词** ✗

## 2. ADK 的执行模型（出处见括号）

- 节点 = "an AI agent, Tool, or your programmed code"（`docs/graphs/index.md`）；TS 的 `node()` 可包 function / agent / tool / **另一个 Workflow**（同页）
- 图用**边的列表**声明；以 `START` 开头的一行 = 顺序执行：
  ```python
  Workflow(name=..., edges=[("START", a_agent, b_function, c_agent, done_function)])
  ```
  （`docs/graphs/index.md`；TS 同形 `docs/graphs/routes.md`；Go 用 `NewFunctionNode`/`NewAgentNode` + `Chain` + `workflowagent.New`，示例源码 `adk-go/v2/examples/workflow/routing/string/main.go`）
- 约束：图里的 LLM agent 要配成 single-turn/task 模式（`docs/graphs/routes.md` 注意项）；Python v2.0.0 里 task 模式在 graph workflow 中**被禁用**（`docs/workflows/collaboration.md`）

## 3. 三大模式（这正是我们缺的）

| 模式 | ADK 的做法（出处） | 我们要不要 |
|---|---|---|
| **扇出** | 多行以 `START` 开头即成并行路径（`docs/graphs/routes.md`）；动态扇出 = 循环调 `ctx.run_node` 拿 future、不 await、最后 `gather`/`Promise.all`（`docs/graphs/dynamic.md`）；内建 `parallelWorker`，**默认并发 8**（同页） | 已有（busyloop `tasks[]+concurrency`）✓ 但**静态** ✗ |
| **join / 聚合** | `JoinNode`：等**所有**前驱完成，把结果按**前驱节点名**组成一条记录交给后继（TS）/ `map[string]any`（Go）——**框架合并，不用自己写合并器** ✓（`docs/graphs/routes.md`）注意：任一前驱没产出，失败会**在下游爆**（同页） | **没有** ✗ ← 最该补的一环 |
| **路由** | `Event(route=...)` + dict 边 `(router, {"RUN_TASK_B": nodeB, "RUN_TASK_C": nodeC})`（`docs/graphs/routes.md`）；**LLM 路由 = 一个 `output_schema=str` 的分类 agent + 一段把文本转成 route 的函数**（`docs/graphs/index.md`）；TS 有 `DEFAULT_ROUTE` 兜底（`docs/graphs/routes.md`）；`RoutedAgent` 是**显式路由函数**，文档明确区分它与"LLM 自行决定交接对象"（`docs/agents/routing.md`） | 只有按名选通道 ✗ |

**文档给出的存在理由**（原话）："as your instructions and procedures become longer and more complicated, making sure that the agent is following each step and guideline becomes more complicated and less reliable"；收益是 "Improve the predictability of your agents by relying on structured node definitions rather than prompts alone"（`docs/graphs/index.md`）。

## 4. 状态与并行语义（出处）

- Event 的字段：`output`（给下一节点 ✓）、`message`/content（只给用户，**不下传** ✗）、`state`、`route`（`docs/graphs/data-handling.md`）
- **优先用 `Event.output` 而不是 state**（Go 的 tip，同页）；state 作用域 `app:` / `user:` / `temp:` / 无前缀=会话 ✓；**一次执行只能有一个 output**（两个 yield 会运行时报错 ✓）；state 是轻量 KV，**别拿来搬大对象** ✓
- 并行：`ParallelAgent` 几乎同时启动 ✓；**各分支不共享对话历史与状态** ✓；**结果顺序不确定** ✓；join 是屏障 ✓；父 agent 在所有分支结束后收到收集结果 ✓（`docs/agents/workflow-agents/parallel-agents.md`、`docs/workflows/collaboration.md`）
- 执行 ID 按**调用顺序**分配 → 想要跨恢复稳定，就得**用同步循环启动子节点**（`docs/graphs/dynamic.md`）；图里的**环不会自动有界** ✗（`docs/graphs/routes.md`）

## 5. 可恢复性（第二大缺口）

- 开 `ResumabilityConfig(is_resumable=True)` ✓，按 `invocation_id` 恢复 ✓；**ADK Web UI / CLI 目前不支持恢复** ✗（`docs/runtime/resume.md`）
- 粒度：Sequential 记 `current_sub_agent` ✓；Loop 记 `current_sub_agent + times_looped` ✓；**Parallel 只跑没跑完的** ✓✓（同页）
- 工具是 **at-least-once**（可能跑两次 ✗）→ 需要幂等 ✓；恢复前**不要改**已停止的 workflow ✗（同页）
- 动态 workflow：**自动检查点**，成功的子节点恢复时**跳过**，只有失败/被中断的重跑 ✓；靠**确定性执行 ID（父 ID + 计数器）** 实现 ✓（`docs/graphs/dynamic.md`）
- 部署：Agent Runtime（全托管自动伸缩）/ Cloud Run / GKE ✓；2.0 的 Event 新增 `node_info` 与 `output` 字段，**会破坏**刚性的自定义 `BaseSessionService` schema ✗（`docs/2.0/index.md`）

## 6. 我们的实测现状（真数字）

| 项 | 数字 |
|---|---|
| `sources` | **151**（**118 subagent / 33 main**）✓ |
| 父子边 | **118** ✓（每个 subagent 都有 `parent_session` ✓） |
| `delegations` 结构 | **只有 `(parent_source, child_source)`** ✗ —— 无类型/时间/成败 ✗ |
| `nodes` / `edges`（handoff 图） | 4,509 / **202,632** ✓（节点 kind **全是 concept** ✗） |
| checkpoints | 504 ✓ |
| busyloop | `tasks[] + concurrency` = **扇出+收集** ✓，**无 join** ✗，无谓词路由 ✗ |
| notemap | **27 个工具，全是数据图动词** ✗（没有执行动词 ✗） |

## 7. 差距对照（ADK ↔ 我们）

| ADK | 我们 | 差距 |
|---|---|---|
| 节点 = agent/tool/函数 对等 ✓ | 只有"我调用工具"这一种节点 ✗ | 无显式节点类型 ✗ |
| 动态扇出（数量运行时定）✓ | 静态 `tasks[]` ✓ | 缺 ✗ |
| **JoinNode 框架合并** ✓ | 只收集不合并 ✗ | **缺** ✗✗ |
| 路由（route + dict 边 / LLM 分类器+函数）✓ | 按名选通道 ✗ | 缺 ✗ |
| 边传值（返回值→下一节点）✓ | 每次 run 是孤岛 ✗，结果靠人工搬 ✗ | 缺 ✗ |
| 并行语义明确定义 ✓ | 未文档化 ✗ | 缺 ✗ |
| 逐节点检查点 + 只重跑未完成 ✓ | **完全没有** ✗ | **缺** ✗✗ |
| 边带 `node_info`/`output` ✓ | `delegations` 两个外键 ✗ | 缺 ✗ |

## 8. 提案（按性价比排序，均可独立落地）

### A. busyloop 长成"节点/边"执行器（收益最大）
- **A1 join 语义** ✓：`tasks[]` 增加 `join: 'concat' | 'json' | 'agent:<prompt>'` —— 最后一种用**一次 LLM 调用**把 N 份输出合成一份 ✓（= ADK 的 JoinNode ✓ + 我们要的 synthesis ✓）
  *验收*：3 任务扇出 + `join:'agent:…'` → 返回**单条**综合结果 ✓，测试覆盖 ✓
- **A2 路由** ✓：`route: [{when:'<谓词>', channel|model}, …, {default}]` ✓（确定性 ✓）＋ `classify:'<prompt>'`（LLM 路由 ✓，与 ADK 的 classifier+function 同形 ✓）
  *验收*：谓词路由有单测 ✓；LLM 路由返回**结构化** route 值 ✓（不是自由文本 ✗）
- **A3 节点间传值** ✓：任务提示支持 `{{node.N.output}}` 占位 ✓（= ADK 的边传值 ✓）
- **A4 语义写进文档 + 测试** ✓：无共享状态 ✓、顺序不定 ✓、join 是屏障 ✓（把 ADK 的明文语义直接抄成我们的契约 ✓）
- **A5 确定性执行 ID + 每任务状态落盘** ✓ → 中断后**只重跑未完成的** ✓（= ADK 的自动检查点 ✓✓）
  *验收*：杀掉进程后重跑 → 已成功任务**不重跑** ✓

### B. handoff/ACP：让执行图有语义
- **B1** `delegations` 加列：`kind, started_at, ended_at, status, tokens, turns` ✓（= ADK 边的 `node_info` ✓）
- **B2** 新工具 `handoff_graph` ✓：把 sources+delegations 导出成 **ADK 形状的 nodes/edges** ✓（可被任何图工具消费 ✓，也能喂 notemap ✓）
- **B3** ACP 的**按分支压缩** ✗：需要宿主提供 per-branch 的 surface 视图 ✗ → 先记录 ✓，不硬做 ✓

### C. notemap：接执行图
- **C1** `notemap_network` 除了 handoff 图 + memory ✓，再吃**执行边** ✓（带语义的 delegations ✓）→ 数据图里出现"谁派生了谁、花了多久" ✓
- **C2** fan-out/join 的结果回灌为节点 ✓（`notemap_commit` 已有 ✓）

## 9. 未获证实的说法（诚实标注）

- **"graph 工程"、"predictable work to functions, reasoning to models"** 这两句话在 adk-docs 全仓 grep **0 命中** ✗ —— 它们来自**课程/演讲** ✓，不是官方文档用词 ✓。文档里最接近的是："Weave deterministic code with adaptive AI reasoning. Orchestrate complex tasks through structured, graph-based architectures, with explicit execution paths and predictable outcomes."（`docs/_includes/homepage/_graphs.md`）
- **"LLM 路由 vs 确定性路由"的正式权衡**在能拿到的资料里**没有明文** ✗（只找到上面那句可预测性理由 ✓）
- `https://google.github.io/adk-docs/` **已 308 跳转**到 `adk.dev` ✗（仓库内 `llms.txt` 现在只是指路 ✓）


---

## 10. 出处等级（子代理的最后两条补充，直接影响可信度）

**① "graph 工程"不是 Google 的术语** ✗ —— `graph engineering` 与 `predictable work to functions,
reasoning to models` 在整个 adk-docs 语料里 **0 命中** ✓。官方术语是 **graph-based workflows /
Workflow Runtime（ADK 2.0）** ✓。把它们说成"Google 的说法"属于**归属错误** ✗。

**② 三类示例的出处等级不同** ✗：

| 语言 | 出处等级 |
|---|---|
| Python | 文档正文示例 ✓（可靠 ✓） |
| **Go** | 文档正文 ✓ ＋ **`google/adk-go` tag `v2` 里可运行的真实源码** ✓（`examples/workflow/routing/string/main.go` ✓）——**最高** ✓ |
| **TypeScript** | ⚠️ **只来自散文描述** ✗ —— 文档里的 `--8<--` 代码包含**无法从 docs 仓库解析** ✗，`adk-js` 的片段路径**返回 404** ✗ |

⇒ 所以我们**不能**声称"看过 TS 的图 API 源码" ✓；TS 那两条（`new Workflow({edges:[['START', …]]})` ✓、
`DEFAULT_ROUTE` ✓）是**文档正文的转述** ✓，等级低于 Go ✓。

**③ `google.github.io/adk-docs/` 已不再提供文档** ✗ —— HTTP 308 跳转到 `adk.dev` ✓；任务里点名的五个页面
（Workflows / Agents / Sequential / Parallel / Loop）**都还在** ✓，只是路径变为 `adk.dev` 下与
`docs/agents/workflow-agents/` 对应的镜像 ✓。

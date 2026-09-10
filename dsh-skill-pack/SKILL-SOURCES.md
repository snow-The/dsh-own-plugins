# dsh-skill-pack — Skill Sources & Evolution Candidates

## 已加入资源
- **awesome-design-md** (voltagent) — 74 个 DESIGN.md 设计语言模板，clone 到
  skills/design-md/resources/awesome-design-md/。让 design-md skill 能引用真实设计系统生成视觉一致 UI。

## GitHub 高质量 skill 候选（搜索于本会话，stars>500）
| 仓库 | ★ | 价值 | 与我们的关系 |
|---|---|---|---|
| Graphify-Labs/graphify | 114k | 代码库→知识图谱，本地 AST，无向量库 | 与 acp_graph 理念一致，可借鉴实体抽取 |
| JuliusBrussee/caveman | 102k | 省 65% token 的极简沟通 skill | 省 token 思路，可作 skill |
| thedotmack/claude-mem | 93k | 跨会话上下文持久化 | 与 ACP 高度相关，可借鉴压缩注入 |
| Egonex-AI/Understand-Anything | ~ | 代码交互知识图谱 | 图谱可视化方向 |
| affaan-m/ECC | 246k | agent 性能优化系统（skills/instincts/memory） | 综合方法论参考 |

## 演进候选（skillwiki 流程）
- caveman → skillwiki_propose 加入（省 token 沟通）
- graphify 实体抽取 → 反馈给 acp_graph 的 extractEntities 增强
- claude-mem 压缩注入 → 反馈给 acp_compress 的注入策略

## 注意
- 引用外部 skill 需遵守各自 LICENSE（caveman 等）。
- skillwiki_gate 用验证分决定接受/回滚。

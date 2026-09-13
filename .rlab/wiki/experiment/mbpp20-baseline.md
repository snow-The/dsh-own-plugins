---
id: mbpp20-baseline
kind: experiment
title: mbpp20-baseline — confirmed
updated: 2026-09-13
tags: []
---

# mbpp20-baseline — confirmed

## Hypothesis

在没有可测判据之前，任何"更好的编排/拓扑/state"都是说法。MASS(2502.02533) 的三阶段搜索与 SKILL.state(2608.26263) 的 state-first 都要求可反复测量的验证集；我们没有。所以先建 baseline：外部任务集 + 客观判分 + 同时记 pass 与 token。

## Prediction / decision rule

判分器必须先双向验证：o某acle=MBPP 自带参考解必须 100% PASS（无假阴性），stub 必须 0%（无假阳性）。只有这两条都过后，模型跑出的任何数字才算数。若 oracle 不是 20/20，则 bench 无效，不得使用。

## Evidence

产物：`.rlab/bench/{run.mjs, channels.json, tasks/mbpp-20.jsonl, tasks/mbpp-20.meta.json, results.jsonl}`
任务：Google sanitized MBPP 427 题 → 按 task_id 排序每 21 题取 1 → **20 题冻结**；来源 sha256 `ca95deaa9a01ef0a…`；平均 3.3 条单测/题。
判分：每题**自带的单元测试**，在子进程 python 3.13 里跑，10s 超时；记录 `{run,id,pass,tokens_in,tokens_out,wall_ms,error}`。

**双向验证**：
- oracle（MBPP 参考解）**20/20 PASS** ✓ → 无假阴性
- stub（垃圾代码）**0/20** ✓ → 无假阳性

**基线（首跑，单发 deepseek-chat，temperature 0，max_tokens 1024）**：
```
tasks 20 | passed 12 | pass_rate 60% | tokens_in 1170 | tokens_out 1012 | wall_ms 19015
```

**过程中抓住的两个 harness bug（不是模型的锅 ✗）**：
1. **用 node 判 Python** ✗ —— MBPP 是 Python；oracle 当场 **0/20** 暴露之 ✓（若没做 oracle 检验，这个 bench 会一直输出 0% 而“看起来正常” ✗）
2. **提示词没给必需函数名** ✗ —— MBPP 的 prose 从不说明测试调用的函数名；模型自取名 → **20/20 全是 NameError** ✓。修法：`requiredName()` 从第一条 `assert` 提取名字写进提示 ✓。
3. 附带：traceback 的**异常在最后一行** ✗，只截前两行等于什么都没记 ✓。

## Verdict: **CONFIRMED**

## Conclusion

可用的 baseline 已建立：**60% (12/20)，1170 in / 1012 out tokens，19.0s**（单发 deepseek-chat）。
后续任何编排改动（busyloop 的 refine/debate/aggregate 旋钮、join、state-first）都必须**同时**对照 pass 与 token —— 只对 pass 会看不见成本收益（MASS 自身：prompt +6 分、拓扑 +3 分；SKILL.state：16× token 而其开源权重准确率打平）。
纪律：orbnb 与 stub 两条自检必须在每次改判分器后重跑 ✓。

---
id: hf-gold-sources
kind: decision
title: Decision: HF 黄金资料来源索引 (插件常识库)
updated: 2026-09-01
tags: [decision, hf, gold-source]
---

# Decision: HF 黄金资料来源索引 (插件常识库)

## 目的
w8 研究项目的高质量 HF 参考来源, 作为插件用户与研究常识。

## 已收录 (9 条)
1. ModernBERT 文档 — https://huggingface.co/docs/transformers/model_doc/modernbert — RoPE/GeGLU/unpadding/交替注意力
2. transformers 仓库 — https://github.com/huggingface/transformers — 全架构文档 + API 黄金来源
3. bekko-embedding-v1-a8m — https://huggingface.co/hotchpotch/bekko-embedding-v1-a8m — 7.7M ModernBERT, matryoshka 384→256
4. granite-embedding-97m-r2 — https://huggingface.co/ibm-granite/granite-embedding-97m-multilingual-r2 — <100M MTEB 第一 60.3
5. WeMM-Embedding-4B — https://huggingface.co/tencent/WeMM-Embedding-4B — 蒸馏教师候选 (本地 /root/models/wemm-4b)
6. potion-multilingual-128m-onnx — https://huggingface.co/minishlab/potion-multilingual-128m-onnx — 现成筛选器
7. sentence-transformers 68 数据集合集 — https://huggingface.co/sentence-transformers/embedding-training-data
8. smol-training-playbook — https://huggingface.co/blog/smol-training-playbook
9. UltraData 门户 — https://huggingface.co/openbmb

## 抓取技巧
- 文档: <url>.md 后缀 → 干净 markdown
- 模型卡: /raw/main/README.md → 纯文本

## 教师决策 (2026-09)
本轮蒸馏教师 = Qwen3-Embedding-0.6B (验证管线为主); WeMM-Embedding-4B 留作后续升级

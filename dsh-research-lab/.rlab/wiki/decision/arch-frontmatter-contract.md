---
id: arch-frontmatter-contract
kind: decision
title: Architecture Decision: wiki frontmatter contract
updated: 2026-08-31
tags: [architecture, omega-wiki, contract]
---

# Architecture Decision: wiki frontmatter contract

## Context
Wiki pages previously wrote metadata lines (kind: x | id: y), which rlab_validate could not parse. 插件自身页面曾缺 frontmatter, 被自家校验器抓出 — dogfood 生效。

## Decision
1. writeWikiPage now emits YAML frontmatter (id/kind/title/updated/tags) matching the validate contract; parseFrontmatter is the single parser.
2. Zero runtime deps: node:fs/path only, esbuild single-file bundle (~64KB) — hono-style minimalism.
3. Absorbed dsh-std meta-protocol idea: tool contracts.
4. rlab_wiki 写页自动 addDoc 进 related.db (v0.3 lib-analyzer 联动)。

## Consequence
rlab_validate 强制校验; 缺 frontmatter 报 error; wiki 页自动可被 rlab_related 检索。

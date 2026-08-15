---
name: design-md
description: Create, read, and apply DESIGN.md files — a structured visual identity format for coding agents. Use when a project needs a persistent design system, when the user mentions DESIGN.md, design tokens, or when UI work must stay consistent with an existing visual identity.
---

# DESIGN.md — Persistent Visual Identity for Coding Agents

DESIGN.md gives an agent a durable, structured understanding of a project's
design system. It combines **machine-readable design tokens** (YAML front
matter) with **human-readable rationale** (markdown prose). Tokens give exact
values; prose explains why those values exist and how to apply them.

## The Format

A DESIGN.md file starts with a YAML front matter block of tokens, then
markdown sections of rationale.

```md
---
name: Heritage
colors:
  primary: "#1A1C1E"
  secondary: "#6C7278"
  tertiary: "#B8422E"
  neutral: "#F7F5F2"
typography:
  h1:
    fontFamily: Public Sans
    fontSize: 3rem
  body-md:
    fontFamily: Public Sans
    fontSize: 1rem
rounded:
  sm: 4px
  md: 8px
spacing:
  sm: 8px
  md: 16px
---

## Overview

One paragraph: the design's personality in words.

## Colors

Why each color exists and where it applies.

## Typography

Hierarchy rules, pairings, and fallbacks.
```

## Recommended Token Set

| Token group | Fields |
|---|---|
| name | identity name |
| colors | primary / secondary / tertiary / neutral / danger / success |
| typography | per-role: fontFamily / fontSize / fontWeight / lineHeight |
| spacing | sm / md / lg / xl (8px base recommended) |
| rounded | sm / md / lg |
| shadows | sm / md / lg (optional) |
| dark | boolean or dark palette overrides (optional) |

## When to Create

1. New UI project — create DESIGN.md in the repo root early.
2. Existing UI without one — extract tokens from the current implementation.
3. Design changes — update tokens AND the prose rationale together.

## When to Apply

1. Before building any UI: read DESIGN.md first.
2. While building: pull exact values from tokens (never approximate).
3. In review: flag deviations from tokens as bugs, not style opinions.

## Source

Format specification by Google Labs (github.com/google-labs-code/design.md).

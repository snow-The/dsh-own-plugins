# dsh-own-plugins

Own-built DSH plugins (DeepSeek Harness) — zero runtime dependencies, node
builtins only.

| Package | Purpose | Status |
|---|---|---|
| `dsh-lib-analyzer` | Library absorption analysis: libscan / libtasks / libreport / libsearch + the `library-analysis` skill (ref→batch absorption reports with a hindsight-style per-library knowledge base) | ✅ 使用中 |
| `dsh-gitkit` | git_status / git_diff / git_log / git_commit / git_branch | ⚠️ superseded by native DSH git_* tools — kept for reference |
| `dsh-snapshot` | snapshot_backup / snapshot_list / snapshot_restore | ⚠️ superseded by native DSH snapshot_* tools — kept for reference |
| `dsh-plugin-doctor` | doctor_scan / doctor_scan_path | ⚠️ superseded by native DSH doctor_scan tools — kept for reference |

Skills live in `skills/<name>/SKILL.md` inside each package and are auto-mounted;
the usage guide is also exposed as the `dsh-own` skill in `~/.agents/skills/`.

## dsh-lib-analyzer

Absorb hindsight-coding-agents' knowledge-page idea, but pages are **derived
from finished absorption reports** (file:line evidence, rebuildable) instead of
conversation recall — auditable, offline, no model calls.

```
<project>/
├── ref/                 # read-only reference corpus
├── batch/
│   ├── tasks.jsonl      # one JSON task per line: id/target/focus/deliverable/output
│   └── out/*.md         # absorption reports
└── .dsh-lib-analyzer/   # auto-maintained knowledge base
    ├── index.json
    └── pages/<lib>.md
```

Workflow (see the `library-analysis` skill for the full discipline):

1. `libtasks` — list tasks with filesystem-derived status; `{"next": true}` for the next pending one.
2. `libscan {"root": "ref/<lib>"}` — tree, language mix, **>1MB big-file list** (big-file discipline: never read those whole).
3. Research read-only, cite file:line evidence, write the report (概览 / 关键机制 ✓◐✗ / 可吸收设计 / 落地章节建议 / 风险与教训 / 提取方式).
4. `libreport {"taskId","reportFile","library","sourceDir"}` — validate discipline, sink the knowledge page.
5. `libsearch {"query"}` — search pages + reports before repeating work.

## Install

```
dsh plugin --profile web add file:~/dsh-own-plugins/dsh-lib-analyzer
# then restart dsh web (tools appear in the next session)
```

## Test

```
node --check dsh-lib-analyzer/lib/index.js
# smoke test against a real project: see the dsh-own skill, or
# exercise the four tools with a stub ctx.tools.register collector.
```

## License

MIT

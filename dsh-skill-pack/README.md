# dsh-skill-pack

Curated engineering skills for DeepSeek Harness — **cross-platform by
construction** (pure SKILL.md text mounted via the host's filesystem
provider; zero platform-specific code, zero runtime dependencies beyond
the DSH-hosted `@deepseek-ai/dsh-skill-filesystem`).

## Skills (27)

**Engineering workflows** (curated from mattpocock/skills):

| Skill | What it does |
|---|---|
| `handoff` / `claude-handoff` | Compact the conversation into a handoff doc for another agent |
| `grill-me` / `grill-with-docs` / `batch-grill-me` | Relentless interviews to sharpen plans/designs |
| `teach` | Teach the user a new skill or concept in-workspace |
| `to-spec` / `to-tickets` / `to-prd` / `to-issues` / `to-questionnaire` | Turn conversations into spec/tickets/PRD/issues/questionnaires |
| `implement` | Implement a piece of work from a spec or tickets |
| `triage` | Move issues/PRs through triage roles |
| `wayfinder` | Plan huge work as a map of decision tickets |
| `loop-me` | Grill specs for workflows to build |
| `ubiquitous-language` | Extract a DDD-style ubiquitous language glossary |
| `ask-matt` | Router over the skills in this pack |
| `zoom-out` | Get broader context / higher-level perspective |
| `improve-codebase-architecture` | Scan for deepening opportunities, HTML report |
| `setup-ts-deep-modules` | Wire dependency-cruiser for deep-module TS repos |
| `wizard` | Generate an interactive bash wizard for manual procedures |

**Writing** (curated from mattpocock/skills): `edit-article`,
`writing-beats`, `writing-fragments`, `writing-shape`,
`writing-great-skills`.

**Design**: `design-md` (self-authored — google-labs DESIGN.md format:
persistent visual identity for coding agents).

## Install

```
dsh plugin --profile web add file:~/source/repos/dsh-own-plugins/dsh-skill-pack
```

## Notes

- Skills are text (SKILL.md + references); they work identically on
  Windows / macOS / Linux.
- Claude Code's `agents/` subdirectories were stripped during curation.
- All skills passed `dsh-plugin-doctor` static vetting (SAFE).

## License

MIT

/**
 * dsh-skill-pack — curated engineering skills for DeepSeek Harness.
 *
 * Cross-platform by construction: pure text skills (SKILL.md) mounted via
 * the host's filesystem provider; no platform-specific code, no runtime
 * dependencies beyond the DSH-hosted @deepseek-ai/dsh-skill-filesystem.
 *
 * WikiSkill evolution (arXiv 2608.27454): skills co-evolve with a persistent
 * wiki (~/.dsh/skill-wiki/). raw/ holds immutable experience traces, wiki/
 * holds patterns + evolution logs, skills/ holds candidates. Tools:
 *   skillwiki_status / ingest / consolidate / propose / gate
 * Experience becomes skill: ingest a dev session → consolidate a pattern →
 * propose a skill update → gate it.
 */
import { fileURLToPath } from 'node:url'
import { readdirSync } from 'node:fs'
import { apply as applyFilesystemProvider } from '@deepseek-ai/dsh-skill-filesystem'
import { Hono } from 'hono'
import {
  ingestExperience, consolidatePattern, logEvolution, proposeSkill, gateSkill, wikiStatus, ingestFromAcp,
} from './wiki.js'

const skillsRoot = fileURLToPath(new URL('../skills/', import.meta.url))

export const name = 'skill-pack'
export const inject = ['tools', 'skills']

// The host ctx shape is not exported by the filesystem provider package;
// this adapter only forwards it unchanged, so an explicit any is fine.
export function apply(ctx: any) {
  applyFilesystemProvider(ctx, {
    providerName: 'skill-pack',
    includeDefaultRoots: false,
    bundledSkillDir: skillsRoot,
    watch: false,
  })

  // --- WikiSkill evolution tools (object-literal registration, no dsh-tools dep) ---
  const textOut = { schema: { type: 'string' }, render: (_a: any, v: any) => [{ type: 'text', text: String(v) }] }
  const reg = (t: any) => { try { ctx.tools.register(t) } catch (e) { console.error('[skill-pack] ' + t.name + ' skipped: ' + e) } }

  reg({
    name: 'skillwiki_status',
    description: 'WikiSkill status: raw/ experience traces, wiki patterns, candidate skills, active skills, recent evolution log.',
    parameters: {},
    output: textOut,
    execute: () => { const s = wikiStatus(); return 'Skill Wiki (~/.dsh/skill-wiki):\n  raw=' + s.raw + ' patterns=' + s.patterns + ' candidates=' + s.skills + ' active=' + s.active + '\n\nrecent log:\n' + (s.logs.length ? s.logs.join('\n') : '(empty)') },
  })

  reg({
    name: 'skillwiki_ingest',
    description: 'Ingest a development experience trace into raw/ (immutable). Use after a debugging/refactor session so the insight becomes skill-evolution material. Optional: from=acp pulls latest ACP compaction summaries as experience.',
    parameters: {
      type: 'object', properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        from: { type: 'string' },
        limit: { type: 'number' },
      }, required: [],
    },
    output: textOut,
    execute: (args: any) => {
      if (args?.from === 'acp') { const files = ingestFromAcp(Number(args?.limit) || 10); return 'ingested ' + files.length + ' ACP checkpoint(s) into raw/' }
      if (!args?.title || !args?.content) throw new Error('title and content required')
      const f = ingestExperience(String(args.title), String(args.content))
      logEvolution('ingest', 'experience', String(args.title))
      return 'ingested experience → ' + f
    },
  })

  reg({
    name: 'skillwiki_consolidate',
    description: 'Wiki Maintainer: consolidate an experience pattern into wiki/patterns/. Extracts a reusable failure-mode/strategy with actionable workaround.',
    parameters: {
      type: 'object', properties: {
        name: { type: 'string' }, title: { type: 'string' }, diagnosis: { type: 'string' }, workaround: { type: 'string' },
      }, required: [],
    },
    output: textOut,
    execute: (args: any) => {
      const f = consolidatePattern(String(args.name), String(args.title), String(args.diagnosis), String(args.workaround))
      logEvolution('consolidate', 'pattern', String(args.name))
      return 'consolidated pattern → ' + f
    },
  })

  reg({
    name: 'skillwiki_propose',
    description: 'Skill Proposer: write a candidate SKILL.md (wiki-informed) into skills/. Generates an atomic skill creation/update proposal grounded in wiki patterns.',
    parameters: {
      type: 'object', properties: {
        name: { type: 'string' }, description: { type: 'string' }, body: { type: 'string' }, patterns: { type: 'array', items: { type: 'string' } },
      }, required: [],
    },
    output: textOut,
    execute: (args: any) => {
      const f = proposeSkill(String(args.name), String(args.description), String(args.body), (args?.patterns ?? []).map(String))
      logEvolution('propose', 'skill', String(args.name))
      return 'proposed skill → ' + f
    },
  })

  reg({
    name: 'skillwiki_gate',
    description: 'Gating: accept or reject a candidate skill. Accepted skills move to skills-active/ (mounted), rejected ones are logged so they are not re-proposed without new evidence.',
    parameters: {
      type: 'object', properties: {
        name: { type: 'string' }, accept: { type: 'boolean' }, score: { type: 'number' },
      }, required: [],
    },
    output: textOut,
    execute: (args: any) => gateSkill(String(args.name), args?.accept === true, args?.score != null ? Number(args.score) : undefined),
  })

  // Hono app: try to mount on the host http service when available.
  try {
    const http = ctx.http
    if (http?.mount) http.mount('/skill-pack', createHonoApp(ctx).fetch)
  } catch {
    /* no host http service */
  }
}

// --- Hono app factory (same pattern as dsh-codex) ---

export interface AppEnv {
  Bindings: { ctx: unknown }
}

export function createHonoApp(_ctx: unknown): Hono<AppEnv> {
  const app = new Hono<AppEnv>()
  let skillCount = 0
  try {
    skillCount = readdirSync(skillsRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).length
  } catch {
    /* skills dir not readable here */
  }
  app.get('/api/skill-pack/health', (c) => c.json({ ok: true, plugin: 'dsh-skill-pack', ts: true, hono: true, skills: skillCount }))
  return app
}

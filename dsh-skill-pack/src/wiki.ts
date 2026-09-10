/**
 * dsh-skill-pack — WikiSkill evolution layer (arXiv 2608.27454).
 *
 * Three-layer knowledge architecture under ~/.dsh/skill-wiki/:
 *   raw/       immutable experience traces (dev sessions, failures, wins)
 *   wiki/      compiled knowledge: patterns/<name>.md + logs.md + skill-impact.md
 *   skills/    executable skills (SKILL.md), evolution candidates live here
 *
 * Evolution loop (WikiSkill): ingest experience → consolidate into wiki →
 * propose skill update → gate (accept/reject). Wiki keeps cross-iteration
 * history so rejected interventions aren't re-proposed.
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const NL = String.fromCharCode(10);
function wikiRoot(): string {
  const base = process.env.DSH_HOME ?? join(homedir(), '.dsh');
  return join(base, 'skill-wiki');
}
function ensureLayers(): void {
  for (const d of ['raw', 'wiki/patterns', 'skills', 'skills-active']) mkdirSync(join(wikiRoot(), d), { recursive: true });
  const logs = join(wikiRoot(), 'wiki', 'logs.md');
  if (!existsSync(logs)) writeFileSync(logs, '# Skill Evolution Log' + NL + NL + '<!-- Wiki Maintainer appends one entry per evolution round -->' + NL, 'utf8');
  const impact = join(wikiRoot(), 'wiki', 'skill-impact.md');
  if (!existsSync(impact)) writeFileSync(impact, '# Skill Impact Tracker' + NL + NL + '<!-- updated programmatically after gating -->' + NL, 'utf8');
}
function ts(): string { return new Date().toISOString(); }
function slug(s: string): string { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'untitled'; }

/** Ingest an experience trace into raw/ (immutable). */
export function ingestExperience(title: string, content: string, meta: Record<string, unknown> = {}): string {
  ensureLayers();
  const file = join(wikiRoot(), 'raw', ts().replace(/[:.]/g, '-') + '-' + slug(title) + '.md');
  const body = '---' + NL + 'title: ' + title + NL + 'time: ' + ts() + NL + 'meta: ' + JSON.stringify(meta) + NL + '---' + NL + NL + content;
  writeFileSync(file, body, 'utf8');
  return file;
}

/** Consolidate a raw trace into a wiki pattern (Wiki Maintainer). */
export function consolidatePattern(name: string, title: string, diagnosis: string, workaround: string): string {
  ensureLayers();
  const file = join(wikiRoot(), 'wiki', 'patterns', slug(name) + '.md');
  const body = '---' + NL + 'name: ' + slug(name) + NL + 'title: ' + title + NL + 'consolidated: ' + ts() + NL + '---' + NL + NL + '## Diagnosis' + NL + NL + diagnosis + NL + NL + '## Workaround' + NL + NL + workaround;
  writeFileSync(file, body, 'utf8');
  return file;
}

/** Append to the evolution log (logs.md). */
export function logEvolution(round: string, action: string, detail: string): void {
  ensureLayers();
  appendFileSync(join(wikiRoot(), 'wiki', 'logs.md'), NL + '- **' + ts() + '** [' + round + '] ' + action + ': ' + detail + NL, 'utf8');
}

/** Propose a skill update: write a candidate SKILL.md into skills/ (Skill Proposer). */
export function proposeSkill(name: string, description: string, body: string, fromPatterns: string[] = []): string {
  ensureLayers();
  const dir = join(wikiRoot(), 'skills', slug(name));
  mkdirSync(dir, { recursive: true });
  const sk = '---' + NL + 'name: ' + slug(name) + NL + 'description: ' + description + NL + 'source: wiki-proposed' + NL + 'patterns: ' + JSON.stringify(fromPatterns) + NL + 'proposed: ' + ts() + NL + '---' + NL + NL + body;
  writeFileSync(join(dir, 'SKILL.md'), sk, 'utf8');
  return join(dir, 'SKILL.md');
}

/** Gate: accept a candidate skill (move to active) or reject (remove). */
export function gateSkill(name: string, accept: boolean, score?: number): string {
  ensureLayers();
  const dir = join(wikiRoot(), 'skills', slug(name));
  const active = join(wikiRoot(), 'skills-active', slug(name));
  if (!existsSync(dir)) return 'skill not found: ' + name;
  if (accept) {
    mkdirSync(active, { recursive: true });
    writeFileSync(join(active, 'SKILL.md'), readFileSync(join(dir, 'SKILL.md'), 'utf8'), 'utf8');
    appendFileSync(join(wikiRoot(), 'wiki', 'skill-impact.md'), NL + '- **' + ts() + '** ACCEPT ' + name + (score != null ? ' score=' + score : '') + NL, 'utf8');
    logEvolution('gate', 'accept', name + (score != null ? ' (score ' + score + ')' : ''));
    return 'accepted: ' + name;
  }
  appendFileSync(join(wikiRoot(), 'wiki', 'skill-impact.md'), NL + '- **' + ts() + '** REJECT ' + name + ' — do not re-propose without new evidence' + NL, 'utf8');
  logEvolution('gate', 'reject', name);
  return 'rejected: ' + name;
}

/** Status of the skill wiki. */
export function wikiStatus(): { raw: number; patterns: number; skills: number; active: number; logs: string[] } {
  ensureLayers();
  const count = (d: string): number => { try { return readdirSync(d).length; } catch { return 0; } };
  const activeDir = join(wikiRoot(), 'skills-active');
  const logs = existsSync(join(wikiRoot(), 'wiki', 'logs.md'))
    ? readFileSync(join(wikiRoot(), 'wiki', 'logs.md'), 'utf8').split(NL).filter((l) => l.trim().startsWith('- **')).slice(-10)
    : [];
  return {
    raw: count(join(wikiRoot(), 'raw')),
    patterns: count(join(wikiRoot(), 'wiki', 'patterns')),
    skills: count(join(wikiRoot(), 'skills')),
    active: existsSync(activeDir) ? readdirSync(activeDir).length : 0,
    logs,
  };
}

/** Pull ACP compaction summaries from ~/.dsh/graph/graph.db as experience source. */
export function ingestFromAcp(limit = 10): string[] {
  try {
    const req = require as any;
    const { DatabaseSync } = req('node:sqlite');
    const base = process.env.DSH_HOME ?? join(homedir(), '.dsh');
    const dbPath = join(base, 'graph', 'graph.db');
    if (!existsSync(dbPath)) return [];
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const rows = db.prepare('SELECT session_id, seq_start, summary, created_at FROM checkpoints ORDER BY created_at DESC LIMIT ?').all(limit) as { session_id: string; seq_start: number; summary: string; created_at: number }[];
      const files: string[] = [];
      for (const r of rows) {
        files.push(ingestExperience('acp-cp-' + r.session_id + '-' + r.seq_start, r.summary, { source: 'acp_graph', session: r.session_id, seq: r.seq_start }));
      }
      return files;
    } finally { db.close(); }
  } catch { return []; }
}

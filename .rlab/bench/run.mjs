#!/usr/bin/env node
/**
 * MBPP-20 evaluator for DSH orchestration experiments.
 *
 * Tasks: Google's sanitized MBPP, 20 sampled deterministically and FROZEN before any plugin
 * change (tasks/mbpp-20.meta.json carries the source sha256). Grading uses each task's own
 * unit tests, run in a child PYTHON process (MBPP is Python — grading with node scored 0/20
 * even on MBPP's own reference solutions).
 *
 * Two things this file learned the hard way and now encodes:
 *   1. MBPP prose never states the function name the tests call; without it every task dies
 *      on NameError. requiredName() extracts it from the first assert and puts it in the prompt.
 *   2. A traceback's LAST line carries the exception; capturing the first two lines reported
 *      'Traceback (most recent call last)' and nothing else.
 *
 * Records { run, id, pass, tokens_in, tokens_out, wall_ms, error? } — tokens even when passing,
 * because the knobs under test mostly move COST (MASS: prompts +6 pts / topology +3 pts;
 * SKILL.state: 16x tokens with accuracy ties on open weights).
 *
 * Usage: node run.mjs [--n=20] [--dry] [--channel=<name>] [--keep]
 */
import { readFileSync, writeFileSync, appendFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const PY = process.env.DSH_BENCH_PYTHON ?? 'python';
const HERE = dirname(fileURLToPath(import.meta.url));
const TASKS = join(HERE, 'tasks', 'mbpp-20.jsonl');
const RESULTS = join(HERE, 'results.jsonl');
const HOME = process.env.USERPROFILE ?? process.env.HOME ?? '';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? 'true'] : [a, 'true'];
}));
const dry = args.dry === 'true';
const keep = args.keep === 'true';
const limit = Number(args.n ?? 20);

/** The exception is the LAST line of a traceback, not the first. */
function grade(code, tests, setup) {
  const src = [setup, code, ...tests].filter(Boolean).join('\n') + '\n';
  const dir = mkdtempSync(join(tmpdir(), 'mbpp-'));
  const file = join(dir, 'candidate.py');
  writeFileSync(file, src, 'utf8');
  try {
    execFileSync(PY, [file], { stdio: 'pipe', timeout: 10000 });
    return { pass: true };
  } catch (e) {
    const lines = String(e.stderr ?? e.message ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
    return { pass: false, error: lines.slice(-2).join(' | ').slice(0, 240) };
  }
}

function extractCode(text) {
  const fenced = String(text).match(/```(?:python|py)?\n([\s\S]*?)```/);
  return (fenced ? fenced[1] : String(text)).trim();
}

/** MBPP prose never names the function the tests call; extract it from the first assert. */
function requiredName(tests) {
  for (const s of tests ?? []) {
    const m = String(s).match(/assert\s+([A-Za-z_]\w*)\s*\(/);
    if (m) return m[1];
  }
  return null;
}

function ask(t) {
  const name = requiredName(t.tests);
  const head = name ? 'Your solution MUST define a function named ' + name + '.\n\n' : '';
  return t.prompt + '\n\n' + head +
    'Return ONLY a Python code block implementing the solution. You may use the standard library. Do not print anything.';
}

/** Keys are not in this process env; they live in ~/.dsh/.credentials.yaml (plain parsing only). */
function readCredential(name) {
  if (!name) return undefined;
  try {
    const text = readFileSync(join(HOME, '.dsh', '.credentials.yaml'), 'utf8');
    const line = text.split('\n').find((l) => l.trim().startsWith(name + ':'));
    return line ? line.slice(line.indexOf(':') + 1).trim().replace(/^["']|["']$/g, '') : undefined;
  } catch { return undefined; }
}

function makeAdapter(channelName) {
  const cfgPath = process.env.DSH_BUSYLOOP_CHANNELS ?? join(HOME, '.dsh', 'busyloop-channels.json');
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  const name = channelName ?? Object.keys(cfg)[0];
  const ch = cfg.channels?.[name] ?? cfg[name];
  if (!ch) throw new Error('channel "' + name + '" not found; have: ' + Object.keys(cfg).join(', '));
  const baseURL = String(ch.baseURL ?? ch.baseUrl).replace(/\/$/, '');
  const key = process.env[ch.keyEnv ?? ''] ?? readCredential(ch.keyEnv);
  if (!baseURL || !ch.model || !key) throw new Error('channel "' + name + '" needs baseURL/model/keyEnv');
  return async (prompt) => {
    const t0 = Date.now();
    const res = await fetch(baseURL + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({ model: ch.model, messages: [{ role: 'user', content: prompt }], temperature: 0, max_tokens: 1024 }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error('http ' + res.status + ' ' + JSON.stringify(j).slice(0, 120));
    return {
      text: j.choices?.[0]?.message?.content ?? '',
      tokens_in: j.usage?.prompt_tokens ?? 0,
      tokens_out: j.usage?.completion_tokens ?? 0,
      wall_ms: Date.now() - t0,
    };
  };
}

const tasks = readFileSync(TASKS, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).slice(0, limit);
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const adapter = dry ? null : makeAdapter(args.channel);
const rows = [];
for (const t of tasks) {
  const t0 = Date.now();
  let row;
  try {
    const reply = dry
      ? { text: '```python\ndef stub():\n    return 1\n```', tokens_in: 0, tokens_out: 0, wall_ms: 0 }
      : await adapter(ask(t));
    const code = extractCode(reply.text);
    if (keep) writeFileSync(join(HERE, 'last-reply-' + t.id + '.txt'), reply.text, 'utf8');
    const g = grade(code, t.tests, t.setup);
    row = { run: runId, id: t.id, pass: g.pass, tokens_in: reply.tokens_in, tokens_out: reply.tokens_out,
      wall_ms: dry ? Date.now() - t0 : reply.wall_ms, dry, ...(g.error ? { error: g.error } : {}) };
    if (keep) row.code_head = code.slice(0, 160);
  } catch (e) {
    row = { run: runId, id: t.id, pass: false, tokens_in: 0, tokens_out: 0, wall_ms: Date.now() - t0, error: String(e.message).slice(0, 200), dry };
  }
  rows.push(row);
  appendFileSync(RESULTS, JSON.stringify(row) + '\n', 'utf8');
  process.stdout.write((row.pass ? 'PASS ' : 'fail ') + row.id + ' (' + row.tokens_in + '+' + row.tokens_out + ' tok)\n');
}
const passed = rows.filter((r) => r.pass).length;
const sum = (k) => rows.reduce((s, r) => s + (r[k] ?? 0), 0);
console.log(JSON.stringify({ run: runId, dry, tasks: rows.length, passed,
  pass_rate: Math.round((passed / rows.length) * 1000) / 10,
  tokens_in: sum('tokens_in'), tokens_out: sum('tokens_out'), wall_ms: sum('wall_ms') }));

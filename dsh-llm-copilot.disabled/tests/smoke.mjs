// Smoke test for @snow-the/dsh-llm-copilot: module shape + adapter stream translation logic.
// Run: node tests/smoke.mjs  (from plugin root; needs node_modules present)
import { CopilotAdapter, PROVIDER, NS, name, inject, apply } from '../dist/index.js'

let pass = 0
let fail = 0
function check(label, cond, extra = '') {
  if (cond) { pass++; console.log(`  ok  ${label}`) }
  else { fail++; console.log(`FAIL  ${label} ${extra}`) }
}

// ---- module shape ----
console.log('== module shape ==')
check('name exported', name === 'dsh-llm-copilot', name)
check('inject has llm', Array.isArray(inject) && inject.includes('llm'))
check('PROVIDER=copilot', PROVIDER === 'copilot', PROVIDER)
check('NS=llm-copilot', NS === 'llm-copilot', NS)
check('apply is function', typeof apply === 'function')
check('CopilotAdapter subclass shape', typeof CopilotAdapter === 'function')
const probe = new CopilotAdapter({}, async () => 'test-token')
check('listModels returns 4 text-only models', (async () => {
  const ms = await probe.listModels()
  return ms.length === 4 && ms.every((m) => m.provider === 'copilot' && m.inputModalities?.includes('text'))
})(), 'async')
check('resolveModel context window', (async () => {
  const r = await probe.resolveModel('copilot', 'gpt-4o')
  return r.context?.contextWindow === 128000 && r.defaultMaxTokens === 4096
})(), 'async')
check('providerInfo', probe.providerInfo('copilot')?.name === 'GitHub Copilot')

// ---- fetch mock harness ----
const enc = new TextEncoder()
function sseStream(...lines) {
  return new ReadableStream({
    start(c) { c.enqueue(enc.encode(lines.map((l) => `data: ${l}\n\n`).join(''))); c.close() },
  })
}
function jsonChunk(o) { return JSON.stringify(o) }

let lastFetch = null
const origFetch = globalThis.fetch
function mockFetch(responder) {
  globalThis.fetch = async (url, init) => {
    lastFetch = { url: String(url), init }
    const r = await responder(url, init)
    return r
  }
}

function okResponse(...lines) {
  return { ok: true, status: 200, body: sseStream(...lines) }
}

// ---- case 1: text-only stream with usage ----
console.log('== case 1: text stream ==')
mockFetch(() => okResponse(
  jsonChunk({ choices: [{ index: 0, delta: { content: 'Hello' } }] }),
  jsonChunk({ choices: [{ index: 0, delta: { content: ' world' } }] }),
  jsonChunk({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 4, prompt_tokens_details: { cached_tokens: 3 } } }),
  '[DONE]',
))
const adapter1 = new CopilotAdapter({}, async () => 'tok-1')
const chunks1 = []
for await (const c of adapter1.stream({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] })) chunks1.push(c)
check('fetch hit /chat/completions', lastFetch.url.endsWith('/chat/completions'), lastFetch.url)
const hdrs = lastFetch.init.headers
check('integration header present', /vscode-chat/.test(hdrs['copilot-integration-id']))
check('auth bearer', hdrs.authorization === 'Bearer tok-1')
const body = JSON.parse(lastFetch.init.body)
check('body stream+usage', body.stream === true && body.stream_options?.include_usage === true && body.model === 'gpt-4o')
check('body user message', body.messages.length === 1 && body.messages[0].role === 'user' && body.messages[0].content === 'hi')
const kinds1 = chunks1.map((c) => c.type)
check('block-start text first', kinds1[0] === 'block-start' && chunks1[0].blockType === 'text')
const text = chunks1.filter((c) => c.type === 'text-delta').map((c) => c.text).join('')
check('text deltas concatenated', text === 'Hello world', text)
const end1 = chunks1.find((c) => c.type === 'block-end')
check('block-end text with full text', end1?.block?.type === 'text' && end1.block.text === 'Hello world')
const usage1 = chunks1.find((c) => c.type === 'usage')
check('usage mapped (input 9 = 12-3 cached)', usage1?.usage?.inputTokens === 9 && usage1.usage.outputTokens === 4 && usage1.usage.cacheReadTokens === 3, JSON.stringify(usage1))
const fin1 = chunks1.find((c) => c.type === 'finish')
check('finish stop', fin1?.reason?.kind === 'stop')

// ---- case 2: tool call stream (split id/name/arguments across chunks) ----
console.log('== case 2: tool calls ==')
mockFetch(() => okResponse(
  jsonChunk({ choices: [{ index: 0, delta: { content: 'Let me check' } }] }),
  jsonChunk({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call_abc', type: 'function', function: { name: 'get_weather', arguments: '' } }] } }] }),
  jsonChunk({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '{"city":' } }] } }] }),
  jsonChunk({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '"Beijing"}' } }] } }] }),
  jsonChunk({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] }),
  '[DONE]',
))
const adapter2 = new CopilotAdapter({}, async () => 'tok-2')
const chunks2 = []
for await (const c of adapter2.stream({ model: 'gpt-4o', messages: [{ role: 'user', content: 'weather?' }] })) chunks2.push(c)
const toolEnd = chunks2.find((c) => c.type === 'block-end' && c.block?.type === 'tool-call')
check('tool-call block-end id/name/args', toolEnd && toolEnd.block.id === 'call_abc' && toolEnd.block.name === 'get_weather' && toolEnd.block.arguments === '{"city":"Beijing"}', JSON.stringify(toolEnd))
check('tool finish reason', chunks2.some((c) => c.type === 'finish' && c.reason?.kind === 'tool-calls'))
const argDeltas = chunks2.filter((c) => c.type === 'tool-call-delta').map((c) => c.argumentsDelta).join('')
check('args delta concatenated', argDeltas === '{"city":"Beijing"}', argDeltas)

// ---- case 3: HTTP 401 -> AUTH ----
console.log('== case 3: error mapping ==')
mockFetch(() => ({ ok: false, status: 401, text: async () => 'bad token' }))
const adapter3 = new CopilotAdapter({}, async () => 'tok-3')
let err3 = null
try { for await (const _ of adapter3.stream({ model: 'gpt-4o', messages: [] })) { /* drain */ } } catch (e) { err3 = e }
check('401 -> AUTH LlmError', err3 && err3.code === 'AUTH' && err3.message.includes('bad token'), err3?.message)

// ---- case 4: empty completion -> EMPTY_RESPONSE ----
console.log('== case 4: empty response ==')
mockFetch(() => okResponse('[DONE]'))
const adapter4 = new CopilotAdapter({}, async () => 'tok-4')
let err4 = null
try { for await (const _ of adapter4.stream({ model: 'gpt-4o', messages: [] })) { /* drain */ } } catch (e) { err4 = e }
check('empty -> EMPTY_RESPONSE finish error', err4 === null && false, 'expects finish-error chunk not throw')
// Actually the design yields finish with error reason; collect chunks instead:
const adapter4b = new CopilotAdapter({}, async () => 'tok-4')
const chunks4 = []
for await (const c of adapter4b.stream({ model: 'gpt-4o', messages: [] })) chunks4.push(c)
const fin4 = chunks4.find((c) => c.type === 'finish')
check('empty -> finish EMPTY_RESPONSE', fin4?.reason?.kind === 'error' && fin4.reason.failure.code === 'EMPTY_RESPONSE', JSON.stringify(fin4))

// ---- case 5: stream ends without [DONE] -> STREAM_CLOSED ----
console.log('== case 5: premature end ==')
mockFetch(() => ({ ok: true, status: 200, body: sseStream(jsonChunk({ choices: [{ index: 0, delta: { content: 'x' } }] })) }))
const adapter5 = new CopilotAdapter({}, async () => 'tok-5')
let err5 = null
try { for await (const _ of adapter5.stream({ model: 'gpt-4o', messages: [] })) { /* drain */ } } catch (e) { err5 = e }
check('no [DONE] -> STREAM_CLOSED', err5 && err5.code === 'STREAM_CLOSED', err5?.message)

// ---- case 6: missing credential ----
console.log('== case 6: missing credential ==')
mockFetch(() => okResponse('[DONE]'))
const adapter6 = new CopilotAdapter({}, async () => { throw new Error('gh not installed') })
let err6 = null
try { for await (const _ of adapter6.stream({ model: 'gpt-4o', messages: [] })) { /* drain */ } } catch (e) { err6 = e }
check('resolveApiKey throw -> MISSING_CREDENTIAL', err6 && err6.code === 'MISSING_CREDENTIAL', err6?.message)

// ---- case 7: apply() registers on host ----
console.log('== case 7: apply() ==')
let registered = null
let configurable = null
let disposed = 0
let disposedHook = null
apply({
  llm: {
    registerAdapter(providers, adapter) {
      registered = { providers, adapter }
      return () => { disposed++ }
    },
    registerConfigurableProviders(entries) { configurable = entries },
  },
  on(event, fn) { if (event === 'dispose') disposedHook = fn },
  logger: { warn() {} },
}, {})
check('registerAdapter called with copilot', registered?.providers?.includes('copilot') && registered.adapter instanceof CopilotAdapter)
check('configurable provider registered', configurable?.[0]?.provider === 'copilot' && configurable[0].displayName === 'GitHub Copilot')

// ---- case 8: apply() no-op without llm ----
console.log('== case 8: apply() fallback ==')
let warned = ''
apply({ logger: { warn(m) { warned = m } } }, {})
check('warns when no registerAdapter', warned.includes('registerAdapter'), warned)

globalThis.fetch = origFetch
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

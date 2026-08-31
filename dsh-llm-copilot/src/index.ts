import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { LlmAdapter, LlmError, attributionHeaders, CallId } from '@deepseek-ai/dsh-llm'
import type {
  GenerateOptions,
  StreamChunk,
  LlmProviderInfo,
  LlmModelInfo,
  LlmResolvedModelInfo,
  ResolvedRetryPolicy,
  TokenUsage,
  FinishReason,
} from '@deepseek-ai/dsh-llm'
import { EventSourceParserStream } from 'eventsource-parser/stream'

export const name = 'dsh-llm-copilot'
export const description =
  'DSH LLM provider adapter for GitHub Copilot (OpenAI-compatible chat/completions, Bearer = `gh auth token`). Student plan models: gpt-4o / gpt-4o-mini / gpt-4.1 / gpt-3.5-turbo.'
export const inject = ['llm']

export const PROVIDER = 'copilot'
export const NS = 'llm-copilot'

const execFileP = promisify(execFile)
const DEFAULT_BASE_URL = 'https://api.githubcopilot.com'
const DEFAULT_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-3.5-turbo'] as const
const TOKEN_TTL_MS = 60_000

/** Copilot provider configuration (plugin settings + adapter options). */
export interface CopilotConfig {
  /** API base, default https://api.githubcopilot.com */
  baseURL?: string
  /** Static token override; when absent the adapter shells out to `gh auth token` (TTL-cached). */
  apiKey?: string
  /** Model catalog advertised to the host (default: the four student-plan models). */
  models?: readonly string[]
  /** Context window advertised for gpt-4o (default 128000). */
  contextWindow?: number
  /** Default max output tokens (default 4096). */
  maxTokens?: number
}

/* ------------------------------------------------------------------ */
/*  serialize: GenerateOptions -> chat/completions request body        */
/* ------------------------------------------------------------------ */

type BlockLike = {
  type?: string
  text?: string
  id?: string
  name?: string
  arguments?: string
  toolCallId?: string
  content?: unknown
}

function flattenText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((b) => {
        if (typeof b === 'string') return b
        const block = b as BlockLike
        if (typeof block.text === 'string') return block.text
        return ''
      })
      .join('')
  }
  return String(content ?? '')
}

function serializeChatRequest(options: GenerateOptions): Record<string, unknown> {
  const messages: Record<string, unknown>[] = []
  if (options.system !== undefined) messages.push({ role: 'system', content: options.system })
  for (const m of options.messages) {
    const content = m.content as unknown
    if (m.role === 'system') {
      messages.push({ role: 'system', content: flattenText(content) })
    } else if (m.role === 'assistant') {
      const blocks = Array.isArray(content) ? (content as BlockLike[]) : []
      const toolCalls = blocks
        .filter((b) => b.type === 'tool-call')
        .map((b) => ({
          id: b.id,
          type: 'function',
          function: { name: b.name, arguments: typeof b.arguments === 'string' ? b.arguments : '' },
        }))
      messages.push({
        role: 'assistant',
        content: flattenText(content),
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      })
    } else {
      // user (or any other role): tool-result blocks become independent {role:'tool'} messages
      const blocks = Array.isArray(content) ? (content as BlockLike[]) : []
      const toolResults = blocks.filter((b) => b.type === 'tool-result')
      const text = flattenText(content)
      if (text.length || toolResults.length === 0) messages.push({ role: 'user', content: text })
      for (const r of toolResults) {
        messages.push({
          role: 'tool',
          tool_call_id: r.toolCallId,
          content: flattenText(r.content) || '(no output)',
        })
      }
    }
  }
  return {
    model: options.model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    ...(options.tools?.length
      ? {
          tools: options.tools.map((t) => ({
            type: 'function',
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            },
          })),
        }
      : {}),
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
    ...(options.stop !== undefined ? { stop: options.stop } : {}),
  }
}

/* ------------------------------------------------------------------ */
/*  SSE: parse + translate into StreamChunk                            */
/* ------------------------------------------------------------------ */

async function* parseSse(stream: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const events = stream
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream() as unknown as TransformStream)
  for await (const { data } of events as unknown as AsyncIterable<{ data: string }>) {
    yield data
    if (data === '[DONE]') return
  }
  throw new LlmError('SSE stream ended without [DONE]', 'STREAM_CLOSED')
}

function mapFinishReason(reason: string): FinishReason {
  if (reason === 'stop') return { kind: 'stop' }
  if (reason === 'tool_calls') return { kind: 'tool-calls' }
  if (reason === 'length') return { kind: 'max-tokens' }
  return { kind: 'error', failure: { code: reason.toUpperCase(), message: `provider finish_reason: ${reason}` } }
}

function mapUsage(u: Record<string, unknown> | undefined): TokenUsage | undefined {
  if (!u) return undefined
  const details = (u.prompt_tokens_details ?? {}) as Record<string, unknown>
  const compDetails = (u.completion_tokens_details ?? {}) as Record<string, unknown>
  const cacheRead = typeof details.cached_tokens === 'number' ? details.cached_tokens : 0
  const promptTokens = typeof u.prompt_tokens === 'number' ? u.prompt_tokens : 0
  return {
    inputTokens: Math.max(0, promptTokens - cacheRead),
    outputTokens: typeof u.completion_tokens === 'number' ? u.completion_tokens : 0,
    ...(cacheRead > 0 ? { cacheReadTokens: cacheRead } : {}),
    ...(typeof compDetails.reasoning_tokens === 'number' ? { reasoningTokens: compDetails.reasoning_tokens } : {}),
  }
}

type PendingBlock =
  | { kind: 'text'; index: number; text: string }
  | { kind: 'tool'; index: number; id?: string; name?: string; args: string }

async function* translateCopilot(payloads: AsyncIterable<string>): AsyncIterable<StreamChunk> {
  const order: PendingBlock[] = []
  let pendingFinish: FinishReason | undefined
  let pendingUsage: TokenUsage | undefined

  for await (const payload of payloads) {
    if (payload === '[DONE]') {
      for (const block of order) {
        if (block.kind === 'text') {
          yield { type: 'block-end', index: block.index, block: { type: 'text', text: block.text } }
        } else {
          yield {
            type: 'block-end',
            index: block.index,
            block: {
              type: 'tool-call',
              id: CallId(block.id ?? ''),
              name: block.name ?? '',
              arguments: block.args,
            },
          }
        }
      }
      if (pendingUsage) yield { type: 'usage', usage: pendingUsage }
      const reason = pendingFinish ?? ({ kind: 'stop' } as FinishReason)
      if (reason.kind === 'stop' && order.length === 0) {
        yield {
          type: 'finish',
          reason: { kind: 'error', failure: { code: 'EMPTY_RESPONSE', message: 'empty completion' } },
        }
      } else {
        yield { type: 'finish', reason }
      }
      return
    }

    let chunk: Record<string, unknown>
    try {
      chunk = JSON.parse(payload) as Record<string, unknown>
    } catch {
      throw new LlmError('malformed SSE payload', 'MALFORMED_RESPONSE')
    }

    for (const choice of (chunk.choices ?? []) as Record<string, unknown>[]) {
      const delta = (choice.delta ?? {}) as Record<string, unknown>
      if (typeof delta.content === 'string' && delta.content.length > 0) {
        let textBlock = order.find((b): b is Extract<PendingBlock, { kind: 'text' }> => b.kind === 'text' && b.index === order.length - 1 && b.kind === 'text')
        // ^ find the last text block if it is the most recent one; otherwise open a new one
        const last = order[order.length - 1]
        if (!last || last.kind !== 'text') {
          textBlock = { kind: 'text', index: order.length, text: '' }
          order.push(textBlock)
          yield { type: 'block-start', index: textBlock.index, blockType: 'text' }
        } else {
          textBlock = last
        }
        textBlock.text += delta.content
        yield { type: 'text-delta', index: textBlock.index, text: delta.content }
      }
      for (const call of (delta.tool_calls ?? []) as Record<string, unknown>[]) {
        const ci = typeof call.index === 'number' ? call.index : 0
        let tb = order.find((b): b is Extract<PendingBlock, { kind: 'tool' }> => b.kind === 'tool' && b.index === ci)
        const fn = (call.function ?? {}) as Record<string, unknown>
        if (!tb) {
          tb = {
            kind: 'tool',
            index: order.length,
            id: typeof call.id === 'string' ? call.id : undefined,
            name: typeof fn.name === 'string' ? fn.name : undefined,
            args: '',
          }
          order.push(tb)
          yield { type: 'block-start', index: tb.index, blockType: 'tool-call' }
        }
        if (typeof call.id === 'string' && call.id) {
          tb.id = call.id
        }
        if (typeof fn.name === 'string' && fn.name) {
          tb.name = fn.name
        }
        const frag = typeof fn.arguments === 'string' ? fn.arguments : ''
        if (frag) tb.args += frag
        yield { type: 'tool-call-delta', index: tb.index, id: CallId(tb.id ?? ''), name: tb.name, argumentsDelta: frag }
      }
      if (typeof choice.finish_reason === 'string') {
        pendingFinish = mapFinishReason(choice.finish_reason)
      }
    }
    const usage = mapUsage(chunk.usage as Record<string, unknown> | undefined)
    if (usage) pendingUsage = usage
  }
  throw new LlmError('SSE stream ended without [DONE]', 'STREAM_CLOSED')
}

/* ------------------------------------------------------------------ */
/*  CopilotAdapter                                                     */
/* ------------------------------------------------------------------ */

function httpErrorCode(status: number): string {
  if (status === 401 || status === 403) return 'AUTH'
  if (status === 429) return 'RATE_LIMIT'
  if (status === 400) return 'INVALID_REQUEST'
  if (status >= 500) return 'SERVER'
  return `HTTP_${status}`
}

export class CopilotAdapter extends LlmAdapter {
  private readonly baseURL: string
  private readonly contextWindow: number
  private readonly maxTokens: number
  private readonly models: readonly string[]
  private readonly resolveApiKey: () => Promise<string>

  constructor(config: CopilotConfig, resolveApiKey: () => Promise<string>) {
    super()
    this.baseURL = config.baseURL ?? DEFAULT_BASE_URL
    this.contextWindow = config.contextWindow ?? 128_000
    this.maxTokens = config.maxTokens ?? 4096
    this.models = config.models && config.models.length ? config.models : DEFAULT_MODELS
    this.resolveApiKey = resolveApiKey
  }

  providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: 'GitHub Copilot' }
  }

  providerRetryPolicy(): ResolvedRetryPolicy | undefined {
    return undefined
  }

  async listModels(): Promise<readonly LlmModelInfo[]> {
    return this.models.map((id) => ({ provider: PROVIDER, id, name: id, inputModalities: ['text'] }))
  }

  async resolveModel(_provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return {
      provider: PROVIDER,
      id: model,
      name: model,
      inputModalities: ['text'],
      context: { contextWindow: this.contextWindow },
      defaultMaxTokens: this.maxTokens,
    }
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    let apiKey: string
    try {
      apiKey = await this.resolveApiKey()
    } catch (err) {
      throw new LlmError(err instanceof Error ? err.message : String(err), 'MISSING_CREDENTIAL')
    }

    const headers: Record<string, string> = {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      accept: 'text/event-stream',
      ...attributionHeaders(),
      'copilot-integration-id': 'vscode-chat',
      'editor-version': 'vscode/1.103.2',
      'editor-plugin-version': 'copilot-chat/0.29.1',
      'openai-intent': 'conversation-panel',
      'user-agent': 'GitHubCopilotChat/0.29.1',
      'x-github-api-version': '2025-04-01',
    }

    const body = serializeChatRequest(options)

    let response: Response
    try {
      response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: options.signal,
      })
    } catch (err) {
      if (options.signal?.aborted) throw new LlmError('request aborted', 'ABORTED')
      throw new LlmError(err instanceof Error ? err.message : String(err), 'TRANSPORT')
    }

    if (!response.ok) {
      let detail = ''
      try {
        detail = await response.text()
      } catch {
        /* ignore body read failure */
      }
      throw new LlmError(
        `GitHub Copilot request failed (${response.status}): ${detail.slice(0, 300)}`,
        httpErrorCode(response.status),
      )
    }
    if (!response.body) throw new LlmError('GitHub Copilot returned no response body', 'EMPTY_RESPONSE')

    yield* translateCopilot(parseSse(response.body))
  }
}

/* ------------------------------------------------------------------ */
/*  Plugin entry                                                       */
/* ------------------------------------------------------------------ */

export function apply(ctx: {
  llm?: {
    registerAdapter?(providers: string[], adapter: unknown): () => void
    registerConfigurableProviders?(entries: { provider: string; displayName: string; settingsNs: string; settingsPath: string[] }[]): void
  }
  on?(event: string, listener: () => void): void
  logger?: { warn?(msg: string): void }
}, config: CopilotConfig = {}): void {
  const llm = ctx.llm
  if (!llm?.registerAdapter) {
    ctx.logger?.warn?.('[dsh-llm-copilot] host ctx.llm has no registerAdapter; provider not registered')
    return
  }

  let tokenCache: { token: string; at: number } | undefined
  const resolveApiKey = async (): Promise<string> => {
    if (config.apiKey) return config.apiKey
    const now = Date.now()
    if (tokenCache && now - tokenCache.at < TOKEN_TTL_MS) return tokenCache.token
    let stdout = ''
    try {
      const res = await execFileP('gh', ['auth', 'token'], { timeout: 15_000, windowsHide: true })
      stdout = res.stdout
    } catch (err) {
      throw new Error(
        `no GitHub token: run \`gh auth login\` first (${err instanceof Error ? err.message : String(err)})`,
      )
    }
    const token = stdout.trim()
    if (!token) throw new Error('`gh auth token` returned an empty token')
    tokenCache = { token, at: now }
    return token
  }

  const adapter = new CopilotAdapter(config, resolveApiKey)
  try {
    llm.registerConfigurableProviders?.([
      { provider: PROVIDER, displayName: 'GitHub Copilot', settingsNs: NS, settingsPath: [] },
    ])
  } catch {
    /* optional UI sugar; non-fatal */
  }
  const registration = llm.registerAdapter([PROVIDER], adapter)
  ctx.on?.('dispose', () => {
    try {
      registration()
    } catch {
      /* already disposed */
    }
  })
}

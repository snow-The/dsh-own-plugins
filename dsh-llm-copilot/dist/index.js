// src/index.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { LlmAdapter, LlmError, attributionHeaders, CallId } from "@deepseek-ai/dsh-llm";

// node_modules/.pnpm/eventsource-parser@3.1.1/node_modules/eventsource-parser/dist/index.js
var ParseError = class extends Error {
  constructor(message, options) {
    super(message), this.name = "ParseError", this.type = options.type, this.field = options.field, this.value = options.value, this.line = options.line;
  }
};
var LF = 10;
var CR = 13;
var SPACE = 32;
function noop(_arg) {
}
function createParser(config) {
  if (typeof config == "function")
    throw new TypeError(
      "`config` must be an object, got a function instead. Did you mean `createParser({onEvent: fn})`?"
    );
  const { onEvent = noop, onError = noop, onRetry = noop, onComment, maxBufferSize } = config, pendingFragments = [];
  let pendingFragmentsLength = 0, isFirstChunk = true, id, data = "", dataLines = 0, eventType, terminated = false;
  function feed(chunk) {
    if (terminated)
      throw new Error(
        "Cannot feed parser: it was terminated after exceeding the configured max buffer size. Call `reset()` to resume parsing."
      );
    if (isFirstChunk && (isFirstChunk = false, chunk.charCodeAt(0) === 239 && chunk.charCodeAt(1) === 187 && chunk.charCodeAt(2) === 191 && (chunk = chunk.slice(3))), pendingFragments.length === 0) {
      const trailing2 = processLines(chunk);
      trailing2 !== "" && (pendingFragments.push(trailing2), pendingFragmentsLength = trailing2.length), checkBufferSize();
      return;
    }
    if (chunk.indexOf(`
`) === -1 && chunk.indexOf("\r") === -1) {
      pendingFragments.push(chunk), pendingFragmentsLength += chunk.length, checkBufferSize();
      return;
    }
    pendingFragments.push(chunk);
    const input = pendingFragments.join("");
    pendingFragments.length = 0, pendingFragmentsLength = 0;
    const trailing = processLines(input);
    trailing !== "" && (pendingFragments.push(trailing), pendingFragmentsLength = trailing.length), checkBufferSize();
  }
  function checkBufferSize() {
    maxBufferSize !== void 0 && (pendingFragmentsLength + data.length <= maxBufferSize || (terminated = true, pendingFragments.length = 0, pendingFragmentsLength = 0, id = void 0, data = "", dataLines = 0, eventType = void 0, onError(
      new ParseError(`Buffered data exceeded max buffer size of ${maxBufferSize} characters`, {
        type: "max-buffer-size-exceeded"
      })
    )));
  }
  function processLines(chunk) {
    let searchIndex = 0;
    if (chunk.indexOf("\r") === -1) {
      let lfIndex = chunk.indexOf(`
`, searchIndex);
      for (; lfIndex !== -1; ) {
        if (searchIndex === lfIndex) {
          dataLines > 0 && onEvent({ id, event: eventType, data }), id = void 0, data = "", dataLines = 0, eventType = void 0, searchIndex = lfIndex + 1, lfIndex = chunk.indexOf(`
`, searchIndex);
          continue;
        }
        const firstCharCode = chunk.charCodeAt(searchIndex);
        if (isDataPrefix(chunk, searchIndex, firstCharCode)) {
          const valueStart = chunk.charCodeAt(searchIndex + 5) === SPACE ? searchIndex + 6 : searchIndex + 5, value = chunk.slice(valueStart, lfIndex);
          if (dataLines === 0 && chunk.charCodeAt(lfIndex + 1) === LF) {
            onEvent({ id, event: eventType, data: value }), id = void 0, data = "", eventType = void 0, searchIndex = lfIndex + 2, lfIndex = chunk.indexOf(`
`, searchIndex);
            continue;
          }
          data = dataLines === 0 ? value : `${data}
${value}`, dataLines++;
        } else isEventPrefix(chunk, searchIndex, firstCharCode) ? eventType = chunk.slice(
          chunk.charCodeAt(searchIndex + 6) === SPACE ? searchIndex + 7 : searchIndex + 6,
          lfIndex
        ) || void 0 : parseLine(chunk, searchIndex, lfIndex);
        searchIndex = lfIndex + 1, lfIndex = chunk.indexOf(`
`, searchIndex);
      }
      return chunk.slice(searchIndex);
    }
    for (; searchIndex < chunk.length; ) {
      const crIndex = chunk.indexOf("\r", searchIndex), lfIndex = chunk.indexOf(`
`, searchIndex);
      let lineEnd = -1;
      if (crIndex !== -1 && lfIndex !== -1 ? lineEnd = crIndex < lfIndex ? crIndex : lfIndex : crIndex !== -1 ? crIndex === chunk.length - 1 ? lineEnd = -1 : lineEnd = crIndex : lfIndex !== -1 && (lineEnd = lfIndex), lineEnd === -1)
        break;
      parseLine(chunk, searchIndex, lineEnd), searchIndex = lineEnd + 1, chunk.charCodeAt(searchIndex - 1) === CR && chunk.charCodeAt(searchIndex) === LF && searchIndex++;
    }
    return chunk.slice(searchIndex);
  }
  function parseLine(chunk, start, end) {
    if (start === end) {
      dispatchEvent();
      return;
    }
    const firstCharCode = chunk.charCodeAt(start);
    if (isDataPrefix(chunk, start, firstCharCode)) {
      const valueStart = chunk.charCodeAt(start + 5) === SPACE ? start + 6 : start + 5, value2 = chunk.slice(valueStart, end);
      data = dataLines === 0 ? value2 : `${data}
${value2}`, dataLines++;
      return;
    }
    if (isEventPrefix(chunk, start, firstCharCode)) {
      eventType = chunk.slice(chunk.charCodeAt(start + 6) === SPACE ? start + 7 : start + 6, end) || void 0;
      return;
    }
    if (firstCharCode === 105 && chunk.charCodeAt(start + 1) === 100 && chunk.charCodeAt(start + 2) === 58) {
      const value2 = chunk.slice(chunk.charCodeAt(start + 3) === SPACE ? start + 4 : start + 3, end);
      value2.includes("\0") || (id = value2);
      return;
    }
    if (firstCharCode === 58) {
      if (onComment) {
        const line2 = chunk.slice(start, end);
        onComment(line2.slice(chunk.charCodeAt(start + 1) === SPACE ? 2 : 1));
      }
      return;
    }
    const line = chunk.slice(start, end), fieldSeparatorIndex = line.indexOf(":");
    if (fieldSeparatorIndex === -1) {
      processField(line, "", line);
      return;
    }
    const field = line.slice(0, fieldSeparatorIndex), offset = line.charCodeAt(fieldSeparatorIndex + 1) === SPACE ? 2 : 1, value = line.slice(fieldSeparatorIndex + offset);
    processField(field, value, line);
  }
  function processField(field, value, line) {
    switch (field) {
      case "event":
        eventType = value || void 0;
        break;
      case "data":
        data = dataLines === 0 ? value : `${data}
${value}`, dataLines++;
        break;
      case "id":
        value.includes("\0") || (id = value);
        break;
      case "retry":
        /^\d+$/.test(value) ? onRetry(parseInt(value, 10)) : onError(
          new ParseError(`Invalid \`retry\` value: "${value}"`, {
            type: "invalid-retry",
            value,
            line
          })
        );
        break;
      default:
        onError(
          new ParseError(
            `Unknown field "${field.length > 20 ? `${field.slice(0, 20)}\u2026` : field}"`,
            { type: "unknown-field", field, value, line }
          )
        );
        break;
    }
  }
  function dispatchEvent() {
    dataLines > 0 && onEvent({
      id,
      event: eventType,
      data
    }), id = void 0, data = "", dataLines = 0, eventType = void 0;
  }
  function reset(options = {}) {
    if (options.consume && pendingFragments.length > 0) {
      const incompleteLine = pendingFragments.join("");
      parseLine(incompleteLine, 0, incompleteLine.length);
    }
    isFirstChunk = true, id = void 0, data = "", dataLines = 0, eventType = void 0, pendingFragments.length = 0, pendingFragmentsLength = 0, terminated = false;
  }
  return { feed, reset };
}
function isDataPrefix(chunk, i, firstCharCode) {
  return firstCharCode === 100 && chunk.charCodeAt(i + 1) === 97 && chunk.charCodeAt(i + 2) === 116 && chunk.charCodeAt(i + 3) === 97 && chunk.charCodeAt(i + 4) === 58;
}
function isEventPrefix(chunk, i, firstCharCode) {
  return firstCharCode === 101 && chunk.charCodeAt(i + 1) === 118 && chunk.charCodeAt(i + 2) === 101 && chunk.charCodeAt(i + 3) === 110 && chunk.charCodeAt(i + 4) === 116 && chunk.charCodeAt(i + 5) === 58;
}

// node_modules/.pnpm/eventsource-parser@3.1.1/node_modules/eventsource-parser/dist/stream.js
var EventSourceParserStream = class extends TransformStream {
  constructor({ onError, onRetry, onComment, maxBufferSize } = {}) {
    let parser;
    super({
      start(controller) {
        parser = createParser({
          onEvent: (event) => {
            controller.enqueue(event);
          },
          onError(error) {
            typeof onError == "function" && onError(error), (onError === "terminate" || error.type === "max-buffer-size-exceeded") && controller.error(error);
          },
          onRetry,
          onComment,
          maxBufferSize
        });
      },
      transform(chunk) {
        parser.feed(chunk);
      }
    });
  }
};

// src/index.ts
var name = "dsh-llm-copilot";
var description = "DSH LLM provider adapter for GitHub Copilot (OpenAI-compatible chat/completions, Bearer = `gh auth token`). Student plan models: gpt-4o / gpt-4o-mini / gpt-4.1 / gpt-3.5-turbo.";
var inject = ["llm"];
var PROVIDER = "copilot";
var NS = "llm-copilot";
var execFileP = promisify(execFile);
var DEFAULT_BASE_URL = "https://api.githubcopilot.com";
var DEFAULT_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-3.5-turbo"];
var TOKEN_TTL_MS = 6e4;
function flattenText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((b) => {
      if (typeof b === "string") return b;
      const block = b;
      if (typeof block.text === "string") return block.text;
      return "";
    }).join("");
  }
  return String(content ?? "");
}
function serializeChatRequest(options) {
  const messages = [];
  if (options.system !== void 0) messages.push({ role: "system", content: options.system });
  for (const m of options.messages) {
    const content = m.content;
    if (m.role === "system") {
      messages.push({ role: "system", content: flattenText(content) });
    } else if (m.role === "assistant") {
      const blocks = Array.isArray(content) ? content : [];
      const toolCalls = blocks.filter((b) => b.type === "tool-call").map((b) => ({
        id: b.id,
        type: "function",
        function: { name: b.name, arguments: typeof b.arguments === "string" ? b.arguments : "" }
      }));
      messages.push({
        role: "assistant",
        content: flattenText(content),
        ...toolCalls.length ? { tool_calls: toolCalls } : {}
      });
    } else {
      const blocks = Array.isArray(content) ? content : [];
      const toolResults = blocks.filter((b) => b.type === "tool-result");
      const text = flattenText(content);
      if (text.length || toolResults.length === 0) messages.push({ role: "user", content: text });
      for (const r of toolResults) {
        messages.push({
          role: "tool",
          tool_call_id: r.toolCallId,
          content: flattenText(r.content) || "(no output)"
        });
      }
    }
  }
  return {
    model: options.model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    ...options.tools?.length ? {
      tools: options.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      }))
    } : {},
    ...options.temperature !== void 0 ? { temperature: options.temperature } : {},
    ...options.maxTokens !== void 0 ? { max_tokens: options.maxTokens } : {},
    ...options.stop !== void 0 ? { stop: options.stop } : {}
  };
}
async function* parseSse(stream) {
  const events = stream.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream());
  for await (const { data } of events) {
    yield data;
    if (data === "[DONE]") return;
  }
  throw new LlmError("SSE stream ended without [DONE]", "STREAM_CLOSED");
}
function mapFinishReason(reason) {
  if (reason === "stop") return { kind: "stop" };
  if (reason === "tool_calls") return { kind: "tool-calls" };
  if (reason === "length") return { kind: "max-tokens" };
  return { kind: "error", failure: { code: reason.toUpperCase(), message: `provider finish_reason: ${reason}` } };
}
function mapUsage(u) {
  if (!u) return void 0;
  const details = u.prompt_tokens_details ?? {};
  const compDetails = u.completion_tokens_details ?? {};
  const cacheRead = typeof details.cached_tokens === "number" ? details.cached_tokens : 0;
  const promptTokens = typeof u.prompt_tokens === "number" ? u.prompt_tokens : 0;
  return {
    inputTokens: Math.max(0, promptTokens - cacheRead),
    outputTokens: typeof u.completion_tokens === "number" ? u.completion_tokens : 0,
    ...cacheRead > 0 ? { cacheReadTokens: cacheRead } : {},
    ...typeof compDetails.reasoning_tokens === "number" ? { reasoningTokens: compDetails.reasoning_tokens } : {}
  };
}
async function* translateCopilot(payloads) {
  const order = [];
  let pendingFinish;
  let pendingUsage;
  for await (const payload of payloads) {
    if (payload === "[DONE]") {
      for (const block of order) {
        if (block.kind === "text") {
          yield { type: "block-end", index: block.index, block: { type: "text", text: block.text } };
        } else {
          yield {
            type: "block-end",
            index: block.index,
            block: {
              type: "tool-call",
              id: CallId(block.id ?? ""),
              name: block.name ?? "",
              arguments: block.args
            }
          };
        }
      }
      if (pendingUsage) yield { type: "usage", usage: pendingUsage };
      const reason = pendingFinish ?? { kind: "stop" };
      if (reason.kind === "stop" && order.length === 0) {
        yield {
          type: "finish",
          reason: { kind: "error", failure: { code: "EMPTY_RESPONSE", message: "empty completion" } }
        };
      } else {
        yield { type: "finish", reason };
      }
      return;
    }
    let chunk;
    try {
      chunk = JSON.parse(payload);
    } catch {
      throw new LlmError("malformed SSE payload", "MALFORMED_RESPONSE");
    }
    for (const choice of chunk.choices ?? []) {
      const delta = choice.delta ?? {};
      if (typeof delta.content === "string" && delta.content.length > 0) {
        let textBlock = order.find((b) => b.kind === "text" && b.index === order.length - 1 && b.kind === "text");
        const last = order[order.length - 1];
        if (!last || last.kind !== "text") {
          textBlock = { kind: "text", index: order.length, text: "" };
          order.push(textBlock);
          yield { type: "block-start", index: textBlock.index, blockType: "text" };
        } else {
          textBlock = last;
        }
        textBlock.text += delta.content;
        yield { type: "text-delta", index: textBlock.index, text: delta.content };
      }
      for (const call of delta.tool_calls ?? []) {
        const ci = typeof call.index === "number" ? call.index : 0;
        let tb = order.find((b) => b.kind === "tool" && b.index === ci);
        const fn = call.function ?? {};
        if (!tb) {
          tb = {
            kind: "tool",
            index: order.length,
            id: typeof call.id === "string" ? call.id : void 0,
            name: typeof fn.name === "string" ? fn.name : void 0,
            args: ""
          };
          order.push(tb);
          yield { type: "block-start", index: tb.index, blockType: "tool-call" };
        }
        if (typeof call.id === "string" && call.id) {
          tb.id = call.id;
        }
        if (typeof fn.name === "string" && fn.name) {
          tb.name = fn.name;
        }
        const frag = typeof fn.arguments === "string" ? fn.arguments : "";
        if (frag) tb.args += frag;
        yield { type: "tool-call-delta", index: tb.index, id: CallId(tb.id ?? ""), name: tb.name, argumentsDelta: frag };
      }
      if (typeof choice.finish_reason === "string") {
        pendingFinish = mapFinishReason(choice.finish_reason);
      }
    }
    const usage = mapUsage(chunk.usage);
    if (usage) pendingUsage = usage;
  }
  throw new LlmError("SSE stream ended without [DONE]", "STREAM_CLOSED");
}
function httpErrorCode(status) {
  if (status === 401 || status === 403) return "AUTH";
  if (status === 429) return "RATE_LIMIT";
  if (status === 400) return "INVALID_REQUEST";
  if (status >= 500) return "SERVER";
  return `HTTP_${status}`;
}
var CopilotAdapter = class extends LlmAdapter {
  baseURL;
  contextWindow;
  maxTokens;
  models;
  resolveApiKey;
  constructor(config, resolveApiKey) {
    super();
    this.baseURL = config.baseURL ?? DEFAULT_BASE_URL;
    this.contextWindow = config.contextWindow ?? 128e3;
    this.maxTokens = config.maxTokens ?? 4096;
    this.models = config.models && config.models.length ? config.models : DEFAULT_MODELS;
    this.resolveApiKey = resolveApiKey;
  }
  providerInfo(provider) {
    return { id: provider, name: "GitHub Copilot" };
  }
  providerRetryPolicy() {
    return void 0;
  }
  async listModels() {
    return this.models.map((id) => ({ provider: PROVIDER, id, name: id, inputModalities: ["text"] }));
  }
  async resolveModel(_provider, model) {
    return {
      provider: PROVIDER,
      id: model,
      name: model,
      inputModalities: ["text"],
      context: { contextWindow: this.contextWindow },
      defaultMaxTokens: this.maxTokens
    };
  }
  async *stream(options) {
    let apiKey;
    try {
      apiKey = await this.resolveApiKey();
    } catch (err) {
      throw new LlmError(err instanceof Error ? err.message : String(err), "MISSING_CREDENTIAL");
    }
    const headers = {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      accept: "text/event-stream",
      ...attributionHeaders(),
      "copilot-integration-id": "vscode-chat",
      "editor-version": "vscode/1.103.2",
      "editor-plugin-version": "copilot-chat/0.29.1",
      "openai-intent": "conversation-panel",
      "user-agent": "GitHubCopilotChat/0.29.1",
      "x-github-api-version": "2025-04-01"
    };
    const body = serializeChatRequest(options);
    let response;
    try {
      response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: options.signal
      });
    } catch (err) {
      if (options.signal?.aborted) throw new LlmError("request aborted", "ABORTED");
      throw new LlmError(err instanceof Error ? err.message : String(err), "TRANSPORT");
    }
    if (!response.ok) {
      let detail = "";
      try {
        detail = await response.text();
      } catch {
      }
      throw new LlmError(
        `GitHub Copilot request failed (${response.status}): ${detail.slice(0, 300)}`,
        httpErrorCode(response.status)
      );
    }
    if (!response.body) throw new LlmError("GitHub Copilot returned no response body", "EMPTY_RESPONSE");
    yield* translateCopilot(parseSse(response.body));
  }
};
function apply(ctx, config = {}) {
  const llm = ctx.llm;
  if (!llm?.registerAdapter) {
    ctx.logger?.warn?.("[dsh-llm-copilot] host ctx.llm has no registerAdapter; provider not registered");
    return;
  }
  let tokenCache;
  const resolveApiKey = async () => {
    if (config.apiKey) return config.apiKey;
    const now = Date.now();
    if (tokenCache && now - tokenCache.at < TOKEN_TTL_MS) return tokenCache.token;
    let stdout = "";
    try {
      const res = await execFileP("gh", ["auth", "token"], { timeout: 15e3, windowsHide: true });
      stdout = res.stdout;
    } catch (err) {
      throw new Error(
        `no GitHub token: run \`gh auth login\` first (${err instanceof Error ? err.message : String(err)})`
      );
    }
    const token = stdout.trim();
    if (!token) throw new Error("`gh auth token` returned an empty token");
    tokenCache = { token, at: now };
    return token;
  };
  const adapter = new CopilotAdapter(config, resolveApiKey);
  try {
    llm.registerConfigurableProviders?.([
      { provider: PROVIDER, displayName: "GitHub Copilot", settingsNs: NS, settingsPath: [] }
    ]);
  } catch {
  }
  const registration = llm.registerAdapter([PROVIDER], adapter);
  ctx.on?.("dispose", () => {
    try {
      registration();
    } catch {
    }
  });
}
export {
  CopilotAdapter,
  NS,
  PROVIDER,
  apply,
  description,
  inject,
  name
};

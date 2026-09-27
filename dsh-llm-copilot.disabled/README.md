> **DEPRECATED (2026-09-11): retired, not mounted by any profile.** See [DEPRECATED.md](./DEPRECATED.md) for why, what was checked, and how to revive it.

# dsh-llm-copilot

DSH LLM provider adapter for **GitHub Copilot** — registers the `copilot` provider route in the host `ctx.llm` runtime so the Models page and any agent loop can use your Copilot subscription as an LLM channel.

## How it works

- Endpoint: `https://api.githubcopilot.com/chat/completions` (OpenAI-compatible chat completions, SSE streamed)
- Auth: `Authorization: Bearer <gh auth token>` — the adapter shells out to `gh auth token` at runtime with a 60s TTL cache (override with `apiKey` setting)
- Required integration headers: `Copilot-Integration-Id: vscode-chat`, `Editor-Version`, `Editor-Plugin-Version`, `OpenAI-Intent`, `X-GitHub-Api-Version`
- Model catalog (student plan): `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `gpt-3.5-turbo` — all text-only, no reasoning

## Install

Requires the `llm` service (host built-in) and a logged-in `gh` CLI:

```bash
gh auth login          # with a Copilot-enabled account (e.g. GitHub Student Pack Copilot Pro)
```

Add to your profile's `package.json` dependencies + `dsh.profile.bundles`, or install as a normal DSH plugin. After (re)start, the Models page lists the `copilot` provider.

## Usage notes

- Chat usage counts against your Copilot plan's monthly AI credits — it is not unlimited. For free/unlimited workloads prefer OpenRouter `:free` models or a local Ollama.
- The Copilot API does not expose a Responses API for student models; this adapter only implements chat completions.
- Rate-limit (429) and auth (401/403) errors map to `RATE_LIMIT` / `AUTH` failure codes the host understands.

## Settings

| Key | Default | Meaning |
|---|---|---|
| `baseURL` | `https://api.githubcopilot.com` | API base |
| `apiKey` | *(empty)* | Static token override; otherwise `gh auth token` (TTL 60s) |
| `models` | 4 student models | Advertised model catalog |
| `contextWindow` | `128000` | Advertised context window (gpt-4o) |
| `maxTokens` | `4096` | Default max output tokens |

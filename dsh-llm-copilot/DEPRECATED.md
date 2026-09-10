# DEPRECATED — 2026-09-11

**Status: retired.** Not mounted by any dsh profile, not published to a registry, not
version-controlled in this directory. The code is kept as-is so it can be revived or
harvested; nothing in the live stack imports it.

## Why

The owner stopped using GitHub Copilot as an LLM channel ("copilot 现在没有再用，可以先弃用").
It was a provider adapter: it registered a `copilot` route in the host `ctx.llm`, calling
`https://api.githubcopilot.com/chat/completions` with a `gh` token and the
	exttt{Copilot-Integration-Id} header. With no subscription behind it, the route is dead weight
in the model list, and every provider route is also a credential surface.

## What was checked before retiring it

- `grep`ped every profile under `~/.dsh/profiles`: **no profile declares it** in
  `dependencies` or in `dsh.profile.bundles`, so no boot tree mounts it.
- `npm view @snow-the/dsh-llm-copilot`: 404 — it was never published, so there is no
  registry entry to deprecate and no consumer to warn.
- No other plugin imports it (the three-way coupling audit covers `@snow-the/*`).

## To revive

1. `cd` here and `npm run build` (esbuild bundle, `@deepseek-ai/*` external).
2. Add it to the target profile: `dependencies` **and** `dsh.profile.bundles` — a plugin in
   deps but not bundles is never mounted (the classic trap `guide_scan` checks for).
3. `pnpm install` in that profile, then restart dsh; the `copilot` route reappears in the
   model list.
4. Needs a working `gh auth token` with Copilot access, plus the `eventsource-parser`
   dependency (`npm install` here).

## If you are deleting it

Nothing else depends on it. `rm -rf` the directory is safe; keep the `src/index.ts` if you
want the SSE provider pattern as a template for the next adapter.

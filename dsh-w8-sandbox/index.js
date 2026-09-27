/**
 * dsh-w8-sandbox — server entry: serves the w8 world-sandbox demo page and its tiny state API.
 *
 * THREE BUGS FIXED HERE (the plugin had never activated, in two independent ways):
 *
 *  1. `export const inject = ['web-server']` — that service does not exist. The web server service
 *     is `webServer` (camelCase), owned by `@deepseek-ai/dsh-web-app` (its own error string:
 *     "web-app: webServer service missing while resolving Web runtime"). A hyphenated, unknown
 *     service name is a dependency that can never be satisfied, so the plugin was never applicable.
 *     `inject` is now gone entirely: this plugin declares no startup dependency, because...
 *
 *  2. `const ws = ctx.webServer` was ILLEGAL EVEN WITH THE NAME FIXED. cordis's context is a proxy:
 *     reading a registered service that is not declared in `inject` THROWS
 *     `cannot get property "webServer" without inject`, and optional chaining cannot save it (the
 *     get-trap throws before `?.` is reached). So fixing (1) alone would have turned a plugin that
 *     silently never loads into one that throws inside `apply`. The official pattern is to pull the
 *     dependency into a CHILD context — `ctx.inject(['webServer'], (webCtx) => ...)` — which is what
 *     the six working plugins in this repo do (dsh-gitkit, dsh-busyloop, dsh-lib-analyzer,
 *     dsh-plugin-doctor, dsh-skill-pack, dsh-snapshot, dsh-codex.frozen). In a profile without
 *     `webServer` the callback simply never runs and the rest of the plugin still loads.
 *
 *  3. The route handlers answered EVERY caller. Every other route in this repo applies the official
 *     Host/Origin + browser-auth fence first (see `createRequestFence` below). These did not, so
 *     `/w8/` and `/w8/state` were an unfenced read surface on the loopback server.
 *
 * Also removed: a dead `awaitImport` helper that was never called, and an unused `existsSync` import.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = '@snow-the/dsh-w8-sandbox';

/** The w8 knowledge base this demo reads its counts from. Absent = the page shows "(sqlite 未掛載)". */
const KB = join(process.env.USERPROFILE || '.', 'source', 'repos', 'w8', 'kb');

/** Served page assets live beside this module (`web/`). */
const WEB_DIR = fileURLToPath(new URL('./web/', import.meta.url));

/**
 * Apply the official Host/Origin + browser-auth fence to this plugin's routes.
 *
 * SOURCE — the contract, copied in shape from `@deepseek-ai/dsh-host-open-in-app` and already
 * carried by dsh-gitkit / dsh-codex.frozen in this repo: **every route** asks the composition's
 * `connection` service for a rejection first. Its Host/Origin fence defeats DNS rebinding and
 * cross-site calls; its browser authentication (the login-token cookie) gates every caller. An
 * anonymous request gets 401 and a forged one gets 403; a browser that loaded the page first is
 * unaffected, so the iframe's own `fetch('/w8/state')` still succeeds with its cookie.
 *
 * READ WITHOUT DECLARING `inject`, via `ctx.get('connection')`. MEASURED in this repo: from a plugin
 * that does not declare `inject: ['connection']`, BOTH `ctx.connection` AND
 * `Reflect.get(ctx, 'connection')` throw `cannot get property "connection" without inject`, while
 * `ctx.get('connection')` returns the live service. `ctx.get` is the official inject-free read.
 *
 * FAIL CLOSED: when the service is unreachable the request is answered 503, never forwarded —
 * silently serving would reopen exactly the hole this fence exists to close.
 *
 * Each plugin carries its OWN copy on purpose: they are independent packages, and a shared module
 * would create a deployment coupling that has to be re-synced on every edit.
 */
function createRequestFence(ctx) {
  /** Read the service without declaring `inject` — see the read note above for why not Reflect.get. */
  const resolveConnection = () => {
    const read = ctx?.get;
    if (typeof read !== 'function') return undefined;
    try {
      const connection = read.call(ctx, 'connection');
      return typeof connection?.requestRejection === 'function' ? connection : undefined;
    } catch {
      return undefined;
    }
  };

  return (req, res) => {
    const connection = resolveConnection();
    if (connection === undefined) {
      // Fail closed: an unreachable fence must not become an open route.
      res.statusCode = 503;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'connection service unavailable: the Host/Origin fence cannot be applied' }));
      return true;
    }
    const rejection = connection.requestRejection(req);
    if (rejection === undefined) return false;
    res.statusCode = rejection;
    res.end();
    return true;
  };
}

/** Read one file from `web/`, or null when it is not there. */
const readWeb = (file) => {
  try {
    return readFileSync(join(WEB_DIR, file), 'utf8');
  } catch {
    return null;
  }
};

const send = (res, type, body) => {
  res.writeHead(200, { 'content-type': type });
  res.end(body);
};

/**
 * Count the data rows of one kb CSV (minus the header).
 *
 * Deliberately NOT sqlite: this keeps the demo free of a native dependency. A missing file is -1,
 * which the page renders as "not mounted" rather than as zero — an absent data set and an empty one
 * are different facts and the page should not conflate them.
 */
const countRows = (file) => {
  try {
    const text = readFileSync(join(KB, 'data', file), 'utf8');
    return Math.max(0, text.split(/\r?\n/).filter((line) => line.trim()).length - 1);
  } catch {
    return -1;
  }
};

/**
 * Register the demo routes.
 *
 * Registered on the child context, so `webCtx.webServer` is legal to read there. Exported so the
 * wiring can be exercised without a live host.
 */
export function registerRoutes(webCtx, ctx) {
  const fence = createRequestFence(ctx);
  const register = (path, handler) => {
    webCtx.webServer.register({
      kind: 'exact',
      path,
      handler: (req, res) => {
        if (fence(req, res)) return;
        return handler(req, res);
      },
    });
  };

  register('/w8', (_req, res) => {
    res.writeHead(302, { location: '/w8/' });
    res.end();
  });

  register('/w8/', (_req, res) => {
    const html = readWeb('sandbox.html');
    if (html === null) {
      res.writeHead(404);
      res.end('sandbox.html missing');
      return;
    }
    send(res, 'text/html; charset=utf-8', html);
  });

  register('/w8/state', (_req, res) => {
    const state = {
      books: countRows('books.csv'),
      assets: countRows('assets.csv'),
      resources: countRows('resources.csv'),
    };
    send(res, 'application/json', JSON.stringify(state));
  });
}

export const apply = (ctx) => {
  // No `inject` export: the dependency is taken here, into a child context, so a profile without
  // webServer still loads this plugin (the callback just never fires).
  ctx.inject?.(['webServer'], (webCtx) => {
    const mount = () => registerRoutes(webCtx, ctx);
    // `effect` gives the registration a disposer so a reload tears the routes down with it.
    if (typeof webCtx.effect === 'function') webCtx.effect(mount, 'w8-sandbox: GET /w8/{,/state}');
    else mount();
  });
};

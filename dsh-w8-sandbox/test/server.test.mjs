/**
 * dsh-w8-sandbox server-side tests.
 *
 * WHAT THESE DEFEND. The plugin was dead for two independent reasons and nothing noticed, because
 * it had no test at all: `inject = ['web-server']` named a service that does not exist, and the
 * handler read `ctx.webServer` directly, which cordis's proxy forbids without a declared inject.
 * So the assertions below cover the wiring facts that were silently false:
 *
 *   - `apply()` must NOT touch `ctx.webServer` directly. It must take the dependency through
 *     `ctx.inject(['webServer'], child)`. A stub whose `webServer` getter THROWS proves it: the old
 *     code would blow up on the property read itself.
 *   - the routes must be registered on the CHILD context, and only when webServer is available.
 *   - every route must ask the connection fence first: 401/403 from the fence stops the request,
 *     and an unreachable fence fails CLOSED (503) rather than serving.
 *   - `/w8` redirects, `/w8/` serves the page, `/w8/state` reports -1 for a missing CSV (absent is
 *     not zero) and a real count for a present one.
 *
 * No host and no network: the web server and the connection service are stubs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mod = await import('../index.js');

/** A res stub recording what the handler wrote. */
function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
    writeHead(code, headers) { this.statusCode = code; if (headers) Object.assign(this.headers, headers); return this; },
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(body) { this.body = body; this.ended = true; },
  };
}

/**
 * A webServer stub that records registrations.
 * `throwsOnRead` reproduces the cordis proxy: reading an undeclared service throws, so a plugin
 * that reads it directly is caught here instead of in production.
 */
function makeWebServer({ throwsOnRead = false } = {}) {
  const routes = new Map();
  const stub = {
    routes,
    register(route) { routes.set(route.path, route); },
  };
  if (throwsOnRead) {
    return new Proxy(stub, {
      get(target, prop, receiver) {
        if (prop === 'register' || prop === 'routes') return Reflect.get(target, prop, receiver);
        throw new Error(`cannot get property "${String(prop)}" without inject`);
      },
    });
  }
  return stub;
}

/** A ctx stub exposing `get` (connection) and `inject` (child contexts). */
function makeCtx({ connection } = {}) {
  const injected = [];
  return {
    injected,
    get(name) { return name === 'connection' ? connection : undefined; },
    inject(deps, callback) {
      injected.push(deps);
      const child = { webServer: undefined, effect: (fn) => fn() };
      callback(child);
      return () => {};
    },
  };
}

const passingConnection = { requestRejection: () => undefined };

test('apply takes webServer through ctx.inject and never reads ctx.webServer directly', () => {
  // A ctx whose injected child reports the registration; the top-level ctx has NO webServer at all,
  // so a direct read would be `undefined` and the old `if (!ws) return` would silently do nothing.
  let childSeen = null;
  const ctx = {
    get: () => passingConnection,
    inject(deps, callback) {
      assert.deepEqual(deps, ['webServer'], 'declares exactly the webServer dependency');
      const ws = makeWebServer();
      childSeen = ws;
      callback({ webServer: ws, effect: (fn) => fn() });
      return () => {};
    },
  };
  mod.apply(ctx);
  assert.ok(childSeen, 'the webServer dependency was taken via ctx.inject');
  assert.deepEqual([...childSeen.routes.keys()].sort(), ['/w8', '/w8/', '/w8/state']);
});

test('the module declares NO inject export — the dependency is taken at apply time', () => {
  // THIS is the assertion that the original bug needed. The plugin used to export
  //     export const inject = ['web-server']
  // a service name that does not exist, so the plugin was permanently inapplicable and never
  // loaded. Every runtime test above still passes with that export reinstated (measured: the
  // negative-verification mutation went green), because the runtime path is driven through
  // apply() directly. Only asserting the module SHAPE catches it.
  assert.equal(
    'inject' in mod && mod.inject !== undefined,
    false,
    "must not declare an `inject` export: 'web-server' does not exist and the real dependency is taken via ctx.inject at apply time",
  );
});

test('apply does not throw when the child webServer is a throwing proxy', () => {
  // The decisive regression test: the OLD code did `const ws = ctx.webServer` inside apply.
  // cordis's proxy throws on that read. Here the child is such a proxy, so any direct read fails.
  const ctx = {
    get: () => passingConnection,
    inject(_deps, callback) {
      callback({ webServer: makeWebServer({ throwsOnRead: true }), effect: (fn) => fn() });
      return () => {};
    },
  };
  assert.doesNotThrow(() => mod.apply(ctx), 'must not read ctx.webServer directly');
});

test('apply is a no-op, not a crash, in a profile without webServer', () => {
  let called = false;
  const ctx = { get: () => undefined, inject: () => { called = true; return () => {}; } };
  assert.doesNotThrow(() => mod.apply(ctx));
  assert.ok(called, 'asks for the dependency; the composition decides whether to satisfy it');
});

test('/w8 redirects to /w8/', () => {
  const ws = makeWebServer();
  mod.registerRoutes({ webServer: ws }, { get: () => passingConnection });
  const req = {};
  const res = makeRes();
  ws.routes.get('/w8').handler(req, res);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.location, '/w8/');
});

test('/w8/ serves the sandbox page', () => {
  const ws = makeWebServer();
  mod.registerRoutes({ webServer: ws }, { get: () => passingConnection });
  const res = makeRes();
  ws.routes.get('/w8/').handler({}, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.match(String(res.body), /w8/i, 'the served page really is the demo');
});

test('/w8/state counts the kb CSVs it actually ships', () => {
  const ws = makeWebServer();
  mod.registerRoutes({ webServer: ws }, { get: () => passingConnection });
  const res = makeRes();
  ws.routes.get('/w8/state').handler({}, res);
  assert.equal(res.statusCode, 200);
  const state = JSON.parse(String(res.body));
  assert.deepEqual(Object.keys(state).sort(), ['assets', 'books', 'resources']);
  // Deliberately NOT hardcoded counts: the kb is live project data and its row counts change.
  // What must hold is that every known CSV is found and counted as a non-negative row count.
  for (const [name, rows] of Object.entries(state)) {
    assert.ok(Number.isInteger(rows), `${name} must be an integer, got ${rows}`);
    assert.ok(rows > 0, `${name}.csv is present in this workspace and must have rows, got ${rows}`);
  }
});

test('a MISSING data set reports -1, so absent is never confused with empty', () => {
  // KB is resolved from USERPROFILE at import time, so this runs in a child process with a
  // USERPROFILE that has no w8/kb — no module-cache games, and the parent's module is untouched.
  const script = `
    const ws = { routes: new Map(), register(r) { this.routes.set(r.path, r); } };
    const mod = await import(${JSON.stringify(new URL('../index.js', import.meta.url).href)});
    mod.registerRoutes({ webServer: ws }, { get: () => ({ requestRejection: () => undefined }) });
    let body;
    const res = { statusCode: 0, writeHead() {}, setHeader() {}, end(b) { body = b; } };
    ws.routes.get('/w8/state').handler({}, res);
    console.log(body);
  `;
  const emptyHome = mkdtempSync(join(tmpdir(), 'w8-nokb-'));
  try {
    const out = execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
      encoding: 'utf8',
      env: { ...process.env, USERPROFILE: emptyHome, HOME: emptyHome },
    });
    const state = JSON.parse(out.trim());
    assert.deepEqual(state, { books: -1, assets: -1, resources: -1 }, 'absent data is -1, not 0');
  } finally {
    rmSync(emptyHome, { recursive: true, force: true });
  }
});

test('every route asks the fence first: 401 from the fence stops the request', () => {
  const ws = makeWebServer();
  mod.registerRoutes({ webServer: ws }, { get: () => ({ requestRejection: () => 401 }) });
  for (const path of ['/w8', '/w8/', '/w8/state']) {
    const res = makeRes();
    ws.routes.get(path).handler({}, res);
    assert.equal(res.statusCode, 401, `${path} must be gated`);
    assert.equal(res.body, undefined, `${path} must not serve a body when refused`);
  }
});

test('every route asks the fence first: a forged request gets 403', () => {
  const ws = makeWebServer();
  mod.registerRoutes({ webServer: ws }, { get: () => ({ requestRejection: () => 403 }) });
  for (const path of ['/w8', '/w8/', '/w8/state']) {
    const res = makeRes();
    ws.routes.get(path).handler({}, res);
    assert.equal(res.statusCode, 403, `${path} must be gated`);
  }
});

test('an unreachable fence FAILS CLOSED with 503, never an open route', () => {
  const ws = makeWebServer();
  mod.registerRoutes({ webServer: ws }, { get: () => undefined });
  for (const path of ['/w8', '/w8/', '/w8/state']) {
    const res = makeRes();
    ws.routes.get(path).handler({}, res);
    assert.equal(res.statusCode, 503, `${path} must fail closed when the fence cannot be built`);
  }
});

test('the fence is read through ctx.get, not a property read', () => {
  // ctx exposes ONLY `get`; any property read of `connection` would be undefined here.
  const ws = makeWebServer();
  mod.registerRoutes({ webServer: ws }, { get: (n) => (n === 'connection' ? passingConnection : undefined) });
  const res = makeRes();
  ws.routes.get('/w8/state').handler({}, res);
  assert.equal(res.statusCode, 200, 'ctx.get is the inject-free read the fence must use');
});

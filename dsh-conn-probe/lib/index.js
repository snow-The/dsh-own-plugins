/**
 * ONE-SHOT read-only probe for the official `connection` service.
 *
 * Question it answers, empirically (not by inference): in the real `web` profile,
 * is `ctx.get('connection')` defined, does it carry `requestRejection`, and what
 * does it return for an anonymous / cross-site / same-origin request?
 *
 * It writes NO state and registers exactly one diagnostic route. Delete this whole
 * plugin directory once the numbers are recorded.
 */

const PROBE = '/__probe-conn'

/** Read a header case-insensitively (node lowercases them already). */
const h = (req, name) => {
  const v = req.headers[name]
  return Array.isArray(v) ? v.join(',') : v
}

export function apply(ctx) {
  ctx.inject?.(['webServer'], (webCtx) => {
    const mount = () => webCtx.webServer.register({
      kind: 'exact',
      path: PROBE,
      handler: (req, res) => {
        const report = { probe: 'connection', ok: true }

        // 1. Which read forms work at all.
        try {
          const viaGet = ctx.get('connection')
          report.get = viaGet === undefined ? 'undefined' : 'defined'
          report.getHasRequestRejection = typeof viaGet?.requestRejection === 'function'
          report.getTypeof = typeof viaGet
          report.getCtor = viaGet?.constructor?.name ?? null
        } catch (err) {
          report.get = 'THREW: ' + String(err?.message ?? err)
        }

        // 2. Does the plain property read throw (the cordis get-trap we hit before)?
        try {
          report.directRead = ctx.connection === undefined ? 'undefined' : 'defined'
        } catch (err) {
          report.directRead = 'THREW: ' + String(err?.message ?? err)
        }

        // 3. Reflect.get — the official open-in-app helper's form.
        try {
          const r = Reflect.get(ctx, 'connection')
          report.reflectGet = r === undefined ? 'undefined' : 'defined'
        } catch (err) {
          report.reflectGet = 'THREW: ' + String(err?.message ?? err)
        }

        // 4. What the fence actually decides for THIS request.
        try {
          const conn = ctx.get('connection')
          if (typeof conn?.requestRejection === 'function') {
            const verdict = conn.requestRejection(req)
            report.verdict = verdict === undefined ? 'allow (undefined)' : verdict
          } else {
            report.verdict = 'unavailable'
          }
        } catch (err) {
          report.verdict = 'THREW: ' + String(err?.message ?? err)
        }

        // 5. Echo the facts the fence looks at, so the three cases are explainable.
        report.seen = {
          host: h(req, 'host') ?? null,
          origin: h(req, 'origin') ?? null,
          secFetchSite: h(req, 'sec-fetch-site') ?? null,
          cookiePresent: (h(req, 'cookie') ?? '').includes('dsh-auth-'),
          cookieNames: (h(req, 'cookie') ?? '').split(';').map((s) => s.trim().split('=')[0]).filter(Boolean),
        }

        res.statusCode = 200
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(report, null, 2))
      },
    })
    if (typeof webCtx.effect === 'function') webCtx.effect(mount, `conn-probe: GET ${PROBE}`)
    else mount()
  })
}

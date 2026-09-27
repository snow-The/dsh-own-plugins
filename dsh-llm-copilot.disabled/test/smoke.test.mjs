/**
 * node:test entry for the copilot smoke test.
 *
 * WHY A WRAPPER INSTEAD OF MOVING THE FILE. The smoke test lives in `tests/` (plural) as
 * `smoke.mjs`, so `node --test` — the package's own test script — discovered ZERO tests and exited
 * 0. A green run that ran nothing is worse than a red one.
 *
 * Moving it into `test/` was the obvious fix and does not work: the file is written as a SCRIPT
 * (top-level await, a bare `process.exit`), so node:test would import it as an ordinary ESM module,
 * the assertions would run at import time, and a `process.exit` would kill the runner process.
 *
 * So the file keeps both entries, and this wrapper is the one the runner sees:
 *   DSH_SMOKE_AS_TEST=1 makes the script THROW on failure instead of exiting, and this module
 *   invokes it once — the assertion details print on stdout, and the failure surfaces as a test
 *   failure with the count in the message.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DSH_SMOKE_AS_TEST = '1';

test('copilot smoke suite (module shape + stream translation)', async () => {
  await assert.doesNotReject(
    () => import('../tests/smoke.mjs'),
    (err) => {
      // The script throws with its own summary; surface that rather than a bare import error.
      assert.match(String(err?.message ?? err), /copilot smoke:/);
      return true;
    },
  );
});

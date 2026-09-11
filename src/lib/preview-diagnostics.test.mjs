import test from "node:test";
import assert from "node:assert/strict";
import { previewEvent, previewOperation, previewSupabaseConfig } from "./preview-diagnostics.ts";

test("preview diagnostics preserve results and exclude credentials and row contents", async (t) => {
  const oldEnv = process.env.VERCEL_ENV;
  const oldBranch = process.env.VERCEL_GIT_COMMIT_REF;
  const entries = [];
  t.mock.method(console, "info", (...args) => entries.push(JSON.parse(args[1])));
  t.after(() => {
    if (oldEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = oldEnv;
    if (oldBranch === undefined) delete process.env.VERCEL_GIT_COMMIT_REF;
    else process.env.VERCEL_GIT_COMMIT_REF = oldBranch;
  });
  const branch = "codex/skyshare-e2e-smoke-harness";
  const secret = "PRIVATE_SENTINEL_PASSWORD_TOKEN_COOKIE_KEY_ROW";
  const result = { data: { password: secret, session: secret }, error: {
    code: "42501", message: secret, details: secret, hint: secret, stack: secret,
  } };

  for (const [env, ref] of [["production", branch], ["preview", "another-branch"], ["development", branch]]) {
    process.env.VERCEL_ENV = env;
    process.env.VERCEL_GIT_COMMIT_REF = ref;
    assert.equal(await previewOperation("query", () => result), result);
    previewEvent("cookies", "complete");
    previewSupabaseConfig("https://example.com", true);
    assert.equal(entries.length, 0);
  }

  process.env.VERCEL_ENV = "preview";
  process.env.VERCEL_GIT_COMMIT_REF = branch;
  assert.equal(await previewOperation("query", () => result), result);
  assert.equal(entries.at(-1).outcome, "returned-error");
  assert.equal(entries.at(-1).code, "42501");
  assert.equal(entries.at(-1).id, entries.at(-2).id);
  assert.equal(typeof entries.at(-1).elapsedMs, "number");

  const thrown = Object.assign(new TypeError(secret), { code: secret, digest: "12345" });
  await assert.rejects(previewOperation("render", () => { throw thrown; }), (error) => error === thrown);
  assert.equal(entries.at(-1).name, "TypeError");
  assert.equal(entries.at(-1).digest, "12345");
  assert.equal(entries.at(-1).code, undefined);

  const redirect = Object.assign(new Error(secret), { digest: `NEXT_REDIRECT;replace;/${secret};307;` });
  await assert.rejects(previewOperation("context", () => { throw redirect; }), (error) => error === redirect);
  assert.equal(entries.at(-1).controlFlow, true);
  previewSupabaseConfig(`https://${secret}@lbmadoyajrlzdtxyvkwi.supabase.co/?key=${secret}`, true);
  assert.equal(entries.at(-1).host, "lbmadoyajrlzdtxyvkwi.supabase.co");
  previewSupabaseConfig(`https://${secret}.example.com`, true);
  assert.equal(entries.at(-1).host, "nonstandard-host");
  assert.equal(JSON.stringify(entries).includes(secret), false);

  t.mock.timers.enable({ apis: ["setTimeout"] });
  let finish;
  const pending = previewOperation("pending", () => new Promise((resolve) => { finish = resolve; }));
  t.mock.timers.tick(10_000);
  assert.equal(entries.at(-1).outcome, "pending-after-10s");
  finish(result);
  assert.equal(await pending, result);
  const count = entries.length;
  t.mock.timers.tick(10_000);
  assert.equal(entries.length, count);
});

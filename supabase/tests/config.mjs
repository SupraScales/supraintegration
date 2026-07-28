// Environment/config loading for the RLS test suite.
// Load env with Node's native --env-file flag, e.g.:
//   node --env-file=.env.test.local --test supabase/tests/rls.test.mjs
// No dotenv dependency required.

// Supabase clients expect the bare project URL (https://<ref>.supabase.co) with no
// path. Tolerate a pasted trailing slash or a `/rest/v1` (REST endpoint) suffix so a
// slightly-off SUPABASE_URL does not produce a doubled, malformed request path.
function normalizeBaseUrl(raw) {
  if (!raw) return null;
  return raw
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "")
    .replace(/\/+$/, "");
}

export function readConfig() {
  const url = normalizeBaseUrl(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? null;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
  return {
    url,
    anonKey,
    serviceKey,
    ok: Boolean(url && anonKey && serviceKey),
  };
}

export function requireConfig() {
  const config = readConfig();
  if (!config.ok) {
    throw new Error(
      "Missing Supabase test config. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), " +
        "SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY), and " +
        "SUPABASE_SERVICE_ROLE_KEY. See supabase/tests/README.md.",
    );
  }
  return config;
}

// Destructive guard. seed.mjs and teardown.mjs delete auth users and cascade-drop
// organizations, so refuse to run unless the operator explicitly opts in. This is
// the last line of defence against pointing the suite at the wrong project.
export function requireDestructive() {
  if (process.env.RLS_TEST_ALLOW_DESTRUCTIVE !== "true") {
    throw new Error(
      "Refusing to run destructive seed/teardown. Set RLS_TEST_ALLOW_DESTRUCTIVE=true " +
        "and confirm SUPABASE_URL points at a development/staging project, never production.",
    );
  }
  const { url } = readConfig();
  // Surface the target so an operator can catch a wrong URL before data is touched.
  console.log(`[rls-tests] destructive operations enabled against: ${url}`);
}

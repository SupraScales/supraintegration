// Supabase client factories for the RLS test suite.
import { createClient } from "@supabase/supabase-js";
import { requireConfig } from "./config.mjs";
import { PASSWORD } from "./fixtures.mjs";

const NO_PERSIST = { auth: { autoRefreshToken: false, persistSession: false } };

// Service-role client: bypasses RLS. Used ONLY to arrange and tear down fixtures,
// never to assert access decisions.
export function serviceClient() {
  const { url, serviceKey } = requireConfig();
  return createClient(url, serviceKey, NO_PERSIST);
}

// Anonymous client: the publishable/anon key with no session. This is exactly what
// an unauthenticated browser has.
export function anonClient() {
  const { url, anonKey } = requireConfig();
  return createClient(url, anonKey, NO_PERSIST);
}

// Authenticated client: signs in as a seeded user so auth.uid() and RLS apply
// precisely as they would in production.
export async function signInAs(email, password = PASSWORD) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  }
  return client;
}

// Fixtures for the Alumasteel quoting RLS matrix and staging walkthroughs.
// STAGING/DEV ONLY. Every record is explicitly fictional — no real Alumasteel
// customers, vendors, prices, or documents may ever appear here.

export { PASSWORD } from "./fixtures.mjs";

// Slugs must satisfy the DB check: ^[a-z0-9]+(?:-[a-z0-9]+)*$
export const QUOTING_ORGS = {
  alumasteel: {
    slug: "alumasteel-staging-test",
    name: "Alumasteel (Staging Test)",
    kind: "client",
  },
  otherClient: {
    slug: "fabricators-b-staging-test",
    name: "Fabricators B (Staging Test)",
    kind: "client",
  },
  internal: {
    slug: "supra-internal-quoting-test",
    name: "Supra Internal (Quoting Test)",
    kind: "internal",
  },
};

export const QUOTING_USERS = {
  alumaOwner: { email: "q.aluma.owner@supra.test", org: "alumasteel", role: "client_admin", status: "active" },
  alumaMember: { email: "q.aluma.member@supra.test", org: "alumasteel", role: "client_member", status: "active" },
  otherOwner: { email: "q.other.owner@supra.test", org: "otherClient", role: "client_admin", status: "active" },
  internalAdmin: { email: "q.internal.admin@supra.test", org: "internal", role: "internal_admin", status: "active" },
  internalMember: { email: "q.internal.member@supra.test", org: "internal", role: "internal_member", status: "active" },
};

export const QUOTING_MODULES = ["quotes", "customers", "vendors", "quote_settings"];

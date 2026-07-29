// Shared fixtures for the RLS authorization matrix.
// STAGING/DEV ONLY. These users and organizations are created and destroyed by
// seed.mjs / teardown.mjs. Never point this at a production project.

// A single throwaway password for all seeded test users. Staging only.
export const PASSWORD = "Rls-Test-Passw0rd!";

// Organizations. Slugs must satisfy the DB check: ^[a-z0-9]+(?:-[a-z0-9]+)*$
export const ORGS = {
  internal: { slug: "supra-internal-test", name: "Supra Internal (RLS Test)", kind: "internal" },
  clientA: { slug: "client-a-test", name: "Client A (RLS Test)", kind: "client" },
  clientB: { slug: "client-b-test", name: "Client B (RLS Test)", kind: "client" },
};

// Test users. `org` keys into ORGS. `role` must match the org kind (enforced by
// the validate_membership_role trigger). `status` = active|suspended.
export const USERS = {
  internalAdmin: { email: "rls.internal.admin@supra.test", org: "internal", role: "internal_admin", status: "active" },
  internalMember: { email: "rls.internal.member@supra.test", org: "internal", role: "internal_member", status: "active" },
  clientAAdmin: { email: "rls.clienta.admin@supra.test", org: "clientA", role: "client_admin", status: "active" },
  clientAMember: { email: "rls.clienta.member@supra.test", org: "clientA", role: "client_member", status: "active" },
  clientBAdmin: { email: "rls.clientb.admin@supra.test", org: "clientB", role: "client_admin", status: "active" },
  inactiveClientA: { email: "rls.inactive@supra.test", org: "clientA", role: "client_member", status: "suspended" },
  // The identity Phase 1B agent-authored records are attributed to. It is an
  // ordinary internal member: the restriction on agents comes from
  // created_by_actor_type = 'agent', not from a weaker role.
  agent: { email: "rls.agent@supra.test", org: "internal", role: "internal_member", status: "active" },
};

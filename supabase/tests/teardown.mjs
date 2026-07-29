// Idempotent teardown for the RLS test suite. Deletes seeded auth users and
// cascade-drops seeded organizations. STAGING/DEV ONLY.
import { pathToFileURL } from "node:url";
import { serviceClient } from "./clients.mjs";
import { requireDestructive } from "./config.mjs";
import { ORGS, USERS } from "./fixtures.mjs";

export async function deleteSeed(svc = serviceClient()) {
  requireDestructive();

  const slugs = Object.values(ORGS).map((org) => org.slug);
  const { data: orgRows, error: orgErr } = await svc
    .from("organizations")
    .select("id")
    .in("slug", slugs);
  if (orgErr) throw new Error(`teardown lookup failed: ${orgErr.message}`);

  const orgIds = (orgRows ?? []).map((row) => row.id);
  if (orgIds.length > 0) {
    // audit_events.organization_id is ON DELETE SET NULL, so remove them explicitly
    // before dropping the orgs to avoid orphaned test rows.
    await svc.from("audit_events").delete().in("organization_id", orgIds);
    // Dropping the organization cascades to memberships and every tenant-owned table.
    const { error } = await svc.from("organizations").delete().in("id", orgIds);
    if (error) throw new Error(`teardown org delete failed: ${error.message}`);
  }

  const emails = new Set(Object.values(USERS).map((user) => user.email));
  let page = 1;
  for (;;) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`teardown user list failed: ${error.message}`);
    const users = data.users ?? [];
    for (const user of users) {
      if (user.email && emails.has(user.email)) {
        await svc.auth.admin.deleteUser(user.id);
      }
    }
    if (users.length < 200) break;
    page += 1;
  }
}

// Allow running directly: node --env-file=.env.test.local supabase/tests/teardown.mjs
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  deleteSeed()
    .then(() => {
      console.log("[rls-tests] teardown complete");
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

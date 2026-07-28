// RLS authorization matrix for the Hermes / client portal foundation.
//
// Runs against a development/staging Supabase project with the migration
// supabase/migrations/202607280001_hermes_foundation.sql applied. It signs in as
// real seeded users so auth.uid() and every RLS policy apply exactly as in
// production. The service-role key is used only to arrange and tear down fixtures.
//
// Run:
//   node --env-file=.env.test.local --test supabase/tests/rls.test.mjs
//
// See supabase/tests/README.md for staging setup and the full test/user matrix.

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readConfig } from "./config.mjs";
import { anonClient, signInAs } from "./clients.mjs";
import { resetAndSeed } from "./seed.mjs";
import { deleteSeed } from "./teardown.mjs";
import { USERS } from "./fixtures.mjs";

// If the environment is not configured, register a single skipped test instead of
// crashing, so `node --test` in a bare checkout stays green.
if (!readConfig().ok) {
  test("RLS matrix", { skip: "No staging Supabase config; see supabase/tests/README.md" }, () => {});
} else {
  // ---- shared assertions -------------------------------------------------------
  async function read(client, table, build = (q) => q) {
    const { data, error } = await build(client.from(table).select("*"));
    return { data: data ?? [], error };
  }

  // A denied read is either a hard permission error (anon, no grants) or an
  // RLS-filtered empty result (authenticated but policy evaluates false).
  function assertDenied(res, message) {
    if (res.error) return;
    assert.equal(res.data.length, 0, `${message}: expected 0 rows, got ${res.data.length}`);
  }

  function assertReadable(res, message, min = 1) {
    assert.ok(!res.error, `${message}: unexpected error ${res.error?.message}`);
    assert.ok(res.data.length >= min, `${message}: expected >= ${min} rows, got ${res.data.length}`);
  }

  async function tryInsert(client, table, row) {
    const { data, error } = await client.from(table).insert(row).select("*");
    return { data: data ?? [], error };
  }

  // A blocked write is either a with-check violation (error) or zero rows returned.
  function assertWriteDenied(res, message) {
    if (res.error) return;
    assert.equal(res.data.length, 0, `${message}: expected the write to be blocked`);
  }

  function assertWriteAllowed(res, message) {
    assert.ok(!res.error, `${message}: unexpected error ${res.error?.message}`);
    assert.ok(res.data.length >= 1, `${message}: expected the inserted row back`);
  }

  // ---- fixtures ----------------------------------------------------------------
  const ctx = { orgIds: null, userIds: null, seed: null, clients: {} };

  before(async () => {
    const seeded = await resetAndSeed();
    ctx.orgIds = seeded.orgIds;
    ctx.userIds = seeded.userIds;
    ctx.seed = seeded.seed;
    ctx.clients = {
      internalAdmin: await signInAs(USERS.internalAdmin.email),
      internalMember: await signInAs(USERS.internalMember.email),
      clientAAdmin: await signInAs(USERS.clientAAdmin.email),
      clientAMember: await signInAs(USERS.clientAMember.email),
      clientBAdmin: await signInAs(USERS.clientBAdmin.email),
      inactive: await signInAs(USERS.inactiveClientA.email),
      anon: anonClient(),
    };
  });

  after(async () => {
    await deleteSeed();
  });

  // ---- 1. Internal admin: read all clients + admin writes ----------------------
  test("internal admin can read all client organizations", async () => {
    const res = await read(ctx.clients.internalAdmin, "organizations", (q) => q.eq("kind", "client"));
    assertReadable(res, "internal admin reads clients", 2);
  });

  test("internal admin can perform admin-only writes", async () => {
    const action = await tryInsert(ctx.clients.internalAdmin, "action_items", {
      organization_id: ctx.orgIds.clientA,
      title: "Admin-created action",
      client_visible: true,
    });
    assertWriteAllowed(action, "internal admin inserts action_item");

    const update = await ctx.clients.internalAdmin
      .from("organizations")
      .update({ status: "paused" })
      .eq("id", ctx.orgIds.clientA)
      .select("*");
    assert.ok(!update.error, `internal admin updates organization: ${update.error?.message}`);
    assert.equal((update.data ?? []).length, 1, "internal admin update should affect the row");

    const audit = await tryInsert(ctx.clients.internalAdmin, "audit_events", {
      organization_id: ctx.orgIds.clientA,
      actor_user_id: ctx.userIds.internalAdmin,
      action: "test.write",
      entity_type: "test",
    });
    assertWriteAllowed(audit, "internal admin inserts audit_event");
  });

  // ---- 2. Internal member: read all clients, no admin writes -------------------
  test("internal member can read all clients and internal-only tables", async () => {
    assertReadable(
      await read(ctx.clients.internalMember, "organizations", (q) => q.eq("kind", "client")),
      "internal member reads clients",
      2,
    );
    assertReadable(await read(ctx.clients.internalMember, "internal_notes"), "internal member reads internal notes", 1);
  });

  test("internal member cannot perform admin-only writes", async () => {
    assertWriteDenied(
      await tryInsert(ctx.clients.internalMember, "action_items", {
        organization_id: ctx.orgIds.clientA,
        title: "Member should not create this",
        client_visible: true,
      }),
      "internal member insert action_item",
    );
    const update = await ctx.clients.internalMember
      .from("organizations")
      .update({ status: "archived" })
      .eq("id", ctx.orgIds.clientA)
      .select("*");
    assert.equal((update.data ?? []).length, 0, "internal member must not update organizations");
  });

  // ---- 3 & 4. Client admin / member confined to their own organization ---------
  for (const who of ["clientAAdmin", "clientAMember"]) {
    test(`${who} sees only their own organization`, async () => {
      const orgs = await read(ctx.clients[who], "organizations");
      assertReadable(orgs, `${who} reads own org`, 1);
      assert.ok(
        orgs.data.every((row) => row.id === ctx.orgIds.clientA),
        `${who} must see only Client A, saw ${orgs.data.map((r) => r.id).join(", ")}`,
      );
      const profiles = await read(ctx.clients[who], "client_profiles");
      assert.ok(
        profiles.data.every((row) => row.organization_id === ctx.orgIds.clientA),
        `${who} must read only Client A profile`,
      );
    });
  }

  // ---- 5. Client A cannot read or mutate Client B ------------------------------
  test("client A cannot read Client B data", async () => {
    assertDenied(
      await read(ctx.clients.clientAAdmin, "organizations", (q) => q.eq("id", ctx.orgIds.clientB)),
      "client A reads Client B organization",
    );
    assertDenied(
      await read(ctx.clients.clientAAdmin, "client_profiles", (q) => q.eq("organization_id", ctx.orgIds.clientB)),
      "client A reads Client B profile",
    );
    assertDenied(
      await read(ctx.clients.clientAAdmin, "portal_modules", (q) => q.eq("organization_id", ctx.orgIds.clientB)),
      "client A reads Client B portal modules",
    );
  });

  test("client A cannot mutate Client B data", async () => {
    assertWriteDenied(
      await tryInsert(ctx.clients.clientAAdmin, "action_items", {
        organization_id: ctx.orgIds.clientB,
        title: "Cross-tenant write",
        client_visible: true,
      }),
      "client A inserts into Client B",
    );
    const update = await ctx.clients.clientAAdmin
      .from("client_profiles")
      .update({ business_summary: "hacked" })
      .eq("organization_id", ctx.orgIds.clientB)
      .select("*");
    assert.equal((update.data ?? []).length, 0, "client A must not update Client B profile");
  });

  // ---- 6-9. Client users cannot read internal-only surfaces --------------------
  test("client users cannot read internal notes", async () => {
    assertDenied(await read(ctx.clients.clientAAdmin, "internal_notes"), "client reads internal notes");
    assertDenied(
      await read(ctx.clients.clientAAdmin, "internal_notes", (q) => q.eq("organization_id", ctx.orgIds.clientA)),
      "client reads own-org internal notes",
    );
  });

  test("client users cannot read private agent configuration", async () => {
    assertDenied(await read(ctx.clients.clientAAdmin, "agent_private_configs"), "client reads agent_private_configs");
  });

  test("client users cannot read private KPI definitions", async () => {
    assertDenied(await read(ctx.clients.clientAAdmin, "kpi_private_definitions"), "client reads kpi_private_definitions");
  });

  test("client users cannot read Hermes-only audit or integration data", async () => {
    assertDenied(await read(ctx.clients.clientAAdmin, "audit_events"), "client reads audit_events");
    assertDenied(await read(ctx.clients.clientAAdmin, "operational_records"), "client reads operational_records");
    assertDenied(
      await read(ctx.clients.clientAAdmin, "data_source_private_configs"),
      "client reads data_source_private_configs",
    );
    assertDenied(await read(ctx.clients.clientAAdmin, "client_accounts"), "client reads client_accounts");
  });

  // Positive controls: the client-safe surface DOES work, and only visible rows show.
  test("client users see only client-visible rows on shared tables", async () => {
    const modules = await read(ctx.clients.clientAMember, "portal_modules");
    assertReadable(modules, "client reads portal modules", 1);
    assert.ok(
      modules.data.every((row) => row.client_visible === true && row.enabled === true),
      "client must not see disabled or hidden portal modules",
    );
    const kpis = await read(ctx.clients.clientAMember, "kpi_definitions");
    assert.ok(
      kpis.data.every((row) => row.client_visible === true),
      "client must not see internal KPI definitions",
    );
    const actions = await read(ctx.clients.clientAMember, "action_items");
    assert.ok(
      actions.data.every((row) => row.client_visible === true),
      "client must not see internal-only action items",
    );
    // The client-safe data-source view is readable for the client's own org.
    assertReadable(await read(ctx.clients.clientAMember, "data_source_connections"), "client reads own data sources", 1);
  });

  // ---- 10. Anonymous users cannot access protected tables ----------------------
  test("anonymous users cannot access protected tables", async () => {
    for (const table of [
      "organizations",
      "organization_memberships",
      "client_profiles",
      "client_accounts",
      "internal_notes",
      "portal_modules",
      "kpi_definitions",
      "agent_profiles",
      "audit_events",
    ]) {
      assertDenied(await read(ctx.clients.anon, table), `anon reads ${table}`);
    }
  });

  // ---- 11. Inactive memberships cannot access protected data -------------------
  test("inactive (suspended) membership cannot access protected data", async () => {
    assertDenied(await read(ctx.clients.inactive, "organizations"), "inactive reads organizations");
    assertDenied(await read(ctx.clients.inactive, "client_profiles"), "inactive reads client_profiles");
    assertDenied(await read(ctx.clients.inactive, "portal_modules"), "inactive reads portal_modules");
  });

  // ---- 12. Forged org id / body cannot bypass tenant isolation -----------------
  test("supplying another org's id in a query cannot bypass isolation", async () => {
    for (const table of ["portal_modules", "kpi_definitions", "action_items", "agent_profiles", "client_profiles"]) {
      assertDenied(
        await read(ctx.clients.clientAMember, table, (q) => q.eq("organization_id", ctx.orgIds.clientB)),
        `client A forges Client B org id on ${table}`,
      );
    }
  });

  test("forged organization_id / owner in a write body cannot bypass isolation", async () => {
    // A client can legitimately write their own dashboard layout...
    assertWriteAllowed(
      await tryInsert(ctx.clients.clientAMember, "dashboard_layouts", {
        organization_id: ctx.orgIds.clientA,
        user_id: ctx.userIds.clientAMember,
        layout_key: "overview",
        layout: [],
      }),
      "client writes own dashboard layout",
    );
    // ...but not one scoped to another organization.
    assertWriteDenied(
      await tryInsert(ctx.clients.clientAMember, "dashboard_layouts", {
        organization_id: ctx.orgIds.clientB,
        user_id: ctx.userIds.clientAMember,
        layout_key: "overview",
        layout: [],
      }),
      "client forges other-org dashboard layout",
    );
    // Forged conversation ownership / org is rejected.
    assertWriteDenied(
      await tryInsert(ctx.clients.clientAMember, "agent_conversations", {
        organization_id: ctx.orgIds.clientB,
        created_by_user_id: ctx.userIds.clientAMember,
        title: "cross-tenant",
      }),
      "client forges conversation in another org",
    );
    assertWriteDenied(
      await tryInsert(ctx.clients.clientAMember, "agent_conversations", {
        organization_id: ctx.orgIds.clientA,
        created_by_user_id: ctx.userIds.clientBAdmin,
        title: "spoofed owner",
      }),
      "client forges conversation owned by another user",
    );
  });

  // ---- 13. agent_messages: conversation boundary + future role restriction -----
  test("client cannot write into another org's conversation", async () => {
    assertWriteDenied(
      await tryInsert(ctx.clients.clientAMember, "agent_messages", {
        conversation_id: ctx.seed.clientB.conversationId,
        role: "user",
        content: "should be blocked",
      }),
      "client writes message into Client B conversation",
    );
  });

  // FUTURE SECURITY (currently NOT enforced by the migration): once the live agent
  // endpoint exists, client users must not be able to author assistant/system
  // messages — only 'user'. This is skipped until a policy/trigger enforces it.
  // See supabase/tests/README.md ("agent_messages hardening") for the proposed fix.
  // To activate: add the restriction, then remove `skip`.
  test(
    "client cannot forge assistant/system agent messages",
    { skip: "Not yet enforced — add a role restriction with the live agent endpoint (see README)." },
    async () => {
      const conversation = await tryInsert(ctx.clients.clientAMember, "agent_conversations", {
        organization_id: ctx.orgIds.clientA,
        created_by_user_id: ctx.userIds.clientAMember,
        title: "role-restriction check",
      });
      assertWriteAllowed(conversation, "client creates own conversation");
      const conversationId = conversation.data[0].id;

      for (const role of ["assistant", "system"]) {
        assertWriteDenied(
          await tryInsert(ctx.clients.clientAMember, "agent_messages", {
            conversation_id: conversationId,
            role,
            content: `forged ${role} message`,
          }),
          `client forges ${role} message`,
        );
      }
    },
  );
}

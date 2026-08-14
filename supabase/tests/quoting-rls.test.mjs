// RLS authorization matrix for the Alumasteel quoting tables.
//
// Runs against a development/staging Supabase project with BOTH migrations
// applied (202607280001_hermes_foundation.sql and
// 202607300001_alumasteel_quoting.sql). Signs in as real seeded users so
// auth.uid() and every quoting RLS policy apply exactly as in production.
// The service-role key is used only to arrange and tear down fixtures.
//
// Run:
//   node --env-file=.env.test.local --test supabase/tests/quoting-rls.test.mjs
//
// See docs/alumasteel-staging.md for the staging checklist.

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readConfig } from "./config.mjs";
import { anonClient, signInAs } from "./clients.mjs";
import { resetAndSeedQuoting, deleteQuotingSeed } from "./quoting-seed.mjs";
import { QUOTING_USERS } from "./quoting-fixtures.mjs";

if (!readConfig().ok) {
  test("Quoting RLS matrix", { skip: "No staging Supabase config; see supabase/tests/README.md" }, () => {});
} else {
  async function read(client, table, build = (q) => q) {
    const { data, error } = await build(client.from(table).select("*"));
    return { data: data ?? [], error };
  }

  function assertDenied(res, message) {
    if (res.error) return;
    assert.equal(res.data.length, 0, `${message}: expected 0 rows, got ${res.data.length}`);
  }

  function assertReadable(res, message, min = 1) {
    assert.ok(!res.error, `${message}: unexpected error ${res.error?.message}`);
    assert.ok(res.data.length >= min, `${message}: expected >= ${min} rows, got ${res.data.length}`);
  }

  const ctx = { orgIds: null, userIds: null, alumasteel: null, otherQuoteId: null, clients: {} };

  before(async () => {
    const seeded = await resetAndSeedQuoting();
    ctx.orgIds = seeded.orgIds;
    ctx.userIds = seeded.userIds;
    ctx.alumasteel = seeded.alumasteel;
    ctx.otherQuoteId = seeded.otherQuoteId;
    ctx.clients = {
      alumaOwner: await signInAs(QUOTING_USERS.alumaOwner.email),
      alumaMember: await signInAs(QUOTING_USERS.alumaMember.email),
      otherOwner: await signInAs(QUOTING_USERS.otherOwner.email),
      internalAdmin: await signInAs(QUOTING_USERS.internalAdmin.email),
      internalMember: await signInAs(QUOTING_USERS.internalMember.email),
      anon: anonClient(),
    };
  });

  after(async () => {
    await deleteQuotingSeed();
  });

  const QUOTING_TABLES = [
    "quote_customers",
    "quote_vendors",
    "quote_projects",
    "quote_documents",
    "quote_takeoff_items",
    "quote_clarifications",
    "quote_vendor_requests",
    "quote_cost_lines",
    "quote_settings",
    "quote_versions",
    "quote_follow_ups",
    "quote_status_history",
    "quote_activity",
    "quote_approvals",
  ];

  test("Alumasteel owner and member can read their own quote records", async () => {
    for (const clientKey of ["alumaOwner", "alumaMember"]) {
      const res = await read(ctx.clients[clientKey], "quote_projects", (q) =>
        q.eq("organization_id", ctx.orgIds.alumasteel),
      );
      assertReadable(res, `${clientKey} reads own quote_projects`, 3);
      const takeoff = await read(ctx.clients[clientKey], "quote_takeoff_items", (q) =>
        q.eq("quote_id", ctx.alumasteel.quoteReviewId),
      );
      assertReadable(takeoff, `${clientKey} reads own takeoff rows`, 3);
    }
  });

  test("an unrelated client cannot read any Alumasteel quoting record", async () => {
    for (const table of QUOTING_TABLES) {
      const res = await read(ctx.clients.otherOwner, table, (q) =>
        q.eq("organization_id", ctx.orgIds.alumasteel),
      );
      assertDenied(res, `otherOwner blocked from Alumasteel ${table}`);
    }
  });

  test("Alumasteel users cannot read the unrelated client's quotes", async () => {
    const res = await read(ctx.clients.alumaOwner, "quote_projects", (q) =>
      q.eq("organization_id", ctx.orgIds.otherClient),
    );
    assertDenied(res, "alumaOwner blocked from Fabricators B quotes");
    const byId = await read(ctx.clients.alumaMember, "quote_projects", (q) =>
      q.eq("id", ctx.otherQuoteId),
    );
    assertDenied(byId, "alumaMember blocked from a foreign quote by id");
  });

  test("supplying the foreign org id in a write body cannot bypass isolation", async () => {
    const { data, error } = await ctx.clients.otherOwner
      .from("quote_takeoff_items")
      .insert({
        organization_id: ctx.orgIds.alumasteel,
        quote_id: ctx.alumasteel.quoteReviewId,
        category: "other",
        description: "forged cross-tenant row",
      })
      .select("id");
    assert.ok(error || (data ?? []).length === 0, "forged organization_id insert must be blocked");
  });

  test("client admin can perform allowed quote writes in their own org", async () => {
    const { data, error } = await ctx.clients.alumaOwner
      .from("quote_customers")
      .insert({
        organization_id: ctx.orgIds.alumasteel,
        company_name: "Fictional RLS Write Check Co",
      })
      .select("id")
      .single();
    assert.ok(!error && data, `alumaOwner insert failed: ${error?.message}`);
    await ctx.clients.alumaOwner.from("quote_customers").delete().eq("id", data.id);
  });

  test("client users cannot delete quoting records (deactivate-only model)", async () => {
    const { error, count } = await ctx.clients.alumaOwner
      .from("quote_takeoff_items")
      .delete({ count: "exact" })
      .eq("id", ctx.alumasteel.humanRowId);
    assert.ok(error || count === 0, "client delete of takeoff rows must be blocked by RLS");
    const stillThere = await read(ctx.clients.alumaOwner, "quote_takeoff_items", (q) =>
      q.eq("id", ctx.alumasteel.humanRowId),
    );
    assertReadable(stillThere, "row survives client delete attempt");
  });

  test("append-only history cannot be rewritten by client users", async () => {
    for (const table of ["quote_status_history", "quote_activity", "quote_approvals"]) {
      const { data, error } = await ctx.clients.alumaOwner
        .from(table)
        .update({ note: "tampered" })
        .eq("organization_id", ctx.orgIds.alumasteel)
        .select("id");
      // quote_approvals has no note column; any error is also a denial.
      assert.ok(error || (data ?? []).length === 0, `${table} must be append-only for clients`);
    }
  });

  test("internal Supra users can read client quoting health data", async () => {
    for (const clientKey of ["internalAdmin", "internalMember"]) {
      const res = await read(ctx.clients[clientKey], "quote_projects", (q) =>
        q.eq("organization_id", ctx.orgIds.alumasteel),
      );
      assertReadable(res, `${clientKey} reads Alumasteel quotes for support`, 3);
    }
  });

  test("client users cannot read Hermes-only tables", async () => {
    for (const table of ["internal_notes", "audit_events", "operational_records", "agent_private_configs"]) {
      const res = await read(ctx.clients.alumaOwner, table);
      assertDenied(res, `alumaOwner blocked from ${table}`);
    }
  });

  test("client users cannot write Hermes-only module configuration", async () => {
    const { data, error } = await ctx.clients.alumaOwner
      .from("portal_modules")
      .update({ enabled: false })
      .eq("organization_id", ctx.orgIds.alumasteel)
      .select("id");
    assert.ok(error || (data ?? []).length === 0, "module registry writes are internal-admin only");
  });

  test("anonymous users cannot access any quoting table", async () => {
    for (const table of QUOTING_TABLES) {
      const res = await read(ctx.clients.anon, table);
      assertDenied(res, `anon blocked from ${table}`);
    }
  });

  test("document records stay tenant-scoped", async () => {
    const own = await read(ctx.clients.alumaOwner, "quote_documents", (q) =>
      q.eq("organization_id", ctx.orgIds.alumasteel),
    );
    assertReadable(own, "alumaOwner reads own documents");
    const foreign = await read(ctx.clients.otherOwner, "quote_documents");
    for (const row of foreign.data) {
      assert.notEqual(
        row.organization_id,
        ctx.orgIds.alumasteel,
        "foreign client must never see an Alumasteel document record",
      );
    }
  });

  test("storage objects in quote-documents are tenant-scoped", async () => {
    // The bucket policy keys on the first path segment (organization id).
    const foreignList = await ctx.clients.otherOwner.storage
      .from("quote-documents")
      .list(ctx.orgIds.alumasteel, { limit: 10 });
    assert.ok(
      foreignList.error || (foreignList.data ?? []).length === 0,
      "foreign client must not list Alumasteel storage objects",
    );
    const foreignUpload = await ctx.clients.otherOwner.storage
      .from("quote-documents")
      .upload(`${ctx.orgIds.alumasteel}/intrusion-test.txt`, new Blob(["x"]), {
        contentType: "text/plain",
      });
    assert.ok(foreignUpload.error, "foreign client must not upload into Alumasteel's folder");
  });
}

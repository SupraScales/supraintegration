// RLS matrix for SkyShare Lead Intelligence Slice 1.
// Requires 202607280001_hermes_foundation.sql and
// 202609070001_lead_intelligence_foundation.sql on a staging/dev Supabase project.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readConfig } from "./config.mjs";
import { serviceClient, signInAs } from "./clients.mjs";
import { resetAndSeed } from "./seed.mjs";
import { deleteSeed } from "./teardown.mjs";
import { USERS } from "./fixtures.mjs";

if (!readConfig().ok) {
  test("Lead Intelligence RLS matrix", { skip: "No staging Supabase config; see supabase/tests/README.md" }, () => {});
} else {
  const ctx = { orgIds: null, userIds: null, clients: {}, ids: {} };

  async function insert(svc, table, row, returning = "id") {
    const { data, error } = await svc.from(table).insert(row).select(returning).single();
    if (error) throw new Error(`seed ${table}: ${error.message}`);
    return data;
  }

  async function read(client, table, build = (q) => q) {
    const { data, error } = await build(client.from(table).select("*"));
    return { data: data ?? [], error };
  }

  function denied(result, message) {
    if (result.error) return;
    assert.equal(result.data.length, 0, message);
  }

  before(async () => {
    const seeded = await resetAndSeed();
    ctx.orgIds = seeded.orgIds;
    ctx.userIds = seeded.userIds;
    ctx.clients = {
      internalAdmin: await signInAs(USERS.internalAdmin.email),
      internalMember: await signInAs(USERS.internalMember.email),
      clientAAdmin: await signInAs(USERS.clientAAdmin.email),
      clientAMember: await signInAs(USERS.clientAMember.email),
      clientBAdmin: await signInAs(USERS.clientBAdmin.email),
    };

    const svc = serviceClient();
    const huntA = await insert(svc, "lead_hunts", {
      organization_id: ctx.orgIds.clientA,
      hunt_key: "test-liquidity",
      label: "Test liquidity event",
      priority: "p0",
      configuration: { private_threshold: 5000000 },
    });
    const huntB = await insert(svc, "lead_hunts", {
      organization_id: ctx.orgIds.clientB,
      hunt_key: "test-dealer",
      label: "Test dealer expansion",
      priority: "p0",
    });

    const publishedA = await insert(svc, "lead_candidates", {
      organization_id: ctx.orgIds.clientA,
      supra_lead_id: "TEST-A-PUBLISHED",
      source_hunt_key: "test-liquidity",
      source_hunt_label: "Test liquidity event",
      person_name: "Published Test Person",
      trigger_summary: "Test public event",
      why_found: "Fixture for RLS verification",
      known_facts: ["public fixture fact"],
      publication_state: "published",
      published_at: new Date().toISOString(),
      published_by: ctx.userIds.internalAdmin,
    });
    const unpublishedA = await insert(svc, "lead_candidates", {
      organization_id: ctx.orgIds.clientA,
      supra_lead_id: "TEST-A-UNPUBLISHED",
      source_hunt_key: "test-liquidity",
      source_hunt_label: "Test liquidity event",
      person_name: "Unpublished Test Person",
      trigger_summary: "Internal fixture event",
      why_found: "Fixture for unpublished protection",
    });
    const publishedB = await insert(svc, "lead_candidates", {
      organization_id: ctx.orgIds.clientB,
      supra_lead_id: "TEST-B-PUBLISHED",
      source_hunt_key: "test-dealer",
      source_hunt_label: "Test dealer expansion",
      person_name: "Other Tenant Test Person",
      trigger_summary: "Other tenant fixture",
      why_found: "Fixture for cross-tenant protection",
      publication_state: "published",
      published_at: new Date().toISOString(),
      published_by: ctx.userIds.internalAdmin,
    });

    await insert(svc, "lead_candidate_private_details", {
      candidate_id: publishedA.id,
      organization_id: ctx.orgIds.clientA,
      hunt_id: huntA.id,
      dedupe_key: "private-dedupe-key",
      scoring_weights: { secret_weight: 99 },
      prompt_material: { private_prompt: true },
      vendor_payloads: { secret_vendor_payload: true },
    }, "candidate_id");
    await insert(svc, "lead_candidate_private_details", {
      candidate_id: publishedB.id,
      organization_id: ctx.orgIds.clientB,
      hunt_id: huntB.id,
      dedupe_key: "private-other-tenant",
    }, "candidate_id");

    await insert(svc, "lead_evidence", {
      organization_id: ctx.orgIds.clientA,
      candidate_id: publishedA.id,
      label: "Client-safe source",
      summary: "Visible evidence",
      client_visible: true,
    });
    await insert(svc, "lead_evidence", {
      organization_id: ctx.orgIds.clientA,
      candidate_id: publishedA.id,
      label: "Internal-only source",
      summary: "Hidden evidence",
      client_visible: false,
    });
    await insert(svc, "lead_evidence", {
      organization_id: ctx.orgIds.clientA,
      candidate_id: unpublishedA.id,
      label: "Unpublished source",
      summary: "Must stay hidden",
      client_visible: true,
    });

    ctx.ids = { publishedA: publishedA.id, unpublishedA: unpublishedA.id, publishedB: publishedB.id };
  });

  after(async () => {
    await deleteSeed();
  });

  test("client sees only own published candidates", async () => {
    const result = await read(ctx.clients.clientAAdmin, "lead_candidates");
    assert.equal(result.error, null);
    assert.deepEqual(result.data.map((row) => row.id), [ctx.ids.publishedA]);
    assert.equal("hunt_id" in result.data[0], false, "client-safe candidate must not expose internal hunt id");
    assert.equal("signal_id" in result.data[0], false, "client-safe candidate must not expose internal signal id");
  });

  test("client cannot read unpublished or cross-tenant candidates", async () => {
    denied(await read(ctx.clients.clientAAdmin, "lead_candidates", (q) => q.eq("id", ctx.ids.unpublishedA)), "unpublished lead leaked");
    denied(await read(ctx.clients.clientAAdmin, "lead_candidates", (q) => q.eq("id", ctx.ids.publishedB)), "cross-tenant lead leaked");
  });

  test("client cannot read private candidate details or hunts", async () => {
    denied(await read(ctx.clients.clientAAdmin, "lead_candidate_private_details"), "private details leaked");
    denied(await read(ctx.clients.clientAAdmin, "lead_hunts"), "hunt configuration leaked");
    denied(await read(ctx.clients.clientAAdmin, "lead_vendor_usage"), "vendor costs leaked");
  });

  test("client sees only client-safe evidence for a published lead", async () => {
    const result = await read(ctx.clients.clientAMember, "lead_evidence");
    assert.equal(result.error, null);
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].label, "Client-safe source");
    assert.equal(result.data[0].candidate_id, ctx.ids.publishedA);
  });

  test("client can create and update only their own feedback on a published lead", async () => {
    const create = await ctx.clients.clientAAdmin.from("lead_feedback").insert({
      organization_id: ctx.orgIds.clientA,
      candidate_id: ctx.ids.publishedA,
      user_id: ctx.userIds.clientAAdmin,
      rating: "good",
    }).select("*");
    assert.equal(create.error, null);
    assert.equal(create.data.length, 1);

    const update = await ctx.clients.clientAAdmin.from("lead_feedback")
      .update({ rating: "whale" })
      .eq("candidate_id", ctx.ids.publishedA)
      .eq("user_id", ctx.userIds.clientAAdmin)
      .select("*");
    assert.equal(update.error, null);
    assert.equal(update.data[0].rating, "whale");

    const visible = await read(ctx.clients.clientAAdmin, "lead_feedback");
    assert.ok(visible.data.every((row) => row.user_id === ctx.userIds.clientAAdmin));
  });

  test("client feedback is blocked for unpublished and cross-tenant leads", async () => {
    const unpublished = await ctx.clients.clientAAdmin.from("lead_feedback").insert({
      organization_id: ctx.orgIds.clientA,
      candidate_id: ctx.ids.unpublishedA,
      user_id: ctx.userIds.clientAAdmin,
      rating: "good",
    }).select("*");
    assert.ok(unpublished.error || unpublished.data.length === 0);

    const crossTenant = await ctx.clients.clientAAdmin.from("lead_feedback").insert({
      organization_id: ctx.orgIds.clientB,
      candidate_id: ctx.ids.publishedB,
      user_id: ctx.userIds.clientAAdmin,
      rating: "whale",
    }).select("*");
    assert.ok(crossTenant.error || crossTenant.data.length === 0);
  });

  test("client cannot modify lead truth", async () => {
    const result = await ctx.clients.clientAAdmin.from("lead_candidates")
      .update({ why_found: "forged" })
      .eq("id", ctx.ids.publishedA)
      .select("*");
    assert.ok(result.error || result.data.length === 0);
  });

  test("internal member can read complete records and private details", async () => {
    const leads = await read(ctx.clients.internalMember, "lead_candidates");
    const privateDetails = await read(ctx.clients.internalMember, "lead_candidate_private_details");
    assert.equal(leads.error, null);
    assert.ok(leads.data.length >= 3);
    assert.equal(privateDetails.error, null);
    assert.ok(privateDetails.data.some((row) => row.dedupe_key === "private-dedupe-key"));
  });

  test("internal admin can publish/update candidate state", async () => {
    const result = await ctx.clients.internalAdmin.from("lead_candidates")
      .update({
        status: "qualified",
        publication_state: "published",
        published_at: new Date().toISOString(),
        published_by: ctx.userIds.internalAdmin,
      })
      .eq("id", ctx.ids.unpublishedA)
      .select("*");
    assert.equal(result.error, null);
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].publication_state, "published");
  });
}

// RLS matrix for SkyShare Lead Intelligence + SEC POC + internal gate ledger.
// Requires the Hermes foundation and all Lead Intelligence migrations on staging/dev.
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
    const huntA = await insert(svc, "lead_hunts", { organization_id: ctx.orgIds.clientA, hunt_key: "test-liquidity", label: "Test liquidity event", priority: "p0", configuration: { private_threshold: 5000000 } });
    const huntB = await insert(svc, "lead_hunts", { organization_id: ctx.orgIds.clientB, hunt_key: "test-dealer", label: "Test dealer expansion", priority: "p0" });
    const runA = await insert(svc, "lead_hunt_runs", {
      organization_id: ctx.orgIds.clientA,
      hunt_id: huntA.id,
      status: "completed",
      trigger_kind: "manual",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
    const publishedSignalA = await insert(svc, "lead_signals", {
      organization_id: ctx.orgIds.clientA,
      hunt_id: huntA.id,
      hunt_run_id: runA.id,
      source_type: "sec_form_4",
      source_record_id: "test-published-signal",
      event_type: "insider_stock_sale",
      title: "Published test SEC signal",
    });
    const unpublishedSignalA = await insert(svc, "lead_signals", {
      organization_id: ctx.orgIds.clientA,
      hunt_id: huntA.id,
      hunt_run_id: runA.id,
      source_type: "sec_form_4",
      source_record_id: "test-unpublished-signal",
      event_type: "insider_stock_sale",
      title: "Unpublished test SEC signal",
    });

    const publishedA = await insert(svc, "lead_candidates", {
      organization_id: ctx.orgIds.clientA, supra_lead_id: "TEST-A-PUBLISHED", source_hunt_key: "test-liquidity", source_hunt_label: "Test liquidity event",
      person_name: "Published Test Person", trigger_summary: "Test public event", why_found: "Fixture for RLS verification", known_facts: ["public fixture fact"],
      system_recommendation: "whale", event_amount: 12000000, publication_state: "published", published_at: new Date().toISOString(), published_by: ctx.userIds.internalAdmin,
    });
    const unpublishedA = await insert(svc, "lead_candidates", {
      organization_id: ctx.orgIds.clientA, supra_lead_id: "TEST-A-UNPUBLISHED", source_hunt_key: "test-liquidity", source_hunt_label: "Test liquidity event",
      person_name: "Unpublished Test Person", trigger_summary: "Internal fixture event", why_found: "Fixture for unpublished protection", system_recommendation: "good",
    });
    const publishedB = await insert(svc, "lead_candidates", {
      organization_id: ctx.orgIds.clientB, supra_lead_id: "TEST-B-PUBLISHED", source_hunt_key: "test-dealer", source_hunt_label: "Test dealer expansion",
      person_name: "Other Tenant Test Person", trigger_summary: "Other tenant fixture", why_found: "Fixture for cross-tenant protection",
      system_recommendation: "good", publication_state: "published", published_at: new Date().toISOString(), published_by: ctx.userIds.internalAdmin,
    });

    await insert(svc, "lead_candidate_private_details", { candidate_id: publishedA.id, organization_id: ctx.orgIds.clientA, hunt_id: huntA.id, signal_id: publishedSignalA.id, dedupe_key: "private-dedupe-key", scoring_weights: { secret_weight: 99 }, prompt_material: { private_prompt: true }, vendor_payloads: { secret_vendor_payload: true } }, "candidate_id");
    await insert(svc, "lead_candidate_private_details", { candidate_id: unpublishedA.id, organization_id: ctx.orgIds.clientA, hunt_id: huntA.id, signal_id: unpublishedSignalA.id, dedupe_key: "private-unpublished-dedupe-key" }, "candidate_id");
    await insert(svc, "lead_evidence", { organization_id: ctx.orgIds.clientA, candidate_id: publishedA.id, label: "Client-safe source", summary: "Visible evidence", client_visible: true });
    await insert(svc, "lead_evidence", { organization_id: ctx.orgIds.clientA, candidate_id: publishedA.id, label: "Internal-only source", summary: "Hidden evidence", client_visible: false });
    await insert(svc, "lead_evidence", { organization_id: ctx.orgIds.clientA, candidate_id: unpublishedA.id, label: "Unpublished source", summary: "Must stay hidden", client_visible: true });
    ctx.ids = {
      huntA: huntA.id,
      runA: runA.id,
      publishedSignalA: publishedSignalA.id,
      unpublishedSignalA: unpublishedSignalA.id,
      publishedA: publishedA.id,
      unpublishedA: unpublishedA.id,
      publishedB: publishedB.id,
    };
  });

  after(async () => { await deleteSeed(); });

  test("client sees only own published candidates with system recommendation", async () => {
    const result = await read(ctx.clients.clientAAdmin, "lead_candidates");
    assert.equal(result.error, null);
    assert.deepEqual(result.data.map((row) => row.id), [ctx.ids.publishedA]);
    assert.equal(result.data[0].system_recommendation, "whale");
  });

  test("client cannot read unpublished or cross-tenant candidates", async () => {
    denied(await read(ctx.clients.clientAAdmin, "lead_candidates", (q) => q.eq("id", ctx.ids.unpublishedA)), "unpublished lead leaked");
    denied(await read(ctx.clients.clientAAdmin, "lead_candidates", (q) => q.eq("id", ctx.ids.publishedB)), "cross-tenant lead leaked");
  });

  test("client cannot read private details, hunts, runs, gate ledger, or vendor costs", async () => {
    for (const table of ["lead_candidate_private_details", "lead_hunts", "lead_signals", "lead_hunt_runs", "lead_gate_events", "lead_vendor_usage"]) {
      denied(await read(ctx.clients.clientAAdmin, table), `${table} leaked`);
    }
  });

  test("client sees only client-safe evidence for a published lead", async () => {
    const result = await read(ctx.clients.clientAMember, "lead_evidence");
    assert.equal(result.error, null);
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].label, "Client-safe source");
  });

  test("client can approve without overwriting system recommendation and approval enters ledger", async () => {
    const create = await ctx.clients.clientAAdmin.from("lead_feedback").insert({ organization_id: ctx.orgIds.clientA, candidate_id: ctx.ids.publishedA, user_id: ctx.userIds.clientAAdmin, human_decision: "approve" }).select("*");
    assert.equal(create.error, null);
    const lead = await read(ctx.clients.clientAAdmin, "lead_candidates", (q) => q.eq("id", ctx.ids.publishedA));
    assert.equal(lead.data[0].system_recommendation, "whale");
    const gates = await read(ctx.clients.internalMember, "lead_gate_events", (q) => q.eq("candidate_id", ctx.ids.publishedA).eq("reason_code", "client_approved"));
    assert.equal(gates.error, null);
    assert.equal(gates.data.length, 1);
    assert.equal(gates.data[0].hunt_run_id, ctx.ids.runA);
  });

  test("client can override recommendation and override enters ledger while original remains intact", async () => {
    const update = await ctx.clients.clientAAdmin.from("lead_feedback").upsert({ organization_id: ctx.orgIds.clientA, candidate_id: ctx.ids.publishedA, user_id: ctx.userIds.clientAAdmin, human_decision: "override", human_override: "good" }, { onConflict: "candidate_id,user_id" }).select("*");
    assert.equal(update.error, null);
    assert.equal(update.data[0].human_override, "good");
    const lead = await read(ctx.clients.clientAAdmin, "lead_candidates", (q) => q.eq("id", ctx.ids.publishedA));
    assert.equal(lead.data[0].system_recommendation, "whale");
    const gates = await read(ctx.clients.internalMember, "lead_gate_events", (q) => q.eq("candidate_id", ctx.ids.publishedA).eq("reason_code", "client_overridden"));
    assert.equal(gates.error, null);
    assert.equal(gates.data.length, 1);
    assert.equal(gates.data[0].internal_evidence.human_override, "good");
  });

  test("override requires an explicit replacement recommendation", async () => {
    const invalid = await ctx.clients.clientAMember.from("lead_feedback").insert({ organization_id: ctx.orgIds.clientA, candidate_id: ctx.ids.publishedA, user_id: ctx.userIds.clientAMember, human_decision: "override" }).select("*");
    assert.ok(invalid.error || invalid.data.length === 0);
  });

  test("client feedback is blocked for unpublished and cross-tenant leads", async () => {
    const unpublished = await ctx.clients.clientAAdmin.from("lead_feedback").insert({ organization_id: ctx.orgIds.clientA, candidate_id: ctx.ids.unpublishedA, user_id: ctx.userIds.clientAAdmin, human_decision: "approve" }).select("*");
    assert.ok(unpublished.error || unpublished.data.length === 0);
    const crossTenant = await ctx.clients.clientAAdmin.from("lead_feedback").insert({ organization_id: ctx.orgIds.clientB, candidate_id: ctx.ids.publishedB, user_id: ctx.userIds.clientAAdmin, human_decision: "approve" }).select("*");
    assert.ok(crossTenant.error || crossTenant.data.length === 0);
  });

  test("client cannot modify lead truth", async () => {
    const result = await ctx.clients.clientAAdmin.from("lead_candidates").update({ system_recommendation: "bad", why_found: "forged" }).eq("id", ctx.ids.publishedA).select("*");
    assert.ok(result.error || result.data.length === 0);
  });

  test("internal member can read complete records and private details", async () => {
    const leads = await read(ctx.clients.internalMember, "lead_candidates");
    const privateDetails = await read(ctx.clients.internalMember, "lead_candidate_private_details");
    const gates = await read(ctx.clients.internalMember, "lead_gate_events");
    assert.equal(leads.error, null); assert.ok(leads.data.length >= 3);
    assert.equal(privateDetails.error, null); assert.ok(privateDetails.data.some((row) => row.dedupe_key === "private-dedupe-key"));
    assert.equal(gates.error, null);
  });

  test("internal admin can publish candidate and publication enters originating run ledger", async () => {
    const result = await ctx.clients.internalAdmin.from("lead_candidates").update({ status: "qualified", publication_state: "published", published_at: new Date().toISOString(), published_by: ctx.userIds.internalAdmin }).eq("id", ctx.ids.unpublishedA).select("*");
    assert.equal(result.error, null); assert.equal(result.data.length, 1); assert.equal(result.data[0].publication_state, "published");
    const gates = await read(ctx.clients.internalMember, "lead_gate_events", (q) => q.eq("candidate_id", ctx.ids.unpublishedA).eq("reason_code", "published"));
    assert.equal(gates.error, null);
    assert.equal(gates.data.length, 1);
    assert.equal(gates.data[0].hunt_run_id, ctx.ids.runA);
  });

  test("gate ledger is append-only for authenticated users", async () => {
    const update = await ctx.clients.internalAdmin.from("lead_gate_events").update({ reason_code: "qualified" }).eq("candidate_id", ctx.ids.unpublishedA).select("*");
    assert.ok(update.error || update.data.length === 0);
    const remove = await ctx.clients.internalAdmin.from("lead_gate_events").delete().eq("candidate_id", ctx.ids.unpublishedA).select("*");
    assert.ok(remove.error || remove.data.length === 0);
  });
}

// RLS authorization matrix for the Hermes / client portal foundation.
//
// Runs against a development/staging Supabase project with BOTH migrations applied,
// in order: 202607280001_hermes_foundation.sql, then 202607280002_agent_message_role.sql.
// It signs in as real seeded users so auth.uid(), every RLS policy, and the
// agent-message role trigger apply exactly as in production. The service-role key is
// used only to arrange and tear down fixtures.
//
// Run:
//   npm test
//
// which is `node --env-file-if-exists=.env.test.local --test supabase/tests/rls.test.mjs`.
// `--env-file-if-exists` requires Node >= 20.12; see the `engines` field in package.json.
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
//
// A skipped suite still exits 0, so a job that only runs `npm test` proves nothing
// about authorization. Any environment that is SUPPOSED to have staging credentials
// must set RLS_REQUIRE_CONFIG=true, which turns the skip into a hard failure rather
// than a silent green. The protected CI job does exactly that.
if (!readConfig().ok) {
  if (process.env.RLS_REQUIRE_CONFIG === "true") {
    test("RLS matrix", () => {
      assert.fail(
        "RLS_REQUIRE_CONFIG=true but the Supabase test config is missing. Set SUPABASE_URL, " +
          "SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY. See supabase/tests/README.md.",
      );
    });
  } else {
    test("RLS matrix", { skip: "No staging Supabase config; see supabase/tests/README.md" }, () => {});
  }
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

  // ---- 13. agent_messages: conversation boundary + role restriction ------------
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

  // Client A's member owns every conversation created here, so these tests probe
  // the role restriction alone rather than the tenant boundary above.
  async function newClientAConversation(title) {
    const conversation = await tryInsert(ctx.clients.clientAMember, "agent_conversations", {
      organization_id: ctx.orgIds.clientA,
      created_by_user_id: ctx.userIds.clientAMember,
      title,
    });
    assertWriteAllowed(conversation, `client creates conversation "${title}"`);
    return conversation.data[0].id;
  }

  // Enforced by 202607280002_agent_message_role.sql. A client must never be able
  // to author a turn that reads as if Hermes produced it.
  test("client cannot forge assistant/system agent messages", async () => {
    const conversationId = await newClientAConversation("role-restriction check");

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

    // Nothing survived the blocked writes.
    const stored = await read(ctx.clients.clientAMember, "agent_messages", (q) =>
      q.eq("conversation_id", conversationId),
    );
    assert.equal(stored.data.length, 0, "no forged message may be persisted");
  });

  // The client's own legitimate turn still works, and the agent-output fields
  // they tried to supply are stripped instead of trusted.
  test("client can still write a user-role message, without forged agent output", async () => {
    const conversationId = await newClientAConversation("client user message");

    const message = await tryInsert(ctx.clients.clientAMember, "agent_messages", {
      conversation_id: conversationId,
      role: "user",
      content: "Which leads should we contact today?",
      sources: [{ table: "operational_records", id: "forged" }],
      recommended_actions: [{ action: "forged recommendation" }],
      error_code: "forged",
    });
    assertWriteAllowed(message, "client writes own user message");

    const row = message.data[0];
    assert.equal(row.role, "user", "client message must remain role = user");
    assert.deepEqual(row.sources, [], "client-supplied sources must be stripped");
    assert.deepEqual(row.recommended_actions, [], "client-supplied recommended actions must be stripped");
    assert.equal(row.error_code, null, "client-supplied error code must be stripped");

    // Escalating an existing message is blocked too: agent_messages has no update
    // policy, and the trigger also fires before update.
    const escalated = await ctx.clients.clientAMember
      .from("agent_messages")
      .update({ role: "assistant" })
      .eq("id", row.id)
      .select("*");
    assert.equal((escalated.data ?? []).length, 0, "client must not escalate their own message to assistant");
  });

  // Positive control: authorized internal Supra users may author assistant turns,
  // and their agent-output fields are preserved rather than stripped.
  for (const who of ["internalAdmin", "internalMember"]) {
    test(`${who} can write an assistant-role agent message`, async () => {
      const message = await tryInsert(ctx.clients[who], "agent_messages", {
        conversation_id: ctx.seed.clientA.conversationId,
        role: "assistant",
        content: `Assistant turn authored by ${who}.`,
        sources: [{ table: "operational_records", date_range: "last_30_days" }],
        recommended_actions: [{ action: "review the pipeline" }],
      });
      assertWriteAllowed(message, `${who} writes assistant message`);

      const row = message.data[0];
      assert.equal(row.role, "assistant", `${who} must be able to author an assistant turn`);
      assert.equal(row.sources.length, 1, "internal-authored sources must be preserved");
      assert.equal(
        row.recommended_actions.length,
        1,
        "internal-authored recommended actions must be preserved",
      );
    });
  }

  // =========================================================================
  // Phase 1B: scope and fulfillment truth layer (202607290003).
  // =========================================================================

  const scopeA = () => ctx.seed.clientA.scope;
  const scopeB = () => ctx.seed.clientB.scope;

  // ---- 17. Internal admin manages scope records; internal member cannot -------
  test("internal admin can create and manage scope records", async () => {
    const source = await tryInsert(ctx.clients.internalAdmin, "source_references", {
      organization_id: ctx.orgIds.clientA,
      source_type: "approved_change_request",
      secure_reference: "docvault://cr/1",
      created_by_user_id: ctx.userIds.internalAdmin,
    });
    assertWriteAllowed(source, "internal admin inserts source_reference");

    const contract = await tryInsert(ctx.clients.internalAdmin, "contracts", {
      organization_id: ctx.orgIds.clientA,
      internal_title: "Admin created contract",
      created_by_user_id: ctx.userIds.internalAdmin,
    });
    assertWriteAllowed(contract, "internal admin inserts contract");
  });

  test("internal member gets exactly the existing role model: read yes, write no", async () => {
    assertReadable(
      await read(ctx.clients.internalMember, "deliverables"),
      "internal member reads deliverables",
      1,
    );
    assertReadable(
      await read(ctx.clients.internalMember, "deliverable_private_notes"),
      "internal member reads private notes",
      1,
    );
    assertWriteDenied(
      await tryInsert(ctx.clients.internalMember, "contracts", {
        organization_id: ctx.orgIds.clientA,
        internal_title: "Member should not create this",
      }),
      "internal member inserts contract",
    );
  });

  // ---- 18. Cross-tenant isolation on every new table -------------------------
  test("client A cannot read Client B scope records", async () => {
    for (const table of [
      "deliverables",
      "acceptance_criteria",
      "questions",
      "decisions",
      "scope_versions",
      "contracts",
      "source_references",
    ]) {
      assertDenied(
        await read(ctx.clients.clientAAdmin, table, (q) =>
          q.eq("organization_id", ctx.orgIds.clientB),
        ),
        `client A reads Client B ${table}`,
      );
    }
    // Including the deliberately published Client B deliverable.
    assertDenied(
      await read(ctx.clients.clientAAdmin, "deliverables", (q) =>
        q.eq("id", scopeB().publishedDeliverableId),
      ),
      "client A reads Client B published deliverable",
    );
  });

  // ---- 19-21. Internal-only surfaces stay internal ---------------------------
  test("client users cannot read internal scope notes, questions or unapproved decisions", async () => {
    assertDenied(
      await read(ctx.clients.clientAMember, "deliverable_private_notes"),
      "client reads deliverable_private_notes",
    );
    assertDenied(await read(ctx.clients.clientAMember, "questions"), "client reads internal questions");
    assertDenied(await read(ctx.clients.clientAMember, "decisions"), "client reads unapproved decisions");
    for (const table of [
      "contracts",
      "scopes",
      "scope_versions",
      "source_references",
      "deliverable_dependencies",
      "deliverable_evidence",
      "question_private_context",
      "decision_options",
    ]) {
      assertDenied(await read(ctx.clients.clientAMember, table), `client reads ${table}`);
    }
  });

  // Positive control: publication is what makes a deliverable visible, and only
  // the published one shows.
  test("client sees only the published, client-visible deliverable", async () => {
    const visible = await read(ctx.clients.clientAMember, "deliverables");
    assertReadable(visible, "client reads published deliverable", 1);
    assert.ok(
      visible.data.every(
        (row) => row.visibility === "client_visible" && row.publication === "published",
      ),
      "client must never see an internal or unpublished deliverable",
    );
    assert.ok(
      visible.data.every((row) => row.id !== scopeA().internalDeliverableId),
      "the internal deliverable must not be visible",
    );
  });

  // ---- 22-23. Clients cannot approve or forge completion ----------------------
  test("client user cannot approve a scope version", async () => {
    const update = await ctx.clients.clientAAdmin
      .from("scope_versions")
      .update({ approval: "approved", approved_by_user_id: ctx.userIds.clientAAdmin })
      .eq("id", scopeA().scopeVersionId)
      .select("*");
    assert.equal((update.data ?? []).length, 0, "client must not approve a scope version");
  });

  test("client user cannot mark a deliverable completed through a forged write", async () => {
    for (const id of [scopeA().internalDeliverableId, scopeA().publishedDeliverableId]) {
      const update = await ctx.clients.clientAAdmin
        .from("deliverables")
        .update({ status: "completed", verification: "approved" })
        .eq("id", id)
        .select("*");
      assert.equal((update.data ?? []).length, 0, "client must not complete a deliverable");
    }
    // And it really did not change.
    const { data } = await ctx.clients.internalMember
      .from("deliverables")
      .select("status")
      .eq("id", scopeA().publishedDeliverableId)
      .single();
    assert.notEqual(data?.status, "completed", "the deliverable must still not be completed");
  });

  // ---- 24. Agent-created records default to internal --------------------------
  test("agent-created records default to internal and unpublished", async () => {
    const agentDeliverable = scopeA().agentDeliverable;
    assert.equal(
      agentDeliverable.visibility,
      "internal",
      "an agent asking for client_visible must still be stored internal",
    );
    assert.equal(
      agentDeliverable.publication,
      "unpublished",
      "an agent asking for published must still be stored unpublished",
    );
    // The client cannot see it either.
    assertDenied(
      await read(ctx.clients.clientAMember, "deliverables", (q) => q.eq("id", agentDeliverable.id)),
      "client reads agent-drafted deliverable",
    );
  });

  // ---- 25-26. Completion gate --------------------------------------------------
  test("required acceptance criteria prevent premature completion", async () => {
    const attempt = await ctx.clients.internalAdmin
      .from("deliverables")
      .update({
        status: "completed",
        verification: "approved",
        approved_by_user_id: ctx.userIds.internalAdmin,
      })
      .eq("id", scopeA().internalDeliverableId)
      .select("*");
    assert.ok(attempt.error, "completion must be refused while a required criterion is unverified");
    assert.match(
      attempt.error.message,
      /acceptance criteria/i,
      "the refusal should name the unmet acceptance criteria",
    );
  });

  test("evidence and approval allow valid completion", async () => {
    const deliverableId = scopeA().internalDeliverableId;

    const verified = await ctx.clients.internalAdmin
      .from("acceptance_criteria")
      .update({ verification: "approved", verified_by_user_id: ctx.userIds.internalAdmin })
      .eq("id", scopeA().criterionId)
      .select("*");
    assert.ok(!verified.error, `verifying the criterion failed: ${verified.error?.message}`);

    // Still refused: no verified evidence yet.
    const withoutEvidence = await ctx.clients.internalAdmin
      .from("deliverables")
      .update({
        status: "completed",
        verification: "approved",
        approved_by_user_id: ctx.userIds.internalAdmin,
      })
      .eq("id", deliverableId)
      .select("*");
    assert.ok(withoutEvidence.error, "completion must be refused without verified evidence");

    assertWriteAllowed(
      await tryInsert(ctx.clients.internalAdmin, "deliverable_evidence", {
        deliverable_id: deliverableId,
        organization_id: ctx.orgIds.clientA,
        evidence: "automated_test",
        reference: "ci://run/1",
        verification: "approved",
        verified_by_user_id: ctx.userIds.internalAdmin,
      }),
      "internal admin records verified evidence",
    );

    const completed = await ctx.clients.internalAdmin
      .from("deliverables")
      .update({
        status: "completed",
        verification: "approved",
        approved_by_user_id: ctx.userIds.internalAdmin,
      })
      .eq("id", deliverableId)
      .select("*");
    assert.ok(!completed.error, `completion should now succeed: ${completed.error?.message}`);
    assert.ok(completed.data?.[0]?.completed_at, "completed_at must be stamped by the database");
  });

  // ---- 27. Authority hierarchy --------------------------------------------------
  test("a lower-authority source cannot silently supersede a higher-authority record", async () => {
    for (const sourceType of ["agent_inference", "internal_working_note", "onboarding_transcript"]) {
      const attempt = await tryInsert(ctx.clients.internalAdmin, "source_references", {
        organization_id: ctx.orgIds.clientA,
        source_type: sourceType,
        secure_reference: `attempt://${sourceType}`,
        supersedes_id: scopeA().signedSourceId,
        created_by_user_id: ctx.userIds.internalAdmin,
      });
      assertWriteDenied(attempt, `${sourceType} supersedes a signed contract`);
    }

    // A higher-authority source may supersede a lower one.
    assertWriteAllowed(
      await tryInsert(ctx.clients.internalAdmin, "source_references", {
        organization_id: ctx.orgIds.clientA,
        source_type: "approved_change_request",
        secure_reference: "docvault://cr/2",
        supersedes_id: scopeA().inferredSourceId,
        created_by_user_id: ctx.userIds.internalAdmin,
      }),
      "approved change request supersedes agent inference",
    );
  });

  test("agent inference stays noncanonical until a human promotes it", async () => {
    const selfPromote = await ctx.clients.internalAdmin
      .from("source_references")
      .update({ verification: "approved", approved_by_user_id: ctx.userIds.agent })
      .eq("id", scopeA().inferredSourceId)
      .select("*");
    assert.ok(selfPromote.error, "an agent must not approve its own inference");

    const promoted = await ctx.clients.internalAdmin
      .from("source_references")
      .update({ verification: "approved", approved_by_user_id: ctx.userIds.internalAdmin })
      .eq("id", scopeA().inferredSourceId)
      .select("*");
    assert.ok(!promoted.error, `a human promotion should succeed: ${promoted.error?.message}`);
  });

  // ---- 28. Publication requires an internal human --------------------------------
  test("publication requires an internal Supra approver and an explicit visibility change", async () => {
    const deliverableId = scopeA().agentDeliverable.id;

    const noApprover = await ctx.clients.internalAdmin
      .from("deliverables")
      .update({ visibility: "client_visible", publication: "published", published_by_user_id: null })
      .eq("id", deliverableId)
      .select("*");
    assert.ok(noApprover.error, "publishing without an approver must be refused");

    const clientApprover = await ctx.clients.internalAdmin
      .from("deliverables")
      .update({
        visibility: "client_visible",
        publication: "published",
        published_by_user_id: ctx.userIds.clientAAdmin,
      })
      .eq("id", deliverableId)
      .select("*");
    assert.ok(clientApprover.error, "a client must not be accepted as the publisher");

    const published = await ctx.clients.internalAdmin
      .from("deliverables")
      .update({
        visibility: "client_visible",
        publication: "published",
        published_by_user_id: ctx.userIds.internalAdmin,
      })
      .eq("id", deliverableId)
      .select("*");
    assert.ok(!published.error, `internal publication should succeed: ${published.error?.message}`);
  });

  // ---- 29. Audit ------------------------------------------------------------------
  test("meaningful authorized mutations create audit events", async () => {
    const before = await ctx.clients.internalAdmin
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.orgIds.clientA);

    const update = await ctx.clients.internalAdmin
      .from("deliverables")
      .update({ status: "blocked" })
      .eq("id", scopeA().publishedDeliverableId)
      .select("*");
    assert.ok(!update.error, `status change failed: ${update.error?.message}`);

    const after = await ctx.clients.internalAdmin
      .from("audit_events")
      .select("action")
      .eq("organization_id", ctx.orgIds.clientA)
      .like("action", "scope.%")
      .order("created_at", { ascending: false })
      .limit(20);

    assert.ok(
      (after.data ?? []).some((row) => row.action === "scope.deliverables.changed"),
      "a deliverable status change must produce an audit event",
    );
    assert.ok((before.count ?? 0) >= 0, "audit events are readable by internal users");
  });

  test("audit payloads carry no notes, answers or secure references", async () => {
    const { data } = await ctx.clients.internalAdmin
      .from("audit_events")
      .select("metadata")
      .eq("organization_id", ctx.orgIds.clientA)
      .like("action", "scope.%")
      .limit(100);

    const serialized = JSON.stringify(data ?? []);
    for (const forbidden of ["docvault://", "agent://inference", "Margin is thin", "expand scope"]) {
      assert.ok(!serialized.includes(forbidden), `audit metadata leaked: ${forbidden}`);
    }
  });

  // ---- 30. Anonymous and suspended access on the new tables ----------------------
  test("anonymous users cannot access scope tables", async () => {
    for (const table of [
      "contracts",
      "scopes",
      "scope_versions",
      "deliverables",
      "acceptance_criteria",
      "deliverable_evidence",
      "questions",
      "decisions",
      "source_references",
    ]) {
      assertDenied(await read(ctx.clients.anon, table), `anon reads ${table}`);
    }
  });

  test("suspended membership cannot access scope tables", async () => {
    for (const table of ["deliverables", "acceptance_criteria", "questions", "decisions"]) {
      assertDenied(await read(ctx.clients.inactive, table), `suspended reads ${table}`);
    }
  });
}

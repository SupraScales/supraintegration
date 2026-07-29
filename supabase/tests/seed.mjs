// Idempotent seed for the RLS test suite. Creates three organizations, six users,
// and a representative row in every client-safe and internal-only table for the two
// client orgs. Runs teardown first so it can be re-run freely. STAGING/DEV ONLY.
import { pathToFileURL } from "node:url";
import { serviceClient } from "./clients.mjs";
import { requireDestructive } from "./config.mjs";
import { ORGS, USERS, PASSWORD } from "./fixtures.mjs";
import { deleteSeed } from "./teardown.mjs";

async function insert(svc, table, row, returning) {
  let query = svc.from(table).insert(row);
  if (returning) {
    const { data, error } = await query.select(returning).single();
    if (error) throw new Error(`seed ${table}: ${error.message}`);
    return data;
  }
  const { error } = await query;
  if (error) throw new Error(`seed ${table}: ${error.message}`);
  return null;
}

// Seed one client organization with both client-visible and internal-only rows so
// the matrix can assert the visibility boundary at row granularity.
// Phase 1B scope truth layer fixtures for one client organization. Seeded through
// the service role, which the database treats as a trusted server-side caller, so
// the enforcement triggers behave exactly as they will in production.
async function seedScopeTruthLayer(svc, orgId, internalAdminUserId, agentUserId) {
  const signedSource = await insert(
    svc,
    "source_references",
    {
      organization_id: orgId,
      source_type: "signed_contract",
      label: "Master services agreement",
      secure_reference: `docvault://contracts/${orgId}`,
      verification: "approved",
      created_by_actor_type: "human",
      created_by_user_id: internalAdminUserId,
      approved_by_user_id: internalAdminUserId,
    },
    "id, authority_level",
  );

  // Deliberately left unverified: agent inference is noncanonical until promoted.
  const inferredSource = await insert(
    svc,
    "source_references",
    {
      organization_id: orgId,
      source_type: "agent_inference",
      label: "Inferred from onboarding call",
      secure_reference: `agent://inference/${orgId}`,
      created_by_actor_type: "agent",
      created_by_user_id: agentUserId,
    },
    "id, authority_level",
  );

  await insert(svc, "contracts", {
    organization_id: orgId,
    internal_title: "Seeded MSA",
    status: "active",
    source_reference_id: signedSource.id,
    internal_notes: "Internal only. Never client readable.",
    created_by_user_id: internalAdminUserId,
  });

  const scope = await insert(
    svc,
    "scopes",
    {
      organization_id: orgId,
      name: "Seeded growth scope",
      status: "active",
      created_by_user_id: internalAdminUserId,
    },
    "id",
  );

  const version = await insert(
    svc,
    "scope_versions",
    {
      scope_id: scope.id,
      organization_id: orgId,
      version_number: 1,
      summary: "Initial signed scope",
      source_reference_id: signedSource.id,
      approval: "approved",
      created_by_user_id: internalAdminUserId,
      approved_by_user_id: internalAdminUserId,
    },
    "id",
  );

  await svc.from("scopes").update({ current_version_id: version.id }).eq("id", scope.id);

  // Internal deliverable with one required, unverified criterion: the completion
  // gate must refuse this one.
  const internalDeliverable = await insert(
    svc,
    "deliverables",
    {
      organization_id: orgId,
      scope_version_id: version.id,
      name: "Internal deliverable",
      business_outcome: "Answer every inbound call",
      status: "in_progress",
      created_by_user_id: internalAdminUserId,
    },
    "id",
  );

  const criterion = await insert(
    svc,
    "acceptance_criteria",
    {
      deliverable_id: internalDeliverable.id,
      organization_id: orgId,
      criterion: "Calls answered within three rings",
      required: true,
    },
    "id",
  );

  await insert(svc, "deliverable_private_notes", {
    deliverable_id: internalDeliverable.id,
    organization_id: orgId,
    internal_notes: "Internal only. Margin is thin here.",
    scope_risk: "Client may expand scope without paying.",
    change_recommendation: "Propose a change request before build starts.",
  });

  await insert(svc, "deliverable_dependencies", {
    deliverable_id: internalDeliverable.id,
    organization_id: orgId,
    dependency: "missing_access",
    description: "No CRM API key yet",
    responsibility: "client",
  });

  // A published, client-visible deliverable so the client surface has a positive
  // control rather than only deny-assertions.
  const publishedDeliverable = await insert(
    svc,
    "deliverables",
    {
      organization_id: orgId,
      scope_version_id: version.id,
      name: "Published deliverable",
      status: "in_progress",
      visibility: "client_visible",
      publication: "published",
      created_by_user_id: internalAdminUserId,
      published_by_user_id: internalAdminUserId,
    },
    "id",
  );

  // An agent-authored deliverable, asked to be client visible. The database must
  // force it back to internal and unpublished.
  const agentDeliverable = await insert(
    svc,
    "deliverables",
    {
      organization_id: orgId,
      scope_version_id: version.id,
      name: "Agent drafted deliverable",
      status: "not_started",
      visibility: "client_visible",
      publication: "published",
      created_by_actor_type: "agent",
      created_by_user_id: agentUserId,
    },
    "id, visibility, publication",
  );

  await insert(svc, "questions", {
    organization_id: orgId,
    scope_version_id: version.id,
    question: "Which CRM do they actually use?",
    audience: "internal",
    status: "open",
    created_by_user_id: internalAdminUserId,
  });

  await insert(svc, "decisions", {
    organization_id: orgId,
    scope_version_id: version.id,
    statement: "Use HubSpot as the system of record",
    status: "proposed",
    created_by_user_id: internalAdminUserId,
  });

  return {
    signedSourceId: signedSource.id,
    inferredSourceId: inferredSource.id,
    scopeId: scope.id,
    scopeVersionId: version.id,
    internalDeliverableId: internalDeliverable.id,
    publishedDeliverableId: publishedDeliverable.id,
    agentDeliverable,
    criterionId: criterion.id,
  };
}

async function seedClientOrg(svc, orgId, adminUserId) {
  await insert(svc, "client_accounts", {
    organization_id: orgId,
    plan: "growth",
    onboarding_status: "active",
    assigned_owner_id: adminUserId,
  });
  await insert(svc, "client_profiles", {
    organization_id: orgId,
    industry: "Testing",
    website: "https://example.test",
    primary_contact_name: "Test Contact",
    primary_contact_email: "contact@example.test",
    business_summary: "Seeded client profile",
  });
  await insert(svc, "internal_notes", {
    organization_id: orgId,
    author_user_id: adminUserId,
    body: "Internal-only seed note. Client portal code must never read this.",
  });
  await insert(svc, "operational_records", {
    organization_id: orgId,
    record_type: "lead",
    summary: "Seeded operational record",
    payload: {},
  });
  await insert(svc, "audit_events", {
    organization_id: orgId,
    actor_user_id: adminUserId,
    action: "seed.created",
    entity_type: "seed",
    entity_id: orgId,
    metadata: {},
  });

  await insert(svc, "portal_modules", [
    { organization_id: orgId, module_key: "pipeline", label: "Pipeline", enabled: true, client_visible: true, sort_order: 0 },
    { organization_id: orgId, module_key: "reports", label: "Reports", enabled: true, client_visible: false, sort_order: 1 },
  ]);

  const visibleKpi = await insert(
    svc,
    "kpi_definitions",
    { organization_id: orgId, metric_key: "revenue", label: "Revenue", enabled: true, client_visible: true, current_value: 1000 },
    "id",
  );
  await insert(svc, "kpi_definitions", {
    organization_id: orgId,
    metric_key: "internal_margin",
    label: "Internal margin",
    enabled: true,
    client_visible: false,
  });
  await insert(svc, "kpi_private_definitions", {
    kpi_id: visibleKpi.id,
    data_source_key: "warehouse",
    query_definition: { sql: "select 1" },
  });

  await insert(svc, "action_items", [
    { organization_id: orgId, title: "Client-visible action", client_visible: true },
    { organization_id: orgId, title: "Internal-only action", client_visible: false },
  ]);

  await insert(svc, "agent_profiles", {
    organization_id: orgId,
    display_name: "Hermes",
    enabled: true,
    client_visible: true,
    business_context: "Client-safe agent context.",
  });
  await insert(svc, "agent_private_configs", {
    organization_id: orgId,
    internal_instructions: "PRIVATE system prompt — internal only.",
    permitted_actions: "none",
    restricted_actions: "all external writes",
  });

  const connection = await insert(
    svc,
    "data_source_connections",
    { organization_id: orgId, source_key: "crm", provider: "hubspot", label: "CRM", status: "connected" },
    "id",
  );
  await insert(svc, "data_source_private_configs", {
    connection_id: connection.id,
    configuration: { token_ref: "vault://placeholder" },
  });

  const conversation = await insert(
    svc,
    "agent_conversations",
    { organization_id: orgId, created_by_user_id: adminUserId, title: "Seed conversation", status: "open" },
    "id",
  );

  return { conversationId: conversation.id, visibleKpiId: visibleKpi.id };
}

export async function resetAndSeed() {
  requireDestructive();
  const svc = serviceClient();

  await deleteSeed(svc);

  const orgIds = {};
  for (const [key, org] of Object.entries(ORGS)) {
    const row = await insert(
      svc,
      "organizations",
      { name: org.name, slug: org.slug, kind: org.kind, status: "active" },
      "id",
    );
    orgIds[key] = row.id;
  }

  const userIds = {};
  for (const [key, user] of Object.entries(USERS)) {
    const { data, error } = await svc.auth.admin.createUser({
      email: user.email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`seed user ${user.email}: ${error.message}`);
    userIds[key] = data.user.id;
    await insert(svc, "organization_memberships", {
      organization_id: orgIds[user.org],
      user_id: data.user.id,
      role: user.role,
      status: user.status,
    });
  }

  const seed = {
    clientA: {
      ...(await seedClientOrg(svc, orgIds.clientA, userIds.clientAAdmin)),
      scope: await seedScopeTruthLayer(svc, orgIds.clientA, userIds.internalAdmin, userIds.agent),
    },
    clientB: {
      ...(await seedClientOrg(svc, orgIds.clientB, userIds.clientBAdmin)),
      scope: await seedScopeTruthLayer(svc, orgIds.clientB, userIds.internalAdmin, userIds.agent),
    },
  };

  return { orgIds, userIds, seed };
}

// Allow running directly: node --env-file=.env.test.local supabase/tests/seed.mjs
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  resetAndSeed()
    .then((result) => {
      console.log("[rls-tests] seed complete");
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

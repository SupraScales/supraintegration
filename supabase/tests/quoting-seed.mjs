// Idempotent seed for the Alumasteel quoting matrix and staging walkthroughs.
// Creates a fictional Alumasteel staging organization, an unrelated client, an
// internal org, users, and quoting records in several workflow states.
// Every value is clearly fictional. No real pricing rules are configured:
// quote_settings stays empty and quote-level pricing carries explicit
// "FICTIONAL TEST" reasons so staging numbers can never read as real.
// STAGING/DEV ONLY.
import { pathToFileURL } from "node:url";
import { serviceClient } from "./clients.mjs";
import { requireDestructive } from "./config.mjs";
import { QUOTING_ORGS, QUOTING_USERS, QUOTING_MODULES, PASSWORD } from "./quoting-fixtures.mjs";

async function insert(svc, table, row, returning) {
  const query = svc.from(table).insert(row);
  if (returning) {
    const { data, error } = await query.select(returning).single();
    if (error) throw new Error(`quoting seed ${table}: ${error.message}`);
    return data;
  }
  const { error } = await query;
  if (error) throw new Error(`quoting seed ${table}: ${error.message}`);
  return null;
}

function isoDaysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function deleteQuotingSeed(svc = serviceClient()) {
  requireDestructive();

  const slugs = Object.values(QUOTING_ORGS).map((org) => org.slug);
  const { data: orgRows, error: orgErr } = await svc
    .from("organizations")
    .select("id")
    .in("slug", slugs);
  if (orgErr) throw new Error(`quoting teardown lookup failed: ${orgErr.message}`);

  const orgIds = (orgRows ?? []).map((row) => row.id);
  if (orgIds.length > 0) {
    await svc.from("audit_events").delete().in("organization_id", orgIds);
    // Remove any staging uploads before the storage rows lose their org parent.
    for (const orgId of orgIds) {
      const { data: docs } = await svc
        .from("quote_documents")
        .select("storage_path")
        .eq("organization_id", orgId);
      const paths = (docs ?? []).map((doc) => doc.storage_path);
      if (paths.length > 0) {
        await svc.storage.from("quote-documents").remove(paths);
      }
    }
    const { error } = await svc.from("organizations").delete().in("id", orgIds);
    if (error) throw new Error(`quoting teardown org delete failed: ${error.message}`);
  }

  const emails = new Set(Object.values(QUOTING_USERS).map((user) => user.email));
  let page = 1;
  for (;;) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`quoting teardown user list failed: ${error.message}`);
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

async function seedAlumasteelData(svc, orgId, ownerId) {
  const customer = await insert(
    svc,
    "quote_customers",
    {
      organization_id: orgId,
      company_name: "Fictional Test Industries",
      contact_name: "Taylor Example",
      email: "purchasing@example.test",
      phone: "000-555-0100",
      internal_notes: "FICTIONAL staging customer. Not a real Alumasteel customer.",
      created_by: ownerId,
    },
    "id",
  );

  const vendor = await insert(
    svc,
    "quote_vendors",
    {
      organization_id: orgId,
      company_name: "Fictional Steel Supply Co",
      category: "steel_supplier",
      contact_name: "Jordan Example",
      email: "sales@example.test",
      notes: "FICTIONAL staging vendor. Not a real supplier.",
      created_by: ownerId,
    },
    "id",
  );

  // Quote 1: brand new request.
  const qNew = await insert(
    svc,
    "quote_projects",
    {
      organization_id: orgId,
      customer_id: customer.id,
      project_name: "FICTIONAL TEST — Mezzanine platform request",
      customer_contact: "Taylor Example",
      request_date: isoDaysFromNow(-1),
      due_date: isoDaysFromNow(10),
      quote_type: "structural",
      status: "new_request",
      customer_message: "Fictional staging request used for testing only.",
      assigned_user_id: ownerId,
      created_by: ownerId,
    },
    "id",
  );

  // Quote 2: takeoff under review with AI + human + mock rows, an open
  // required clarification, and a required vendor price still outstanding.
  const qReview = await insert(
    svc,
    "quote_projects",
    {
      organization_id: orgId,
      customer_id: customer.id,
      project_name: "FICTIONAL TEST — Handrail and stair package",
      customer_contact: "Taylor Example",
      request_date: isoDaysFromNow(-5),
      due_date: isoDaysFromNow(5),
      quote_type: "mixed",
      status: "takeoff_review",
      assigned_user_id: ownerId,
      created_by: ownerId,
    },
    "id",
  );

  const humanRow = await insert(
    svc,
    "quote_takeoff_items",
    {
      organization_id: orgId,
      quote_id: qReview.id,
      item_mark: "TEST-B1",
      category: "structural_steel",
      description: "FICTIONAL beam row entered by a human for staging tests",
      material: "Steel (fictional test value)",
      profile: "W-shape (fictional test value)",
      quantity: 4,
      unit: "ea",
      unit_weight_lbs: 100,
      total_weight_lbs: 400,
      origin: "human",
      review_state: "confirmed",
      confirmed_by: ownerId,
      confirmed_at: new Date().toISOString(),
      created_by: ownerId,
      last_edited_by: ownerId,
    },
    "id",
  );

  const aiRow = await insert(
    svc,
    "quote_takeoff_items",
    {
      organization_id: orgId,
      quote_id: qReview.id,
      item_mark: "TEST-HR1",
      category: "handrail",
      description: "FICTIONAL AI-proposed handrail row for staging tests",
      linear_feet: 42,
      confidence: "low",
      origin: "ai",
      review_state: "unreviewed",
      source_page: "S-2",
      drawing_number: "TEST-100",
      evidence: "Fictional evidence text seeded for staging review tests.",
      created_by: ownerId,
      last_edited_by: ownerId,
    },
    "id",
  );

  const mockRow = await insert(
    svc,
    "quote_takeoff_items",
    {
      organization_id: orgId,
      quote_id: qReview.id,
      item_mark: "MOCK-X1",
      category: "misc_metal",
      description: "[MOCK] Row seeded as mock-extraction output for approval-block tests",
      confidence: "low",
      origin: "ai_mock",
      review_state: "unreviewed",
      evidence: "MOCK DATA — seeded to prove mock rows can never be approved as real.",
      created_by: ownerId,
      last_edited_by: ownerId,
    },
    "id",
  );

  const clarification = await insert(
    svc,
    "quote_clarifications",
    {
      organization_id: orgId,
      quote_id: qReview.id,
      question: "FICTIONAL TEST — is the handrail finish galvanized or painted?",
      category: "finish",
      severity: "high",
      required_before_approval: true,
      status: "open",
      origin: "human",
      created_by: ownerId,
    },
    "id",
  );

  const vendorRequest = await insert(
    svc,
    "quote_vendor_requests",
    {
      organization_id: orgId,
      quote_id: qReview.id,
      vendor_id: vendor.id,
      cost_category: "steel_supplier",
      description: "FICTIONAL TEST — need supplier pricing for the seeded beam row",
      status: "needed",
      required_before_approval: true,
      created_by: ownerId,
    },
    "id",
  );

  await insert(svc, "quote_cost_lines", [
    {
      organization_id: orgId,
      quote_id: qReview.id,
      section: "material",
      description: "FICTIONAL TEST material line (not a real price)",
      quantity: 400,
      unit: "lb",
      rate: 1,
      base_amount: 400,
      adjustment: 0,
      final_amount: 400,
      entry_kind: "manual",
      data_source: "Fictional staging seed",
      created_by: ownerId,
    },
    {
      organization_id: orgId,
      quote_id: qReview.id,
      section: "labor",
      description: "FICTIONAL TEST manual labor line (not a real rate)",
      quantity: 8,
      unit: "hr",
      rate: 10,
      base_amount: 80,
      adjustment: 0,
      final_amount: 80,
      entry_kind: "manual",
      data_source: "Fictional staging seed",
      created_by: ownerId,
    },
  ]);

  // Quote 3: already sent, with a follow-up that is due (yesterday), a
  // fictional manual price, a draft version, and an uploaded-final-quote
  // document record. Everything explicitly labeled fictional.
  const qSent = await insert(
    svc,
    "quote_projects",
    {
      organization_id: orgId,
      customer_id: customer.id,
      project_name: "FICTIONAL TEST — Small ladder repair quote",
      quote_type: "miscellaneous",
      status: "sent",
      approval_state: "approved",
      request_date: isoDaysFromNow(-14),
      manual_final_price: "1234.56",
      manual_price_reason: "FICTIONAL TEST price for staging only — not a real quote value.",
      sent_at: new Date().toISOString(),
      sent_by: ownerId,
      assigned_user_id: ownerId,
      created_by: ownerId,
    },
    "id",
  );

  await insert(svc, "quote_versions", {
    organization_id: orgId,
    quote_id: qSent.id,
    version_number: 1,
    totals: { note: "Fictional staging totals snapshot" },
    scope_summary: "FICTIONAL TEST scope for staging.",
    price: "1234.56",
    is_draft: true,
    created_by: ownerId,
  });

  await insert(svc, "quote_documents", {
    organization_id: orgId,
    quote_id: qSent.id,
    storage_path: `${orgId}/${qSent.id}/seeded-fictional-final-quote.txt`,
    file_name: "seeded-fictional-final-quote.txt",
    file_size: 64,
    mime_type: "text/plain",
    category: "final_quote",
    processing_status: "uploaded",
    uploaded_by: ownerId,
  });

  await insert(svc, "quote_follow_ups", {
    organization_id: orgId,
    quote_id: qSent.id,
    due_date: isoDaysFromNow(-1),
    method: "phone",
    note: "FICTIONAL TEST follow-up, due yesterday so the dashboard reminder shows.",
    created_by: ownerId,
  });

  for (const quoteId of [qNew.id, qReview.id, qSent.id]) {
    await insert(svc, "quote_status_history", {
      organization_id: orgId,
      quote_id: quoteId,
      previous_status: null,
      new_status: "new_request",
      actor_user_id: ownerId,
      note: "Seeded for staging tests",
    });
  }

  return {
    customerId: customer.id,
    vendorId: vendor.id,
    quoteNewId: qNew.id,
    quoteReviewId: qReview.id,
    quoteSentId: qSent.id,
    humanRowId: humanRow.id,
    aiRowId: aiRow.id,
    mockRowId: mockRow.id,
    clarificationId: clarification.id,
    vendorRequestId: vendorRequest.id,
  };
}

export async function resetAndSeedQuoting() {
  requireDestructive();
  const svc = serviceClient();

  await deleteQuotingSeed(svc);

  const orgIds = {};
  for (const [key, org] of Object.entries(QUOTING_ORGS)) {
    const row = await insert(
      svc,
      "organizations",
      { name: org.name, slug: org.slug, kind: org.kind, status: "active" },
      "id",
    );
    orgIds[key] = row.id;
  }

  const userIds = {};
  for (const [key, user] of Object.entries(QUOTING_USERS)) {
    const { data, error } = await svc.auth.admin.createUser({
      email: user.email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`quoting seed user ${user.email}: ${error.message}`);
    userIds[key] = data.user.id;
    await insert(svc, "organization_memberships", {
      organization_id: orgIds[user.org],
      user_id: data.user.id,
      role: user.role,
      status: user.status,
    });
  }

  // Enable the quoting modules for both client orgs so the cross-tenant tests
  // prove RLS (not module gating) is the boundary.
  for (const orgKey of ["alumasteel", "otherClient"]) {
    await insert(
      svc,
      "portal_modules",
      QUOTING_MODULES.map((moduleKey, index) => ({
        organization_id: orgIds[orgKey],
        module_key: moduleKey,
        enabled: true,
        client_visible: true,
        sort_order: index,
      })),
    );
  }

  const alumasteel = await seedAlumasteelData(svc, orgIds.alumasteel, userIds.alumaOwner);

  // One quote in the unrelated org so cross-tenant reads have a target.
  const otherQuote = await insert(
    svc,
    "quote_projects",
    {
      organization_id: orgIds.otherClient,
      project_name: "FICTIONAL TEST — Fabricators B private quote",
      quote_type: "unknown",
      status: "new_request",
      created_by: userIds.otherOwner,
    },
    "id",
  );

  return { orgIds, userIds, alumasteel, otherQuoteId: otherQuote.id };
}

// Run directly: node --env-file=.env.test.local supabase/tests/quoting-seed.mjs
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  resetAndSeedQuoting()
    .then((result) => {
      console.log("[quoting-tests] seed complete");
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

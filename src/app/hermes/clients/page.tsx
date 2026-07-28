import Link from "next/link";
import {
  EmptyState,
  ProductPageHeader,
  StatusBadge,
} from "@/components/product-shell";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { HermesClient } from "@/lib/hermes";

export default async function HermesClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireAccess("internal");
  const filters = await searchParams;
  const supabase = await createClient();
  let query = supabase
    ?.from("organizations")
    .select("id, name, slug, status")
    .eq("kind", "client")
    .order("name");

  if (filters.q?.trim()) {
    query = query?.ilike("name", `%${filters.q.trim()}%`);
  }
  if (filters.status?.trim()) {
    query = query?.eq("status", filters.status.trim());
  }

  const { data } = query ? await query : { data: [] };
  const organizations = data ?? [];
  const { data: accountData } =
    supabase && organizations.length
      ? await supabase
          .from("client_accounts")
          .select(
            "organization_id, plan, onboarding_status, assigned_owner_id, last_activity_at",
          )
          .in("organization_id", organizations.map((organization) => organization.id))
      : { data: [] };
  const accounts = new Map(
    (accountData ?? []).map((account) => [account.organization_id, account]),
  );
  const clients = organizations.map((organization) => {
    const account = accounts.get(organization.id);
    return {
      ...organization,
      plan: account?.plan ?? null,
      onboarding_status: account?.onboarding_status ?? "not_started",
      assigned_owner_id: account?.assigned_owner_id ?? null,
      last_activity_at: account?.last_activity_at ?? null,
    } as HermesClient;
  });

  return (
    <>
      <ProductPageHeader
        eyebrow="Hermes / accounts"
        title="Clients"
        description="Internal account health, configuration, and access control."
      />

      <form className="client-filters">
        <label>
          <span>Search</span>
          <input name="q" defaultValue={filters.q} placeholder="Client name" />
        </label>
        <label>
          <span>Status</span>
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="onboarding">Onboarding</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <button className="product-button product-button-secondary">Apply filters</button>
      </form>

      {clients.length > 0 ? (
        <div className="client-table-shell">
          <table className="client-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Status</th>
                <th>Plan</th>
                <th>Onboarding</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>
                    <Link href={`/hermes/clients/${client.id}/overview`}>
                      <b>{client.name}</b>
                      <span>{client.slug}</span>
                    </Link>
                  </td>
                  <td><StatusBadge>{client.status}</StatusBadge></td>
                  <td>{client.plan ?? "Not assigned"}</td>
                  <td>{client.onboarding_status.replaceAll("_", " ")}</td>
                  <td>
                    {client.last_activity_at
                      ? new Date(client.last_activity_at).toLocaleDateString()
                      : "No activity"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No client accounts found"
          body={
            filters.q || filters.status
              ? "No accounts match the current filters."
              : "Create the first organization in the connected data project. Hermes does not generate placeholder clients."
          }
        />
      )}
    </>
  );
}

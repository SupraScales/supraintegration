import "server-only";

import { previewOperation } from "@/lib/preview-diagnostics";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole =
  | "internal_admin"
  | "internal_member"
  | "client_admin"
  | "client_member";

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  kind: "internal" | "client";
  status: string;
};

export type CurrentAccess = {
  user: {
    id: string;
    email: string;
  };
  role: AppRole;
  organization: OrganizationSummary;
};

type MembershipRow = {
  organization_id: string;
  role: AppRole;
};

export async function getCurrentAccess(): Promise<CurrentAccess | null> {
  return previewOperation("access.resolve", resolveCurrentAccess);
}

async function resolveCurrentAccess(): Promise<CurrentAccess | null> {
  const supabase = await createClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await previewOperation("access.auth.getUser", () => supabase.auth.getUser());

  if (!user?.email) {
    return null;
  }

  const { data: membershipData } = await previewOperation("access.memberships", () => supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id));

  const memberships = (membershipData ?? []) as MembershipRow[];
  if (memberships.length === 0) {
    return null;
  }

  const organizationIds = memberships.map((membership) => membership.organization_id);
  const { data: organizationData } = await previewOperation("access.organizations", () => supabase
    .from("organizations")
    .select("id, name, slug, kind, status")
    .in("id", organizationIds)
    .eq("status", "active"));

  const organizations = (organizationData ?? []) as OrganizationSummary[];
  const selectedMembership =
    memberships.find((membership) => membership.role.startsWith("internal_")) ??
    memberships[0];
  const organization = organizations.find(
    (candidate) => candidate.id === selectedMembership.organization_id,
  );

  if (!organization) {
    return null;
  }

  return {
    user: { id: user.id, email: user.email },
    role: selectedMembership.role,
    organization,
  };
}

export async function requireAccess(audience: "internal" | "client") {
  const access = await getCurrentAccess();
  if (!access) {
    redirect("/login");
  }

  const isInternal = access.role.startsWith("internal_");
  if (audience === "internal" && !isInternal) {
    redirect("/portal/overview");
  }
  if (audience === "client" && isInternal) {
    redirect("/hermes/clients");
  }

  return access;
}

export async function requireInternalAdmin() {
  const access = await requireAccess("internal");
  if (access.role !== "internal_admin") {
    throw new Error("This action requires an internal administrator.");
  }
  return access;
}

export async function getPostLoginPath() {
  const access = await getCurrentAccess();
  if (!access) {
    return "/access-denied";
  }
  return access.role.startsWith("internal_")
    ? "/hermes/clients"
    : "/portal/overview";
}

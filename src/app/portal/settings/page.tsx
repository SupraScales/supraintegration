import { ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { getPortalContext } from "@/lib/portal";

export default async function PortalSettingsPage() {
  const { access, modules } = await getPortalContext();

  return (
    <>
      <ProductPageHeader
        eyebrow="Workspace settings"
        title="Account access"
        description="Your organization and visible portal modules."
      />
      <section className="product-panel settings-grid">
        <div>
          <span>Organization</span>
          <b>{access.organization.name}</b>
        </div>
        <div>
          <span>Signed-in user</span>
          <b>{access.user.email}</b>
        </div>
        <div>
          <span>Account role</span>
          <StatusBadge>{access.role.replaceAll("_", " ")}</StatusBadge>
        </div>
        <div>
          <span>Enabled modules</span>
          <b>{modules.length}</b>
        </div>
      </section>
    </>
  );
}

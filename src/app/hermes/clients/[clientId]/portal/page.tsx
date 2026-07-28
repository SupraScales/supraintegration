import { ProductPageHeader } from "@/components/product-shell";
import { requireHermesClient } from "@/lib/hermes";
import { portalModuleCatalog } from "@/lib/portal";
import { savePortalConfiguration } from "./actions";

export default async function HermesPortalConfigurationPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { access, supabase } = await requireHermesClient(clientId);
  const { data: moduleData } = await supabase
    .from("portal_modules")
    .select("module_key, enabled, client_visible, label, sort_order")
    .eq("organization_id", clientId)
    .order("sort_order");
  const data = moduleData ?? [];
  const configured = new Map(data.map((item) => [item.module_key, item]));
  const canEdit = access.role === "internal_admin";

  return (
    <>
      <ProductPageHeader
        eyebrow="Hermes / client-visible"
        title="Portal configuration"
        description="These settings determine which client pages are visible. Internal notes and private agent configuration are not part of this surface."
      />
      <form
        className="configuration-form"
        action={savePortalConfiguration.bind(null, clientId)}
      >
        <div className="configuration-head">
          <span>Module</span><span>Client label</span><span>Order</span><span>Enabled</span><span>Visible</span>
        </div>
        {portalModuleCatalog.map((module, index) => {
          const current = configured.get(module.key);
          return (
            <fieldset key={module.key} disabled={!canEdit}>
              <div><b>{module.label}</b><small>{module.key}</small></div>
              <input
                name={`label_${module.key}`}
                defaultValue={current?.label ?? module.label}
                aria-label={`${module.label} client label`}
                required
              />
              <input
                name={`order_${module.key}`}
                type="number"
                min="0"
                max="100"
                defaultValue={current?.sort_order ?? index}
                aria-label={`${module.label} order`}
              />
              <label className="toggle-field">
                <input
                  name={`enabled_${module.key}`}
                  type="checkbox"
                  defaultChecked={current?.enabled ?? false}
                />
                <span>Enabled</span>
              </label>
              <label className="toggle-field">
                <input
                  name={`visible_${module.key}`}
                  type="checkbox"
                  defaultChecked={current?.client_visible ?? true}
                />
                <span>Visible</span>
              </label>
            </fieldset>
          );
        })}
        <div className="configuration-actions">
          <p>
            {canEdit
              ? "Saving creates an internal audit event."
              : "Internal team members can review this configuration. An internal administrator must save changes."}
          </p>
          <button
            className="product-button product-button-primary"
            disabled={!canEdit}
          >
            Save portal configuration
          </button>
        </div>
      </form>
    </>
  );
}

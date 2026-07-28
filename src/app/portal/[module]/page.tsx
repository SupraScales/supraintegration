import { EmptyState, ProductPageHeader } from "@/components/product-shell";
import {
  portalModuleCatalog,
  requireEnabledPortalModule,
  type PortalModuleKey,
} from "@/lib/portal";

export default async function PortalModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const definition = portalModuleCatalog.find((item) => item.key === module);
  if (!definition || module === "agent") {
    return null;
  }

  await requireEnabledPortalModule(module as PortalModuleKey);

  return (
    <>
      <ProductPageHeader
        eyebrow="Client module"
        title={definition.label}
        description="This module will populate from the data sources approved for your organization."
      />
      <EmptyState
        title={`No ${definition.label.toLowerCase()} data is available`}
        body="The module is enabled, but its live data connection has not been completed for this workspace."
      />
    </>
  );
}

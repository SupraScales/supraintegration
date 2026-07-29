import { ProductShell } from "@/components/product-shell";
import { getPortalContext, portalModuleCatalog } from "@/lib/portal";

export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { access, modules } = await getPortalContext();
  const enabledKeys = new Set(modules.map((module) => module.module_key));
  const navigation = [
    { href: "/portal/overview", label: "Overview" },
    ...portalModuleCatalog
      .filter((module) => enabledKeys.has(module.key))
      .map((module) => ({
        href: `/portal/${module.key}`,
        label:
          modules.find((configured) => configured.module_key === module.key)
            ?.label ?? module.label,
      })),
    { href: "/portal/settings", label: "Settings" },
  ];

  return (
    <ProductShell
      audience="portal"
      organizationName={access.organization.name}
      userEmail={access.user.email}
      role={access.role}
      navigation={navigation}
    >
      {children}
    </ProductShell>
  );
}

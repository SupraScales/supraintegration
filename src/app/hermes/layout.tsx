import { ProductShell } from "@/components/product-shell";
import { requireAccess } from "@/lib/auth";

export default async function HermesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const access = await requireAccess("internal");

  return (
    <ProductShell
      audience="hermes"
      organizationName="Supra Integration"
      userEmail={access.user.email}
      role={access.role}
      navigation={[
        { href: "/hermes/clients", label: "Clients" },
      ]}
    >
      {children}
    </ProductShell>
  );
}

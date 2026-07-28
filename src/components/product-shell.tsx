import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";

export type ProductNavItem = {
  href: string;
  label: string;
};

export function ProductShell({
  audience,
  organizationName,
  userEmail,
  role,
  navigation,
  children,
}: {
  audience: "portal" | "hermes";
  organizationName: string;
  userEmail: string;
  role: string;
  navigation: ProductNavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="product-app">
      <header className="product-topbar">
        <Link href={audience === "hermes" ? "/hermes/clients" : "/portal/overview"} className="product-logo">
          <span aria-hidden />
          <b>SUPRA</b>
          <strong>{audience === "hermes" ? "HERMES" : "PORTAL"}</strong>
        </Link>
        <div className="product-account">
          <span>{organizationName}</span>
          <b>{role.replaceAll("_", " ")}</b>
          <form action={signOutAction}>
            <button>Log out</button>
          </form>
        </div>
      </header>

      <div className="product-frame">
        <aside className="product-sidebar">
          <p>{audience === "hermes" ? "Internal control" : "Client system"}</p>
          <nav aria-label={audience === "hermes" ? "Hermes navigation" : "Portal navigation"}>
            {navigation.map((item) => (
              <Link href={item.href} key={item.href}>{item.label}</Link>
            ))}
          </nav>
          <div className="product-user">
            <span>Signed in</span>
            <b>{userEmail}</b>
          </div>
        </aside>
        <main className="product-main">{children}</main>
      </div>
    </div>
  );
}

export function ProductPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="product-page-header">
      <div>
        <p className="product-kicker"><span aria-hidden />{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="product-page-actions">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="product-empty">
      <span aria-hidden />
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function StatusBadge({ children }: { children: React.ReactNode }) {
  return <span className="status-badge"><i aria-hidden />{children}</span>;
}

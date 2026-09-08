import Link from "next/link";
import { StatusBadge } from "@/components/product-shell";
import { requireHermesClient } from "@/lib/hermes";

const sections = [
  ["overview", "Overview"],
  ["data", "Data"],
  ["portal", "Portal"],
  ["agent", "Agent"],
  ["lead-intelligence", "Lead Intelligence"],
  ["integrations", "Integrations"],
  ["users", "Users"],
  ["audit", "Audit"],
] as const;

export default async function HermesClientLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ clientId: string }>;
}>) {
  const { clientId } = await params;
  const { client } = await requireHermesClient(clientId);

  return (
    <>
      <header className="client-profile-header">
        <div>
          <Link href="/hermes/clients">← All clients</Link>
          <h1>{client.name}</h1>
          <p>{client.plan ?? "No plan assigned"} · {client.onboarding_status.replaceAll("_", " ")}</p>
        </div>
        <StatusBadge>{client.status}</StatusBadge>
      </header>
      <nav className="client-profile-nav" aria-label={`${client.name} sections`}>
        {sections.map(([slug, label]) => (
          <Link href={`/hermes/clients/${clientId}/${slug}`} key={slug}>{label}</Link>
        ))}
      </nav>
      {children}
    </>
  );
}

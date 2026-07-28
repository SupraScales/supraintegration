import { redirect } from "next/navigation";

export default async function HermesClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  redirect(`/hermes/clients/${clientId}/overview`);
}

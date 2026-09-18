"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireInternalAdmin } from "@/lib/auth";
import { requireHermesClient } from "@/lib/hermes";
import { runSecHunterPoc } from "@/lib/lead-intelligence/sec-poc";
import { runSecMnaHunter } from "@/lib/lead-intelligence/sec-mna-poc";
import { runDealerExpansionHunter } from "@/lib/lead-intelligence/dealer-expansion-poc";
import { runSecIpoHunter } from "@/lib/lead-intelligence/sec-ipo-poc";
import { runSkyshareDiscovery } from "@/lib/lead-intelligence/sec-discovery-runner";

const candidateStateSchema = z.object({
  status: z.enum(["new", "qualified", "archived"]),
  publicationState: z.enum(["unpublished", "published"]),
});

export async function updateLeadCandidateState(
  clientId: string,
  candidateId: string,
  formData: FormData,
) {
  const access = await requireInternalAdmin();
  const { supabase } = await requireHermesClient(clientId);
  const parsed = candidateStateSchema.safeParse({
    status: formData.get("status"),
    publicationState: formData.get("publication_state"),
  });

  if (!parsed.success) throw new Error("Invalid lead candidate state.");

  const publishFields = parsed.data.publicationState === "published"
    ? { published_at: new Date().toISOString(), published_by: access.user.id }
    : { published_at: null, published_by: null };

  const { error } = await supabase
    .from("lead_candidates")
    .update({
      status: parsed.data.status,
      publication_state: parsed.data.publicationState,
      updated_by: access.user.id,
      ...publishFields,
    })
    .eq("id", candidateId)
    .eq("organization_id", clientId);

  if (error) throw new Error("Lead candidate state could not be updated.");

  revalidatePath(`/hermes/clients/${clientId}/lead-intelligence`);
  revalidatePath("/portal/lead-intelligence");
}

export async function runSecPocAction(clientId: string, formData: FormData): Promise<void> {
  const parsed = z.object({
    filingUrl: z.string().url().refine((value) => value.startsWith("https://www.sec.gov/"), "Use an official SEC URL."),
  }).safeParse({ filingUrl: formData.get("filing_url") });
  if (!parsed.success) throw new Error("Enter a valid official SEC Form 4 XML URL.");

  await runSecHunterPoc(clientId, parsed.data.filingUrl);
  revalidatePath(`/hermes/clients/${clientId}/lead-intelligence`);
}

export async function runSecMnaAction(clientId: string, formData: FormData): Promise<void> {
  const parsed = z.object({
    filingUrl: z.string().url().refine((value) => value.startsWith("https://www.sec.gov/Archives/edgar/"), "Use an official SEC EDGAR URL."),
  }).safeParse({ filingUrl: formData.get("mna_filing_url") });
  if (!parsed.success) throw new Error("Enter a valid official SEC Form 8-K filing or index URL.");

  await runSecMnaHunter(clientId, parsed.data.filingUrl);
  revalidatePath(`/hermes/clients/${clientId}/lead-intelligence`);
}

export async function runSecMnaDiscoveryNowAction(clientId: string): Promise<void> {
  await requireInternalAdmin();
  await requireHermesClient(clientId);
  if (process.env.SKYSHARE_DISCOVERY_ORGANIZATION_ID?.trim() !== clientId) {
    throw new Error("Automated SEC discovery is not configured for this organization.");
  }
  if (process.env.SKYSHARE_DISCOVERY_HUNT2_ENABLED?.trim().toLowerCase() !== "true") {
    throw new Error("Automated SEC discovery is disabled.");
  }

  await runSkyshareDiscovery();
  revalidatePath(`/hermes/clients/${clientId}/lead-intelligence`);
}

export async function runDealerExpansionAction(clientId: string, formData: FormData): Promise<void> {
  const officialUrl = z.string().url().refine(
    (value) => value.startsWith("https://"),
    "Use a direct HTTPS URL from an official source.",
  );
  const parsed = z.object({
    eventUrl: officialUrl,
    ownershipUrl: officialUrl,
  }).safeParse({
    eventUrl: formData.get("dealer_event_url"),
    ownershipUrl: formData.get("dealer_ownership_url"),
  });
  if (!parsed.success) throw new Error("Enter direct official event and ownership source URLs.");

  await runDealerExpansionHunter(clientId, parsed.data.eventUrl, parsed.data.ownershipUrl);
  revalidatePath(`/hermes/clients/${clientId}/lead-intelligence`);
}

export async function runSecIpoAction(clientId: string, formData: FormData): Promise<void> {
  const officialSecUrl = z.string().url().refine(
    (value) => value.startsWith("https://www.sec.gov/Archives/edgar/"),
    "Use an official SEC EDGAR URL.",
  );
  const parsed = z.object({
    prospectusUrl: officialSecUrl,
    certUrl: officialSecUrl,
  }).safeParse({
    prospectusUrl: formData.get("ipo_prospectus_url"),
    certUrl: formData.get("ipo_cert_url"),
  });
  if (!parsed.success) throw new Error("Enter official SEC 424B4 and CERT filing URLs.");

  await runSecIpoHunter(clientId, parsed.data.prospectusUrl, parsed.data.certUrl);
  revalidatePath(`/hermes/clients/${clientId}/lead-intelligence`);
}

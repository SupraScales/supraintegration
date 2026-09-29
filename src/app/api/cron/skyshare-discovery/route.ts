import { NextResponse } from "next/server";
import { evaluateDiscoveryRequest } from "@/lib/lead-intelligence/discovery-policy";
import { runSkyshareDiscovery } from "@/lib/lead-intelligence/sec-discovery-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const result = await evaluateDiscoveryRequest({
      authorization: request.headers.get("authorization"),
      cronSecret: process.env.CRON_SECRET,
      enabled: process.env.SKYSHARE_DISCOVERY_HUNT2_ENABLED,
      enabledHunt4: process.env.SKYSHARE_DISCOVERY_HUNT4_ENABLED,
      hasQuery: url.search.length > 0,
      execute: runSkyshareDiscovery,
    });
    return NextResponse.json(result.body, { status: result.statusCode });
  } catch (error) {
    console.error("[skyshare-discovery] run failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json({ status: "failed" }, { status: 503 });
  }
}

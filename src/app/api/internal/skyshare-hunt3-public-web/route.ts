import { NextResponse } from "next/server";
import { authorizeDiscoveryRequest } from "@/lib/lead-intelligence/discovery-policy";
import { runSkyshareHunt3PublicWebDiscovery } from "@/lib/lead-intelligence/public-web-discovery-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const url = new URL(request.url);
  const decision = authorizeDiscoveryRequest({
    authorization: request.headers.get("authorization"),
    cronSecret: process.env.CRON_SECRET,
    hasQuery: url.search.length > 0,
  });
  if (!decision.allowed) return NextResponse.json(decision.body, { status: decision.status });

  try {
    return NextResponse.json(await runSkyshareHunt3PublicWebDiscovery());
  } catch (error) {
    console.error("[skyshare-hunt3-public-web] run failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json({ status: "failed" }, { status: 503 });
  }
}

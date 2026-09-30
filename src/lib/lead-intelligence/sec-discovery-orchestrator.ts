export type SharedSecHuntResult = { status: string; [key: string]: unknown };

type SharedSecDiscoveryInput<TSnapshot> = {
  enabled: { hunt1: boolean; hunt2: boolean; hunt4: boolean };
  reconcile: () => Promise<TSnapshot>;
  runHunt1: (snapshot: TSnapshot) => Promise<SharedSecHuntResult>;
  runHunt2: (snapshot: TSnapshot) => Promise<SharedSecHuntResult>;
  runHunt4: (snapshot: TSnapshot) => Promise<SharedSecHuntResult>;
};

async function runIsolated<TSnapshot>(
  enabled: boolean,
  failureCode: string,
  snapshot: TSnapshot,
  run: (snapshot: TSnapshot) => Promise<SharedSecHuntResult>,
): Promise<SharedSecHuntResult> {
  if (!enabled) return { status: "disabled" };
  try {
    return await run(snapshot);
  } catch {
    return { status: "failed", error: failureCode };
  }
}

export async function orchestrateSharedSecDiscovery<TSnapshot>(
  input: SharedSecDiscoveryInput<TSnapshot>,
) {
  if (!input.enabled.hunt1 && !input.enabled.hunt2 && !input.enabled.hunt4) {
    return { status: "disabled" as const };
  }
  const snapshot = await input.reconcile();
  const hunt1 = await runIsolated(
    input.enabled.hunt1,
    "hunt1_discovery_failed",
    snapshot,
    input.runHunt1,
  );
  const hunt2 = await runIsolated(
    input.enabled.hunt2,
    "hunt2_discovery_failed",
    snapshot,
    input.runHunt2,
  );
  const hunt4 = await runIsolated(
    input.enabled.hunt4,
    "hunt4_discovery_failed",
    snapshot,
    input.runHunt4,
  );
  return { status: "completed" as const, snapshot, hunts: { hunt1, hunt2, hunt4 } };
}

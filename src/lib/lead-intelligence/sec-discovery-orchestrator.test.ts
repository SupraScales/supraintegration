import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { orchestrateSharedSecDiscovery } from "./sec-discovery-orchestrator.ts";

test("all disabled Hunts skip reconciliation", async () => {
  let reconciliations = 0;
  const result = await orchestrateSharedSecDiscovery({
    enabled: { hunt1: false, hunt2: false, hunt4: false },
    reconcile: async () => { reconciliations += 1; return { id: "unused" }; },
    runHunt1: async () => ({ status: "completed" }),
    runHunt2: async () => ({ status: "completed" }),
    runHunt4: async () => ({ status: "completed" }),
  });
  assert.equal(reconciliations, 0);
  assert.deepEqual(result, { status: "disabled" });
});

test("one reconciliation snapshot is shared across independently enabled Hunts 1/2/4", async () => {
  let reconciliations = 0;
  const snapshots: object[] = [];
  const result = await orchestrateSharedSecDiscovery({
    enabled: { hunt1: true, hunt2: false, hunt4: true },
    reconcile: async () => {
      reconciliations += 1;
      return { id: "shared" };
    },
    runHunt1: async (snapshot) => { snapshots.push(snapshot); return { status: "completed" }; },
    runHunt2: async (snapshot) => { snapshots.push(snapshot); return { status: "completed" }; },
    runHunt4: async (snapshot) => { snapshots.push(snapshot); return { status: "completed" }; },
  });
  assert.equal(result.status, "completed");
  assert.equal(reconciliations, 1);
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0], snapshots[1]);
  if (result.status === "completed") {
    assert.equal(result.hunts.hunt2.status, "disabled");
  }
});

test("one Hunt failure is isolated and later Hunts still report results", async () => {
  const executed: string[] = [];
  const result = await orchestrateSharedSecDiscovery({
    enabled: { hunt1: true, hunt2: true, hunt4: true },
    reconcile: async () => ({ id: "shared" }),
    runHunt1: async () => { executed.push("hunt1"); throw new Error("fixture failure"); },
    runHunt2: async () => { executed.push("hunt2"); return { status: "completed" }; },
    runHunt4: async () => { executed.push("hunt4"); return { status: "completed" }; },
  });
  assert.deepEqual(executed, ["hunt1", "hunt2", "hunt4"]);
  assert.equal(result.status, "completed");
  if (result.status === "completed") {
    assert.deepEqual(result.hunts.hunt1, {
      status: "failed",
      error: "hunt1_discovery_failed",
    });
    assert.equal(result.hunts.hunt2.status, "completed");
    assert.equal(result.hunts.hunt4.status, "completed");
  }
});

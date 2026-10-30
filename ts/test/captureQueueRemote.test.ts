import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { jobEnd, pullCommand } from "../scripts/captureQueueLaptop";
import { builtMapKey, manifestAt, originOf, planAt, pullFile, pullStoredMap, pushFolder } from "../scripts/captureQueueRemote";

test("a laptop pulls the stored map from the host that queued the group into its own store under the same key, then sends the frames back whole [k1 scenario]", async () => {
  const root = mkdtempSync(join(tmpdir(), "capture-queue-remote-"));
  try {
    const gex = join(root, "gex"), store = join(gex, "maps"), laptop = join(root, "laptop"), logFile = join(laptop, "run.log");
    const key = "a".repeat(64);
    mkdirSync(join(store, key), { recursive: true });
    mkdirSync(laptop, { recursive: true });
    writeFileSync(join(store, key, "map.w3x"), "capture map");
    writeFileSync(join(gex, "plan.json"), '{"version":1,"rows":[{"name":"g0","map":"/gex/g0.w3x"}]}');
    writeFileSync(logFile, `stored map build ${"b".repeat(64)}\nreused map build ${key}\n`);
    expect(builtMapKey(logFile)).toBe(key);
    const origin = originOf("gex45", ["sh", "-c"]);
    const own = join(laptop, "maps");
    const map = await Effect.runPromise(pullStoredMap(origin, store, key, logFile, own));
    expect(map).toBe(join(own, key, "map.w3x"));
    expect(readFileSync(map, "utf8")).toBe("capture map");
    await Effect.runPromise(pullFile(origin, join(gex, "plan.json"), join(laptop, "work/origin-plan.json"), logFile));
    expect(planAt(readFileSync(join(laptop, "work/origin-plan.json"), "utf8"), map, "/laptop/manifest.json")).toBe(`${JSON.stringify({ version: 1, rows: [{ name: "g0", map, manifest: "/laptop/manifest.json" }] })}\n`);
    mkdirSync(join(laptop, "native/g0"), { recursive: true });
    writeFileSync(join(laptop, "native/g0/frame 1.png"), "frame");
    mkdirSync(join(gex, "native-0"), { recursive: true });
    writeFileSync(join(gex, "native-0/stale.png"), "stale");
    await Effect.runPromise(pushFolder(origin, join(laptop, "native"), join(gex, "native-0"), logFile));
    expect(readFileSync(join(gex, "native-0/g0/frame 1.png"), "utf8")).toBe("frame");
    expect(existsSync(join(gex, "native-0/stale.png"))).toBe(false);
    expect(existsSync(join(gex, "native-0.push"))).toBe(false);
    const missing = await Effect.runPromise(pushFolder(origin, join(laptop, "none"), join(gex, "native-1"), logFile).pipe(Effect.flip));
    expect(missing.problem).toContain("to gex45");
    expect(existsSync(join(gex, "native-1"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a remote capture's manifest names the map at the pair host's store path, so its batch accepts the plan's row [k2 property]", () => {
  const local = JSON.stringify({ map: "/home/tom/batch/g0.w3x", mapSha256: "abc", fixtures: [{ name: "a", frames: [1] }] });
  expect(JSON.parse(manifestAt(local, "/home/tom/.cache/wisp/maps/key/map.w3x"))).toEqual({ map: "/home/tom/.cache/wisp/maps/key/map.w3x", mapSha256: "abc", fixtures: [{ name: "a", frames: [1] }] });
});

test("the queued job runs the pull script from the laptop's checkout with every pull field, and waits until the ledger shows the job ended [k2 property]", () => {
  const job = { origin: "gex45", originStore: "/c/maps", key: "k", plan: "/b/plan-0.json", manifest: "/b/g0.captures.json", out: "/b/native-0", work: "b1-g0", pair: 1, client: "lan1a", minutes: 3 };
  const command = pullCommand(job);
  expect(command.slice(0, 2)).toEqual(["sh", "-c"]);
  expect(command[2]).toContain("scripts/captureQueuePull.ts");
  expect(command.slice(4)).toEqual(["--origin", "gex45", "--origin-store", "/c/maps", "--key", "k", "--plan", "/b/plan-0.json", "--manifest", "/b/g0.captures.json", "--out", "/b/native-0", "--work", "b1-g0", "--pair", "1", "--client", "lan1a", "--minutes", "3"]);
  const listing = (state: string) => JSON.stringify([{ id: 4, state, host: "whiterabbit" }, { id: 5, state: "done", host: null }]);
  for (const state of ["queued", "requeued", "taken"]) expect(jobEnd(listing(state), "4")).toEqual({ ended: false });
  expect(jobEnd(listing("done"), "4")).toEqual({ ended: true, state: "done", host: "whiterabbit" });
  expect(jobEnd(listing("failed"), "4")).toEqual({ ended: true, state: "failed", host: "whiterabbit" });
  expect(jobEnd(listing("done"), "9")).toEqual({ ended: true, state: "missing", host: null });
});

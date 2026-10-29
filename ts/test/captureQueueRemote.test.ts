import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { builtMapKey, fetchFolder, manifestAt, remoteHost, runThere, sendFile, shipStoredMap } from "../scripts/captureQueueRemote";

test("a group on another host's pair ships the stored map into that host's store under the same key, runs its batch there and brings the frames back [k1 scenario]", async () => {
  const root = mkdtempSync(join(tmpdir(), "capture-queue-remote-"));
  try {
    const here = join(root, "here"), store = join(here, "maps"), laptop = join(root, "laptop"), logFile = join(here, "run.log");
    const key = "a".repeat(64);
    mkdirSync(join(store, key), { recursive: true });
    mkdirSync(join(laptop, "ts"), { recursive: true });
    writeFileSync(join(store, key, "map.w3x"), "capture map");
    writeFileSync(join(here, "plan.json"), "{}");
    writeFileSync(logFile, `stored map build ${"b".repeat(64)}\nreused map build ${key}\n`);
    expect(builtMapKey(logFile)).toBe(key);
    const host = await Effect.runPromise(remoteHost("laptop", ["env", `HOME=${laptop}`, "XDG_CACHE_HOME=", "WISP_MAP_REUSE_STORE=", "sh", "-c"]));
    expect(host.store).toBe(join(laptop, ".cache/wisp/maps"));
    const map = await Effect.runPromise(shipStoredMap(host, key, logFile, store));
    expect(map).toBe(join(laptop, ".cache/wisp/maps", key, "map.w3x"));
    expect(readFileSync(map, "utf8")).toBe("capture map");
    const there = join(laptop, "batch");
    await Effect.runPromise(sendFile(host, join(here, "plan.json"), join(there, "plan.json"), logFile));
    await Effect.runPromise(runThere(host, join(laptop, "ts"), ["sh", "-c", `mkdir -p '${there}/native/g0' && cp "$1" '${there}/native/g0/frame 1.png'`, "batch", map], logFile));
    await Effect.runPromise(fetchFolder(host, join(there, "native"), join(here, "native-0"), logFile));
    expect(readFileSync(join(here, "native-0", "g0", "frame 1.png"), "utf8")).toBe("capture map");
    expect(existsSync(join(here, "native-0.fetch"))).toBe(false);
    const failed = await Effect.runPromise(runThere(host, join(laptop, "ts"), ["false"], logFile).pipe(Effect.flip));
    expect(failed.problem).toContain("false on laptop");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a remote capture's manifest names the map at the pair host's store path, so its batch accepts the plan's row [k2 property]", () => {
  const local = JSON.stringify({ map: "/home/tom/batch/g0.w3x", mapSha256: "abc", fixtures: [{ name: "a", frames: [1] }] });
  expect(JSON.parse(manifestAt(local, "/home/tom/.cache/wisp/maps/key/map.w3x"))).toEqual({ map: "/home/tom/.cache/wisp/maps/key/map.w3x", mapSha256: "abc", fixtures: [{ name: "a", frames: [1] }] });
});

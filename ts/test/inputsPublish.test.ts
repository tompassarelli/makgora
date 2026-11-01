import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { checksFor } from "../scripts/prePush";
import { hashTree, removeTree, seal } from "../scripts/wisp/buildInputs";
import { PIN_HOST, type Remote, publishPins } from "../scripts/wisp/inputsPublish";

const FAMILY = "selection-assets" as const;

const entry = async (root: string, files: Readonly<Record<string, string>>) => {
  const staging = join(root, "staging");
  mkdirSync(join(staging, "nested"), { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(staging, name), text);
  const hash = await hashTree(staging);
  mkdirSync(join(root, FAMILY), { recursive: true });
  Bun.spawnSync(["mv", staging, join(root, FAMILY, hash)]);
  seal(join(root, FAMILY, hash));
  return hash;
};

const pinHost = (store: string): Remote => ({
  name: "pin-host",
  store,
  shell: (script) => Effect.sync(() => {
    const child = Bun.spawnSync(["sh", "-c", script], { stdout: "pipe", stderr: "pipe" });
    return { code: child.exitCode, stdout: child.stdout.toString(), stderr: child.stderr.toString() };
  }),
  rsyncShell: [],
  target: (path) => path,
});

const pinning = (hash: string) => [{ family: FAMILY, hash }] as const;

describe("build input publish", () => {
  test("a pin whose entry only this host stores is copied into the pin host's store, verified, sealed and linked to its stored sibling [k1 scenario]", async () => {
    const directory = mkdtempSync(join(tmpdir(), "inputs-publish-"));
    try {
      const store = join(directory, "store"), remote = join(directory, "remote");
      const older = await entry(remote, { "art.tga": "unchanged".repeat(1000), "nested/cursor.tga": "old cursor" });
      const pinned = await entry(store, { "art.tga": "unchanged".repeat(1000), "nested/cursor.tga": "new cursor" });
      const published = await Effect.runPromise(publishPins(pinHost(remote), pinning(pinned), store));
      expect(published).toEqual([{ family: FAMILY, hash: pinned }]);
      const copy = join(remote, FAMILY, pinned);
      expect(await hashTree(copy)).toBe(pinned);
      expect(statSync(copy).mode & 0o222).toBe(0);
      expect(statSync(join(copy, "art.tga")).ino).toBe(statSync(join(remote, FAMILY, older, "art.tga")).ino);
      expect(readdirSync(join(remote, FAMILY)).filter((name) => name.startsWith("."))).toEqual([]);
      expect(await Effect.runPromise(publishPins(pinHost(remote), pinning(pinned), store))).toEqual([]);
    } finally {
      removeTree(directory);
    }
  });

  test("a pin whose entry neither this host nor the pin host stores is refused and leaves nothing there [k1 scenario]", async () => {
    const directory = mkdtempSync(join(tmpdir(), "inputs-publish-"));
    try {
      const store = join(directory, "store"), remote = join(directory, "remote");
      const refused = await Effect.runPromise(Effect.flip(publishPins(pinHost(remote), pinning("a".repeat(64)), store)));
      expect(String(refused.cause)).toContain("neither this host nor pin-host stores it");
      expect(existsSync(join(remote, FAMILY))).toBe(false);
    } finally {
      removeTree(directory);
    }
  });

  test(`a landing that changes a pin checks that its entry is in ${PIN_HOST}'s store, and one that changes no pin does not [k1 scenario]`, () => {
    const publish = (paths: readonly string[]) => checksFor(paths).filter(({ args }) => args.includes("publish"));
    expect(publish(["build-inputs/selection-assets"]).map(({ args, privateStore }) => ({ args, privateStore }))).toEqual([{ args: ["scripts/wisp.ts", "inputs", "publish", PIN_HOST], privateStore: true }]);
    expect(publish(["ts/src/game/ui/selectBar.ts"])).toEqual([]);
  });
});

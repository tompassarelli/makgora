import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { hashTree, removeTree, seal } from "../scripts/wisp/buildInputs";
import { fetchEntry } from "../scripts/wisp/inputsFetch";

const FAMILY = "selection-assets";

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

describe("build input fetch", () => {
  test("a fetched entry reuses the bytes its newest stored sibling already holds and verifies against its hash [k1 scenario]", async () => {
    const directory = mkdtempSync(join(tmpdir(), "inputs-fetch-"));
    try {
      const remote = join(directory, "remote"), store = join(directory, "store");
      const older = await entry(store, { "art.tga": "unchanged".repeat(1000), "nested/cursor.tga": "old cursor" });
      const wanted = await entry(remote, { "art.tga": "unchanged".repeat(1000), "nested/cursor.tga": "new cursor" });
      const result = await Effect.runPromise(fetchEntry("remote", FAMILY, wanted, store, remote));
      expect(result).toBe("fetched");
      const fetched = join(store, FAMILY, wanted);
      expect(await hashTree(fetched)).toBe(wanted);
      expect(statSync(join(fetched, "art.tga")).ino).toBe(statSync(join(store, FAMILY, older, "art.tga")).ino);
      expect(statSync(join(fetched, "nested/cursor.tga")).ino).not.toBe(statSync(join(store, FAMILY, older, "nested/cursor.tga")).ino);
      expect(statSync(fetched).mode & 0o222).toBe(0);
    } finally {
      removeTree(directory);
    }
  });

  test("an entry the host does not store is absent, and nothing is left in the store [k1 scenario]", async () => {
    const directory = mkdtempSync(join(tmpdir(), "inputs-fetch-"));
    try {
      const remote = join(directory, "remote"), store = join(directory, "store");
      mkdirSync(join(remote, FAMILY), { recursive: true });
      const result = await Effect.runPromise(fetchEntry("remote", FAMILY, "a".repeat(64), store, remote));
      expect(result).toBe("absent");
      expect(Bun.spawnSync(["ls", "-A", join(store, FAMILY)]).stdout.toString()).toBe("");
    } finally {
      removeTree(directory);
    }
  });
});

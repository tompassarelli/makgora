import { expect, test } from "bun:test";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listFiles, removeTree, seal } from "../scripts/wisp/buildInputs";
import { DERIVE_LEASE_SECONDS, pruneInputs } from "../scripts/wisp/inputsPrune";

const snapshot = (root: string) => Object.fromEntries(listFiles(root).map((path) => [path, readFileSync(join(root, path), "utf8")]));

test("prune removes ended derive runs and named scratch folders, never a pinned view, a shard, a live run or a held folder, even through links into the store [k2 property]", () => {
  const root = mkdtempSync(join(tmpdir(), "inputs-prune-"));
  try {
    const shard = join(root, "store/original-clips-static-lights", "a".repeat(64)), view = join(root, "store/views", "b".repeat(64));
    mkdirSync(join(shard, "imports"), { recursive: true });
    writeFileSync(join(shard, "imports/KoboldTimelineBody.mdx"), "kobold body");
    seal(shard);
    mkdirSync(join(view, "original-clips-static-lights/imports"), { recursive: true });
    linkSync(join(shard, "imports/KoboldTimelineBody.mdx"), join(view, "original-clips-static-lights/imports/KoboldTimelineBody.mdx"));
    seal(view);
    const store = snapshot(join(root, "store"));
    const linked = (folder: string) => {
      mkdirSync(join(folder, "kobold/assets"), { recursive: true });
      symlinkSync(join(view, "original-clips-static-lights"), join(folder, "kobold/assets/original-clips-static-lights"));
      symlinkSync(join(root, "store"), join(folder, "store"));
      linkSync(join(shard, "imports/KoboldTimelineBody.mdx"), join(folder, "KoboldTimelineBody.mdx"));
      writeFileSync(join(folder, "kobold/clips.log"), "log");
      return folder;
    };
    const ended = linked(join(root, "derive/run-ended")), live = linked(join(root, "derive/run-live")), held = linked(join(root, "derive/run-held"));
    const old = (Date.now() - 2 * DERIVE_LEASE_SECONDS * 1000) / 1000;
    for (const run of [ended, held]) utimesSync(run, old, old);
    const scratch = linked(join(root, "pin-repro")), worktree = linked(join(root, "lane-scratch"));
    const holds = [{ path: join(held, "kobold/clips.log"), reason: "is open in process 7" }, { path: join(worktree, "kobold"), reason: "holds a git worktree" }];

    const pruned = pruneInputs(root, ["pin-repro", "lane-scratch", "store", "../outside", "derive"], holds);

    expect(pruned.removed).toEqual([ended, scratch]);
    expect(pruned.refused.map(({ path, reason }) => [path, reason])).toEqual([
      [worktree, "holds a git worktree"],
      [join(root, "store"), "is part of the build-inputs layout"],
      [join(root, "../outside"), "is not a folder directly under the build-inputs root"],
      [join(root, "derive"), "is part of the build-inputs layout"],
    ]);
    expect(snapshot(join(root, "store"))).toEqual(store);
    for (const path of [live, held, worktree]) expect(existsSync(join(path, "kobold/clips.log")), path).toBe(true);
    for (const path of [ended, scratch]) expect(existsSync(path), path).toBe(false);
  } finally {
    removeTree(root);
  }
});

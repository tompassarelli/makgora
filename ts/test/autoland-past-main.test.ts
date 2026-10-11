import { expect, test } from "bun:test";
import { pastMain, type Tree } from "../scripts/autolandCore";

const PATHS = ["docs/ci.md", "docs/a.md", "ts/src/game/a.ts", "ts/src/game/b.ts", "tools/move-data/advantage-state.md", "assets/stage.png.pointer", "ts/scripts/autoland.ts", ".github/workflows/ci.yml"];

test("a train lands past main iff every main commit misses its paths, as the tested tree plus main's delta [k2 property]", () => {
  let seed = 7513;
  const next = (n: number): number => { seed = (seed * 48271) % 2147483647; return seed % n; };
  const edit = (tree: Tree, paths: readonly string[], tag: string): Map<string, string> => {
    const out = new Map(tree);
    for (const path of paths) if (next(3) === 0) out.delete(path); else out.set(path, `100644 blob ${tag}-${next(1000)}`);
    return out;
  };
  const pick = (from: readonly string[]): string[] => from.filter(() => next(3) === 0);
  let landedCount = 0;
  for (let round = 0; round < 2000; round++) {
    const base: Tree = new Map(PATHS.filter(() => next(4) > 0).map((path) => [path, `100644 blob base-${next(1000)}`]));
    const tested = edit(base, pick(PATHS.filter((path) => !path.startsWith(".github/"))), "train");
    const trainPaths = new Set(PATHS.filter((path) => base.get(path) !== tested.get(path)));
    const main: Tree[] = [];
    let disjoint = true;
    const merged = new Map(tested);
    let before = base;
    for (let commits = 1 + next(3); commits > 0; commits--) {
      const tree = edit(before, pick(PATHS), "main");
      for (const path of PATHS) {
        if (before.get(path) === tree.get(path)) continue;
        if (trainPaths.has(path) || path.startsWith(".github/workflows/") || path.startsWith("ts/scripts/autoland")) disjoint = false;
        const entry = tree.get(path);
        if (entry === undefined) merged.delete(path); else merged.set(path, entry);
      }
      main.push(tree);
      before = tree;
    }
    const broken = next(4) === 0;
    let landed: Tree | undefined = merged;
    if (broken) {
      const path = PATHS[next(PATHS.length)] ?? "docs/ci.md";
      landed = next(5) === 0 ? undefined : new Map([...merged, [path, `${merged.get(path) ?? "100644 blob"}-rebased-wrong`]]);
    }
    const verdict = pastMain(base, tested, main, landed);
    expect(verdict).toBe(disjoint && !broken ? "land" : "retest");
    if (verdict === "land") landedCount++;
  }
  expect(landedCount).toBeGreaterThan(50);
});

import { afterEach, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { landedLanes, LANE_TRAILER, type Commit, type LandedLane } from "../scripts/sheriff";

const sha = (value: number) => value.toString(16).padStart(40, "0");

function train(seed: number, count: number) {
  const base = sha(0);
  const commits: Commit[] = [];
  const expected: LandedLane[] = [];
  let id = 1;
  let random = seed;
  const next = () => { random = Math.imul(random, 1664525) + 1013904223 | 0; return random >>> 0; };
  for (let lane = 0; lane < count; lane++) {
    const parent = commits.at(-1)?.sha ?? base;
    const length = 1 + next() % 4;
    const branch = `claude/generated-${seed}-${lane}`;
    const ids = Array.from({ length }, () => sha(id++));
    commits.push(...ids.map((sha, index) => ({ sha, message: `Refs #${513 + lane}${index === length - 1 ? `\n\n${LANE_TRAILER} ${JSON.stringify({ branch, count: length, issues: [513 + lane] })}` : ""}` })));
    expected.push({ branch, issues: [513 + lane], parent, head: ids.at(-1)!, commits: ids });
  }
  return { base, commits, expected };
}

test("a lane is found whole across generated trains and a commit outside every lane voids the range [k2 property]", () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (let count = 1; count <= 6; count++) {
      const { base, commits, expected } = train(seed, count);
      expect(landedLanes(base, commits)).toEqual(expected);
      for (let gap = 1; gap < count; gap++) {
        const cut = expected[gap]!.parent;
        const at = commits.findIndex((commit) => commit.sha === cut) + 1;
        const stray = { sha: sha(900), message: "Regenerate reports for a lane\n\nAutoland-Reports: 1" };
        expect(landedLanes(base, [...commits.slice(0, at), stray, ...commits.slice(at)])).toBeUndefined();
      }
    }
  }
});

const scratch: string[] = [];
afterEach(() => { for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true }); });

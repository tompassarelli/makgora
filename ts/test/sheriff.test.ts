import { expect, test } from "bun:test";
import { bisect, decide, landedLanes, LANE_TRAILER, suiteProbe, type Commit, type LandedLane, type Probe, type ProbeResult } from "../scripts/sheriff";

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
    if (next() % 2 === 0 || lane === count - 1) commits.push({ sha: sha(id++), message: "Regenerated\n\nAutoland-Reports: 1", files: ["tools/move-data/advantage-state.md"] });
  }
  const main = sha(id++);
  const snapshots = new Map([[base, [] as string[]], ...commits.map((commit, index) => [commit.sha, commits.slice(0, index + 1).map((entry) => entry.sha)] as const), [main, commits.map((entry) => entry.sha)]]);
  return { base, commits, expected, main, snapshots };
}

function search(fixture: ReturnType<typeof train>, culprits: readonly number[], override?: (probe: Probe) => ProbeResult | undefined) {
  const lanes = landedLanes(fixture.base, fixture.commits)!;
  const search = bisect(lanes, fixture.main);
  const probes: { probe: Probe; result: ProbeResult }[] = [];
  let next = search.next();
  while (!next.done) {
    const probe = next.value;
    const present = new Set(fixture.snapshots.get(probe.head)!.filter((commit) => !probe.without?.includes(commit)));
    const result = override?.(probe) ?? (culprits.some((index) => fixture.expected[index]!.commits.some((commit) => present.has(commit))) ? "fail" : "pass");
    probes.push({ probe, result });
    next = search.next(result);
  }
  return { culprit: next.value, probes };
}

const failedRun = { conclusion: "failure", jobs: [{ name: "Background sweeps (bun)", conclusion: "failure", steps: [{ name: "Run bun run test", conclusion: "failure" }] }] };

test("sheriff reverts all and only the confirmed lane across generated trains and otherwise alarms [k2 property]", () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (let count = 1; count <= 6; count++) {
      const fixture = train(seed, count);
      expect(landedLanes(fixture.base, fixture.commits)).toEqual(fixture.expected);
      for (let culprit = 0; culprit < count; culprit++) {
        const result = search(fixture, [culprit]);
        expect(result.culprit).toEqual(fixture.expected[culprit]);
        const reverted = result.culprit!.commits.toReversed();
        expect(reverted).toEqual(fixture.expected[culprit]!.commits.toReversed());
        const survivors = fixture.expected.flatMap((lane) => lane.commits).filter((commit) => !reverted.includes(commit));
        expect(survivors).toEqual(fixture.expected.filter((_, index) => index !== culprit).flatMap((lane) => lane.commits));
        expect(search(fixture, [culprit], (probe) => probe.without === undefined && probe.head === fixture.base ? "fail" : undefined).culprit).toBeUndefined();
        expect(search(fixture, [culprit], (probe) => probe.without === undefined && probe.head === fixture.expected[culprit]!.head ? "unmeasured" : undefined).culprit).toBeUndefined();
        expect(search(fixture, [culprit], (probe) => probe.without !== undefined ? "unmeasured" : undefined).culprit).toBeUndefined();
        const parent = fixture.expected[culprit]!.parent;
        expect(search(fixture, [culprit], (probe) => probe.without === undefined && probe.head === parent ? "fail" : undefined).culprit).toBeUndefined();
      }
      expect(search(fixture, []).culprit).toBeUndefined();
      for (let first = 0; first < count; first++) for (let second = first + 1; second < count; second++) expect(search(fixture, [first, second]).culprit).toBeUndefined();
      const partial = fixture.commits.slice(1).map((commit, index) => index === 0 && fixture.expected[0]!.commits.length === 1 ? { ...commit, message: `${commit.message}\n${LANE_TRAILER} ${JSON.stringify({ branch: "claude/truncated", count: fixture.commits.length + 1, issues: [513] })}` } : commit);
      expect(landedLanes(fixture.base, partial)).toBeUndefined();
      expect(landedLanes(fixture.base, [{ sha: sha(900), message: "direct" }, ...fixture.commits])).toBeUndefined();
      expect(landedLanes(fixture.base, fixture.commits.map((commit) => commit.message.includes("Autoland-Reports:") ? { ...commit, files: ["ts/src/game/sim/attacks.ts"] } : commit))).toBeUndefined();
      const missing = fixture.commits.map((commit) => ({ ...commit, message: commit.message.replace(`${LANE_TRAILER} `, "Unknown: ") }));
      expect(landedLanes(fixture.base, missing)).toBeUndefined();
      const verdict = decide({ run: failedRun, previous: { conclusion: "success", jobs: [], ancestor: true }, commits: fixture.commits, workflowFiles: [] });
      expect(verdict.kind).toBe("bisect");
      expect(suiteProbe("Background sweeps", "Background census: Every fighter pair's worst frame within the margin of main's fixture (#405)")).toBeUndefined();
    }
  }
});

test("sheriff bisects 1-6 lanes within ceil(log2(n))+5 probes and confirms the actual reports parent [k3 measure #513]", () => {
  for (let seed = 41; seed <= 80; seed++) {
    for (let count = 1; count <= 6; count++) {
      const fixture = train(seed, count);
      for (let culprit = 0; culprit < count; culprit++) {
        const result = search(fixture, [culprit]);
        const expected = fixture.expected[culprit]!;
        expect(result.culprit).toEqual(expected);
        expect(result.probes.length).toBeLessThanOrEqual(Math.ceil(Math.log2(count)) + 5);
        expect(result.probes.some(({ probe, result }) => probe.head === expected.parent && probe.without === undefined && result === "pass")).toBe(true);
        expect(result.probes.some(({ probe, result }) => probe.head === expected.head && probe.without === undefined && result === "fail")).toBe(true);
        expect(result.probes.at(-1)).toEqual({ probe: { head: fixture.main, without: expected.commits.toReversed() }, result: "pass" });
      }
    }
  }
});

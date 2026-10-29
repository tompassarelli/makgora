import { expect, test } from "bun:test";
import { Effect } from "effect";
import { type Gh, retireScratch, retirement } from "../scripts/scratchRetire";

const REPO = "tompassarelli/smashcraft";
const NOW = Date.parse("2026-10-29T14:00:00Z");
const TIP = "a".repeat(40);

const farm = (minutesAgo: number, runs: readonly { branch: string | null; sha: string; title: string }[]) => {
  const deleted: string[] = [];
  const gh: Gh = (...args) => Effect.sync(() => {
    const call = args.join(" ");
    if (args[0] === "api" && args[1] === "-X" && args[2] === "DELETE") {
      deleted.push(args[3]!.slice(`repos/${REPO}/git/refs/heads/`.length));
      return "";
    }
    if (call.includes("/events")) return JSON.stringify([[{ type: "PushEvent", created_at: new Date(NOW - minutesAgo * 60000).toISOString(), payload: { ref: "refs/heads/farm/chen-keg" } }]]);
    if (call.includes("graphql")) {
      const nodes = call.includes("refs/heads/farm/") ? [{ name: "chen-keg", target: { oid: TIP } }] : [];
      return JSON.stringify([{ data: { repository: { refs: { nodes } } } }]);
    }
    if (call.includes("/actions/runs?status=in_progress")) return JSON.stringify([{ workflow_runs: runs.map((run) => ({ head_branch: run.branch, head_sha: run.sha, display_title: run.title })) }]);
    if (call.includes("/actions/runs")) return JSON.stringify([{ workflow_runs: [] }]);
    if (call.includes("/pulls")) return JSON.stringify([[]]);
    throw new Error(`unexpected gh ${call}`);
  });
  return { gh, deleted };
};

test("a farm/ branch is deleted once no run is using it and kept while its run is in progress [k1 scenario]", async () => {
  const running = farm(120, [{ branch: "main", sha: "b".repeat(40), title: `Perf ${TIP} farm/chen-keg abcd1234` }]);
  await Effect.runPromise(retireScratch(running.gh, REPO, NOW, false));
  expect(running.deleted).toEqual([]);

  const finished = farm(120, []);
  await Effect.runPromise(retireScratch(finished.gh, REPO, NOW, false));
  expect(finished.deleted).toEqual(["farm/chen-keg"]);
});

test("a branch pushed minutes ago is kept for its dispatch, and an open pull request or a lane named in a run title holds it [k2 property]", () => {
  const ref = { name: "probe/vashj", tip: TIP, pushedMinutesAgo: 2 };
  expect(retirement(ref, [], new Set()).retire).toBe(false);
  expect(retirement({ ...ref, pushedMinutesAgo: undefined }, [], new Set()).retire).toBe(true);
  expect(retirement({ ...ref, pushedMinutesAgo: 60 }, [], new Set(["probe/vashj"])).retire).toBe(false);
  expect(retirement({ ...ref, pushedMinutesAgo: 60 }, [{ headBranch: "main", headSha: "c".repeat(40), title: "Balance sha probe/vashj wren expert 400 a pair x" }], new Set()).retire).toBe(false);
});

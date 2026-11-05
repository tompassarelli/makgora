import { expect, test } from "bun:test";
import { Effect } from "effect";
import { type Gh, retireScratch, retirement } from "../scripts/scratchRetire";

const REPO = "tompassarelli/makgora";
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
      const nodes = call.includes("refs/heads/farm/") ? [{ name: "chen-keg", target: { oid: TIP, committedDate: new Date(NOW - minutesAgo * 60000).toISOString() } }] : [];
      return JSON.stringify([{ data: { repository: { refs: { nodes } } } }]);
    }
    if (call.includes("/actions/runs?status=in_progress")) return JSON.stringify([{ workflow_runs: runs.map((run) => ({ head_branch: run.branch, head_sha: run.sha, display_title: run.title })) }]);
    if (call.includes("/actions/runs")) return JSON.stringify([{ workflow_runs: [] }]);
    if (call.includes("/pulls")) return JSON.stringify([[]]);
    throw new Error(`unexpected gh ${call}`);
  });
  return { gh, deleted };
};

test("a branch whose head is under 3 hours old is kept when no run uses it, and an older one is deleted, whether or not a push event survives [k1 scenario]", async () => {
  const fresh = farm(179, []);
  await Effect.runPromise(retireScratch(fresh.gh, REPO, NOW, false));
  expect(fresh.deleted).toEqual([]);

  const old = farm(181, []);
  await Effect.runPromise(retireScratch(old.gh, REPO, NOW, false));
  expect(old.deleted).toEqual(["farm/chen-keg"]);

  const ref = { name: "probe/sc-788-a", tip: TIP };
  expect(retirement({ ...ref, headMinutesAgo: 179 }, [], new Set()).retire).toBe(false);
  expect(retirement({ ...ref, headMinutesAgo: 181 }, [], new Set()).retire).toBe(true);
});

import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit } from "effect";
import { type PairStatus, restartPair } from "../scripts/wisp/commands/lanPoolUnit";

const state = mkdtempSync(join(tmpdir(), "smashcraft-pair-restart-"));
const ownState = process.env["XDG_STATE_HOME"];
process.env["XDG_STATE_HOME"] = state;
afterAll(() => {
  if (ownState === undefined) delete process.env["XDG_STATE_HOME"];
  else process.env["XDG_STATE_HOME"] = ownState;
  rmSync(state, { recursive: true, force: true });
});

const crashed: PairStatus = { clients: [{ name: "lan0a" }, { name: "lan0b", pid: 202 }] };
const back: PairStatus = { clients: [{ name: "lan0a", pid: 301 }, { name: "lan0b", pid: 302 }] };

const fakePair = (after: readonly (PairStatus | undefined)[], unlistedReads = 0) => {
  const events: string[] = [];
  let restarted = false;
  let reads = 0;
  let listedReads = 0;
  const control = {
    status: Effect.sync(() => {
      if (!restarted) return crashed;
      const read = after[Math.min(reads, after.length - 1)];
      reads += 1;
      events.push(`status ${read === undefined ? "none" : read.clients.every(({ pid }) => pid !== undefined) ? "back" : "down"}`);
      return read;
    }),
    listed: Effect.sync(() => {
      if (!restarted) return true;
      listedReads += 1;
      const listed = listedReads > unlistedReads;
      if (!listed) events.push("unlisted");
      return listed;
    }),
    stop: Effect.sync(() => { events.push("stop"); }),
    start: (profile: string | undefined) => Effect.sync(() => { restarted = true; events.push(`start ${profile ?? "default"}`); }),
    every: "1 millis",
    within: "2 seconds",
  } as const;
  return { control, events };
};

test("a pair with a crashed client is stopped, restarted and waited on until both clients run again before the restart returns [k1 scenario]", async () => {
  const { control, events } = fakePair([undefined, undefined, crashed, back]);
  const drop = await Effect.runPromise(restartPair(0, control).pipe(Effect.tap(() => Effect.sync(() => events.push("checks")))));
  expect(drop?.dropped).toEqual(["client lan0a"]);
  expect(events).toEqual(["stop", "start default", "status none", "status none", "status down", "status back", "checks"]);
});

test("a restart whose pair never comes back fails naming the client still down instead of handing the pair to checks [k1 scenario]", async () => {
  const { control, events } = fakePair([crashed]);
  const exit = await Effect.runPromiseExit(restartPair(0, { ...control, within: "50 millis" }).pipe(Effect.tap(() => Effect.sync(() => events.push("checks")))));
  expect(Exit.isFailure(exit)).toBe(true);
  expect(String(exit)).toContain("lan0a not running");
  expect(events).not.toContain("checks");
});

test("a restarted pair whose clients run before the pool lists it is waited on until pool.json names it, so accept never reads a pool without the pair [k1 scenario]", async () => {
  const { control, events } = fakePair([back], 2);
  const drop = await Effect.runPromise(restartPair(0, control).pipe(Effect.tap(() => Effect.sync(() => events.push("checks")))));
  expect(drop?.dropped).toEqual(["client lan0a"]);
  expect(events).toEqual(["stop", "start default", "status back", "unlisted", "status back", "unlisted", "status back", "checks"]);
});

test("a restarted pair the pool never lists fails saying so instead of handing an unlisted pair to checks [k1 scenario]", async () => {
  const { control, events } = fakePair([back], Number.MAX_SAFE_INTEGER);
  const exit = await Effect.runPromiseExit(restartPair(0, { ...control, within: "50 millis" }).pipe(Effect.tap(() => Effect.sync(() => events.push("checks")))));
  expect(Exit.isFailure(exit)).toBe(true);
  expect(String(exit)).toContain("the pool hasn't listed it");
  expect(events).not.toContain("checks");
});

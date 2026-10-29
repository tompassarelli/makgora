import { expect, test } from "bun:test";
import { Deferred, Effect, Option } from "effect";
import { type Check, type Local, PrePushRefusal, prePush } from "../scripts/prePush";

const HEAD = "c".repeat(40);
const CUE = "ts/src/game/presentation/specialCues.ts";

const lane = (failing: string): { local: Local; ran: string[] } => {
  const ran: string[] = [];
  const local: Local = {
    hosted: false,
    cues: () => new Set([CUE]),
    strikes: () => new Set(),
    changed: () => Effect.succeed([CUE]),
    head: Effect.succeed(HEAD),
    dirty: () => Effect.succeed(""),
    runner: (check: Check) => Effect.sync(() => {
      ran.push(check.name);
      return { exitCode: check.name === failing ? 1 : 0, stdout: "", stderr: "" };
    }),
    key: () => Effect.succeed(Option.none()),
    cache: { has: () => Effect.succeed(false), record: () => Effect.void },
  };
  return { local, ran };
};

const handOff = (local: Local) => prePush(`refs/heads/lane ${HEAD} refs/heads/claude/land-lane-${HEAD.slice(0, 12)} ${"d".repeat(40)}\n`, {
  gate: () => Effect.void,
  queue: Effect.succeed("autoland"),
  notice: Effect.void,
}, local);

test("a lane whose Classic effect record is stale stops at its own push with the record command, before Autoland can only hand it back [k1 scenario]", async () => {
  const stale = lane("cue models and Classic effect record");
  const refused = await Effect.runPromise(Effect.flip(handOff(stale.local)));
  expect(refused).toBeInstanceOf(PrePushRefusal);
  expect(refused.problem).toContain("record new models with");
  expect(stale.ran).toContain("cue models and Classic effect record");
  expect(stale.ran).not.toContain("kind tags, parity ledger and type-check ts");

  const fresh = lane("");
  await Effect.runPromise(handOff(fresh.local));
  expect(fresh.ran).toContain("cue models and Classic effect record");
});

test("the clean room scans beside the other local checks and the main-red notice beside them all, so neither waits in line [k1 scenario]", async () => {
  const run = Effect.gen(function*() {
    const typeChecking = yield* Deferred.make<void>();
    const scanned = yield* Deferred.make<void>();
    const { local } = lane("");
    const beside: Local = {
      ...local,
      runner: (check: Check) => Effect.gen(function*() {
        if (check.name === "kind tags, parity ledger and type-check ts") yield* Deferred.succeed(typeChecking, undefined);
        if (check.name === "clean room") {
          yield* Deferred.await(typeChecking);
          yield* Deferred.succeed(scanned, undefined);
        }
        return { exitCode: 0, stdout: "", stderr: "" };
      }),
    };
    yield* prePush(`refs/heads/lane ${HEAD} refs/heads/lane ${"d".repeat(40)}\n`, { gate: () => Effect.void, queue: Effect.succeed(""), notice: Deferred.await(scanned) }, beside);
  });
  await Effect.runPromise(run.pipe(Effect.timeout("5 seconds")));
});

test("a release-candidate tag pushes only onto a commit main's CI passed, since the Lua parity tapes run there after landing [k1 scenario]", async () => {
  const { local } = lane("");
  const tagPush = (conclusions: readonly string[]) => prePush(`refs/tags/v0.1.2-rc.10 ${HEAD} refs/tags/v0.1.2-rc.10 ${"0".repeat(40)}\n`, {
    gate: () => Effect.void, queue: Effect.succeed(""), notice: Effect.void, mainCi: () => Effect.succeed(conclusions),
  }, local);
  const refused = await Effect.runPromise(Effect.flip(tagPush(["failure"])));
  expect(refused.problem).toContain("main's CI has not passed on it (failure)");
  expect((await Effect.runPromise(Effect.flip(tagPush([])))).problem).toContain("(no run)");
  await Effect.runPromise(tagPush(["failure", "success"]));
});

import { expect, test } from "bun:test";
import { Effect } from "effect";
import { parsePadScript } from "../scripts/integrity/padScript";
import { timingCheck, timingLease } from "../scripts/wisp/captureCapacity";

const leased = (script: string) => {
  const owners: string[] = [];
  const quiet = <A, E, R>(owner: string, run: Effect.Effect<A, E, R>) => { owners.push(owner); return run; };
  Effect.runSync(timingLease(timingCheck([parsePadScript(script)]), "smashcraft-pad", Effect.void, quiet));
  return owners;
};

test("a capture script runs without the quiet lease and a timing script takes it [k2 property]", () => {
  expect(leased("10 a press A\n20 a capture\n")).toEqual([]);
  expect(leased("10 a press A\n20 a release A\n")).toEqual(["smashcraft-pad"]);
});

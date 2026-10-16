import { expect, test } from "bun:test";
import { Effect } from "effect";
import { inQuietNativeWindow, windowLoad } from "../scripts/wisp/quietWindow";

test("a compared native pad run records its load inside the quiet native session it waited for [k2 property]", () => {
  const owners: string[] = [];
  const quiet = <A, E, R>(owner: string, run: Effect.Effect<A, E, R>) => { owners.push(owner); return run; };
  const load = Effect.runSync(inQuietNativeWindow("smashcraft-pad", windowLoad, quiet));
  expect(owners).toEqual(["smashcraft-pad"]);
  expect(load.quiet_window).toBe("smashcraft-pad");
});

import { expect, test } from "bun:test";
import { Effect } from "effect";
import { rerun } from "../scripts/heavyCapacity";

test("the admitted re-run sees what its parent set in process.env, such as the derive lock holder [k5 boundary capacity-rerun-env]", async () => {
  process.env.SMASHCRAFT_RERUN_PROBE = "set after start";
  try {
    expect(await Effect.runPromise(rerun(["sh", "-c", 'test "$SMASHCRAFT_RERUN_PROBE" = "set after start"']))).toBe(0);
  } finally {
    delete process.env.SMASHCRAFT_RERUN_PROBE;
  }
});

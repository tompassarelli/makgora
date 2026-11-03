import { expect, test } from "bun:test";
import { join } from "node:path";

test("cpu-expert.pad played through the standalone path on this tree's sim matches its native recording's digest on every frame [k4 reference native]", () => {
  const run = Bun.spawnSync(["bun", "wisp", "parity", "standalone", "test/native/pads/cpu-expert.pad", "--presentation", "native"], { cwd: join(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" });
  expect(`${run.stdout}${run.stderr}`).toContain("0 divergent");
  expect(run.exitCode).toBe(0);
}, 60_000);

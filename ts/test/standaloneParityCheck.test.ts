import { expect, test } from "bun:test";
import { join } from "node:path";
import { CHECKS, STANDALONE_PARITY } from "../scripts/landingChecks";

test("cpu-expert.pad played through the standalone path on this tree's sim matches its native recording's digest on every frame [k4 reference native]", () => {
  const check = CHECKS.find(({ name }) => name === STANDALONE_PARITY)!;
  const run = Bun.spawnSync([...check.command], { cwd: join(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" });
  expect(`${run.stdout}${run.stderr}`).toContain("0 divergent");
  expect(run.exitCode).toBe(0);
}, 60_000);

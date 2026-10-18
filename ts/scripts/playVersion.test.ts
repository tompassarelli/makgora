import { expect, test } from "bun:test";
import { buildName, releaseTarget } from "./wisp/currentPlaytest";
import { PLAYABLE_FILE, buildLabel } from "./wisp/greenBuilds";

test("every build after v0.1.0 is Smashcraft 0.1.1 plus its commit until an rc tag names it RC-N and the v0.1.1 tag names it 0.1.1 [k1 scenario]", () => {
  const first = "b".repeat(40);
  const second = "c".repeat(40);
  expect(releaseTarget("v0.1.0")).toBe("0.1.0");
  expect(releaseTarget("v0.1.0-3-g0123abc\n")).toBe("0.1.1");
  expect(releaseTarget("v0.1.0-rc1")).toBeUndefined();
  expect(releaseTarget(undefined)).toBeUndefined();

  expect(buildName([], "0.1.1", first)).toBe("Smashcraft 0.1.1 bbbbbbb");
  expect(buildName([], "0.1.1", second)).toBe("Smashcraft 0.1.1 ccccccc");
  expect(buildName(["v0.1.1-rc.1", "v0.1.1-rc.2"], "0.1.1", first)).toBe("Smashcraft 0.1.1 RC-2");
  expect(buildName(["v0.1.2-rc.1", "v0.1.1-rc.x"], "0.1.1", first)).toBe("Smashcraft 0.1.1 bbbbbbb");
  expect(buildName(["v0.1.1-rc.3", "v0.1.1"], "0.1.1", first)).toBe("Smashcraft 0.1.1");
  expect(buildName(["v0.1.0"], "0.1.0", first)).toBe("Smashcraft 0.1.0");

  for (const name of ["Smashcraft 0.1.1 bbbbbbb", "Smashcraft 0.1.1 RC-2", "Smashcraft 0.1.1"]) expect(PLAYABLE_FILE.exec(`${name}.w3x`)).not.toBeNull();
  expect(PLAYABLE_FILE.exec("Smashcraft 0.1.1-cairne-air.w3x")).toBeNull();
  expect(buildLabel("Smashcraft 0.1.1 RC-2.w3x")).toBe("0.1.1 RC-2");
});

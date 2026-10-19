import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { type LaneSteps, laneBuild, laneTests } from "./laneBuild";
import { LANE_FILE, PLAYABLE_FILE } from "./wisp/greenBuilds";
import { laneMapTitle, laneSlug } from "./wisp/laneMaps";
import { installLatest } from "./wisp/mapLibrary";

const CAIRNE = "claude/land-cairne-air-924c72aef489";
const FLAKE = "claude/land-fix-test-flake-0123456789ab";

test("a lane map is named Smashcraft <version>-<lane>, one installed lane map replaces any other, and none is taken for a main build [k2 property]", async () => {
  const root = mkdtempSync(join(tmpdir(), "smashcraft-lane-build-"));
  try {
    const documents = join(root, "documents");
    const maps = join(documents, "Maps/00-Smashcraft/dev");
    const staging = join(root, "staging");
    mkdirSync(maps, { recursive: true });
    writeFileSync(join(maps, "Smashcraft 0.0.6-dev aaaaaaa.w3x"), "main 6");
    expect(laneSlug(CAIRNE)).toBe("cairne-air-924c72aef489");
    expect(laneSlug("claude/Fix_Test Flake")).toBe("fix-test-flake");
    expect(laneMapTitle("0.0.7", laneSlug(CAIRNE))).toBe("Smashcraft 0.0.7-cairne-air-924c72aef489");

    let version = "0.0.7";
    let passing = true;
    const built: string[] = [];
    const steps: LaneSteps<never> = {
      check: Effect.suspend(() => passing ? Effect.void : Effect.fail(new PlayProblem({ problem: "lane tests failed" }))),
      version: Effect.sync(() => version),
      build: (title, out) => Effect.sync(() => { built.push(title); writeFileSync(out, title); }),
    };
    const build = (branch: string) => Effect.runPromise(laneBuild(steps, branch, staging, documents).pipe(Effect.result));
    const listed = () => readdirSync(maps).sort();

    await build(CAIRNE);
    await build(FLAKE);
    expect(listed()).toEqual(["Smashcraft 0.0.6-dev aaaaaaa.w3x", "Smashcraft 0.0.7-fix-test-flake-0123456789ab.w3x"]);
    version = "0.0.8";
    const replaced = await build(CAIRNE);
    expect(replaced._tag).toBe("Success");
    expect(listed()).toEqual(["Smashcraft 0.0.6-dev aaaaaaa.w3x", "Smashcraft 0.0.8-cairne-air-924c72aef489.w3x"]);
    expect(readFileSync(join(maps, "Smashcraft 0.0.8-cairne-air-924c72aef489.w3x"), "utf8")).toBe("Smashcraft 0.0.8-cairne-air-924c72aef489");

    passing = false;
    version = "0.0.9";
    expect((await build(CAIRNE))._tag).toBe("Failure");
    expect(built).toHaveLength(3);
    expect(existsSync(join(maps, "Smashcraft 0.0.8-cairne-air-924c72aef489.w3x"))).toBe(true);

    for (const name of listed().filter((entry) => LANE_FILE.test(entry))) expect(PLAYABLE_FILE.test(name)).toBe(false);
    const main = join(root, "Smashcraft 0.0.7-dev bbbbbbb.w3x");
    writeFileSync(main, "main 7");
    installLatest(documents, main);
    expect(listed()).toEqual(["Smashcraft 0.0.7-dev bbbbbbb.w3x"]);

    expect(laneTests(["scripts/laneBuild.test.ts", "src/game/sim/mathTables.tests.ts", "scripts/gone.test.ts", "scripts/laneBuild.ts"]))
      .toEqual({ host: ["scripts/laneBuild.test.ts"], game: ["game/sim/mathTables.tests.ts"] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

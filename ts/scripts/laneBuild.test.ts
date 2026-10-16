import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { type LaneSteps, laneBuild, laneTests } from "./laneBuild";
import { type WatchSteps, watchOnce } from "./tomBuildWatch";
import { playVersion } from "./wisp/currentPlaytest";
import { LANE_FILE, PLAYABLE_FILE } from "./wisp/greenBuilds";
import { landedBranches, laneMapTitle, laneSlug, removeLaneMaps } from "./wisp/laneMaps";
import { installLatest } from "./wisp/mapLibrary";

const CAIRNE = "claude/land-cairne-air-924c72aef489";
const FLAKE = "claude/land-fix-test-flake-0123456789ab";

test("a lane map is named Smashcraft <version>-<lane>, replaces only its own lane's map, and main numbering and pruning ignore it [k2 property]", async () => {
  const root = mkdtempSync(join(tmpdir(), "smashcraft-lane-build-"));
  try {
    const documents = join(root, "documents");
    const maps = join(documents, "Maps/00-Smashcraft");
    const staging = join(root, "staging");
    mkdirSync(maps, { recursive: true });
    writeFileSync(join(maps, "Smashcraft 0.0.6.w3x"), "main 6");
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
    const build = (branch: string) => Effect.runPromise(laneBuild(steps, documents, branch, staging).pipe(Effect.result));
    const listed = () => readdirSync(maps).filter((entry) => entry.endsWith(".w3x")).sort();

    await build(CAIRNE);
    await build(FLAKE);
    version = "0.0.8";
    const replaced = await build(CAIRNE);
    expect(replaced._tag).toBe("Success");
    expect(listed()).toEqual(["Smashcraft 0.0.6.w3x", "Smashcraft 0.0.7-fix-test-flake-0123456789ab.w3x", "Smashcraft 0.0.8-cairne-air-924c72aef489.w3x"]);
    expect(readFileSync(join(maps, "Smashcraft 0.0.8-cairne-air-924c72aef489.w3x"), "utf8")).toBe("Smashcraft 0.0.8-cairne-air-924c72aef489");

    passing = false;
    version = "0.0.9";
    expect((await build(CAIRNE))._tag).toBe("Failure");
    expect(built).toHaveLength(3);
    expect(existsSync(join(maps, "Smashcraft 0.0.8-cairne-air-924c72aef489.w3x"))).toBe(true);

    for (const name of listed().filter((entry) => LANE_FILE.test(entry))) expect(PLAYABLE_FILE.test(name)).toBe(false);
    expect(playVersion(join(root, "play-current"), maps, "a".repeat(40))).toBe("0.0.7");
    const main = join(root, "Smashcraft 0.0.7.w3x");
    writeFileSync(main, "main 7");
    installLatest(documents, main);
    expect(listed()).toEqual(["Smashcraft 0.0.6.w3x", "Smashcraft 0.0.7-fix-test-flake-0123456789ab.w3x", "Smashcraft 0.0.7.w3x", "Smashcraft 0.0.8-cairne-air-924c72aef489.w3x"]);

    expect(laneTests(["scripts/laneBuild.test.ts", "src/game/sim/mathTables.tests.ts", "scripts/gone.test.ts", "scripts/laneBuild.ts"]))
      .toEqual({ host: ["scripts/laneBuild.test.ts"], game: ["game/sim/mathTables.tests.ts"] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the main build that lands a lane removes that lane's map and no other [k2 property]", async () => {
  const root = mkdtempSync(join(tmpdir(), "smashcraft-lane-retire-"));
  try {
    const documents = join(root, "documents");
    const maps = join(documents, "Maps/00-Smashcraft");
    mkdirSync(join(maps, "tests"), { recursive: true });
    for (const name of ["Smashcraft 0.0.8-cairne-air-924c72aef489.w3x", "Smashcraft 0.0.7-fix-test-flake-0123456789ab.w3x"]) writeFileSync(join(maps, name), name);
    writeFileSync(join(maps, "tests", "Smashcraft 0.0.5-cairne-air-924c72aef489.w3x"), "older lane build");
    const history: Record<string, string> = {
      ["a".repeat(40)]: "Unrelated change\n",
      ["b".repeat(40)]: `Cairne air\n\nAutoland-Lane: {"branch":"${CAIRNE}","count":1,"issues":[]}\n`,
    };
    expect(landedBranches(Object.values(history).join("\n"))).toEqual([CAIRNE]);
    let tip = "a".repeat(40);
    const ranges: (string | undefined)[] = [];
    const steps: WatchSteps<never> = {
      tip: () => Effect.sync(() => tip),
      decision: () => Effect.succeed("build"),
      landedAt: () => Effect.succeed(0),
      notes: () => Effect.succeed("notes.md"),
      build: () => Effect.succeed({ version: "0.0.9", path: join(maps, "Smashcraft 0.0.9.w3x") }),
      retire: (previous, sha) => Effect.sync(() => {
        ranges.push(previous);
        return removeLaneMaps(documents, landedBranches(history[sha] ?? "").map(laneSlug));
      }),
    };
    const files = { log: join(root, "tom-build.log"), attempts: join(root, "attempted") };
    await Effect.runPromise(watchOnce(steps, files));
    expect(readdirSync(maps).filter((entry) => LANE_FILE.test(entry))).toHaveLength(2);
    tip = "b".repeat(40);
    await Effect.runPromise(watchOnce(steps, files));
    expect(ranges).toEqual([undefined, "a".repeat(40)]);
    expect(readdirSync(maps).filter((entry) => LANE_FILE.test(entry))).toEqual(["Smashcraft 0.0.7-fix-test-flake-0123456789ab.w3x"]);
    expect(readdirSync(join(maps, "tests"))).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

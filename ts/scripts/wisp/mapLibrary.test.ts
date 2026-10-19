import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { type LaneSteps, laneBuild } from "../laneBuild";
import { installAcceptedGreen } from "./installGreen";
import { GREEN_GATE_CHECKS } from "./greenBuilds";
import { installLatest, newestPlayable } from "./mapLibrary";

test("a green install leaves exactly one map in dev and never touches releases, a lane build writes nothing there, and a lane installed to try replaces any earlier one until the next main install [k1 scenario]", async () => {
  const root = mkdtempSync(join(tmpdir(), "smashcraft-map-library-"));
  try {
    const documents = join(root, "documents");
    const library = join(documents, "Maps/00-Smashcraft");
    const maps = join(library, "dev");
    const releases = join(library, "releases");
    mkdirSync(join(maps, "older"), { recursive: true });
    mkdirSync(join(library, "tests"), { recursive: true });
    mkdirSync(releases, { recursive: true });
    for (const name of ["Smashcraft 0.0.399 aaaaaaa.w3x", "Smashcraft 0.0.400 bbbbbbb.w3x", "Smashcraft 0.0.400 bbbbbbb.w3x.base.lua",
      "Smashcraft current integrity.w3x", "Smashcraft 0.0.400-cairne-air.w3x"]) writeFileSync(join(maps, name), name);
    writeFileSync(join(releases, "Smashcraft 0.1.0.w3x"), "release 0.1.0");
    writeFileSync(join(maps, "older", "Smashcraft 0.0.300 ccccccc.w3x"), "older");
    writeFileSync(join(library, "tests", "Smashcraft test 9.w3x"), "test");

    const map = join(root, "Smashcraft 0.0.401 ddddddd.w3x");
    writeFileSync(map, "green");
    const green = await Effect.runPromise(installAcceptedGreen(documents, map, "d".repeat(40), GREEN_GATE_CHECKS, join(root, "state"), false).pipe(Effect.result));
    expect(green._tag).toBe("Success");
    expect(readdirSync(maps)).toEqual(["Smashcraft 0.0.401 ddddddd.w3x"]);
    expect(readdirSync(library).sort()).toEqual(["dev", "releases", "tests"]);

    const staging = join(root, "lane-cache");
    const steps: LaneSteps<never> = {
      check: Effect.void,
      version: Effect.succeed("0.0.402"),
      build: (_title, out) => Effect.sync(() => { writeFileSync(out, "lane"); writeFileSync(`${out}.base.lua`, "base"); }),
    };
    const lane = (branch: string, install?: string) => Effect.runPromise(laneBuild(steps, branch, staging, install).pipe(Effect.result));
    expect((await lane("claude/land-wisp-play-diagnostic"))._tag).toBe("Success");
    expect(readdirSync(maps)).toEqual(["Smashcraft 0.0.401 ddddddd.w3x"]);
    expect(readdirSync(join(staging, "wisp-play-diagnostic")).sort()).toEqual(["Smashcraft 0.0.402-wisp-play-diagnostic.w3x", "Smashcraft 0.0.402-wisp-play-diagnostic.w3x.base.lua"]);

    expect((await lane("claude/land-cairne-air", documents))._tag).toBe("Success");
    expect((await lane("claude/land-fix-flake", documents))._tag).toBe("Success");
    expect(readdirSync(maps).sort()).toEqual(["Smashcraft 0.0.401 ddddddd.w3x", "Smashcraft 0.0.402-fix-flake.w3x"]);
    const next = join(root, "Smashcraft 0.0.403 eeeeeee.w3x");
    writeFileSync(next, "next green");
    expect((await Effect.runPromise(installAcceptedGreen(documents, next, "e".repeat(40), GREEN_GATE_CHECKS, join(root, "state"), false).pipe(Effect.result)))._tag).toBe("Success");
    expect(readdirSync(maps)).toEqual(["Smashcraft 0.0.403 eeeeeee.w3x"]);

    const release = join(root, "Smashcraft 0.1.1.w3x");
    writeFileSync(release, "release 0.1.1");
    installLatest(documents, release);
    expect(readdirSync(releases).sort()).toEqual(["Smashcraft 0.1.0.w3x", "Smashcraft 0.1.1.w3x"]);
    expect(readdirSync(maps)).toEqual(["Smashcraft 0.0.403 eeeeeee.w3x"]);
    expect(newestPlayable(documents)).toEqual({ folder: "00-Smashcraft/releases", file: "Smashcraft 0.1.1.w3x" });
    expect(readFileSync(join(releases, "Smashcraft 0.1.0.w3x"), "utf8")).toBe("release 0.1.0");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

import { expect, test } from "bun:test";
import { fighterSlug } from "../src/game/sim/heroes/registry";
import { fighters } from "../scripts/heroModelSource";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DERIVED_PATHS, derivedDifferences, derivedStepCode } from "../scripts/wisp/fighterArt";
import { changedFighters } from "../scripts/wisp/fighterArtChanges";
import { checksFor } from "../scripts/prePush";

const roster = [...fighters].map(([character, { name, source }]) => ({ name, source, slug: fighterSlug(character) }));
const everyone = roster.map(({ slug }) => slug).sort();
const STEP_CODE = new Set(["tools/animations/timeline-models.ts", "ts/src/game/sim/heroes/wardenSpecials.ts", "ts/bun.lock"]);

test("a landing checks a fighter whenever an input of its derive-step keys changes, and only then [k2 property]", () => {
  for (const { name, slug } of roster) {
    const owned = [
      `build-inputs/original-clips-static-lights/${slug}`,
      `build-inputs/impact-assets/${slug}`,
      `build-inputs/hero-models/${slug}`,
      `ts/src/generated/clips/${slug}.ts`,
      `ts/src/generated/fighter-art/${slug}.ts`,
      `ts/src/generated/assets/white-models/${slug}.ts`,
      `ts/src/generated/assets/white-facts/${slug}.ts`,
      `ts/scripts/wisp/model-facts/war3mapImported_${name}TimelineBody-${"0".repeat(64)}.mdx.00000000.json`,
      `ts/scripts/wisp/model-facts/war3mapImported_${name}White-${"0".repeat(64)}.mdx.00000000.json`,
    ];
    for (const path of owned) expect(changedFighters([path], STEP_CODE), path).toEqual([slug]);
  }
  for (const path of [...STEP_CODE, "build-inputs/hero-models/shared", "build-inputs/hero-models", "build-inputs/imported-models"]) expect(changedFighters([path], STEP_CODE), path).toEqual(everyone);
  expect(changedFighters(["ts/src/game/sim/heroes/peonMoves.ts", "build-inputs/original-clips-static-lights/shared", "build-inputs/stage-assets", "docs/build-inputs.md"], STEP_CODE)).toEqual([]);
  for (const family of ["animation-assets", "illidan-animation"]) {
    expect(changedFighters([`build-inputs/${family}`], STEP_CODE)).toEqual(roster.filter(({ source }) => source.startsWith(`${family}/`)).map(({ slug }) => slug).sort());
  }
});

test("pre-push derives exactly the changed fighters with --check on the private store, checks every fighter when a derive step's own code changes, and skips landings that change no fighter art [k2 property]", () => {
  const derive = (paths: readonly string[]) => checksFor(paths).find((check) => check.args.includes("derive"));
  const kobold = derive(["build-inputs/original-clips-static-lights/kobold", "ts/src/generated/clips/kobold.ts"]);
  expect(kobold?.args).toEqual(["scripts/wisp.ts", "inputs", "derive", "--check", "--fighter", "kobold"]);
  expect(kobold?.privateStore).toBe(true);
  expect(derive(["ts/src/generated/fighterArtData.ts"])?.args.filter((arg) => arg !== "--fighter").slice(4)).toEqual(everyone);
  expect(derive(["ts/src/generated/fighter-art/kobold.ts"])?.args).toEqual(kobold?.args);
  expect(derive(["docs/ci.md"])).toBeUndefined();
  expect(derivedStepCode().has("tools/animations/export-original-clips.ts")).toBe(true);
});

test("the derive steps read game rules only through the generated fighter art data and a few small tables, so a gameplay change outside them invalidates no fighter [k2 property]", () => {
  const game = [...derivedStepCode()].filter((path) => path.startsWith("ts/src/game/")).sort();
  expect(game).toEqual(["ts/src/game/assets/importedModelInfo.ts", "ts/src/game/sim/codes.ts"]);
  expect(derivedStepCode().has("ts/src/generated/fighterArtData.ts")).toBe(true);
  expect([...derivedStepCode()].filter((path) => path.startsWith("ts/src/generated/fighter-art/"))).toEqual([]);
});

test("a derive check reports where its scratch checkout differs from the target without writing it, and a derive writes exactly those differences [k2 property]", () => {
  const root = mkdtempSync(join(tmpdir(), "derived-differences-"));
  const write = (base: string, path: string, text: string) => (mkdirSync(dirname(join(root, base, path)), { recursive: true }), writeFileSync(join(root, base, path), text));
  const [pins, clips, facts] = [`${DERIVED_PATHS[0]}/kobold`, `${DERIVED_PATHS[2]}/kobold.ts`, `${DERIVED_PATHS[4]}/old.json`];
  write("target", pins, "old"), write("target", clips, "same"), write("target", facts, "dropped"), write("target", "ts/src/game/rules.ts", "kept");
  write("scratch", pins, "new"), write("scratch", clips, "same"), write("scratch", "ts/src/game/rules.ts", "edited");
  try {
    expect(derivedDifferences(join(root, "scratch"), join(root, "target"), false)).toEqual([pins, facts].sort());
    expect(readFileSync(join(root, "target", pins), "utf8")).toBe("old");
    expect(derivedDifferences(join(root, "scratch"), join(root, "target"), true)).toEqual([pins, facts].sort());
    expect(derivedDifferences(join(root, "scratch"), join(root, "target"), false)).toEqual([]);
    expect(readFileSync(join(root, "target", "ts/src/game/rules.ts"), "utf8")).toBe("kept");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

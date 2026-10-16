import { expect, test } from "bun:test";
import { fighterSlug } from "../src/game/sim/heroes/registry";
import { fighters } from "../scripts/heroModelSource";
import { derivedStepCode } from "../scripts/wisp/fighterArt";
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
      `ts/src/generated/clips/${slug}.ts`,
      `ts/src/generated/assets/white-models/${slug}.ts`,
      `ts/src/generated/assets/white-facts/${slug}.ts`,
      `ts/scripts/wisp/model-facts/war3mapImported_${name}TimelineBody-${"0".repeat(64)}.mdx.00000000.json`,
      `ts/scripts/wisp/model-facts/war3mapImported_${name}White-${"0".repeat(64)}.mdx.00000000.json`,
    ];
    for (const path of owned) expect(changedFighters([path], STEP_CODE), path).toEqual([slug]);
  }
  for (const path of [...STEP_CODE, "build-inputs/hero-models/warden", "build-inputs/imported-models"]) expect(changedFighters([path], STEP_CODE), path).toEqual(everyone);
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
  expect(derive(["ts/src/game/presentation/heroes/wardenClipTable.ts"])?.args.filter((arg) => arg !== "--fighter").slice(4)).toEqual(everyone);
  expect(derive(["docs/ci.md"])).toBeUndefined();
  expect(derivedStepCode().has("tools/animations/export-original-clips.ts")).toBe(true);
});

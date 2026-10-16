import { expect, test } from "bun:test";
import { fighterSlug } from "../src/game/sim/heroes/registry";
import { fighters } from "../scripts/heroModelSource";
import { changedFighters } from "../scripts/wisp/fighterArtChanges";
import { checksFor } from "../scripts/prePush";

const roster = [...fighters].map(([character, { name, source }]) => ({ name, source, slug: fighterSlug(character) }));

test("a landing that changes any fighter's pins, generated clips, white files, model facts or source model checks exactly that fighter, and nothing else checks any [k2 property]", () => {
  for (const { name, slug } of roster) {
    const owned = [
      `build-inputs/original-clips-static-lights/${slug}`,
      `build-inputs/impact-assets/${slug}`,
      `build-inputs/hero-models/${slug}`,
      `ts/src/generated/clips/${slug}.ts`,
      `ts/src/generated/assets/white-models/${slug}.ts`,
      `ts/src/generated/assets/white-facts/${slug}.ts`,
      `ts/scripts/wisp/model-facts/war3mapImported_${name}TimelineBody-${"0".repeat(64)}.mdx.00000000.json`,
      `ts/scripts/wisp/model-facts/war3mapImported_${name}White-${"0".repeat(64)}.mdx.00000000.json`,
    ];
    for (const path of owned) expect(changedFighters([path]), path).toEqual([slug]);
  }
  expect(changedFighters(["ts/src/game/sim/heroes/peonMoves.ts", "build-inputs/original-clips-static-lights/shared", "build-inputs/stage-assets", "docs/build-inputs.md"])).toEqual([]);
  for (const family of ["animation-assets", "illidan-animation", "imported-models"]) {
    expect(changedFighters([`build-inputs/${family}`])).toEqual(roster.filter(({ source }) => source.startsWith(`${family}/`)).map(({ slug }) => slug).sort());
  }
});

test("pre-push derives exactly the changed fighters with --check on the private store, and skips landings that change no fighter art [k2 property]", () => {
  const derive = (paths: readonly string[]) => checksFor(paths).find((check) => check.args.includes("derive"));
  const kobold = derive(["build-inputs/original-clips-static-lights/kobold", "ts/src/generated/clips/kobold.ts"]);
  expect(kobold?.args).toEqual(["scripts/wisp.ts", "inputs", "derive", "--check", "--fighter", "kobold"]);
  expect(kobold?.privateStore).toBe(true);
  expect(derive(["ts/src/game/sim/heroes/peonMoves.ts"])).toBeUndefined();
});

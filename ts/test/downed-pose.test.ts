import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { INPUTS_STORE, assetsView, pinHashes, readManifest } from "../scripts/wisp/buildInputs";
import { DrawnModel } from "../scripts/wisp/drawnModel";
import { originalClip } from "../src/generated/clips/fighterOriginalClipInfo";
import { clipFor } from "../src/game/presentation/fighterClips";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";

const manifest = Effect.runSync(readManifest());
const stored = pinHashes(manifest["original-clips-static-lights"]).every((hash) => existsSync(join(INPUTS_STORE, "original-clips-static-lights", hash)));

test("every fighter's downed frame, where play and the results screen hold a knocked-down fighter, still draws its whole body [k3 measure #31]", async () => {
  if (!stored) return;
  const family = join(assetsView(manifest), "original-clips-static-lights", "imports");
  const faded: string[] = [];
  for (const character of SELECTABLE_CHARACTERS) {
    const knockdown = clipFor(character, "knockdown");
    const clip = originalClip(character, knockdown.index);
    if (clip === undefined) { faded.push(`${fighterName(character)}: no knockdown clip ${knockdown.index}`); continue; }
    const model = new DrawnModel(await Bun.file(join(family, ...clip.modelPath.split("\\"))).arrayBuffer(), 1);
    const start = clip.timeline === true ? clip.startSeconds : 0;
    const resting = Math.min(knockdown.seconds, clip.endSeconds - clip.startSeconds - 1 / 60);
    const [first, held] = [model.triangles(0, start, 1).length, model.triangles(0, start + resting, 1).length];
    if (held < first * 0.9) faded.push(`${fighterName(character)}: ${held / 2} of ${first / 2} drawn vertices at ${resting.toFixed(3)}s into its knockdown`);
  }
  expect(faded).toEqual([]);
}, 120_000);

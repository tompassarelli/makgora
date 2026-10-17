import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { parseMDX } from "war3-model";
import { INPUTS_STORE, assetsView, pinHashes, readManifest } from "../scripts/wisp/buildInputs";
import { originalClip, originalClipNamed } from "../src/generated/clips/fighterOriginalClipInfo";
import { victoryAnimation } from "../src/game/presentation/matchAudio";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";

const manifest = Effect.runSync(readManifest());
const stored = pinHashes(manifest["original-clips-static-lights"]).every((hash) => existsSync(join(INPUTS_STORE, "original-clips-static-lights", hash)));

test("every fighter's victory clip ends inside the Classic timeline body that plays it [k3 measure #31]", async () => {
  if (!stored) return;
  const family = join(assetsView(manifest), "original-clips-static-lights", "imports");
  const past: string[] = [];
  for (const character of SELECTABLE_CHARACTERS) {
    const index = originalClipNamed(character, victoryAnimation(character));
    const clip = index === undefined ? undefined : originalClip(character, index);
    if (clip === undefined) { past.push(`${fighterName(character)}: no "${victoryAnimation(character)}" clip`); continue; }
    if (clip.timeline !== true) continue;
    const path = join(family, ...clip.modelPath.split("\\"));
    if (!existsSync(path)) { past.push(`${fighterName(character)}: no body ${clip.modelPath}`); continue; }
    const body = parseMDX(await Bun.file(path).arrayBuffer());
    const end = Math.max(...body.Sequences.map((sequence) => sequence.Interval[1]!));
    if (Math.round(clip.endSeconds * 1000) > end) past.push(`${fighterName(character)}: "${victoryAnimation(character)}" ends at ${Math.round(clip.endSeconds * 1000)} ms, its body at ${end} ms`);
  }
  expect(past).toEqual([]);
}, 60_000);

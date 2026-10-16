import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { parseMDX } from "war3-model";
import { RAISED_FRAME, UPRIGHT_LIMIT_DEGREES, torsoLean } from "../scripts/wisp/victoryTorso";
import { fighters } from "../scripts/heroModelSource";
import { INPUTS_STORE, assetsView, pinHashes, readManifest } from "../scripts/wisp/buildInputs";
import { victoryAnimation } from "../src/game/presentation/matchAudio";

const manifest = Effect.runSync(readManifest());
const authored = [...fighters].filter(([character, fighter]) => victoryAnimation(character) === `${fighter.name.toLowerCase()} victory`);
const families = new Set(authored.map(([, fighter]) => fighter.source.split("/")[0]!));
const stored = [...families].every((family) => pinHashes(manifest[family]).every((hash) => existsSync(join(INPUTS_STORE, family, hash))));

test("every authored victory cheer holds the torso within 30 degrees of upright on its raised beat [k3 measure #31]", async () => {
  if (!stored) return;
  expect(authored.length).toBeGreaterThan(0);
  const hunched: string[] = [];
  for (const [, fighter] of authored) {
    const model = parseMDX(await Bun.file(join(assetsView(manifest), fighter.source)).arrayBuffer());
    const sequence = model.Sequences.findIndex((candidate) => candidate.Name.trim().toLowerCase() === `${fighter.name.toLowerCase()} victory`);
    if (sequence < 0) { hunched.push(`${fighter.name}: no ${fighter.name} Victory sequence`); continue; }
    const lean = torsoLean(model, sequence, Math.round(RAISED_FRAME * 1000 / 60));
    if (!(lean <= UPRIGHT_LIMIT_DEGREES)) hunched.push(`${fighter.name}: ${lean.toFixed(0)} degrees`);
  }
  expect(hunched).toEqual([]);
}, 60_000);

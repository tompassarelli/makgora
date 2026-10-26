import { mkdirSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { generateMDX, parseMDX, model as mdx } from "war3-model";
import { Character } from "../../ts/src/game/sim/codes";
import { characterModelScale } from "../../ts/src/game/presentation/modelScale";
import { ensure, onGlobalClock, tracks } from "./original-clips";
import { FIGHTER_RIGS } from "./rigs";
import { WEAPON_CLEAR_MARGIN, clearWeapon } from "./weapon-clearance";

const [input, fighter, output, ...names] = process.argv.slice(2);
const project = resolve(import.meta.dir, "../..");
ensure(input && fighter && output && names.length > 0 && relative(project, resolve(output)).startsWith(".."), "usage: bun tools/animations/weapon-clear.ts SHIPPED.mdx FIGHTER PRIVATE_OUTPUT SEQUENCE...");
const character = Character[fighter as keyof typeof Character], rig = FIGHTER_RIGS.get(character);
ensure(rig, `${fighter}: no Classic rig`);
const source = parseMDX(await Bun.file(input).arrayBuffer()), model = structuredClone(source), scale = characterModelScale(character);
const sequences = names.flatMap((name) => { const found = model.Sequences.flatMap((sequence, index) => sequence.Name === name ? [index] : []); ensure(found.length > 0, `${name}: no such sequence`); return found; });
for (const index of sequences) console.log(`${model.Sequences[index]!.Name}\t${clearWeapon(model, rig, scale, index, WEAPON_CLEAR_MARGIN).toFixed(3)}`);
const outside = (m: mdx.Model) => {
  const copy = structuredClone(m);
  tracks(copy, (track) => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter((key) => !sequences.some((index) => key.Frame >= source.Sequences[index]!.Interval[0]! && key.Frame <= source.Sequences[index]!.Interval[1]!)); });
  return copy;
};
ensure(isDeepStrictEqual(outside(model), outside(source)), "Clearing the weapon changed a sequence that was not named");
const bytes = generateMDX(model), decoded = parseMDX(bytes);
ensure(isDeepStrictEqual(parseMDX(generateMDX(decoded)), decoded), "MDX round trip changed model");
mkdirSync(resolve(output), { recursive: true });
await Bun.write(join(resolve(output), basename(input)), bytes);
console.log(`WEAPON_CLEAR_PASS ${sequences.length} sequences; ${join(resolve(output), basename(input))}`);




import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { INPUTS_STORE, assetsView, pinHashes, readManifest } from "../scripts/wisp/buildInputs";
import { DrawnModel } from "../scripts/wisp/drawnModel";
import { sampleState } from "../scripts/wisp/hurtboxView";
import { originalClip } from "../src/generated/clips/fighterOriginalClipInfo";
import { characterModelScale } from "../src/game/presentation/modelScale";
import { Character } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/sim/heroes/registry";


const LOWEST = 0.9;

const HIGHEST = 1.3;

const DEPARTURES: { readonly [character: number]: string } = {
  [Character.blademaster]: "the banner on his back stands about 60 units over his head",
  [Character.lichKing]: "Frostmourne, raised in Stand Ready, stands about 50 units over his helm; the blade is never body",
  [Character.cairne]: "the carried back totem rises above his head and chest",
  [Character.chen]: "his hat rises about 12 units above his drawn head",
  [Character.tinker]: "the raised backpack claw extends above the goblin and lower backpack body",
  [Character.grom]: "the carried banner rises about 50 units above his drawn head",
  [Character.malfurion]: "the carried staff rises above his drawn head",
};

/** The highest drawn point over the Stand hurt capsules' horizontal span, so side props and wings don't count. */
function drawnHeight(triangles: Float32Array, half: number): number {
  let top = Number.NEGATIVE_INFINITY;
  for (let at = 0; at < triangles.length; at += 6) {
    for (let a = 0; a <= 8; a++) for (let b = 0; b <= 8 - a; b++) {
      const u = a / 8, v = b / 8, w = 1 - u - v;
      const x = (triangles[at] ?? 0) * u + (triangles[at + 2] ?? 0) * v + (triangles[at + 4] ?? 0) * w;
      const z = (triangles[at + 1] ?? 0) * u + (triangles[at + 3] ?? 0) * v + (triangles[at + 5] ?? 0) * w;
      if (Math.abs(x) <= half && z > top) top = z;
    }
  }
  return top;
}


const manifest = Effect.runSync(readManifest());
const POOL = "original-clips-static-lights";
test("every fighter's drawn Stand height fits its hurt capsule [k3 measure docs/design/hurtbox-legibility.md]", async () => {
  const pinned = pinHashes(manifest[POOL]);
  const missing = pinned.filter((hash) => !existsSync(join(INPUTS_STORE, POOL, hash)));
  if (missing.length === pinned.length) return;
  expect(missing, `pinned ${POOL} shards missing from ${INPUTS_STORE}`).toEqual([]);
  const family = join(assetsView(manifest), POOL);
  const off: string[] = [];
  for (const character of SELECTABLE_CHARACTERS) {
    const frame = sampleState(character, false, 1);
    const clip = frame.clip === undefined ? undefined : originalClip(character, frame.clip);
    if (clip === undefined) { off.push(`${fighterSlug(character)}: no Stand clip`); continue; }
    const half = Math.max(...frame.parts.map((part) => Math.max(Math.abs(part.x1), Math.abs(part.x2)) + part.radius));
    const hurt = Math.max(...frame.parts.map((part) => Math.max(part.z1, part.z2) + part.radius)) - frame.z;
    const body = (originalClip(character, 0)?.modelPath ?? "").split("\\");
    const height = async (path: string) => drawnHeight(new DrawnModel(await Bun.file(path).arrayBuffer(), characterModelScale(character)).triangles(0, clip.startSeconds + frame.seconds, 1), half);
    const classic = await height(join(family, "imports", ...body));
    const ratio = classic / hurt;
    if (ratio < LOWEST || (ratio > HIGHEST && DEPARTURES[character] === undefined)) off.push(`${fighterSlug(character)}: drawn ${classic.toFixed(0)} is ${ratio.toFixed(2)} of its hurt top ${hurt.toFixed(0)}`);
  }
  expect(off).toEqual([]);
}, 60_000);

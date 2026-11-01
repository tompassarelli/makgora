import { f32 } from "wisp/src/sim/f32";
import { Character, HitElement } from "../../sim/codes";
import { groundHit } from "../../sim/heroes/groundNormals";
import { HERO_REFERENCE_HEIGHT } from "../../sim/heroMoves";
import type { AuthoredSpecial, PlacementWalk, SpecialKit, SpecialPlacement, SpecialProjectile } from "../../sim/specials/schema";
import { standinCastBody } from "../standin/moves";
import { SUBMERGE_SINK_FRAMES, SUBMERGE_SURFACE_FRAME } from "./specials";

const h = (multiple: number): number => f32(HERO_REFERENCE_HEIGHT * f32(multiple));

export const SPAWN_LIFE = 720;
export const SPAWN_SPLIT_HITS = 5;
export const SPAWN_FIRST_SHOT = 45;
export const SPAWN_SHOT_EVERY = 65;
export const SPAWN_DURABILITY = 10.0;
export const SPAWN_CAST_FRAME = 30;
export const SPAWN_END_FRAME = 57;
export const SPAWN_APART = h(f32(0.35));
export const FIREBALL_SPEED = h(f32(0.09));
export const FIREBALL_DAMAGE = 5.0;
export const FIREBALL_LIFE = 50;

export const SPAWN_WALK: PlacementWalk = {
  near: h(f32(0.6)), far: h(f32(1.5)), spacing: SPAWN_APART, speed: h(f32(0.035)), range: h(f32(3.5)),
  strandedFrames: 30, underFrames: SUBMERGE_SURFACE_FRAME - 1, riseFrames: SUBMERGE_SINK_FRAMES,
};

const SPAWN_MODEL = "Units\\Creeps\\LavaSpawn\\LavaSpawn.mdl";
const FIREBALL_MODEL = "Abilities\\Weapons\\LavaSpawnMissile\\LavaSpawnMissile.mdx";

const shotAges = (): number[] => {
  const ages: number[] = [];
  for (let age = SPAWN_FIRST_SHOT; age < SPAWN_LIFE; age += SPAWN_SHOT_EVERY) ages.push(age);
  return ages;
};

const fireball = (credit: boolean): SpecialProjectile => ({
  model: FIREBALL_MODEL, spawnFrame: 0, offsetX: h(f32(0.2)), offsetZ: 40.0, velocityX: FIREBALL_SPEED, velocityZ: 0.0,
  life: FIREBALL_LIFE, radius: h(f32(0.15)), effect: groundHit(FIREBALL_DAMAGE, 40, 70.0, 16.0, HitElement.fire),
  reflectable: true, limit: 2, ...(credit ? { splitCredit: true as const } : {}),
});

const spawnBody = { radius: 25.0, height: 80.0, life: SPAWN_LIFE, fireAges: shotAges(), aimedSpeed: FIREBALL_SPEED, offsetX: h(f32(0.6)), walks: SPAWN_WALK } as const;

export const LAVA_SPAWN_HALF: SpecialPlacement = {
  ...spawnBody, frame: SPAWN_CAST_FRAME, durability: f32(SPAWN_DURABILITY / 2.0), shot: fireball(false),
  model: { path: SPAWN_MODEL, height: 80.0, alpha: 255 },
};

export const LAVA_SPAWN: SpecialPlacement = {
  ...spawnBody, frame: SPAWN_CAST_FRAME, durability: SPAWN_DURABILITY, shot: fireball(true), refusedWhileOut: true,
  splits: { afterHits: SPAWN_SPLIT_HITS, into: 1, apart: SPAWN_APART, half: LAVA_SPAWN_HALF },
  model: { path: SPAWN_MODEL, height: 80.0, alpha: 255 },
};

const summon: AuthoredSpecial = {
  name: "Summon Lava Spawn", endFrame: SPAWN_END_FRAME, groundOnly: true,
  hurt: standinCastBody(Character.firelord, 8, SPAWN_CAST_FRAME), placement: LAVA_SPAWN,
};

export const SUMMON_LAVA_SPAWN: SpecialKit = {
  name: "Summon Lava Spawn",
  description: "Calls one lava spawn that lobs fireballs at the nearest foe for twelve seconds. It walks after him on its floor, sinks and resurfaces beside him when he submerges, and re-forms beside him when he leaves its floor. After five of its fireballs land it splits once into two. It can be hit and killed, and its fireballs reflect. Pressing again while it is out does nothing.",
  ground: summon,
};

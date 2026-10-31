import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";

export interface OrbitRingStep {
  readonly radius: number;
  readonly scale: number;
}

export interface OrbitRing {
  readonly style: AttackStyle;
  readonly model: string;
  readonly count: number;
  readonly centreZ: number;
  readonly spin: number;
  readonly shardScale: number;
  readonly steps: readonly (OrbitRingStep | undefined)[];
}

export const FROST_HALO_RADIUS = 50.0;
export const FROST_HALO_CENTRE = 70.0;

const HIT_WINDOWS: readonly (readonly [number, number])[] = [[8, 10], [12, 14], [16, 18]];
const BURST_FRAME = 20;

function haloSteps(): (OrbitRingStep | undefined)[] {
  const steps: (OrbitRingStep | undefined)[] = [];
  const set = (frame: number, radius: number, scale: number): void => { steps[frame] = { radius: f32(radius), scale: f32(scale) }; };
  set(5, 30.0, 0.5);
  set(6, 36.0, f32(0.6));
  set(7, 43.0, 0.75);
  for (const [first, last] of HIT_WINDOWS) {
    for (let frame = first; frame <= last; frame++) set(frame, FROST_HALO_RADIUS, frame === first ? f32(1.3) : 1.0);
    set(last + 1, 44.0, f32(0.7));
  }
  set(BURST_FRAME, FROST_HALO_RADIUS, f32(1.4));
  set(BURST_FRAME + 1, FROST_HALO_RADIUS + 4.0, 1.5);
  set(BURST_FRAME + 2, 84.0, f32(1.3));
  set(BURST_FRAME + 3, 118.0, f32(0.8));
  return steps;
}

export const LICH_FROST_HALO: OrbitRing = {
  style: AttackStyle.neutralAir,
  model: "Abilities\\Spells\\Other\\FrostBolt\\FrostBoltMissile.mdx",
  count: 12,
  centreZ: FROST_HALO_CENTRE,
  spin: f32(0.13),
  shardScale: f32(0.5),
  steps: haloSteps(),
};

const TAU = f32(6.283185307);

export const ORBIT_RING_CAPACITY = 12;

export const ORBIT_RINGS: { readonly [character: number]: OrbitRing } = {
  [Character.lich]: LICH_FROST_HALO,
};

export function orbitRingStep(fighter: Readonly<Fighter>): OrbitRingStep | undefined {
  const ring = ORBIT_RINGS[fighter.character];
  if (ring === undefined || fighter.status.out || fighter.attack.style !== ring.style) return undefined;
  return ring.steps[fighter.attack.frame];
}

export function orbitShardAngle(ring: OrbitRing, shard: number, frame: number): number {
  return f32(f32(shard * f32(TAU / ring.count)) + f32(frame * ring.spin));
}

export function orbitRingModels(): readonly string[] {
  return Object.values(ORBIT_RINGS).map(ring => ring.model);
}

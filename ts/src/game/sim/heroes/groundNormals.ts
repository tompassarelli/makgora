






import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, HitElement } from "../codes";
import { type AuthoredMove, type MoveRegion, type StrikeCapsule, heroHurtPose, heroMove, heroRegion, jabStep, tipper, travelThrough } from "../heroMoves";
import type { HitEffect } from "../hitRegions";
import { strongHit } from "../strongHits";
import type { HurtPart, HurtPose } from "../hurtboxes";
import { ANGLES, type Angle } from "./authoring";



export function groundHit(damage: number, angle: Angle, growth: number, base: number, element: HitElement, behind = false): Readonly<HitEffect> {
  const direction = ANGLES[angle];
  return { damage, growth, base, launchX: behind ? -direction.x : direction.x, launchZ: direction.z, electric: false, element };
}

export type Segment = readonly [number, number, number, number];
const capsule = ([x1, z1, x2, z2]: Segment, radius: number): StrikeCapsule => ({ x1, z1, x2, z2, radius });


export function swing(first: number, segments: readonly Segment[], radius: number, effect: Readonly<HitEffect>): MoveRegion[] {
  return segments.map((segment, index) => heroRegion(first + index, first + index, capsule(segment, radius), effect));
}






export function tipped(first: number, segments: readonly Segment[], radius: number, tip: number, tipEffect: Readonly<HitEffect>, inner: Readonly<HitEffect>): MoveRegion[] {
  const regions: MoveRegion[] = [];
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    if (segment === undefined) continue;
    const [x1, z1, x2, z2] = segment;
    const t = f32(f32(f32(x2 - x1) - tip) / f32(x2 - x1));
    const splitX = f32(x1 + f32(f32(x2 - x1) * t));
    const splitZ = f32(z1 + f32(f32(z2 - z1) * t));
    const frame = first + index;
    regions.push(heroRegion(frame, frame, capsule([splitX, splitZ, x2, z2], radius), strongHit(tipEffect)));
    regions.push(heroRegion(frame, frame, capsule([x1, z1, splitX, splitZ], radius), inner));
  }
  return regions;
}


export function held(first: number, last: number, segment: Segment, radius: number, effect: Readonly<HitEffect>, window = 1): MoveRegion {
  const region = heroRegion(first, last, capsule(segment, radius), effect);
  return window === 1 ? region : { ...region, hit: { ...region.hit, window } };
}

export interface GroundKit {
  readonly normals: { readonly [style: number]: AuthoredMove };

  readonly reaches: { readonly [style: number]: readonly [number, number] };
}


export function unangled(move: AuthoredMove): { readonly [style: number]: AuthoredMove } {
  return { [AttackStyle.forwardTilt]: move, [AttackStyle.forwardTiltUp]: move, [AttackStyle.forwardTiltDown]: move };
}






export function groundPoses(kit: GroundKit, limb: (x: number, z: number) => readonly HurtPart[]): { [style: number]: readonly HurtPose[] } {
  const poses: { [style: number]: readonly HurtPose[] } = {};
  for (const key in kit.reaches) {
    const style = Number(key);
    const reach = kit.reaches[style];
    const move = kit.normals[style];
    if (reach === undefined || move === undefined) continue;
    const firstActive = move.startupFrames + 1;
    const first = Math.max(1, firstActive - 2);
    const last = Math.min(move.totalFrames, Math.max(first + 2, firstActive + move.activeFrames + 1));
    poses[style] = [heroHurtPose(first, last, limb(reach[0], reach[1]))];
  }
  return poses;
}



const RIFLE = HitElement.normal;
const bayonet = (ends: readonly (readonly [number, number, number])[], angle: Angle) =>
  tipper(swing(7, ends.map(([z1, x, z]): Segment => [18.0, z1, x, z]), 10.0, groundHit(9.300000190734863, angle, 100.44000244140625, 22.0, RIFLE)), 0.30000001192092896);
export const RIFLEMAN_GROUND: GroundKit = {
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(4, 3, 16, 0, swing(4, [[18.0, 50.0, 95.0, 52.0], [18.0, 50.0, 95.0, 50.0], [18.0, 50.0, 90.0, 48.0]], 10.0, groundHit(3.7200000286102295, 20, 41.85000228881836, 18.0, RIFLE)))),
    [AttackStyle.jab2]: heroMove(4, 2, 18, 0, swing(4, [[18.0, 54.0, 100.0, 56.0], [18.0, 52.0, 100.0, 52.0]], 10.0, groundHit(4.650000095367432, 30, 83.70000457763672, 22.0, RIFLE))),
    [AttackStyle.forwardTilt]: heroMove(7, 3, 21, 0, bayonet([[50.0, 112.0, 28.0], [50.0, 112.0, 27.0], [48.0, 108.0, 28.0]], 30)),
    [AttackStyle.forwardTiltUp]: heroMove(7, 3, 21, 0, bayonet([[56.0, 96.0, 94.0], [58.0, 98.0, 92.0], [56.0, 94.0, 90.0]], 50)),
    [AttackStyle.forwardTiltDown]: heroMove(7, 3, 21, 0, bayonet([[34.0, 86.0, -24.0], [32.0, 86.0, -26.0], [30.0, 86.0, -24.0]], 15)),
    [AttackStyle.upTilt]: heroMove(6, 3, 22, 0, swing(6, [[22.0, 68.0, 24.0, 140.0], [22.0, 68.0, 24.0, 140.0], [22.0, 68.0, 24.0, 140.0]], 12.0,
      groundHit(7.440000057220459, 90, 74.4000015258789, 26.0, RIFLE))),
    [AttackStyle.downTilt]: heroMove(7, 3, 22, 0, swing(7, [[32.0, 18.0, 80.0, -30.0], [32.0, 18.0, 80.0, -30.0], [32.0, 18.0, 80.0, -30.0]], 16.0,
      groundHit(9.300000190734863, 80, 41.85000228881836, 50.0, RIFLE))),
    [AttackStyle.dashAttack]: travelThrough(heroMove(9, 8, 22, 0, [...swing(9, [[18.0, 50.0, 112.0, 28.0], [18.0, 50.0, 112.0, 27.0], [18.0, 48.0, 110.0, 28.0]], 10.0,
      groundHit(8.25, 40, 114.0, 22.0, RIFLE)), held(12, 16, [18.0, 48.0, 108.0, 30.0], 10.0, groundHit(6.0, 40, 100.0, 20.0, RIFLE))], 120.0, true), 16),
  },
  reaches: {},
};

export interface Splits {
  readonly firstActive: number;
  readonly active: number;
  readonly recovery: number;
  readonly chargeFrame: number;
  readonly hip: number;
  readonly reach: number;
  readonly height: number;
  readonly radius: number;
  readonly front: Readonly<HitEffect>;
  readonly back: Readonly<HitEffect>;
}

export function splitsMove({ firstActive, active, recovery, chargeFrame, hip, reach, height, radius, front, back }: Splits): AuthoredMove {
  const last = firstActive + active - 1;
  return {
    ...heroMove(firstActive, active, recovery, 0, [
      heroRegion(firstActive, last, capsule([hip, height, reach, height], radius), front),
      heroRegion(firstActive, last, capsule([-hip, height, -reach, height], radius), back),
    ]),
    chargeFrame,
  };
}

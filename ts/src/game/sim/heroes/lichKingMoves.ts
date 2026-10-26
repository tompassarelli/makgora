import { downSmashHit } from "../downMoveValues";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction, HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT, jabStep, heroHurtPose, heroMove, heroRegion, type FighterMoves, type MoveRegion } from "../heroMoves";
import type { HitEffect } from "../hitRegions";
import { strongHit } from "../strongHits";
import { type FighterHurtboxes, hurtPart, hurtPose } from "../hurtboxes";
import { capsuleOf, limbOf, makeHit, path, reaching } from "./authoring";





const S = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
const M = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
const L = f32(HERO_REFERENCE_HEIGHT * f32(1.10));
const XL = f32(HERO_REFERENCE_HEIGHT * f32(1.35));
const BLADE_RADIUS = 11.0;


export const hit = makeHit({
  LINK: { growth: 42.5, base: 14.0 },
  POKE: { growth: 63.75, base: 18.0 },
  LAUNCH: { growth: 80.75, base: 20.0 },
  EDGE: { growth: 80.75, base: 22.0 },
  KILL: { growth: 85.0, base: 24.0 },
  SPIKE: { growth: 85.0, base: 22.0 },

  JUGGLE: { growth: 46.75, base: 50.0 },
  CHASE: { growth: 34.0, base: 75.0 },
}, HitElement.ice);



export const capsule = capsuleOf(BLADE_RADIUS);




function sweep(first: number, heights: readonly number[], reach: number, effect: Readonly<HitEffect>, facing = 1.0): readonly MoveRegion[] {
  return path(first, heights.map(z => capsule(f32(facing * 36.0), 72.0, f32(facing * f32(reach - BLADE_RADIUS)), z)), effect);
}



const BODY_RADIUS = f32(24.0 * f32(1.12));
const BODY_TOP = f32(f32(4.0 + f32(HERO_REFERENCE_HEIGHT * f32(1.26))) - f32(2.0 * BODY_RADIUS));

const BODY = hurtPart(0.0, 4.0, 0.0, BODY_TOP, BODY_RADIUS);
const ARM_RADIUS = 13.0;
const arm = limbOf(BODY, ARM_RADIUS);

const FORWARD_ARM = arm(20.0, 82.0, 66.0, 76.0);
const LOW_ARM = arm(20.0, 60.0, 64.0, 40.0);
const RAISED_ARM = arm(10.0, 120.0, 22.0, 164.0);
const BACK_ARM = arm(-20.0, 82.0, -66.0, 76.0);

const LICH_KING_BODY: FighterHurtboxes = {
  stand: [BODY],
  attacks: {
    [AttackStyle.jab]: [
      hurtPose(0, 2, [hurtPart(-5.0, 43.0, -5.0, 99.0, 48.0)]),
      hurtPose(3, 5, [hurtPart(-3.0, 51.0, -3.0, 100.0, 52.0)]),
      hurtPose(6, 8, [hurtPart(-1.0, 54.0, -1.0, 77.0, 55.0)]),
      hurtPose(9, 11, [hurtPart(-2.0, 61.0, -2.0, 69.0, 60.0)]),
      hurtPose(12, 14, [hurtPart(-2.0, 61.0, -2.0, 71.0, 60.0)]),
      hurtPose(15, 17, [hurtPart(-1.0, 56.0, -1.0, 78.0, 56.0)]),
      hurtPose(18, 20, [hurtPart(-1.0, 51.0, -1.0, 88.0, 51.0)]),
    ],
    [AttackStyle.jab2]: reaching(7, 3, arm(20.0, 76.0, 58.0, 70.0)),
    [AttackStyle.jab3]: reaching(9, 3, FORWARD_ARM),
    [AttackStyle.forwardTilt]: reaching(11, 4, FORWARD_ARM),
    [AttackStyle.forwardTiltUp]: reaching(11, 4, FORWARD_ARM),
    [AttackStyle.forwardTiltDown]: reaching(11, 4, FORWARD_ARM),
    [AttackStyle.upTilt]: reaching(10, 5, RAISED_ARM),
    [AttackStyle.downTilt]: [heroHurtPose(7, 10, LOW_ARM), heroHurtPose(11, 14, arm(-20.0, 60.0, -64.0, 40.0))],
    [AttackStyle.dashAttack]: reaching(8, 10, arm(20.0, 70.0, 70.0, 66.0)),
    [AttackStyle.forwardSmash]: reaching(19, 4, arm(20.0, 100.0, 72.0, 90.0)),
    [AttackStyle.upSmash]: reaching(18, 8, RAISED_ARM),
    [AttackStyle.downSmash]: [heroHurtPose(15, 19, LOW_ARM), heroHurtPose(20, 24, arm(-20.0, 60.0, -64.0, 40.0))],
    [AttackStyle.neutralAir]: [heroHurtPose(8, 13, FORWARD_ARM), heroHurtPose(14, 19, BACK_ARM)],
    [AttackStyle.forwardAir]: reaching(14, 4, arm(20.0, 96.0, 70.0, 86.0)),
    [AttackStyle.backAir]: reaching(11, 4, BACK_ARM),
    [AttackStyle.upAir]: reaching(10, 5, RAISED_ARM),
    [AttackStyle.downAir]: reaching(18, 5, arm(6.0, 60.0, 10.0, 8.0)),
    [AttackStyle.getupAttack]: [
      hurtPose(0, 2, [hurtPart(30.0, 28.0, 30.0, 28.0, 56.0)]),
      hurtPose(3, 5, [hurtPart(24.0, 24.0, 24.0, 24.0, 60.0)]),
      hurtPose(6, 8, [hurtPart(26.0, 24.0, 26.0, 24.0, 60.0)]),
      hurtPose(9, 11, [hurtPart(24.0, 19.0, 24.0, 19.0, 60.0)]),
      hurtPose(12, 14, [hurtPart(34.0, 24.0, 34.0, 26.0, 59.0)]),
      hurtPose(15, 17, [hurtPart(40.0, 19.0, 40.0, 41.0, 49.0)]),
      hurtPose(18, 20, [hurtPart(41.0, 21.0, 41.0, 40.0, 50.0)]),
      hurtPose(21, 23, [hurtPart(36.0, 21.0, 36.0, 48.0, 50.0)]),
      hurtPose(24, 26, [hurtPart(28.0, 23.0, 28.0, 56.0, 51.0)]),
      hurtPose(27, 29, [hurtPart(22.0, 25.0, 22.0, 61.0, 49.0)]),
      hurtPose(30, 32, [hurtPart(22.0, 27.0, 22.0, 64.0, 50.0)]),
      hurtPose(33, 35, [hurtPart(19.0, 28.0, 19.0, 67.0, 50.0)]),
      hurtPose(36, 38, [hurtPart(15.0, 31.0, 15.0, 75.0, 49.0)]),
      hurtPose(39, 41, [hurtPart(10.0, 36.0, 10.0, 82.0, 49.0)]),
      hurtPose(42, 44, [hurtPart(5.0, 41.0, 5.0, 87.0, 48.0)]),
      hurtPose(45, 48, [hurtPart(1.0, 46.0, 1.0, 92.0, 48.0)]),
    ],
    [AttackStyle.grab]: reaching(9, 2, arm(20.0, 66.0, 72.0, 62.0)),
  },
};

const NO_LAUNCH = { growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;


const FROSTMOURNE_SWEEP = heroMove(11, 4, 21, 0, sweep(11, [150.0, 106.0, 60.0, 16.0], XL, hit(15.0, "EDGE", 35)));

export const LICH_KING_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: LICH_KING_BODY,
  normals: {

    [AttackStyle.jab]: { ...jabStep(heroMove(6, 3, 13, 0, path(6, [
      capsule(30.0, 70.0, f32(S + 6.0), 70.0, 12.0),
      capsule(30.0, 66.0, f32(S + 8.0), 64.0, 12.0),
      capsule(30.0, 62.0, f32(S + 6.0), 58.0, 12.0),
    ], hit(3.75, "LINK", 70, 1.0, HitElement.normal)))), inspiredBy: "Ike's jab (a heavy sword's quick check)" },
    [AttackStyle.jab2]: jabStep(heroMove(7, 3, 16, 0, path(7, [
      capsule(30.0, 86.0, f32(M - 6.0), 70.0),
      capsule(30.0, 70.0, f32(M - 6.0), 54.0),
      capsule(30.0, 56.0, f32(M - 8.0), 40.0),
    ], hit(3.75, "LINK", 80)))),
    [AttackStyle.jab3]: heroMove(9, 3, 20, 0, path(9, [
      capsule(30.0, 70.0, f32(L - 10.0), 68.0),
      capsule(30.0, 68.0, f32(L - 4.0), 66.0),
      capsule(30.0, 66.0, f32(L - 10.0), 64.0),
    ], hit(6.25, "POKE", 40))),
    [AttackStyle.forwardTilt]: { ...FROSTMOURNE_SWEEP, inspiredBy: "Byleth's forward tilt (a non-angled weapon arc)" },
    [AttackStyle.forwardTiltUp]: FROSTMOURNE_SWEEP,
    [AttackStyle.forwardTiltDown]: FROSTMOURNE_SWEEP,

    [AttackStyle.upTilt]: { ...heroMove(10, 5, 20, 0, path(10, [
      capsule(50.0, 110.0, 100.0, 150.0),
      capsule(30.0, 120.0, 50.0, f32(L + 36.0)),
      capsule(0.0, 120.0, 0.0, f32(L + 46.0)),
      capsule(-30.0, 120.0, -50.0, f32(L + 36.0)),
      capsule(-50.0, 110.0, -100.0, 150.0),
    ], hit(13.75, "LAUNCH", 85))), inspiredBy: "Marth's up tilt (an arc that covers behind)" },

    [AttackStyle.downTilt]: { ...heroMove(9, 4, 19, 0, [
      ...path(9, [
        capsule(30.0, 18.0, f32(L - 14.0), 10.0, 13.0),
        capsule(30.0, 14.0, f32(L - 14.0), 6.0, 13.0),
      ], hit(7.5, "POKE", 25)),
      ...path(11, [
        capsule(-30.0, 18.0, -f32(M + 10.0), 10.0, 13.0),
        capsule(-30.0, 14.0, -f32(M + 10.0), 6.0, 13.0),
      ], hit(7.5, "POKE", 25, -1.0)),
    ]), inspiredBy: "Two-sided sweeps (Ganondorf's and Ike's down smashes, at tilt speed)" },

    [AttackStyle.dashAttack]: { ...heroMove(8, 10, 21, 0, [...path(8, [
      capsule(20.0, 66.0, f32(L - 4.0), 64.0, 13.0),
      capsule(20.0, 64.0, f32(L - 4.0), 62.0, 13.0),
      capsule(20.0, 62.0, f32(L - 8.0), 60.0, 12.0),
      capsule(20.0, 60.0, f32(L - 12.0), 58.0, 12.0),
    ], { ...hit(13.75, "LAUNCH", 55), growth: 88.0 }), heroRegion(12, 17, capsule(20.0, 60.0, f32(L - 12.0), 58.0, 12.0), { ...hit(13.75, "LAUNCH", 55), growth: 88.0 })], 40.0, true), inspiredBy: "Arthas's charge at Stratholme" },

    [AttackStyle.forwardSmash]: { ...heroMove(19, 4, 38, 0, [
      ...[130.0, 96.0, 60.0, 16.0].map((z, index) => heroRegion(19 + index, 19 + index,
        capsule(f32(XL - 46.0), z, f32(XL - 12.0), f32(z - 10.0), 14.0), strongHit(hit(24.75, "KILL", 40)))),
      ...sweep(19, [130.0, 96.0, 60.0, 16.0], f32(XL - 40.0), hit(20.5, "KILL", 40)),
    ]), inspiredBy: "Frostmourne's overhead strike (Warcraft III cinematic)" },

    [AttackStyle.upSmash]: { ...heroMove(18, 8, 35, 0, [
      heroRegion(18, 21, capsule(0.0, 90.0, 0.0, f32(L + 10.0), f32(M - 10.0)), strongHit(hit(18.5, "KILL", 85))),
      heroRegion(22, 25, capsule(0.0, 90.0, 0.0, f32(L + 10.0), f32(M - 20.0)), hit(12.5, "LAUNCH", 80)),
    ]), inspiredBy: "Remorseless Winter (Icecrown Citadel)" },

    [AttackStyle.downSmash]: { ...heroMove(17, 6, 25, 0, [
      ...path(17, [
        capsule(30.0, 16.0, f32(L - 10.0), 14.0, 15.0),
        capsule(30.0, 12.0, f32(L - 10.0), 10.0, 15.0),
        capsule(30.0, 10.0, f32(L - 10.0), 6.0, 15.0),
      ], downSmashHit(hit(15.5, "EDGE", 30, 1.0, HitElement.normal))),
      ...path(20, [
        capsule(-30.0, 16.0, -f32(L - 10.0), 14.0, 15.0),
        capsule(-30.0, 12.0, -f32(L - 10.0), 10.0, 15.0),
        capsule(-30.0, 10.0, -f32(L - 10.0), 6.0, 15.0),
      ], downSmashHit(hit(15.5, "EDGE", 30, -1.0, HitElement.normal))),
    ]), inspiredBy: "Quake (Icecrown Citadel's transition)" },

    [AttackStyle.neutralAir]: heroMove(10, 8, 24, 13, [
      ...path(10, [
        capsule(30.0, 60.0, f32(L - BLADE_RADIUS), 70.0),
        capsule(30.0, 90.0, f32(L - 20.0), 116.0),
        capsule(20.0, 110.0, 30.0, f32(L + 26.0)),
        capsule(0.0, 110.0, -20.0, f32(L + 26.0)),
      ], hit(13.75, "POKE", 50)),
      ...path(14, [
        capsule(-30.0, 90.0, -f32(L - 20.0), 116.0),
        capsule(-30.0, 60.0, -f32(L - BLADE_RADIUS), 70.0),
        capsule(-30.0, 40.0, -f32(L - BLADE_RADIUS), 30.0),
        capsule(-20.0, 20.0, -f32(M - 10.0), 0.0),
      ], hit(13.75, "POKE", 50, -1.0)),
    ]),

    [AttackStyle.forwardAir]: heroMove(14, 4, 30, 17, sweep(14, [130.0, 96.0, 52.0, 14.0], f32(HERO_REFERENCE_HEIGHT * f32(1.2)), hit(16.0, "KILL", 40))),

    [AttackStyle.backAir]: heroMove(11, 4, 26, 15, sweep(11, [110.0, 80.0, 56.0, 34.0], L, hit(16.0, "KILL", 40, -1.0), -1.0)),
    [AttackStyle.upAir]: heroMove(10, 5, 25, 13, path(10, [
      capsule(22.0, 110.0, 40.0, f32(L + 20.0)),
      capsule(12.0, 120.0, 24.0, f32(L + 40.0)),
      capsule(0.0, 120.0, 0.0, f32(L + 46.0)),
      capsule(-12.0, 120.0, -24.0, f32(L + 40.0)),
      capsule(-22.0, 110.0, -40.0, f32(L + 20.0)),
    ], hit(15.0, "LAUNCH", 85))),

    [AttackStyle.downAir]: heroMove(18, 5, 33, 23, path(18, [
      capsule(8.0, 30.0, 8.0, -46.0, 14.0),
      capsule(6.0, 30.0, 6.0, -52.0, 14.0),
      capsule(4.0, 30.0, 4.0, -56.0, 14.0),
      capsule(4.0, 30.0, 4.0, -56.0, 14.0),
      capsule(4.0, 30.0, 4.0, -52.0, 14.0),
    ], hit(17.25, "SPIKE", 270), hit(17.25, "SPIKE", 55))),
    [AttackStyle.grab]: heroMove(9, 2, 27, 0, [heroRegion(9, 10,
      capsule(30.0, 62.0, f32(M - 10.0), 60.0, 13.0),
      { damage: 0.0, ...NO_LAUNCH })]),
  },
  throws: {

    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 3.0, ...NO_LAUNCH } },
    [GrabAction.throwForward]: { contactFrame: 15, totalFrames: 38, effect: { ...hit(12.5, "EDGE", 35, 1.0, HitElement.normal), growth: 36.5, base: 61.0 } },
    [GrabAction.throwBack]: { contactFrame: 18, totalFrames: 46, effect: { ...hit(15.0, "KILL", 40, -1.0, HitElement.normal), growth: 67.0, base: 57.0 } },
    [GrabAction.throwUp]: { contactFrame: 16, totalFrames: 30, effect: hit(10.0, "JUGGLE", 85) },

    [GrabAction.throwDown]: { inspiredBy: "Harvest Soul (Icecrown Citadel)", contactFrame: 24, totalFrames: 50, effect: { ...hit(7.5, "CHASE", 70, 1.0, HitElement.dark), growth: 0.0, base: 0.0, setKnockback: 90.0 } },
  },
};

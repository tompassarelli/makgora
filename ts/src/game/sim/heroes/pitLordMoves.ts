import { downSmashHit } from "../downMoveValues";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction, HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT, jabStep, heroMove, heroRegion, type FighterMoves, type MoveRegion } from "../heroMoves";
import type { HitEffect } from "../hitRegions";
import { strongHit } from "../strongHits";
import { type FighterHurtboxes, hurtPart, hurtPose } from "../hurtboxes";
import { capsuleOf, makeHit, path } from "./authoring";




export const S = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
export const M = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
export const L = f32(HERO_REFERENCE_HEIGHT * f32(1.10));
export const XL = f32(HERO_REFERENCE_HEIGHT * f32(1.40));
const BLADE_RADIUS = 10.0;



export const hit = makeHit({
  LINK: { growth: 48.71746063232422, base: 12.0 },
  POKE: { growth: 66.43289947509766, base: 18.0 },
  LAUNCH: { growth: 84.1483383178711, base: 20.0 },
  EDGE: { growth: 84.1483383178711, base: 22.0 },
  KILL: { growth: 93.00606536865234, base: 24.0 },
  SPIKE: { growth: 88.57719421386719, base: 22.0 },

  JUGGLE: { growth: 48.71746063232422, base: 50.0 },
  CHASE: { growth: 35.43088150024414, base: 75.0 },
}, HitElement.slash);


export const capsule = capsuleOf(BLADE_RADIUS);



function cleave(first: number, heights: readonly number[], reach: number, effect: Readonly<HitEffect>): readonly MoveRegion[] {
  return path(first, heights.map(z => capsule(40.0, 70.0, f32(reach - BLADE_RADIUS), z)), effect);
}





const BODY_RADIUS = f32(24.0 * f32(1.65));
const BODY_TOP = f32(f32(4.0 + f32(HERO_REFERENCE_HEIGHT * f32(1.35))) - f32(2.0 * BODY_RADIUS));
const BODY = hurtPart(0.0, 4.0, 0.0, BODY_TOP, BODY_RADIUS);


const PIT_LORD_BODY: FighterHurtboxes = {
  stand: [BODY],
  attacks: {
    [AttackStyle.jab]: [
      hurtPose(0, 27, [hurtPart(-27.0, 43.0, 14.0, 113.0, 70.0)]),
    ],
    [AttackStyle.jab2]: [
      hurtPose(0, 31, [hurtPart(-42.0, 30.0, 32.0, 103.0, 56.0)]),
    ],
    [AttackStyle.forwardTilt]: [
      hurtPose(0, 50, [hurtPart(-22.0, 54.0, 6.0, 113.0, 75.0)]),
    ],
    [AttackStyle.forwardTiltUp]: [
      hurtPose(0, 8, [hurtPart(-24.0, 30.0, 7.0, 122.0, 73.0)]),
      hurtPose(9, 17, [hurtPart(-20.0, 54.0, 51.0, 110.0, 73.0)]),
      hurtPose(18, 26, [hurtPart(-28.0, 54.0, 51.0, 122.0, 73.0)]),
      hurtPose(27, 35, [hurtPart(-32.0, 58.0, 51.0, 114.0, 73.0)]),
      hurtPose(36, 44, [hurtPart(-38.0, 56.0, 51.0, 116.0, 73.0)]),
      hurtPose(45, 50, [hurtPart(-32.0, 40.0, 27.0, 100.0, 65.0)]),
    ],
    [AttackStyle.forwardTiltDown]: [
      hurtPose(0, 8, [hurtPart(-24.0, 30.0, 7.0, 122.0, 73.0)]),
      hurtPose(9, 17, [hurtPart(-20.0, 54.0, 51.0, 110.0, 73.0)]),
      hurtPose(18, 26, [hurtPart(-28.0, 54.0, 51.0, 122.0, 73.0)]),
      hurtPose(27, 35, [hurtPart(-32.0, 58.0, 51.0, 114.0, 73.0)]),
      hurtPose(36, 44, [hurtPart(-36.0, 56.0, 51.0, 114.0, 73.0)]),
      hurtPose(45, 50, [hurtPart(-32.0, 39.0, 31.0, 98.0, 65.0)]),
    ],
    [AttackStyle.upTilt]: [
      hurtPose(0, 42, [hurtPart(-22.0, 39.0, 22.0, 113.0, 75.0)]),
    ],
    [AttackStyle.downTilt]: [
      hurtPose(0, 6, [hurtPart(-24.0, 30.0, 7.0, 122.0, 73.0)]),
      hurtPose(7, 15, [hurtPart(-20.0, 50.0, 51.0, 102.0, 73.0)]),
      hurtPose(16, 24, [hurtPart(-18.0, 54.0, 51.0, 102.0, 73.0)]),
      hurtPose(25, 35, [hurtPart(-48.0, 24.0, 47.0, 110.0, 49.0)]),
    ],
    [AttackStyle.dashAttack]: [
      hurtPose(0, 53, [hurtPart(-40.0, 20.0, 40.0, 111.0, 48.0)]),
    ],
    [AttackStyle.forwardSmash]: [
      hurtPose(0, 11, [hurtPart(-48.0, 14.0, 16.0, 95.0, 50.0)]),
      hurtPose(12, 23, [hurtPart(-72.0, 22.0, 32.0, 103.0, 52.0)]),
      hurtPose(24, 35, [hurtPart(-72.0, 22.0, 72.0, 111.0, 52.0)]),
      hurtPose(36, 47, [hurtPart(-72.0, 32.0, 72.0, 111.0, 52.0)]),
      hurtPose(48, 59, [hurtPart(-72.0, 32.0, 64.0, 111.0, 52.0)]),
      hurtPose(60, 72, [hurtPart(-64.0, 28.0, 60.0, 111.0, 34.0)]),
    ],
    [AttackStyle.upSmash]: [
      hurtPose(0, 8, [hurtPart(-29.0, 39.0, 9.0, 122.0, 65.0)]),
      hurtPose(9, 13, [hurtPart(-41.0, 35.0, 1.0, 130.0, 65.0)]),
      hurtPose(14, 66, [hurtPart(-31.0, 51.0, 34.0, 106.0, 63.0)]),
    ],
    [AttackStyle.downSmash]: [
      hurtPose(0, 55, [hurtPart(-24.0, 44.0, 27.0, 110.0, 69.0)]),
    ],
    [AttackStyle.neutralAir]: [
      hurtPose(0, 46, [hurtPart(-25.0, 17.0, 28.0, 103.0, 56.0)]),
    ],
    [AttackStyle.forwardAir]: [
      hurtPose(0, 57, [hurtPart(-40.0, 44.0, 40.0, 79.0, 56.0)]),
    ],

    [AttackStyle.backAir]: [
      hurtPose(0, 47, [hurtPart(-22.0, 39.0, 31.0, 113.0, 66.0)]),
    ],
    [AttackStyle.upAir]: [
      hurtPose(0, 41, [hurtPart(-14.0, 39.0, 6.0, 113.0, 75.0)]),
    ],

    [AttackStyle.downAir]: [
      hurtPose(0, 59, [hurtPart(-17.0, 44.0, 6.0, 113.0, 75.0)]),
    ],
    [AttackStyle.grab]: [
      hurtPose(0, 43, [hurtPart(-10.0, 39.0, 6.0, 113.0, 75.0)]),
    ],
    [AttackStyle.jab3]: [
      hurtPose(0, 27, [hurtPart(-39.0, 28.0, 24.0, 103.0, 56.0)]),
    ],
    [AttackStyle.ledgeAttack]: [
      hurtPose(0, 3, [hurtPart(15.0, 20.0, -9.0, 4.0, 74.0), hurtPart(-55.0, 89.0, -55.0, 126.0, 42.0)]),
      hurtPose(4, 17, [hurtPart(-19.0, 92.0, -1.0, 70.0, 103.0)]),
      hurtPose(18, 34, [hurtPart(4.0, 64.0, 12.0, 64.0, 45.0), hurtPart(-20.0, 103.0, 44.0, 113.0, 79.0), hurtPart(60.0, 175.0, 60.0, 175.0, 14.0)]),
      hurtPose(35, 39, [hurtPart(4.0, 64.0, 12.0, 64.0, 45.0), hurtPart(-26.0, 55.0, 24.0, 113.0, 71.0), hurtPart(60.0, 175.0, 60.0, 175.0, 14.0)]),
    ],
  },
};

const NO_LAUNCH = { growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

const CLEAVING_SWEEP = heroMove(13, 4, 35, 0, cleave(13, [150.0, 100.0, 50.0, 10.0], XL, hit(14.43239974975586, "EDGE", 35)));

export const PIT_LORD_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: 1.25,
  hurtboxes: PIT_LORD_BODY,
  normals: {

    [AttackStyle.jab]: jabStep(heroMove(7, 3, 19, 0, path(7, [
      capsule(30.0, 64.0, f32(M - 12.0), 64.0, 12.0),
      capsule(30.0, 60.0, f32(M - 12.0), 58.0, 12.0),
      capsule(30.0, 56.0, f32(M - 16.0), 52.0, 12.0),
    ], hit(7.21619987487793, "LINK", 35, 1.0, HitElement.normal)))),

    [AttackStyle.jab2]: heroMove(8, 3, 22, 0, path(8, [
      capsule(30.0, 90.0, f32(M - 4.0), 70.0),
      capsule(30.0, 70.0, f32(M - 4.0), 50.0),
      capsule(30.0, 56.0, f32(M - 8.0), 36.0),
    ], hit(8.418900489807129, "POKE", 40))),



    [AttackStyle.forwardTilt]: CLEAVING_SWEEP,
    [AttackStyle.forwardTiltUp]: CLEAVING_SWEEP,
    [AttackStyle.forwardTiltDown]: CLEAVING_SWEEP,

    [AttackStyle.upTilt]: heroMove(12, 5, 27, 0, path(12, [
      capsule(50.0, 110.0, 100.0, 150.0),
      capsule(30.0, 120.0, 50.0, f32(L + 40.0)),
      capsule(0.0, 120.0, 0.0, f32(L + 50.0)),
      capsule(-30.0, 120.0, -50.0, f32(L + 40.0)),
      capsule(-50.0, 110.0, -100.0, 150.0),
    ], hit(14.43239974975586, "LAUNCH", 85))),
    [AttackStyle.downTilt]: heroMove(10, 3, 24, 0, path(10, [
      capsule(30.0, 22.0, f32(M - 14.0), 14.0, 14.0),
      capsule(30.0, 18.0, f32(M - 14.0), 8.0, 14.0),
      capsule(30.0, 14.0, f32(M - 14.0), 4.0, 14.0),

    ], hit(12.027000427246094, "EDGE", 340, 1.0, HitElement.normal))),

    [AttackStyle.dashAttack]: heroMove(15, 6, 34, 0, path(15, [
      capsule(20.0, 60.0, f32(L - 30.0), 60.0, 30.0),
      capsule(20.0, 60.0, f32(L - 30.0), 58.0, 30.0),
      capsule(20.0, 58.0, f32(L - 30.0), 56.0, 30.0),
      capsule(20.0, 56.0, f32(L - 32.0), 54.0, 28.0),
      capsule(20.0, 54.0, f32(L - 34.0), 52.0, 26.0),
      capsule(20.0, 52.0, f32(L - 36.0), 50.0, 24.0),
    ], hit(19.24319839477539, "KILL", 40, 1.0, HitElement.normal)), 40.0),

    [AttackStyle.forwardSmash]: heroMove(27, 4, 43, 0, [
      ...[150.0, 100.0, 50.0, 10.0].map((z, index) => heroRegion(27 + index, 27 + index,
        capsule(f32(XL - 55.0), z, f32(XL - 14.0), f32(z - 10.0), 14.0), strongHit(hit(26.375, "KILL", 40)))),
      ...cleave(27, [150.0, 100.0, 50.0, 10.0], f32(XL - 50.0), hit(20.045000076293945, "KILL", 40)),
    ]),

    [AttackStyle.upSmash]: heroMove(24, 5, 41, 0, path(24, [
      capsule(40.0, 90.0, 70.0, f32(XL - 10.0)),
      capsule(20.0, 100.0, 30.0, f32(XL + 20.0)),
      capsule(0.0, 100.0, 0.0, f32(XL + 30.0)),
      capsule(-20.0, 100.0, -30.0, f32(XL + 20.0)),
      capsule(-40.0, 90.0, -70.0, f32(XL - 10.0)),
    ], hit(26.45939826965332, "KILL", 85))),

    [AttackStyle.downSmash]: heroMove(22, 7, 28, 0, [
      ...path(22, [
        capsule(30.0, 14.0, f32(L - 14.0), 14.0, 14.0),
        capsule(30.0, 10.0, f32(L - 14.0), 10.0, 14.0),
        capsule(30.0, 8.0, f32(L - 14.0), 6.0, 14.0),
      ], downSmashHit(hit(19.0, "EDGE", 25, 1.0, HitElement.normal))),
      ...path(26, [
        capsule(-30.0, 14.0, -f32(L - 14.0), 14.0, 14.0),
        capsule(-30.0, 10.0, -f32(L - 14.0), 10.0, 14.0),
        capsule(-30.0, 8.0, -f32(L - 14.0), 6.0, 14.0),
      ], downSmashHit(hit(19.0, "EDGE", 25, -1.0, HitElement.normal))),
    ]),

    [AttackStyle.neutralAir]: heroMove(12, 7, 29, 20, [
      ...path(12, [
        capsule(30.0, 60.0, f32(L - BLADE_RADIUS), 70.0),
        capsule(30.0, 90.0, f32(L - 20.0), 120.0),
        capsule(20.0, 110.0, 30.0, f32(L + 30.0)),
        capsule(0.0, 110.0, -20.0, f32(L + 30.0)),
      ], hit(15.635100364685059, "POKE", 50)),
      ...path(16, [
        capsule(-30.0, 90.0, -f32(L - 20.0), 120.0),
        capsule(-30.0, 60.0, -f32(L - BLADE_RADIUS), 70.0),
        capsule(-30.0, 40.0, -f32(L - BLADE_RADIUS), 30.0),
      ], hit(15.635100364685059, "POKE", 50, -1.0)),
    ]),

    [AttackStyle.forwardAir]: heroMove(19, 4, 36, 25, cleave(19, [130.0, 90.0, 50.0, 15.0], XL, hit(22.851299285888672, "KILL", 40))),

    [AttackStyle.backAir]: heroMove(14, 4, 31, 20, path(14, [
      capsule(-30.0, 30.0, -f32(L - 14.0), 24.0, 14.0),
      capsule(-30.0, 34.0, -f32(L - 14.0), 34.0, 14.0),
      capsule(-30.0, 38.0, -f32(L - 14.0), 46.0, 14.0),
      capsule(-30.0, 40.0, -f32(L - 14.0), 56.0, 14.0),
    ], hit(18.04050064086914, "EDGE", 35, -1.0, HitElement.normal))),

    [AttackStyle.upAir]: heroMove(11, 4, 28, 18, path(11, [
      capsule(10.0, 130.0, 14.0, f32(M + 70.0), 18.0),
      capsule(5.0, 130.0, 7.0, f32(M + 75.0), 18.0),
      capsule(0.0, 130.0, 0.0, f32(M + 75.0), 18.0),
      capsule(-5.0, 130.0, -7.0, f32(M + 70.0), 18.0),
    ], hit(14.43239974975586, "LAUNCH", 85, 1.0, HitElement.normal))),

    [AttackStyle.downAir]: heroMove(20, 5, 38, 28, path(20, [
      capsule(-20.0, 10.0, -20.0, -62.0, 18.0),
      capsule(-10.0, 10.0, -10.0, -62.0, 18.0),
      capsule(0.0, 10.0, 0.0, -62.0, 18.0),
      capsule(10.0, 10.0, 10.0, -62.0, 18.0),
      capsule(20.0, 10.0, 20.0, -62.0, 18.0),
    ], hit(21.64859962463379, "SPIKE", 270, 1.0, HitElement.normal), hit(21.64859962463379, "SPIKE", 55, 1.0, HitElement.normal))),

    [AttackStyle.grab]: heroMove(10, 3, 32, 0, [heroRegion(10, 12,
      capsule(30.0, 58.0, f32(M - 12.0), 56.0, 12.0),
      { damage: 0.0, ...NO_LAUNCH })]),
  },
  throws: {

    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 3.0, ...NO_LAUNCH } },
    [GrabAction.throwForward]: { contactFrame: 17, totalFrames: 44, effect: hit(13.22969913482666, "EDGE", 35, 1.0, HitElement.normal) },
    [GrabAction.throwBack]: { contactFrame: 22, totalFrames: 54, effect: hit(14.43239974975586, "KILL", 40, -1.0, HitElement.normal) },
    [GrabAction.throwUp]: { contactFrame: 20, totalFrames: 30, effect: hit(10.600000381469727, "JUGGLE", 85, 1.0, HitElement.normal) },
    [GrabAction.throwDown]: { contactFrame: 23, totalFrames: 50, effect: hit(9.621599197387695, "CHASE", 70, 1.0, HitElement.normal) },
  },
};

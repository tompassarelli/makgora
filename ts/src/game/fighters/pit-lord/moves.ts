import { downSmashHit } from "../../sim/downMoveValues";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction, HitElement } from "../../sim/codes";
import { HERO_REFERENCE_HEIGHT, jabStep, heroMove, heroRegion, type FighterMoves, type MoveRegion } from "../../sim/heroMoves";
import type { HitEffect } from "../../sim/hitRegions";
import { strongHit } from "../../sim/strongHits";
import { type FighterHurtboxes, hurtPart, hurtPose } from "../../sim/hurtboxes";
import { capsuleOf, makeHit, path } from "../../sim/heroes/authoring";




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



type Blade = readonly [gripX: number, gripZ: number, tipX: number, tipZ: number];

const along = (blades: readonly Blade[], radius: number | readonly number[] = BLADE_RADIUS) =>
  blades.map(([gripX, gripZ, tipX, tipZ], index) => capsule(gripX, gripZ, tipX, tipZ, typeof radius === "number" ? radius : radius[index]));

function sweep(first: number, blades: readonly Blade[], effect: Readonly<HitEffect>): readonly MoveRegion[] {
  return path(first, along(blades), effect);
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
      hurtPose(0, 48, [hurtPart(-22.0, 54.0, 6.0, 113.0, 75.0)]),
    ],
    [AttackStyle.forwardTiltUp]: [
      hurtPose(0, 8, [hurtPart(-24.0, 30.0, 7.0, 122.0, 73.0)]),
      hurtPose(9, 17, [hurtPart(-20.0, 54.0, 51.0, 110.0, 73.0)]),
      hurtPose(18, 26, [hurtPart(-28.0, 54.0, 51.0, 122.0, 73.0)]),
      hurtPose(27, 35, [hurtPart(-32.0, 58.0, 51.0, 114.0, 73.0)]),
      hurtPose(36, 44, [hurtPart(-38.0, 56.0, 51.0, 116.0, 73.0)]),
      hurtPose(45, 48, [hurtPart(-32.0, 40.0, 27.0, 100.0, 65.0)]),
    ],
    [AttackStyle.forwardTiltDown]: [
      hurtPose(0, 8, [hurtPart(-24.0, 30.0, 7.0, 122.0, 73.0)]),
      hurtPose(9, 17, [hurtPart(-20.0, 54.0, 51.0, 110.0, 73.0)]),
      hurtPose(18, 26, [hurtPart(-28.0, 54.0, 51.0, 122.0, 73.0)]),
      hurtPose(27, 35, [hurtPart(-32.0, 58.0, 51.0, 114.0, 73.0)]),
      hurtPose(36, 44, [hurtPart(-36.0, 56.0, 51.0, 114.0, 73.0)]),
      hurtPose(45, 48, [hurtPart(-32.0, 39.0, 31.0, 98.0, 65.0)]),
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
      hurtPose(0, 39, [hurtPart(-40.0, 20.0, 40.0, 111.0, 48.0)]),
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

const cleavingSweep = (blades: readonly Blade[]) => heroMove(13, 4, 33, 0, sweep(13, blades, hit(14.43239974975586, "EDGE", 35)));
const RISING_SWEEP = cleavingSweep([[139, 110, 298, 127], [30, 84, 288, 144], [30, 82, 273, 161], [151, 122, 255, 177]]);

export const PIT_LORD_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: PIT_LORD_BODY,
  normals: {

    [AttackStyle.jab]: jabStep(heroMove(7, 3, 19, 0, path(7, along([[85, 98, 259, 47], [30, 109, 257, 59], [30, 106, 253, 71]], 12.0),
      hit(7.21619987487793, "LINK", 35, 1.0, HitElement.normal)))),

    [AttackStyle.jab2]: heroMove(8, 3, 22, 0, sweep(8, [[85, 98, 259, 47], [30, 109, 257, 58], [30, 104, 254, 68]], hit(8.418900489807129, "POKE", 40))),



    [AttackStyle.forwardTilt]: cleavingSweep([[129, 145, 165, 205], [126, 73, 66, 242], [145, 95, 7, 213], [147, 100, -1, 206]]),
    [AttackStyle.forwardTiltUp]: RISING_SWEEP,
    [AttackStyle.forwardTiltDown]: RISING_SWEEP,

    [AttackStyle.upTilt]: heroMove(12, 5, 27, 0, sweep(12, [[72, 168, 102, 349], [72, 169, 100, 350], [73, 169, 99, 350], [73, 169, 98, 351], [73, 169, 98, 351]],
      hit(14.43239974975586, "LAUNCH", 85))),
    [AttackStyle.downTilt]: heroMove(10, 3, 24, 0, path(10, along([[139, 110, 298, 127], [30, 94, 283, 150], [150, 121, 260, 173]], 14.0),
      hit(12.027000427246094, "EDGE", 340, 1.0, HitElement.normal))),

    [AttackStyle.dashAttack]: heroMove(9, 8, 24, 0, path(9, along([[83, 80, 234, 88], [30, 76, 235, 87], [30, 75, 230, 85], [30, 76, 220, 80], [22, 75, 204, 72], [5, 74, 181, 62], [-12, 73, 150, 50], [-28, 73, 113, 35]], [30.0, 30.0, 30.0, 28.0, 26.0, 24.0, 24.0, 24.0]),
      hit(19.24319839477539, "KILL", 40, 1.0, HitElement.normal)), 40.0),

    [AttackStyle.forwardSmash]: heroMove(27, 4, 43, 0, [
      ...along([[234, 120, 298, 127], [233, 128, 291, 140], [226, 140, 280, 154], [220, 149, 267, 167]], 14.0).map((strike, index) =>
        heroRegion(27 + index, 27 + index, strike, strongHit(hit(26.375, "KILL", 40)))),
      ...sweep(27, [[30, 30, 234, 120], [30, 30, 233, 128], [30, 30, 226, 140], [30, 30, 220, 149]], hit(20.045000076293945, "KILL", 40)),
    ]),

    [AttackStyle.upSmash]: heroMove(24, 5, 41, 0, sweep(24, [[116, 111, 129, 294], [114, 114, 125, 297], [112, 116, 122, 299], [111, 117, 120, 300], [110, 118, 119, 300]],
      hit(26.45939826965332, "KILL", 85))),

    [AttackStyle.downSmash]: heroMove(22, 7, 28, 0, [
      ...path(22, along([[83, 80, 234, 88], [30, 76, 235, 86], [30, 75, 231, 85]], 14.0), downSmashHit(hit(19.0, "EDGE", 25, 1.0, HitElement.normal))),
      ...path(26, along([[28, 75, 211, 74], [12, 75, 192, 66], [-3, 74, 167, 56]], 14.0), downSmashHit(hit(19.0, "EDGE", 25, -1.0, HitElement.normal))),
    ]),

    [AttackStyle.neutralAir]: heroMove(12, 7, 29, 20, [
      ...sweep(12, [[79, 108, 84, 282], [78, 105, 90, 279], [76, 102, 96, 276], [74, 99, 102, 272]], hit(15.635100364685059, "POKE", 50)),
      ...sweep(16, [[72, 97, 108, 268], [71, 94, 114, 264], [69, 92, 119, 260]], hit(15.635100364685059, "POKE", 50, -1.0)),
    ]),

    [AttackStyle.forwardAir]: heroMove(19, 4, 36, 25, sweep(19, [[105, 76, 267, 97], [30, 66, 267, 99], [30, 65, 266, 101], [30, 65, 266, 102]], hit(22.851299285888672, "KILL", 40))),

    [AttackStyle.backAir]: heroMove(14, 4, 31, 20, path(14, along([[-41, 142, -222, 130], [-38, 143, -218, 137], [-46, 129, -215, 140], [-45, 129, -213, 137]], 14.0),
      hit(18.04050064086914, "EDGE", 35, -1.0, HitElement.normal))),

    [AttackStyle.upAir]: heroMove(11, 4, 28, 18, path(11, along([[70, 111, 75, 283], [69, 106, 87, 277], [67, 100, 99, 271], [65, 96, 110, 263]], 18.0),
      hit(14.43239974975586, "LAUNCH", 85, 1.0, HitElement.normal))),

    [AttackStyle.downAir]: heroMove(20, 5, 38, 28, path(20, along([[83, 136, -5, 277], [83, 135, -5, 277], [83, 135, -5, 277], [83, 135, -5, 277], [83, 135, -5, 277]], 18.0),
      hit(21.64859962463379, "SPIKE", 270, 1.0, HitElement.normal), hit(21.64859962463379, "SPIKE", 55, 1.0, HitElement.normal))),

    [AttackStyle.grab]: heroMove(10, 3, 32, 0, [heroRegion(10, 12,
      capsule(30.0, 58.0, f32(M - 12.0), 56.0, 12.0),
      { damage: 0.0, ...NO_LAUNCH })]),
  },
  throws: {

    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 3.0, ...NO_LAUNCH } },
    [GrabAction.throwForward]: { contactFrame: 17, totalFrames: 44, effect: { ...hit(13.22969913482666, "EDGE", 35, 1.0, HitElement.normal), growth: 43.0, base: 61.0 } },
    [GrabAction.throwBack]: { contactFrame: 22, totalFrames: 54, effect: { ...hit(14.43239974975586, "KILL", 40, -1.0, HitElement.normal), growth: 74.5, base: 56.0 } },
    [GrabAction.throwUp]: { contactFrame: 20, totalFrames: 30, effect: hit(10.600000381469727, "JUGGLE", 85, 1.0, HitElement.normal) },
    [GrabAction.throwDown]: { contactFrame: 23, totalFrames: 50, effect: { ...hit(9.621599197387695, "CHASE", 70, 1.0, HitElement.normal), growth: 100.0, base: 0.0, setKnockback: 90.0 } },
  },
};





import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "./codes";
import { downSmashHit } from "./downMoveValues";
import { type FighterMoves, type MoveRegion, heroMove, heroRegion, strongRegion } from "./heroMoves";
import { hurtCapsule } from "./geometry/contactGeometry";
import { RIFLEMAN_GROUND, type GroundKit, groundHit, splitsMove } from "./heroes/groundNormals";
import { DEMON_HUNTER_HURTBOXES, type HurtPose, hurtPart, hurtPose, shippedHurtboxes } from "./hurtboxes";

function originalMoves(character: Character, kit: GroundKit, throws: FighterMoves["throws"] = {}): FighterMoves {
  const moves: FighterMoves = {
    normals: kit.normals,
    throws,
    dashAttack: AttackStyle.dashAttack,
  };
  return { ...moves, hurtboxes: shippedHurtboxes(character, moves) };
}
export const RIFLEMAN_MOVES: FighterMoves = originalMoves(Character.rifleman, RIFLEMAN_GROUND, {
  [GrabAction.throwForward]: { contactFrame: 12, totalFrames: 30, effect: { damage: 7.0, growth: 31.5, base: 84.0, launchX: f32(0.819152044), launchZ: f32(0.573576436), electric: false } },
});


const FEL_KICK = (behind: boolean) => downSmashHit(groundHit(13.0, 25, 95.0, 22.0, HitElement.fire, behind));

export const ROUNDHOUSE_FIRST_ACTIVE = 12;
export const ROUNDHOUSE_STEP = 22.0;
const ROUNDHOUSE_RECOVERY = 24;
const HEEL_RADIUS = 13.0;
const SHIN_RADIUS = 17.0;
const BALL_RADIUS = 13.0;
export const ROUNDHOUSE_HEEL = groundHit(10.0, 45, 85.0, 20.0, HitElement.fire);
export const ROUNDHOUSE_SOUR = groundHit(7.0, 45, 72.0, 17.0, HitElement.normal);

type Point = readonly [x: number, z: number];
interface Leg { readonly knee: Point; readonly ankle: Point; readonly heel: Point; readonly toe: Point }
const leg = (knee: Point, ankle: Point, heel: Point, toe: Point): Leg => ({ knee, ankle, heel, toe });
export const ROUNDHOUSE_LEG: readonly Leg[] = [
  leg([39.5, 102.0], [78.0, 94.0], [87.5, 88.0], [83.5, 122.0]),
  leg([43.0, 99.5], [82.5, 94.5], [91.5, 89.0], [87.0, 122.5]),
  leg([46.5, 95.5], [87.0, 95.0], [94.5, 90.0], [90.5, 123.5]),
  leg([42.5, 99.0], [83.5, 93.0], [92.0, 88.0], [89.0, 121.0]),
  leg([39.0, 100.0], [80.0, 91.0], [88.5, 86.0], [87.5, 118.0]),
];
const ROUNDHOUSE_LAST_ACTIVE = ROUNDHOUSE_FIRST_ACTIVE + ROUNDHOUSE_LEG.length - 1;

const capsule = ([x1, z1]: Point, [x2, z2]: Point, radius: number) => ({ x1, z1, x2, z2, radius });

function roundhouseRegions(): MoveRegion[] {
  return ROUNDHOUSE_LEG.flatMap(({ knee, ankle, heel, toe }, index) => {
    const frame = ROUNDHOUSE_FIRST_ACTIVE + index;
    return [
      strongRegion(heroRegion(frame, frame, capsule(heel, heel, HEEL_RADIUS), ROUNDHOUSE_HEEL)),
      heroRegion(frame, frame, capsule(knee, ankle, SHIN_RADIUS), ROUNDHOUSE_SOUR),
      heroRegion(frame, frame, capsule(ankle, toe, BALL_RADIUS), ROUNDHOUSE_SOUR),
    ];
  });
}

function roundhouseHurtPoses(): readonly HurtPose[] {
  const body = hurtCapsule(Character.demonHunter);
  const { knee, ankle } = ROUNDHOUSE_LEG[2] ?? { knee: [0.0, 0.0], ankle: [0.0, 0.0] };
  return [
    hurtPose(ROUNDHOUSE_FIRST_ACTIVE - 3, ROUNDHOUSE_LAST_ACTIVE + 2, [hurtPart(16.0, body.z1, 0.0, body.z2, body.radius), hurtPart(knee[0], knee[1], ankle[0], ankle[1], 10.0)]),
  ];
}

export const ILLIDAN_MOVES: FighterMoves = {
  normals: {
    [AttackStyle.forwardSmash]: { ...heroMove(ROUNDHOUSE_FIRST_ACTIVE, ROUNDHOUSE_LEG.length, ROUNDHOUSE_RECOVERY, 0, roundhouseRegions(), ROUNDHOUSE_STEP, true), travelStopsAtLedge: true },
    [AttackStyle.downSmash]: splitsMove({
      firstActive: 6, active: 5, recovery: 35, chargeFrame: 1, hip: 12.0, reach: 92.0, height: 12.0, radius: 13.0,
      front: FEL_KICK(false), back: FEL_KICK(true),
    }),
  },
  throws: {},
  dashAttack: AttackStyle.demonHunterDashAttack,
  hurtboxes: { ...DEMON_HUNTER_HURTBOXES, attacks: { ...DEMON_HUNTER_HURTBOXES.attacks, [AttackStyle.forwardSmash]: roundhouseHurtPoses() } },
};

export function originalFighterMoves(character: Character): FighterMoves | undefined {
  return character === Character.rifleman ? RIFLEMAN_MOVES : character === Character.demonHunter ? ILLIDAN_MOVES : undefined;
}

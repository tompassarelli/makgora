import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../../sim/codes";
import { hurtCapsule } from "../../sim/geometry/contactGeometry";
import { heroHurtPose, heroMove, heroRegion, jabStep, type AuthoredMove, type FighterMoves, type StrikeCapsule, tipperMove } from "../../sim/heroMoves";
import type { HitEffect } from "../../sim/hitRegions";
import { hurtPart, type HurtPart, type HurtPose } from "../../sim/hurtboxes";
import { groundHit } from "../../sim/heroes/groundNormals";

export const sylvanasStrike = (x1: number, z1: number, x2: number, z2: number, radius = 8.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
export const sylvanasHit = (damage: number, angle: Parameters<typeof groundHit>[1], growth = 87.63500213623047, base = 22.0, behind = false): Readonly<HitEffect> =>
  groundHit(damage, angle, growth, base, HitElement.dark, behind);
const bow = (first: number, active: number, recovery: number, landing: number, strike: StrikeCapsule, effect: Readonly<HitEffect>, groundedEffect?: Readonly<HitEffect>): AuthoredMove =>
  heroMove(first, active, recovery, landing, [heroRegion(first, first + active - 1, strike, effect, groundedEffect)]);
const frontTilt = (x1: number, z1: number, x2: number, z2: number): AuthoredMove => bow(9, 3, 18, 0, sylvanasStrike(x1, z1, x2, z2), sylvanasHit(8.748000144958496, 40));
const NOTHING = { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;
const DASH_HIT = sylvanasHit(9.720000267028809, 50, 92.79000091552734, 24.0);
const NEUTRAL_AIR_BEHIND = sylvanasHit(6.803999900817871, 50, 87.63500213623047, 22.0, true);
const SPIKE = { ...sylvanasHit(10.692000389099121, 90, 103.0999984741211, 24.0), launchZ: -1.0 };

const NORMALS: FighterMoves["normals"] = {
  [AttackStyle.jab]: jabStep(bow(4, 2, 13, 0, sylvanasStrike(53.0, 74.0, 4.0, 115.0), sylvanasHit(2.9159998893737793, 35, 46.39500045776367, 12.0))),
  [AttackStyle.jab2]: jabStep(bow(5, 2, 14, 0, sylvanasStrike(43.0, 68.0, -18.0, 113.0), sylvanasHit(2.9159998893737793, 45, 46.39500045776367, 12.0))),
  [AttackStyle.jab3]: bow(6, 2, 17, 0, sylvanasStrike(51.0, 73.0, -4.0, 111.0), sylvanasHit(4.860000133514404, 55, 82.4800033569336, 24.0)),
  [AttackStyle.forwardTilt]: frontTilt(44.0, 69.0, -21.0, 109.0),
  [AttackStyle.forwardTiltUp]: frontTilt(43.0, 88.0, -30.0, 97.0),
  [AttackStyle.forwardTiltDown]: frontTilt(16.0, 17.0, 75.0, 54.0),
  [AttackStyle.upTilt]: bow(8, 4, 19, 0, sylvanasStrike(-4.0, 34.0, -9.0, 120.0), sylvanasHit(6.803999900817871, 85, 67.01499938964844, 38.0)),
  [AttackStyle.downTilt]: bow(7, 3, 17, 0, sylvanasStrike(17.0, 17.0, 75.0, 53.0), sylvanasHit(6.803999900817871, 75, 61.86000061035156, 38.0)),
  [AttackStyle.dashAttack]: heroMove(6, 8, 22, 0, [
    heroRegion(6, 7, sylvanasStrike(21.0, 52.0, 4.0, 90.0), DASH_HIT),
    heroRegion(8, 9, sylvanasStrike(34.0, 51.0, 36.0, 117.0), DASH_HIT),
    heroRegion(10, 13, sylvanasStrike(45.0, 57.0, -12.0, 102.0), DASH_HIT),
  ], 55.0, true),
  [AttackStyle.forwardSmash]: tipperMove(bow(16, 3, 29, 0, sylvanasStrike(-32.0, 94.0, 42.0, 77.0), sylvanasHit(16.038000106811523, 40, 113.41000366210938, 28.0)), 0.25),
  [AttackStyle.upSmash]: bow(15, 4, 29, 0, sylvanasStrike(4.0, 28.0, -28.0, 120.0, 12.0), sylvanasHit(12.63599967956543, 90, 113.41000366210938, 28.0)),
  [AttackStyle.downSmash]: heroMove(14, 6, 28, 0, [
    heroRegion(14, 16, sylvanasStrike(27.0, 27.0, 64.0, 87.0), sylvanasHit(11.663999557495117, 25, 103.0999984741211, 25.0)),
    heroRegion(17, 19, sylvanasStrike(-26.0, 27.0, -64.0, 87.0), sylvanasHit(11.663999557495117, 25, 103.0999984741211, 25.0, true)),
  ]),
  [AttackStyle.neutralAir]: heroMove(6, 5, 18, 12, [
    heroRegion(6, 7, sylvanasStrike(45.0, 82.0, -36.0, 119.0), sylvanasHit(6.803999900817871, 50)),
    heroRegion(8, 8, sylvanasStrike(-32.0, 92.0, 7.0, 58.0), NEUTRAL_AIR_BEHIND),
    heroRegion(9, 10, sylvanasStrike(-48.0, 82.0, -2.0, 121.0), NEUTRAL_AIR_BEHIND),
  ]),
  [AttackStyle.forwardAir]: bow(10, 3, 23, 16, sylvanasStrike(49.0, 80.0, -21.0, 100.0), sylvanasHit(9.720000267028809, 40, 103.0999984741211, 24.0)),
  [AttackStyle.backAir]: bow(8, 3, 22, 12, sylvanasStrike(28.0, 101.0, -25.0, 113.0), sylvanasHit(10.692000389099121, 35, 108.25499725341797, 26.0, true)),
  [AttackStyle.upAir]: bow(8, 4, 20, 12, sylvanasStrike(-2.0, 32.0, -9.0, 120.0), sylvanasHit(7.776000022888184, 85, 92.79000091552734, 24.0)),
  [AttackStyle.downAir]: bow(12, 4, 28, 20, sylvanasStrike(24.0, 71.0, -5.0, -20.0), SPIKE, sylvanasHit(10.692000389099121, 55, 103.0999984741211, 24.0)),
  [AttackStyle.grab]: bow(7, 2, 23, 0, sylvanasStrike(12.0, 50.0, 48.0, 44.0, 12.0), NOTHING),
};

const body = hurtCapsule(Character.sylvanas);
export const SYLVANAS_STAND: readonly HurtPart[] = [hurtPart(body.x1, body.z1, body.x2, body.z2, body.radius)];
export const sylvanasReach = (x: number, z: number): readonly HurtPart[] => [...SYLVANAS_STAND, hurtPart(8.0, 65.0, x, z, 10.0)];
const limbPoses: { [style: number]: readonly HurtPose[] } = {};
for (const key in NORMALS) {
  const style = Number(key);
  const move = NORMALS[style];
  if (move === undefined) continue;
  const shaped = move.regions.filter((region, index) => index === 0 || move.regions[index - 1]?.firstFrame !== region.firstFrame);
  limbPoses[style] = shaped.map((region, index) => {
    const strike = region.hit.strike;
    if (strike === undefined) return heroHurtPose(1, move.totalFrames, SYLVANAS_STAND);
    const x = f32(Math.max(-48.0, Math.min(48.0, strike.x2)));
    const z = f32(Math.max(20.0, Math.min(112.0, strike.z2)));
    const next = shaped[index + 1];
    const last = Math.min(move.totalFrames, region.lastFrame + 3, next === undefined ? move.totalFrames : Math.max(1, next.firstFrame - 1) - 1);
    return heroHurtPose(Math.max(1, region.firstFrame - 1), last, sylvanasReach(x, z));
  });
}

export const SYLVANAS_MOVES: FighterMoves = {
  normals: NORMALS,
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: { stand: SYLVANAS_STAND, attacks: limbPoses },
  throws: {
    [GrabAction.pummel]: { contactFrame: 60, totalFrames: 75, effect: { ...NOTHING, damage: 3.0 } },
    [GrabAction.throwForward]: { contactFrame: 13, totalFrames: 33, effect: sylvanasHit(6.803999900817871, 40, 46.5, 63.0) },
    [GrabAction.throwBack]: { contactFrame: 16, totalFrames: 37, effect: sylvanasHit(7.776000022888184, 40, 30.0, 68.0, true) },
    [GrabAction.throwUp]: { contactFrame: 14, totalFrames: 24, effect: sylvanasHit(5.831999778747559, 75, 87.63500213623047, 60.0, true) },
    [GrabAction.throwDown]: { contactFrame: 18, totalFrames: 39, effect: { ...sylvanasHit(5.831999778747559, 70, 0.0, 0.0), growth: 100.0, setKnockback: 90.0 } },
  },
};

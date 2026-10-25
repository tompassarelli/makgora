import { f32 } from "wisp/src/sim/f32";
import { SAKURAI_ANGLE } from "../../../../references/melee-frame-data/fightcore";
import { AttackStyle, Character, GrabAction } from "../../../src/game/sim/codes";
import { type AuthoredMove, type AuthoredThrow, type FighterMoves, type MoveRegion, heroRegion, jabStep } from "../../../src/game/sim/heroMoves";
import type { HitEffect } from "../../../src/game/sim/hitRegions";
import { fixedHitKnockback } from "../../../src/game/sim/knockback";
import { AUTHORED_PHYSICS, type CheckFighter, type FighterPhysics, NTSC_FOX_GROUND_MOVEMENT_RULES, melee, registerCheckFighter } from "../../../src/game/sim/tuning";
import { type FoxFixture, type FoxMove, type FoxMoveId, type Phase, foxFixture } from "./fox";

const NORMALS: Partial<Record<FoxMoveId, AttackStyle>> = {
  jab1: AttackStyle.jab, jab2: AttackStyle.jab2, forwardTilt: AttackStyle.forwardTilt, upTilt: AttackStyle.upTilt, downTilt: AttackStyle.downTilt,
  dashAttack: AttackStyle.dashAttack, forwardSmash: AttackStyle.forwardSmash, upSmash: AttackStyle.upSmash, downSmash: AttackStyle.downSmash,
  neutralAir: AttackStyle.neutralAir, forwardAir: AttackStyle.forwardAir, backAir: AttackStyle.backAir, upAir: AttackStyle.upAir, downAir: AttackStyle.downAir,
};
const THROWS: Partial<Record<FoxMoveId, GrabAction>> = {
  forwardThrow: GrabAction.throwForward, backThrow: GrabAction.throwBack, upThrow: GrabAction.throwUp, downThrow: GrabAction.throwDown,
};
const SAKURAI_AIRBORNE_ANGLE = 45;
const NEUTRAL_WEIGHT = 100;

const degrees = (angle: number): number => angle === SAKURAI_ANGLE ? SAKURAI_AIRBORNE_ANGLE : angle;

function effectOf(hitbox: Phase["hitboxes"][number], facing: number): HitEffect {
  const radians = (degrees(hitbox.angle) * Math.PI) / 180;
  const fixed = hitbox.set_knockback > 0;
  return {
    damage: hitbox.damage,
    growth: fixed ? 0 : hitbox.knockback_growth,
    base: fixed ? fixedHitKnockback(hitbox.set_knockback, NEUTRAL_WEIGHT, hitbox.knockback_growth, hitbox.base_knockback, 1.0) : hitbox.base_knockback,
    launchX: f32(Math.cos(radians) * facing),
    launchZ: f32(Math.sin(radians)),
    electric: hitbox.effect === "Electric",
  };
}

function regionsOf(move: FoxMove): MoveRegion[] {
  const frames = move.positions?.value ?? [];
  return frames.flatMap(({ frame, hitboxes }) => {
    const phase = move.phases.value.find((candidate) => candidate.start <= frame && frame <= candidate.end);
    if (phase === undefined) throw new Error(`${move.id} frame ${frame}: no phase in ${move.phases.source} covers it`);
    if (phase.hitboxes.length !== hitboxes.length) throw new Error(`${move.id} frame ${frame}: ${move.positions?.source} has ${hitboxes.length} hitboxes, phase ${phase.phase} has ${phase.hitboxes.length}`);
    return hitboxes.map((hitbox, index) => {
      const x = melee(hitbox.x), z = melee(hitbox.y);
      const own = phase.hitboxes[index];
      if (own === undefined) throw new Error(`${move.id} frame ${frame}: phase ${phase.phase} has no hitbox ${index}`);
      return heroRegion(frame, frame, { x1: x, z1: z, x2: x, z2: z, radius: melee(hitbox.size) }, effectOf(own, hitbox.x < 0 ? -1.0 : 1.0));
    });
  });
}

function normalOf(move: FoxMove): AuthoredMove {
  const { firstActive, lastActive } = move.hitboxes;
  const frames = move.frames;
  const first = firstActive.value, last = lastActive.value, total = frames?.["total"]?.value, iasa = frames?.["iasa"]?.value ?? null;
  if (first === null || last === null || total === undefined || total === null) throw new Error(`${move.id}: no active or total frames`);
  const authored: AuthoredMove = {
    startupFrames: first - 1, activeFrames: last - first + 1, totalFrames: iasa === null ? total : iasa - 1,
    landingLag: frames?.["cancel_lag"]?.value ?? 0, regions: regionsOf(move),
  };
  return move.id === "jab1" ? jabStep(authored) : authored;
}

function throwOf(move: FoxMove): AuthoredThrow {
  const release = move.frames?.["start"]?.value, total = move.frames?.["total"]?.value, hitbox = move.phases.value[0]?.hitboxes[0];
  if (release === undefined || release === null || total === undefined || total === null || hitbox === undefined) throw new Error(`${move.id}: no release, total or throw hitbox`);
  return { contactFrame: release, totalFrames: total, effect: effectOf(hitbox, 1.0) };
}

function physicsOf({ attributes: a }: FoxFixture): FighterPhysics {
  const first = (cited: { readonly value: number | readonly number[] }): number => typeof cited.value === "number" ? cited.value : cited.value[0] ?? Number.NaN;
  return {
    ...AUTHORED_PHYSICS.reference,
    weight: first(a.weight),
    gravity: melee(a.gravity.value),
    terminalSpeed: melee(a.terminalVelocity.value),
    fastFallSpeed: melee(a.fastFallVelocity.value),
    airAcceleration: melee(f32(a.airMobilityA.value + a.airMobilityB.value)),
    airSpeed: melee(first(a.airSpeed)),
    airFriction: melee(a.airFriction.value),
    traction: melee(a.groundFriction.value),
    dashSpeed: melee(a.dashInitialVelocity.value),
    runSpeed: melee(first(a.runVelocity)),
    walkSpeed: melee(a.walkVelocity.value),
    jumpSquatFrames: a.jumpSquat.value,
    fullJumpSpeed: melee(a.jumpVelocity.value),
    shortJumpSpeed: melee(a.hopVelocity.value),
    aerialJumpSpeed: f32(melee(a.jumpVelocity.value) * a.aerialJumpMultiplier.value),
    jumpHorizontalSpeed: melee(a.jumpHorizontalVelocity.value),
    groundAccelerationMultiplier: a.dashRunAccelerationA.value,
    groundAccelerationBase: a.dashRunAccelerationB.value,
  };
}

export function foxFighter(fixture: FoxFixture): CheckFighter {
  const normals: Record<number, AuthoredMove> = {};
  const throws: Record<number, AuthoredThrow> = {};
  for (const move of fixture.moves) {
    const style = NORMALS[move.id], action = THROWS[move.id];
    if (style !== undefined) normals[style] = normalOf(move);
    if (action !== undefined) throws[action] = throwOf(move);
  }
  const moves: FighterMoves = { normals, throws, dashAttack: AttackStyle.dashAttack };
  return {
    hero: {
      name: "fixture:fox", purpose: "Check-only Melee Fox from references/melee-frame-data", weakness: "No specials, art or roster slot",
      moves, jab: { name: "Jab", description: "Fox's jab 1 and jab 2." },
    },
    physics: physicsOf(fixture),
    ground: NTSC_FOX_GROUND_MOVEMENT_RULES,
    look: Character.warden,
  };
}

export function foxFighterGaps(fixture: FoxFixture): string[] {
  const loaded = fixture.moves.filter((move) => NORMALS[move.id] !== undefined || THROWS[move.id] !== undefined);
  const having = (has: (hitbox: Phase["hitboxes"][number]) => boolean): string =>
    loaded.filter((move) => move.phases.value.some((phase) => phase.hitboxes.some(has))).map((move) => move.id).join(", ");
  return [
    "hurtboxes: no file in the corpus gives Fox's, so the fighter stands in the sim's reference capsule",
    "grab: the sim's shared grab box and timing, as for every fighter",
    "presentation: headless runs pose it with Maiev's clips, which never reach the sim",
    `not loaded: ${fixture.moves.filter((move) => !loaded.includes(move)).map((move) => move.id).join(", ")} (no specials, no rapid jab, shared grab)`,
    `Sakurai angle loads as ${SAKURAI_AIRBORNE_ANGLE} degrees, grounded or not: ${having((hitbox) => hitbox.angle === SAKURAI_ANGLE)}`,
    `set knockback loads as its weight-${NEUTRAL_WEIGHT} knockback for every weight: ${having((hitbox) => hitbox.set_knockback > 0)}`,
    "launch direction: a hitbox behind Fox's origin sends backward, where Melee picks the side by the victim's position",
    "aerial auto-cancel windows: not modelled; every aerial landing takes records.jsonl's L-cancelled lag",
  ];
}

export const FIXTURE_FOX: Character = registerCheckFighter(foxFighter(foxFixture()));
export const FIXTURE_FIGHTERS: readonly Character[] = [FIXTURE_FOX];

if (import.meta.main) {
  console.log(`${FIXTURE_FIGHTERS.length} check-only fighter registered as character ${FIXTURE_FOX}`);
  for (const gap of foxFighterGaps(foxFixture())) console.log(`gap ${gap}`);
}

import { f32 } from "wisp/src/sim/f32";
import { SAKURAI_ANGLE } from "../../../../references/melee-frame-data/fightcore";
import { AttackStyle, Character, GrabAction } from "../../../src/game/sim/codes";
import { REFERENCE_HURT_CAPSULE } from "../../../src/game/sim/geometry/contactGeometry";
import { type AuthoredMove, type AuthoredThrow, type FighterMoves, type MoveRegion, heroRegion, jabStep } from "../../../src/game/sim/heroMoves";
import type { HitEffect } from "../../../src/game/sim/hitRegions";
import { type AuthoredSpecial, type FighterSpecials, type SpecialKit, frames } from "../../../src/game/sim/specials/schema";
import { AUTHORED_PHYSICS, type CheckFighter, type FighterPhysics, NTSC_FOX_GROUND_MOVEMENT_RULES, melee, registerCheckFighter } from "../../../src/game/sim/tuning";
import { type FoxFixture, type FoxMove, type FoxMoveId, type Phase, foxFixture } from "./fox";

const NORMALS: Partial<Record<FoxMoveId, AttackStyle>> = {
  jab1: AttackStyle.jab, jab2: AttackStyle.jab2, forwardTilt: AttackStyle.forwardTilt, upTilt: AttackStyle.upTilt, downTilt: AttackStyle.downTilt,
  dashAttack: AttackStyle.dashAttack, forwardSmash: AttackStyle.forwardSmash, upSmash: AttackStyle.upSmash, downSmash: AttackStyle.downSmash,
  neutralAir: AttackStyle.neutralAir, forwardAir: AttackStyle.forwardAir, backAir: AttackStyle.backAir, upAir: AttackStyle.upAir, downAir: AttackStyle.downAir,
  grab: AttackStyle.grab,
};
const THROWS: Partial<Record<FoxMoveId, GrabAction>> = {
  forwardThrow: GrabAction.throwForward, backThrow: GrabAction.throwBack, upThrow: GrabAction.throwUp, downThrow: GrabAction.throwDown,
};
const SPECIALS: Partial<Record<FoxMoveId, "ground" | "air">> = { reflector: "ground", aerialReflector: "air" };
const SAKURAI_AIRBORNE_ANGLE = 45;
const SHINE_SOURCE = "https://www.ssbwiki.com/Fox_(SSBM)/Down_special";
const SHINE = { radius: 7.999488, intangibleFrame: 1, jumpCancelFrame: 4, shortestFrames: 39 } as const;

const degrees = (angle: number): number => angle === SAKURAI_ANGLE ? SAKURAI_AIRBORNE_ANGLE : angle;

function effectOf(hitbox: Phase["hitboxes"][number], facing: number): HitEffect {
  const radians = (degrees(hitbox.angle) * Math.PI) / 180;
  return {
    damage: hitbox.damage,
    growth: hitbox.knockback_growth,
    base: hitbox.base_knockback,
    ...(hitbox.set_knockback > 0 ? { fixedPower: hitbox.set_knockback } : {}),
    launchX: f32(Math.cos(radians) * facing),
    launchZ: f32(Math.sin(radians)),
    electric: hitbox.effect === "Electric",
    ...(hitbox.angle === SAKURAI_ANGLE ? { sakurai: true } : {}),
  };
}

function reflectorOf(move: FoxMove): AuthoredSpecial {
  const phase = move.phases.value[0], hitbox = phase?.hitboxes[0];
  if (phase === undefined || hitbox === undefined) throw new Error(`${move.id}: no hitbox in ${move.phases.source}`);
  const { x1, z1, x2, z2 } = REFERENCE_HURT_CAPSULE;
  const x = f32((x1 + x2) / 2), z = f32((z1 + z2) / 2);
  return {
    endFrame: SHINE.shortestFrames,
    regions: [heroRegion(phase.start, phase.end, { x1: x, z1: z, x2: x, z2: z, radius: melee(SHINE.radius) }, effectOf(hitbox, 1.0))],
    intangible: frames(SHINE.intangibleFrame, SHINE.intangibleFrame),
    jumpCancelFrame: SHINE.jumpCancelFrame,
  };
}

const NOT_LOADED: SpecialKit = { name: "Not loaded", description: "The fixture loads only Fox's reflector.", ground: { endFrame: 1 } };

function specialsOf(fixture: FoxFixture): FighterSpecials {
  const forms = Object.fromEntries(fixture.moves.flatMap((move) => {
    const form = SPECIALS[move.id];
    return form === undefined ? [] : [[form, reflectorOf(move)]];
  })) as Partial<Record<"ground" | "air", AuthoredSpecial>>;
  if (forms.ground === undefined) throw new Error("the Fox fixture has no grounded reflector");
  return {
    neutral: NOT_LOADED, side: NOT_LOADED, up: NOT_LOADED,
    down: { name: "Reflector", description: `Fox's shine: radius, intangibility, jump cancel and shortest length from ${SHINE_SOURCE}.`, ground: forms.ground, air: forms.air },
  };
}

function cleanPhases(move: FoxMove): ReadonlySet<number> {
  const peaks = move.phases.value.map((phase) => Math.max(...phase.hitboxes.map((hitbox) => hitbox.damage)));
  const top = Math.max(...peaks);
  return new Set(peaks.every((peak) => peak === top) ? [] : move.phases.value.filter((_, index) => peaks[index] === top).map((phase) => phase.phase));
}

function regionsOf(move: FoxMove): MoveRegion[] {
  const frames = move.positions?.value ?? [];
  const clean = cleanPhases(move);
  return frames.flatMap(({ frame, hitboxes }) => {
    const phase = move.phases.value.find((candidate) => candidate.start <= frame && frame <= candidate.end);
    if (phase === undefined) throw new Error(`${move.id} frame ${frame}: no phase in ${move.phases.source} covers it`);
    if (phase.hitboxes.length !== hitboxes.length) throw new Error(`${move.id} frame ${frame}: ${move.positions?.source} has ${hitboxes.length} hitboxes, phase ${phase.phase} has ${phase.hitboxes.length}`);
    return hitboxes.map((hitbox, index) => {
      const x = melee(hitbox.x), z = melee(hitbox.y);
      const own = phase.hitboxes[index];
      if (own === undefined) throw new Error(`${move.id} frame ${frame}: phase ${phase.phase} has no hitbox ${index}`);
      const effect = effectOf(own, hitbox.x < 0 ? -1.0 : 1.0);
      return heroRegion(frame, frame, { x1: x, z1: z, x2: x, z2: z, radius: melee(hitbox.size) }, clean.has(phase.phase) ? { ...effect, strong: true } : effect);
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
    landingLag: frames?.["cancel_lag"]?.value ?? 0, regions: move.id === "grab" ? [] : regionsOf(move),
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
      name: "fixture:fox", purpose: "Check-only Melee Fox from references/melee-frame-data", weakness: "Only the reflector of its specials; no art or roster slot",
      moves, specials: specialsOf(fixture), jab: { name: "Jab", description: "Fox's jab 1 and jab 2." },
    },
    physics: physicsOf(fixture),
    ground: NTSC_FOX_GROUND_MOVEMENT_RULES,
    look: Character.warden,
  };
}

export function foxFighterGaps(fixture: FoxFixture): string[] {
  const loaded = fixture.moves.filter((move) => NORMALS[move.id] !== undefined || THROWS[move.id] !== undefined || SPECIALS[move.id] !== undefined);
  return [
    "hurtboxes: no file in the corpus gives Fox's, so the fighter stands in the sim's reference capsule",
    "grab: Fox's frames, with the sim's shared grab box, since the grab path reads no authored region",
    "presentation: headless runs pose it with Maiev's clips, which never reach the sim",
    `not loaded: ${fixture.moves.filter((move) => !loaded.includes(move)).map((move) => move.id).join(", ")} (no specials but the reflector, no rapid jab)`,
    "reflector: held for its shortest length only, centred on the reference capsule's midpoint because the corpus gives no bone position, with no reflection",
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

import { mutablePlacedObject } from "./fighter";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { floorMod } from "wisp/src/sim/intMath";
import { mutableProjectile } from "./fighterProjectiles";
import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { sweep, sweepSeed } from "../core/sweep";
import { clearAttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { produceComputerInput } from "../match/botPlay";
import type { CpuTier } from "../match/cpuProfiles";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import { createPacingAndPresentation } from "../match/pacingAndPresentation";
import { SELECTABLE_CHARACTERS } from "./heroes/registry";
import { fighterAt, isActive, neutralControls } from "./roster";
import { f32 } from "wisp/src/sim/f32";
import { ATTACK_BUFFER_FRAMES, type AttackBuffer, attackBuffer, queueAttack } from "../input/attackBuffer";
import { createFrameControls } from "../match/controls";
import { Phase, createMatchState, stageClock } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { AttackStyle, Character, ProjectileKind, SpecialAction } from "./codes";
import { type Fighter, createFighter, placedObject } from "./fighter";
import { ROSTER_MANA } from "./mana";
import { type Controls, copyControls, createRoster } from "./roster";
import { controls } from "./testWorld";
import { FIGHTER_ULTIMATES, KOBOLD_BURROW_FIRST, KOBOLD_BURROW_LAST, ULTIMATE_REACH } from "./ultimates";
import { type AuthoredSpecial, Relocation, type SpecialProjectile } from "./specials/schema";
import { airHoldEnd, firstThreat } from "./specials/engine";
import { firstStateDifference } from "../replay/difference";
import { stateChecksum } from "../replay/canonical";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { isIntangible } from "./conditions";
import { spawnProjectileMotion } from "./projectiles";
import { clearSpecialOnStock } from "./transitions";
import { floorBelow, floorSurfaceBelow, mainDeckLeft, mainDeckRight, mainDeckZAt, SLOPE_TEST_STAGE, surfaceLeft, surfaceRight, surfaceZAt, TIMED_TEST_STAGE } from "./stage";

/** How each ultimate is met in its recorded scenario (docs/design/ultimates.md). */
type Defence = "shield" | "spotDodge" | "ground";

interface Scenario {
  readonly character: Character;
  /** The target's distance ahead, and its height when it must be airborne to be reached. */
  readonly x: number;
  readonly z?: number;
  readonly defence: Defence;
  /** The frame the defender starts its answer. */
  readonly answerFrame?: number;
}

export const ULTIMATE_SCENARIOS: readonly Scenario[] = [
  { character: Character.rifleman, x: 400.0, defence: "shield" },
  { character: Character.demonHunter, x: 100.0, defence: "shield" },
  { character: Character.blademaster, x: 80.0, defence: "shield" },
  { character: Character.mountainKing, x: 120.0, defence: "shield" },
  { character: Character.warden, x: 250.0, defence: "shield" },
  { character: Character.lich, x: 300.0, defence: "shield" },
  { character: Character.forsakenPaladin, x: 220.0, defence: "shield" },
  { character: Character.dreadlord, x: 260.0, defence: "shield" },
  { character: Character.shadowHunter, x: 300.0, defence: "shield" },
  { character: Character.pitLord, x: 90.0, defence: "spotDodge", answerFrame: 16 },
  { character: Character.beastmaster, x: 300.0, defence: "shield" },
  { character: Character.lichKing, x: 300.0, defence: "shield" },
  { character: Character.thrall, x: 300.0, defence: "shield" },
  { character: Character.jaina, x: 300.0, defence: "shield" },
  { character: Character.sylvanas, x: 300.0, defence: "shield" },
  { character: Character.cairne, x: 100.0, defence: "shield" },
  { character: Character.chen, x: 220.0, defence: "shield" },
  { character: Character.peon, x: 250.0, defence: "shield" },
  { character: Character.tinker, x: 150.0, defence: "shield" },
  { character: Character.kaelthas, x: 150.0, defence: "shield" },
  { character: Character.murloc, x: 300.0, defence: "shield" },
  { character: Character.grom, x: 120.0, defence: "spotDodge", answerFrame: 15 },
  { character: Character.anubarak, x: 150.0, defence: "shield" },
  { character: Character.malfurion, x: 300.0, defence: "shield" },
  { character: Character.medivh, x: 240.0, defence: "shield" },
  { character: Character.kobold, x: 200.0, defence: "shield" },
];

const SHIELD = controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0 });
const ULTIMATE = controls({ specialPressed: true, ultimatePressed: true, attackHeld: true });

interface Bout {
  readonly owner: Fighter;
  readonly target: Fighter;
  readonly bystander: Fighter | undefined;
  readonly step: (this: void, first?: Readonly<Controls>, second?: Readonly<Controls>) => void;
  readonly commands: readonly AttackBuffer[];
  readonly frame: () => number;
  readonly game: ReturnType<typeof createMatchState>;
}

function bout(scenario: Readonly<Scenario>, facing: number, target: Character = Character.blademaster, x = scenario.x, off = false, bystanderGap?: number): Bout {
  const game = createMatchState();
  game.phase = Phase.match;
  game.ultimatesOff = off;
  const owner = createFighter(scenario.character, f32(-x * facing * 0.5), facing);
  const victim = createFighter(target, f32(x * facing * 0.5), -facing);
  const bystander = bystanderGap === undefined ? undefined : createFighter(Character.blademaster, f32(owner.motion.x + f32(facing * bystanderGap)), -facing);
  owner.mana.points = ROSTER_MANA.max;
  const world = createRoster(bystander === undefined ? 3 : 7, bystander === undefined ? [owner, victim] : [owner, victim, bystander]);
  const commands = [attackBuffer(ATTACK_BUFFER_FRAMES), attackBuffer(ATTACK_BUFFER_FRAMES)];
  let frame = 0;
  const step = (first = controls(), second = controls()): void => {
    frame++;
    const out = createFrameControls();
    copyControls(out.inputs[0], first);
    copyControls(out.inputs[1], second);
    out.commands[0] = commands[0] ?? attackBuffer(ATTACK_BUFFER_FRAMES);
    out.commands[1] = commands[1] ?? attackBuffer(ATTACK_BUFFER_FRAMES);
    stepMatch(game, world, out, frame);
  };
  for (let tick = 0; tick < 8; tick++) step();
  owner.mana.points = ROSTER_MANA.max;
  if (scenario.z !== undefined) {
    victim.motion.grounded = false;
    victim.motion.surface = undefined;
    victim.motion.z = f32(victim.motion.z + scenario.z);
  }
  return { owner, target: victim, bystander, step, commands, frame: () => frame, game };
}

/** Holds an airborne target where it was put, as a jumper at its apex would be. */
function hover(b: Bout, z: number | undefined, base: number): void {
  if (z === undefined || b.target.launch.hitstun > 0 || b.target.status.damage > 0.0) return;
  b.target.motion.grounded = false;
  b.target.motion.surface = undefined;
  b.target.motion.z = base;
  b.target.motion.vz = 0.0;
}

function ultimateOf(character: Character): AuthoredSpecial {
  const move = FIGHTER_ULTIMATES[character];
  if (move === undefined) throw new Error(`no ultimate for ${character}`);
  return move;
}

function scenarioOf(character: Character): Scenario {
  const scenario = ULTIMATE_SCENARIOS.find((entry) => entry.character === character);
  if (scenario === undefined) throw new Error(`no scenario for ${character}`);
  return scenario;
}

function play(scenario: Readonly<Scenario>, facing: number, defend: boolean): Bout {
  const b = bout(scenario, facing);
  const base = b.target.motion.z;
  b.step(ULTIMATE);
  hover(b, scenario.z, base);
  for (let tick = 0; tick < 240; tick++) {
    let answer = controls();
    const live = b.owner.special.action === SpecialAction.heroUltimate || b.owner.placed.life > 0 || b.owner.projectiles.some((shot) => shot.life > 0);
    if (scenario.defence === "shield" && defend && live) answer = SHIELD;
    if (scenario.defence === "spotDodge" && defend && tick + 2 === (scenario.answerFrame ?? 0)) answer = controls({ ...SHIELD, groundDodgePressed: true, groundDodgeDirection: 0 });
    b.step(controls(), answer);
    if (!(scenario.defence === "ground" && defend)) hover(b, scenario.z, base);
    if (!live && b.target.launch.hitstun <= 0 && (defend || b.target.status.damage > 0.0)) break;
  }
  return b;
}

test("each fighter's ultimate needs the full bar, spends all of it and starts from Attack + Special [k3 measure #382]", () => {
  for (const scenario of ULTIMATE_SCENARIOS) {
    const short = bout(scenario, 1, Character.blademaster, 600.0);
    short.owner.mana.points = ROSTER_MANA.max - 1;
    short.step(ULTIMATE);
    assertTrue(short.owner.special.action !== SpecialAction.heroUltimate);
    const full = bout(scenario, 1, Character.blademaster, 600.0);
    full.step(ULTIMATE);
    assertEquals(full.owner.special.action, SpecialAction.heroUltimate);
    assertEquals(full.owner.mana.points, 0);
  }
});

const name = (character: Character): string => Object.keys(Character).find((key) => Character[key as keyof typeof Character] === character) ?? `${character}`;

test("each fighter's ultimate lands undefended and never KOs from 0% in both facings [k3 measure #382]", () => {
  const failures: string[] = [];
  for (const scenario of ULTIMATE_SCENARIOS) for (const facing of [-1, 1]) {
    const b = play(scenario, facing, false);
    if (!(b.target.status.damage > 0.0) || b.target.status.out || b.target.status.stocks !== b.owner.status.stocks) failures.push(`${name(scenario.character)} ${facing}: ${b.target.status.damage}% out=${b.target.status.out}`);
  }
  assertEquals(failures.join("; "), "");
});

test("each fighter's ultimate is answered by its defence on startup and leaves the user committed [k3 measure #382]", () => {
  const failures: string[] = [];
  for (const scenario of ULTIMATE_SCENARIOS) for (const facing of [-1, 1]) {
    const b = play(scenario, facing, true);
    const move = ultimateOf(scenario.character);
    if (b.target.status.damage !== 0.0 || firstThreat(move) < 16 || move.endFrame < firstThreat(move) + 16) failures.push(`${name(scenario.character)} ${facing}: ${b.target.status.damage}% threat ${firstThreat(move)} end ${move.endFrame}`);
  }
  assertEquals(failures.join("; "), "");
});


const GROUND_ONLY_ULTIMATES: readonly Character[] = [
  Character.blademaster, Character.beastmaster, Character.thrall, Character.peon, Character.murloc, Character.anubarak,
];

function airborneBout(scenario: Readonly<Scenario>, facing: number, height: number, gap = 900.0, bystanderGap?: number): Bout {
  const b = bout(scenario, facing, Character.blademaster, gap, false, bystanderGap);
  const { motion } = b.owner;
  motion.grounded = false;
  motion.surface = undefined;
  motion.z = f32(mainDeckZAt(0, motion.x) + height);
  motion.vx = f32(facing * 3.0);
  motion.vz = 2.0;
  motion.fastFalling = true;
  b.owner.jump.remaining = 1;
  return b;
}

const LIFT = 1;
const LIFT_RISING = 95;
const LIFT_RAISED = 215;
const SKY = 100000.0;

function standOnFloor(f: Fighter, stage: number, clock: number, ceiling = SKY): void {
  const surface = floorSurfaceBelow(stage, clock, f.motion.x, ceiling);
  if (surface === undefined) throw new Error(`no floor under ${f.motion.x} on stage ${stage}`);
  f.motion.grounded = true;
  f.motion.surface = surface;
  f.motion.z = surfaceZAt(stage, surface, clock, f.motion.x);
  f.motion.vx = 0.0;
  f.motion.vz = 0.0;
}

test("an airborne press starts every ultimate except the floor sweeps, which refuse and keep the bar (#98) [k3 measure #98]", () => {
  const failures: string[] = [];
  for (const scenario of ULTIMATE_SCENARIOS) for (const facing of [-1, 1]) {
    const b = airborneBout(scenario, facing, 150.0);
    b.step(ULTIMATE);
    const refuses = GROUND_ONLY_ULTIMATES.includes(scenario.character);
    const started = b.owner.special.action === SpecialAction.heroUltimate;
    if (started === refuses || b.owner.mana.points !== (refuses ? ROSTER_MANA.max : 0)) failures.push(`${name(scenario.character)} ${facing}: started=${started} mana=${b.owner.mana.points}`);
  }
  assertEquals(failures.join("; "), "");
});

test("an airborne ultimate holds its caster in place through startup, then falls normally with no helpless state and keeps the air jump (#98) [k1 scenario]", () => {
  const failures: string[] = [];
  let airborneAtEnd = 0;
  for (const scenario of ULTIMATE_SCENARIOS) for (const facing of [-1, 1]) {
    if (GROUND_ONLY_ULTIMATES.includes(scenario.character)) continue;
    const b = airborneBout(scenario, facing, 400.0);
    const move = ultimateOf(scenario.character);
    const threat = Math.min(airHoldEnd(move), ...(move.motion ?? []).filter((segment) => segment.relocate === Relocation.floorBelow).map((segment) => segment.first));
    b.step(ULTIMATE);
    const { x, z } = b.owner.motion;
    const label = `${name(scenario.character)} ${facing}`;
    let fell = false;
    for (let tick = 1; b.owner.special.action === SpecialAction.heroUltimate && tick <= move.endFrame + 30; tick++) {
      b.step();
      const frame = b.owner.special.frame;
      if (b.owner.special.action !== SpecialAction.heroUltimate) break;
      if (frame < threat && (b.owner.motion.x !== x || b.owner.motion.z !== z)) failures.push(`${label}: moved at f${frame}`);
      if (frame >= threat && b.owner.motion.z < z) fell = true;
      if (frame >= threat && b.owner.motion.fastFalling) failures.push(`${label}: fast-falls after startup`);
      if (b.owner.special.fall) failures.push(`${label}: helpless at f${frame}`);
    }
    if (!fell) failures.push(`${label}: never fell`);
    if (!b.owner.motion.grounded) {
      airborneAtEnd++;
      if (b.owner.special.fall || b.owner.jump.remaining !== 1) failures.push(`${label}: ended helpless=${b.owner.special.fall} jumps=${b.owner.jump.remaining}`);
    }
  }
  assertEquals([...new Set(failures)].join("; "), "");
  assertGreaterThan(airborneAtEnd, 0);
});

test("Dark Portal, Light's Judgment and Inferno draw their marks on the floor below an air cast and strike a grounded foe there after earlier hits, cast standing or from the air (#98) [k1 scenario]", () => {
  const failures: string[] = [];
  const groundFall: Record<number, number | undefined> = {};
  for (const character of [Character.medivh, Character.forsakenPaladin, Character.dreadlord]) for (const facing of [-1, 1]) for (const height of [0.0, 300.0]) {
    const scenario = scenarioOf(character);
    const move = ultimateOf(character);
    const b = height > 0.0 ? airborneBout(scenario, facing, height, scenario.x) : bout(scenario, facing);
    const label = `${name(character)} ${facing} height ${height}`;
    const last = Math.max(...(move.regions ?? []).map((region) => region.firstFrame + 1));
    const struck: number[] = [];
    let lowestFall: number | undefined;
    b.step(ULTIMATE);
    for (let tick = 0; tick < 120 && b.owner.special.action === SpecialAction.heroUltimate; tick++) {
      const before = b.target.status.damage;
      b.step();
      if (b.target.status.damage > before) struck.push(b.owner.special.frame);
      for (const projectile of b.owner.projectiles) {
        const spec = projectile.spec;
        if (projectile.life <= 0 || spec === undefined || !(move.projectiles ?? []).includes(spec)) continue;
        const floor = mainDeckZAt(0, projectile.x);
        if (spec.velocityZ < 0.0) lowestFall = Math.min(lowestFall ?? projectile.z, projectile.z);
        else if (f32(projectile.z - spec.offsetZ) !== floor) failures.push(`${label}: mark at ${projectile.z} over the floor at ${floor} on f${b.owner.special.frame}`);
      }
    }
    if (!struck.includes(last) || (character !== Character.dreadlord && struck.length < 2)) failures.push(`${label}: struck at ${struck.join(",")}, last region f${last}`);
    if (character === Character.dreadlord && height <= 0.0) groundFall[facing] = lowestFall;
    if (character === Character.dreadlord && (lowestFall === undefined || lowestFall !== groundFall[facing])) failures.push(`${label}: meteor bottomed out at ${lowestFall}, ${groundFall[facing]} on a ground cast`);
  }
  assertEquals([...new Set(failures)].join("; "), "");
});

test("an air cast draws its mark on the highest floor under it at or below the caster: a platform, the deck beneath one, or the caster's height over the void (#98) [k1 scenario]", () => {
  const stage = 1;
  const platform = 2;
  const scenario = scenarioOf(Character.medivh);
  const portalSpec = ultimateOf(Character.medivh).regionOrigin;
  const offset = portalSpec?.offsetX ?? 0.0;
  const overPlatform = f32(f32(surfaceLeft(stage, platform, 0) + 30.0) - offset);
  const overVoid = f32(f32(mainDeckRight(stage) + 90.0) - offset);
  const platformTop = surfaceZAt(stage, platform, 0, f32(overPlatform + offset));
  const failures: string[] = [];
  for (const { x, height, floor } of [
    { x: overPlatform, height: f32(platformTop + 130.0), floor: platformTop },
    { x: overPlatform, height: f32(platformTop - 70.0), floor: mainDeckZAt(stage, f32(overPlatform + offset)) },
    { x: overVoid, height: 300.0, floor: undefined },
  ]) {
    const b = airborneBout(scenario, 1, height, 1100.0);
    b.game.stageChoice = stage;
    b.owner.motion.x = x;
    b.owner.motion.z = height;
    b.owner.motion.vx = 0.0;
    b.owner.motion.vz = 0.0;
    b.step(ULTIMATE);
    const aloft = b.owner.motion.z;
    b.step();
    const portal = b.owner.projectiles.find((projectile) => projectile.life > 0 && projectile.spec === portalSpec);
    const expected = floor ?? aloft;
    if (portal?.z !== expected) failures.push(`cast at ${x}/${height}: portal at ${portal?.x}/${portal?.z}, expected z ${expected}`);
  }
  assertEquals(failures.join("; "), "");
});

test("on a rising lift Inferno, Light's Judgment and the Dark Portal draw every mark at the first, which rides the lift for its whole life when drawn on it and stays where it was drawn beside it, cast standing on the lift or from the air (#98, #113) [k1 scenario]", () => {
  const failures: string[] = [];
  for (const character of [Character.dreadlord, Character.forsakenPaladin, Character.medivh]) for (const facing of [-1, 1]) for (const air of [false, true]) {
    const scenario = scenarioOf(character);
    const specs = ultimateOf(character).projectiles ?? [];
    const first = specs[0];
    if (first === undefined) throw new Error(`no mark for ${name(character)}`);
    const b = bout(scenario, facing, Character.blademaster, 1100.0);
    b.game.stageChoice = TIMED_TEST_STAGE;
    b.game.matchFrame = LIFT_RISING;
    const clock = (): number => stageClock(b.game);
    const { motion } = b.owner;
    motion.x = air ? f32(-facing * f32(first.offsetX - 40.0)) : f32(-facing * Math.min(f32(first.offsetX - 120.0), 120.0));
    standOnFloor(b.owner, TIMED_TEST_STAGE, clock());
    if (air) {
      motion.grounded = false;
      motion.surface = undefined;
      motion.z = f32(motion.z + 200.0);
    }
    const label = `${name(character)} ${facing} ${air ? "air" : "standing"}`;
    const seen = new Set<SpecialProjectile>();
    let drawn: { readonly x: number; readonly z: number; readonly onLift: boolean } | undefined;
    const anchor = (): { readonly x: number; readonly z: number } | undefined =>
      drawn === undefined ? undefined : { x: drawn.x, z: drawn.onLift ? surfaceZAt(TIMED_TEST_STAGE, LIFT, clock(), drawn.x) : drawn.z };
    b.step(ULTIMATE);
    for (let tick = 0; tick < 90 && b.owner.special.action === SpecialAction.heroUltimate; tick++) {
      b.step();
      const mark = b.owner.projectiles.find((projectile) => projectile.life > 0 && projectile.spec === first);
      if (mark !== undefined && drawn === undefined) {
        const lift = surfaceZAt(TIMED_TEST_STAGE, LIFT, clock(), mark.x);
        if (mark.z !== lift) failures.push(`${label}: first mark at z ${mark.z}, lift at ${lift} on f${b.owner.special.frame}`);
        drawn = { x: mark.x, z: mark.z, onLift: mark.x >= surfaceLeft(TIMED_TEST_STAGE, LIFT, clock()) && mark.x <= surfaceRight(TIMED_TEST_STAGE, LIFT, clock()) };
      }
      const expected = anchor();
      if (mark !== undefined && (mark.x !== expected?.x || mark.z !== expected.z)) failures.push(`${label}: f${b.owner.special.frame} first mark at ${mark.x}/${mark.z}, expected ${expected?.x}/${expected?.z}`);
      for (const projectile of b.owner.projectiles) {
        const spec = projectile.spec;
        if (projectile.life <= 0 || spec === undefined || spec === first || !specs.includes(spec)) continue;
        seen.add(spec);
        const age = spec.life - projectile.life;
        const x = expected === undefined ? undefined : f32(expected.x + f32(facing * spec.offsetX));
        const z = expected === undefined ? undefined : f32(f32(expected.z + spec.offsetZ) + f32(spec.velocityZ * age));
        if (projectile.x !== x || projectile.z !== z) failures.push(`${label}: f${b.owner.special.frame} mark at ${projectile.x}/${projectile.z}, drawn at ${x}/${z}`);
      }
    }
    if (drawn === undefined) failures.push(`${label}: never drew the first mark`);
    else if (drawn.onLift !== (air || character !== Character.dreadlord)) failures.push(`${label}: first mark ${drawn.onLift ? "on" : "beside"} the lift at x ${drawn.x}`);
    if (seen.size !== specs.length - 1) failures.push(`${label}: drew ${seen.size} of ${specs.length - 1} marks at the first`);
  }
  assertEquals(failures.join("; "), "");
});

test("on a rising lift Light's Judgment's circle rides the lift, so its f52 and f64 pulses hit a foe standing on the lift in the circle, cast standing on the lift or from the air (#113) [k1 scenario]", () => {
  const failures: string[] = [];
  const circleSpec = ultimateOf(Character.forsakenPaladin).regionOrigin;
  for (const facing of [-1, 1]) for (const air of [false, true]) for (const pulse of [52, 64]) {
    const b = bout(scenarioOf(Character.forsakenPaladin), facing, Character.blademaster, 1100.0);
    b.game.stageChoice = TIMED_TEST_STAGE;
    b.game.matchFrame = LIFT_RISING;
    const clock = (): number => stageClock(b.game);
    const { motion } = b.owner;
    motion.x = air ? f32(-facing * 180.0) : f32(-facing * 100.0);
    standOnFloor(b.owner, TIMED_TEST_STAGE, clock());
    if (air) {
      motion.grounded = false;
      motion.surface = undefined;
      motion.z = f32(motion.z + 200.0);
    }
    const label = `${facing} ${air ? "air" : "standing"} f${pulse}`;
    let hitAt = 0;
    let damage = 0.0;
    b.step(ULTIMATE);
    for (let tick = 0; tick < 90 && b.owner.special.action === SpecialAction.heroUltimate; tick++) {
      if (b.owner.special.frame === pulse - 6) {
        const circle = b.owner.projectiles.find((projectile) => projectile.life > 0 && projectile.spec === circleSpec);
        if (circle === undefined) break;
        b.target.motion.x = circle.x;
        standOnFloor(b.target, TIMED_TEST_STAGE, clock());
        if (b.target.motion.surface !== LIFT) failures.push(`${label}: foe not on the lift at x ${circle.x}`);
        damage = b.target.status.damage;
      }
      b.step();
      if (hitAt === 0 && b.target.status.damage > damage) hitAt = b.owner.special.frame;
    }
    if (hitAt !== pulse) failures.push(`${label}: foe on the lift first hit at f${hitAt}`);
  }
  assertEquals(failures.join("; "), "");
});

test("each drawn-mark ultimate's marks stand through its strikes and its effects are gone within 12 frames of the last, with or without hitlag before it, cast standing or from the air [k3 measure docs/design/ultimates.md]", () => {
  const failures: string[] = [];
  for (const character of [Character.medivh, Character.forsakenPaladin, Character.dreadlord, Character.chen]) for (const near of [false, true]) for (const height of [0.0, 300.0]) {
    const scenario = scenarioOf(character);
    const move = ultimateOf(character);
    const gap = near ? scenario.x : 1100.0;
    const b = height > 0.0 ? airborneBout(scenario, 1, height, gap) : bout(scenario, 1, Character.blademaster, gap);
    const label = `${name(character)} ${near ? "near" : "alone"} height ${height}`;
    const regions = move.regions ?? [];
    const lastActive = Math.max(...regions.map((region) => region.lastFrame + 1));
    const specs = move.projectiles ?? [];
    const strikeMark = (index: number): SpecialProjectile | undefined => character === Character.chen ? specs[index] : move.regionOrigin;
    const standing = (spec: SpecialProjectile | undefined): boolean => b.owner.projectiles.some((projectile) => projectile.life > 0 && projectile.spec === spec);
    const aloft = character === Character.chen && height > 0.0 ? b.owner.motion.z : undefined;
    let lastActiveTick = 0;
    let anchoredAtLast = move.regionOrigin === undefined;
    let paused = 0;
    let goneTick = 0;
    b.step(ULTIMATE);
    for (let tick = 1; tick <= 160 && goneTick === 0; tick++) {
      if (aloft !== undefined) hover(b, aloft, aloft);
      b.step();
      if (b.owner.launch.hitlag > 0 && b.owner.special.frame < lastActive) paused++;
      const running = b.owner.special.action === SpecialAction.heroUltimate;
      for (const [index, region] of regions.entries()) {
        if (running && b.owner.special.frame === region.firstFrame + 1 && !standing(strikeMark(index))) failures.push(`${label}: strike ${index} at f${region.firstFrame + 1} without its mark`);
      }
      if (running && b.owner.special.frame === lastActive) {
        lastActiveTick = tick;
        if (move.regionOrigin !== undefined) anchoredAtLast = standing(move.regionOrigin);
      }
      if (lastActiveTick > 0 && !b.owner.projectiles.some((projectile) => projectile.life > 0 && projectile.spec !== undefined && specs.includes(projectile.spec))) goneTick = tick;
    }
    if (near && paused === 0) failures.push(`${label}: no hitlag before the last strike`);
    if (!anchoredAtLast) failures.push(`${label}: mark gone by the last active frame f${lastActive}`);
    if (goneTick === 0 || goneTick - lastActiveTick > 12) failures.push(`${label}: effects gone ${goneTick - lastActiveTick} frames after the last active frame`);
  }
  assertEquals([...new Set(failures)].join("; "), "");
});

const AIR_PORTAL_SAVE = 12;
const AIR_PORTAL_TICKS = 90;

function airPortalState(): ReplayState {
  const owner = createFighter(Character.medivh, -120.0, 1);
  const foe = createFighter(Character.blademaster, 120.0, -1);
  const match = createMatchState();
  match.phase = Phase.match;
  match.timeLimitMinutes = 0;
  const state: ReplayState = { world: createRoster(3, [owner, foe]), match, controls: createFrameControls(), runtime: createPacingAndPresentation() };
  for (let frame = 1; frame <= 8; frame++) {
    const row = createMatchFrameInput();
    assertTrue(captureFrame(row, frame, 3, state.controls, state.runtime));
    assertTrue(executeMatchFrame(row, match, state.world, state.controls, state.runtime, frame));
  }
  owner.mana.points = ROSTER_MANA.max;
  owner.motion.grounded = false;
  owner.motion.surface = undefined;
  owner.motion.z = f32(mainDeckZAt(0, owner.motion.x) + 300.0);
  owner.motion.vx = 0.0;
  owner.motion.vz = 0.0;
  return state;
}

function stepAirPortal(state: ReplayState, tick: number, foe: Readonly<Controls>): void {
  copyControls(state.controls.inputs[0], tick === 1 ? ULTIMATE : controls());
  copyControls(state.controls.inputs[1], foe);
  const row = createMatchFrameInput();
  assertTrue(captureFrame(row, tick + 8, 3, state.controls, state.runtime));
  assertTrue(executeMatchFrame(row, state.match, state.world, state.controls, state.runtime, tick + 8));
}

test("an air Dark Portal restored mid-hover after a mispredicted foe jump replays to the straight run's checksum on every frame (#98) [k1 scenario]", () => {
  const truth = airPortalState();
  const checksums: string[] = [];
  for (let tick = 1; tick <= AIR_PORTAL_TICKS; tick++) {
    stepAirPortal(truth, tick, controls());
    checksums.push(String(stateChecksum(truth)));
  }
  assertGreaterThan(fighterAt(truth.world, 1).status.damage, 0.0);
  const live = airPortalState();
  for (let tick = 1; tick <= AIR_PORTAL_SAVE; tick++) stepAirPortal(live, tick, controls());
  const caster = fighterAt(live.world, 0);
  assertTrue(caster.special.action === SpecialAction.heroUltimate && !caster.motion.grounded && caster.special.frame < firstThreat(ultimateOf(Character.medivh)));
  const saved = createReplaySnapshot();
  copyReplayState(saved, live);
  for (let tick = AIR_PORTAL_SAVE + 1; tick <= AIR_PORTAL_SAVE + 40; tick++) stepAirPortal(live, tick, controls({ jumpPressed: true, jumpHeld: true, direction: 1 }));
  assertTrue(String(stateChecksum(live)) !== checksums[AIR_PORTAL_SAVE + 39]);
  copyReplayState(live, saved);
  const failures: string[] = [];
  for (let tick = AIR_PORTAL_SAVE + 1; tick <= AIR_PORTAL_TICKS; tick++) {
    stepAirPortal(live, tick, controls());
    if (String(stateChecksum(live)) !== checksums[tick - 1]) failures.push(`f${tick}`);
  }
  assertEquals(failures.join(","), "");
  assertEquals(firstStateDifference(truth, live), undefined);
});
const EX = controls({ specialPressed: true, exPressed: true });

test("Cairne centre ankh burst and arrival replay per frame, including a displaced-anchor fault [k1 scenario]", () => {
  for (const { stage, facing, answer } of [
    { stage: 0, facing: 1, answer: "hit" },
    { stage: SLOPE_TEST_STAGE, facing: -1, answer: "shield" },
    { stage: SLOPE_TEST_STAGE, facing: 1, answer: "leave" },
    { stage: 0, facing: 1, answer: "wide" },
  ]) {
    const move = ultimateOf(Character.cairne);
    const ankhSpec = move.regionOrigin;
    assertTrue(ankhSpec !== undefined);
    const owner = createFighter(Character.cairne, facing * -450.0, facing);
    const inside = createFighter(Character.blademaster, answer === "leave" ? 250.0 : answer === "wide" ? -190.0 : 50.0, answer === "wide" ? 1 : -facing);
    const outside = createFighter(Character.rifleman, 350.0, -1);
    const match = createMatchState();
    match.phase = Phase.match;
    match.stageChoice = stage;
    match.timeLimitMinutes = 0;
    const live: ReplayState = { world: createRoster(7, [owner, inside, outside]), match, controls: createFrameControls(), runtime: createPacingAndPresentation() };
    const replay = createReplaySnapshot();
    const saved = createReplaySnapshot();
    const centreX = f32(f32(mainDeckLeft(stage) + mainDeckRight(stage)) * 0.5);
    const centreZ = mainDeckZAt(stage, centreX);
    for (const fighter of [owner, inside, outside]) fighter.motion.z = mainDeckZAt(stage, fighter.motion.x);
    for (let frame = 1; frame <= 8; frame++) {
      const row = createMatchFrameInput();
      assertTrue(captureFrame(row, frame, 7, live.controls, live.runtime));
      assertTrue(executeMatchFrame(row, match, live.world, live.controls, live.runtime, frame));
    }
    owner.mana.points = ROSTER_MANA.max;
    const startX = owner.motion.x;
    let firstHit = 0;
    let firstBurst = 0;
    let arrival = 0;
    let protectedFrames = 0;
    let lastDamage = 0.0;
    let hits = 0;
    const recorded: string[] = [];
    for (let tick = 1; tick <= 70; tick++) {
      copyControls(live.controls.inputs[0], tick === 1 ? ULTIMATE : controls());
      copyControls(live.controls.inputs[1], answer === "shield" ? SHIELD : controls());
      const row = createMatchFrameInput();
      assertTrue(captureFrame(row, tick + 8, 7, live.controls, live.runtime));
      assertTrue(executeMatchFrame(row, match, live.world, live.controls, live.runtime, tick + 8));
      const ankh = owner.projectiles.find((projectile) => projectile.life > 0 && projectile.spec === ankhSpec);
      const region = move.regions?.[0]?.hit.strike;
      const burst = owner.projectiles.some((projectile) => projectile.life > 0 && projectile.spec?.spawnFrame === 25);
      if (burst && firstBurst === 0) firstBurst = tick;
      if (inside.status.damage > lastDamage) {
        hits++;
        if (firstHit === 0) firstHit = tick;
      }
      lastDamage = inside.status.damage;
      if (owner.motion.x === centreX && arrival === 0) arrival = tick;
      if (arrival === tick) assertEquals(owner.motion.z, centreZ, `arrival deck at ${tick}`);
      const intangible = isIntangible(owner);
      if (intangible) {
        assertEquals(arrival > 0, true, `protection before teleport at ${tick}`);
        protectedFrames++;
      }
      assertEquals(outside.status.damage, 0.0, `outside burst at ${tick}`);
      if (arrival === 0) assertEquals(owner.motion.x, startX, `early teleport at ${tick}`);
      if (ankh !== undefined) {
        assertEquals(ankh.x, centreX, `ankh x at ${tick}`);
        assertEquals(ankh.z, centreZ, `ankh deck at ${tick}`);
      }
      if (tick === 1) assertEquals(ankh !== undefined, true, "ankh spawns on the first tick");
      if (arrival > 0) assertEquals(intangible, tick < arrival + 6, `arrival protection at ${tick}`);
      if (tick < 25) assertEquals(inside.status.damage, 0.0, `early hit at ${tick}`);
      recorded.push(`${tick}:stage=${stage},centre=${centreX}/${centreZ},move=${owner.special.frame},ankh=${ankh?.x}/${ankh?.z},owner=${owner.motion.x}/${owner.motion.z},region=${tick === firstBurst && region !== undefined && ankh !== undefined ? `${f32(ankh.x + region.x1)}/${f32(ankh.z + region.z1)}/${region.radius}` : "none"},burst=${burst},inside=${inside.status.damage},outside=${outside.status.damage},arrival=${arrival},intangible=${intangible}`);
      if (tick === 20) {
        copyReplayState(saved, live);
        copyReplayState(replay, live);
      } else if (tick > 20) {
        assertTrue(executeMatchFrame(row, replay.match, replay.world, replay.controls, replay.runtime, tick + 8));
        assertEquals(firstStateDifference(live, replay), undefined, recorded[tick - 1]);
        if (tick === 70) assertEquals(stateChecksum(live), stateChecksum(replay), recorded[tick - 1]);
      }
    }
    assertEquals(firstBurst, 25, recorded.join("\n"));
    assertEquals(firstHit, answer === "hit" || answer === "wide" ? 25 : 0, recorded.join("\n"));
    assertEquals(hits, answer === "hit" || answer === "wide" ? 1 : 0, recorded.join("\n"));
    assertEquals(arrival, answer === "hit" || answer === "wide" || answer === "shield" ? 32 : 26, recorded.join("\n"));
    assertEquals(protectedFrames, 6, recorded.join("\n"));
    copyReplayState(replay, saved);
    const shiftedIndex = fighterAt(replay.world, 0).projectiles.findIndex((projectile) => projectile.life > 0 && projectile.spec === ankhSpec);
    assertTrue(shiftedIndex >= 0);
    if (shiftedIndex < 0) throw new Error("missing recorded ankh");
    const shifted = mutableProjectile(fighterAt(replay.world, 0), shiftedIndex);
    shifted.x = f32(shifted.x + 400.0);
    assertTrue(firstStateDifference(saved, replay) !== undefined);
    assertTrue(stateChecksum(saved) !== stateChecksum(replay));
  }
});

interface BansheeRun {
  contact: number;
  contactDamage: number;
  carry: number;
  span: number;
  ticks: number;
  tickDamage: number[];
  bystanderShift: number;
  ownerDamage: number;
  turnedTooFar: number;
  intangibleSeek: number;
  targetDamage: number;
  recorded: string[];
}

/** Sylvanas dives at Blademaster while a Rifleman walks into her wake and stands; `fault` shifts one trail piece's clock at the seal. */
function bansheeRun(fault: boolean, saveAt?: (state: ReplayState) => void): BansheeRun {
  const owner = createFighter(Character.sylvanas, -50.0, 1);
  const target = createFighter(Character.blademaster, 200.0, -1);
  const bystander = createFighter(Character.rifleman, -330.0, 1);
  const match = createMatchState();
  match.phase = Phase.match;
  match.timeLimitMinutes = 0;
  const live: ReplayState = { world: createRoster(7, [owner, target, bystander]), match, controls: createFrameControls(), runtime: createPacingAndPresentation() };
  const replay = createReplaySnapshot();
  for (let frame = 1; frame <= 8; frame++) {
    const row = createMatchFrameInput();
    assertTrue(captureFrame(row, frame, 7, live.controls, live.runtime));
    assertTrue(executeMatchFrame(row, match, live.world, live.controls, live.runtime, frame));
  }
  owner.mana.points = ROSTER_MANA.max;
  const run: BansheeRun = { contact: 0, contactDamage: 0, carry: 0, span: 0, ticks: 0, tickDamage: [], bystanderShift: 0, ownerDamage: 0, turnedTooFar: 0, intangibleSeek: 0, targetDamage: 0, recorded: [] };
  const turnCos = ultimateOf(Character.sylvanas).motion?.find((segment) => segment.seek !== undefined)?.seek?.turnCos ?? 1.0;
  let contactX = 0.0;
  let lastTarget = 0.0;
  let lastBystander = 0.0;
  let standingX: number | undefined;
  let sealed = false;
  let headingX = 0.0;
  let lastSeekFrame = 0;
  let headingZ = 0.0;
  for (let tick = 1; tick <= 240; tick++) {
    const walking = standingX === undefined && bystander.motion.x < -40.0;
    copyControls(live.controls.inputs[0], tick === 1 ? ULTIMATE : controls());
    copyControls(live.controls.inputs[1], controls());
    copyControls(live.controls.inputs[2], walking ? controls({ direction: 1, walking: true }) : controls());
    const row = createMatchFrameInput();
    assertTrue(captureFrame(row, tick + 8, 7, live.controls, live.runtime));
    assertTrue(executeMatchFrame(row, match, live.world, live.controls, live.runtime, tick + 8));
    if (owner.special.action === SpecialAction.heroUltimate) {
      const phase = owner.special.frame;
      const ethereal = owner.special.form === 0 ? phase >= 19 && phase <= 98 : phase >= 1 && phase <= 9;
      assertEquals(isIntangible(owner), ethereal, `Banshee contact protection ${phase}/${owner.special.form} at ${tick}`);
    }
    if (!walking && standingX === undefined && bystander.motion.vx === 0.0) standingX = bystander.motion.x;
    const pieces = owner.projectiles.filter((projectile) => projectile.life > 0 && projectile.spec?.trail !== undefined && projectile.spec.trail.every > 0);
    if (!sealed && pieces.length > 0) {
      sealed = true;
      run.carry = f32(owner.motion.x - contactX);
      const xs = pieces.map((piece) => piece.x);
      run.span = f32(Math.max(...xs) - Math.min(...xs));
      if (fault) {
        const piece = owner.projectiles.findIndex((projectile) => projectile.life > 0 && projectile.spec?.trail !== undefined && projectile.spec.trail.every > 0 && projectile.x === Math.min(...xs));
        if (piece >= 0) mutableProjectile(owner, piece).life -= 10;
      }
    }
    if (target.status.damage > lastTarget && run.contact === 0) {
      run.contact = owner.special.frame;
      run.contactDamage = target.status.damage;
      contactX = owner.motion.x;
    }
    lastTarget = target.status.damage;
    if (bystander.status.damage > lastBystander) {
      run.ticks++;
      run.tickDamage.push(f32(bystander.status.damage - lastBystander));
      assertEquals(bystander.launch.hitstun, 3, `tick flinch at ${tick}`);
    }
    lastBystander = bystander.status.damage;
    if (standingX !== undefined) run.bystanderShift = Math.max(run.bystanderShift, Math.abs(f32(bystander.motion.x - standingX)));
    const seeking = owner.special.action === SpecialAction.heroUltimate && owner.special.form === 0 && owner.special.frame >= 19 && owner.special.frame <= 98;
    if (seeking && owner.special.frame !== lastSeekFrame) {
      lastSeekFrame = owner.special.frame;
      if (isIntangible(owner)) run.intangibleSeek++;
      const speed = Math.sqrt(owner.motion.vx * owner.motion.vx + owner.motion.vz * owner.motion.vz);
      const nextX = owner.motion.vx / speed;
      const nextZ = owner.motion.vz / speed;
      if (headingX !== 0.0 || headingZ !== 0.0) {
        if (nextX * headingX + nextZ * headingZ < turnCos - f32(1e-6)) run.turnedTooFar++;
      }
      headingX = nextX;
      headingZ = nextZ;
    }
    run.ownerDamage = Math.max(run.ownerDamage, owner.status.damage);
    run.recorded.push(`${tick}:move=${owner.special.frame}/${owner.special.form},owner=${owner.motion.x}/${owner.motion.z},v=${owner.motion.vx}/${owner.motion.vz},target=${target.motion.x}/${target.status.damage},bystander=${bystander.motion.x}/${bystander.status.damage},pieces=${pieces.map((piece) => `${piece.x}@${piece.life}`).join(";")}`);
    if (tick === 30 && saveAt !== undefined) {
      saveAt(live);
      copyReplayState(replay, live);
    } else if (tick > 30 && saveAt !== undefined) {
      assertTrue(executeMatchFrame(row, replay.match, replay.world, replay.controls, replay.runtime, tick + 8));
      assertEquals(firstStateDifference(live, replay), undefined, run.recorded[tick - 1]);
      if (tick === 240) assertEquals(stateChecksum(live), stateChecksum(replay), run.recorded[tick - 1]);
    }
  }
  run.targetDamage = target.status.damage;
  return run;
}

function bansheeStartupContact(boundary: number): Fighter {
  const owner = createFighter(Character.sylvanas, -150.0, 1);
  const foe = createFighter(Character.rifleman, 150.0, -1);
  const world = createRoster(3, [owner, foe]);
  const game = createMatchState();
  game.phase = Phase.match;
  const inputs = createFrameControls();
  for (let tick = 1; tick <= 8 + boundary; tick++) {
    copyControls(inputs.inputs[0], tick === 9 ? ULTIMATE : controls());
    if (tick === 9) owner.mana.points = ROSTER_MANA.max;
    if (tick === 8 + boundary) {
      const projectile = spawnProjectileMotion(foe, ProjectileKind.blaster, -36.0, 0.0, 60, 100);
      assertTrue(projectile !== undefined);
      if (projectile !== undefined) {
        projectile.x = f32(owner.motion.x + 36.0);
        projectile.z = f32(owner.motion.z + 75.0);
      }
    }
    stepMatch(game, world, inputs, tick);
  }
  return owner;
}

function bansheeCounterplay(shield: boolean): void {
  const owner = createFighter(Character.sylvanas, shield ? -150.0 : 0.0, 1);
  const foe = createFighter(Character.blademaster, shield ? 150.0 : 0.0, -1);
  const world = createRoster(3, [owner, foe]);
  const game = createMatchState();
  game.phase = Phase.match;
  const inputs = createFrameControls();
  let contact = 0;
  let seal = 0;
  let ended = 0;
  for (let tick = 1; tick <= 136; tick++) {
    if (tick === 9) {
      owner.mana.points = ROSTER_MANA.max;
      if (!shield) {
        owner.motion.z = f32(mainDeckZAt(0, 0.0) + 300.0);
        owner.motion.grounded = false;
        owner.motion.surface = undefined;
        owner.motion.vx = 0.0;
        owner.motion.vz = 0.0;
      }
    }
    copyControls(inputs.inputs[0], tick === 9 ? ULTIMATE : controls());
    copyControls(inputs.inputs[1], shield ? SHIELD : tick >= 37 ? controls({ direction: 1 }) : controls());
    stepMatch(game, world, inputs, tick);
    if (contact === 0 && owner.special.hit) contact = tick - 8;
    if (seal === 0 && owner.projectiles.some((piece) => piece.life > 0 && piece.spec?.trail?.every === 20)) seal = tick - 8;
    if (ended === 0 && tick > 9 && owner.special.action === SpecialAction.none) ended = tick - 8;
    if (!shield && (tick === 106 || tick === 107)) assertEquals(foe.status.out, false, `miss target alive at ${tick - 8}`);
  }
  assertEquals(contact, shield ? 43 : 0);
  assertEquals(seal, shield ? 59 : 99);
  assertEquals(ended, shield ? 78 : 128);
  assertEquals(foe.status.damage, 0.0);
}

test("Sylvanas's Banshee Form homes, connects, carries through and leaves a trail that ticks a standing foe six times, replayed per frame, with a shifted trail clock fault (#511) [k1 scenario]", () => {
  for (const frame of [17, 18, 19]) {
    const owner = bansheeStartupContact(frame);
    assertEquals(owner.status.damage > 0.0, frame <= 18, `startup contact frame ${frame}`);
    assertEquals(owner.special.action === SpecialAction.none, frame <= 18, `startup cancellation frame ${frame}`);
  }
  const reset = createFighter(Character.sylvanas, 0.0, 1);
  reset.special.seekTarget = 3;
  clearSpecialOnStock(reset);
  assertEquals(reset.special.seekTarget, 0);
  bansheeCounterplay(true);
  bansheeCounterplay(false);
  const run = bansheeRun(false, () => undefined);
  const log = run.recorded.join("\n");
  assertEquals(run.contact >= 19 && run.contact <= 98, true, log);
  assertEquals(run.contactDamage, 14.0, log);
  assertEquals(run.carry >= 72.0 && run.carry <= 90.0, true, `carry ${run.carry}\n${log}`);
  assertEquals(run.span >= 270.0 && run.span <= 360.0, true, `span ${run.span}\n${log}`);
  assertEquals(run.ticks, 6, log);
  assertEquals(run.tickDamage.filter((damage) => damage !== 1.0).length, 0, log);
  assertEquals(run.bystanderShift, 0.0, log);
  assertEquals(run.ownerDamage, 0.0, log);
  assertEquals(run.turnedTooFar, 0, log);
  assertEquals(run.intangibleSeek, run.contact - 18, log);
  assertEquals(run.targetDamage <= 20.0, true, log);
  assertEquals(bansheeRun(true).ticks !== 6, true, "a trail piece off the shared clock must tick the standing foe a seventh time");
});

test("with Ultimates off no fighter performs an ultimate from Attack + Special, EX still spends one segment and a landed hit still fills the bar [k3 measure #382]", () => {
  const failures: string[] = [];
  for (const scenario of ULTIMATE_SCENARIOS) {
    const held = bout(scenario, 1, Character.blademaster, scenario.x, true);
    for (let tick = 0; tick < 90; tick++) {
      held.step(ULTIMATE);
      if (held.owner.special.action === SpecialAction.heroUltimate) failures.push(`${name(scenario.character)} performed it`);
    }
    if (held.owner.mana.points !== ROSTER_MANA.max) failures.push(`${name(scenario.character)} spent ${held.owner.mana.points}`);
    const ex = bout(scenario, 1, Character.blademaster, 600.0, true);
    ex.step(EX);
    if (ex.owner.mana.points !== ROSTER_MANA.max - ROSTER_MANA.exCost) failures.push(`${name(scenario.character)} EX left ${ex.owner.mana.points}`);
  }
  assertEquals(failures.join("; "), "");
  const filling = bout({ character: Character.blademaster, x: 60.0, defence: "shield" }, 1, Character.blademaster, 60.0, true);
  filling.owner.mana.points = 0;
  for (let tick = 0; tick < 200; tick++) {
    if (floorMod(tick, 24) === 0) queueAttack(filling.commands[0] ?? attackBuffer(ATTACK_BUFFER_FRAMES), { style: AttackStyle.jab, facing: 0, frame: filling.frame() + 1, mayCharge: false });
    filling.step();
  }
  assertGreaterThan(filling.target.status.damage, 0.0);
  assertGreaterThan(filling.owner.mana.points, 0);
});

interface CpuUltimates {
  starts: number;
  landed: number;
  outOfReach: number;
  shielded: number;
  users: number;
}

const WATCH_FRAMES = 150;
const REFILL_FRAMES = 120;

function cpuUltimates(characters: readonly Character[], tier: CpuTier, seed: number, frames: number, off: boolean): CpuUltimates {
  const total: CpuUltimates = { starts: 0, landed: 0, outOfReach: 0, shielded: 0, users: 0 };
  for (const [index, character] of characters.entries()) {
    const foe = SELECTABLE_CHARACTERS[floorMod(SELECTABLE_CHARACTERS.indexOf(character) + 7, SELECTABLE_CHARACTERS.length)] ?? Character.blademaster;
    const world = createRoster(3, [createFighter(character, -200.0, 1), createFighter(foe, 200.0, -1)]);
    const match = createMatchState();
    match.phase = Phase.match;
    match.ultimatesOff = off;
    for (const slot of [0, 1] as const) {
      match.cpuOpponents[slot] = "wren";
      match.cpuResolvedOpponents[slot] = "wren";
      match.cpuTiers[slot] = tier;
    }
    match.stageChoice = 0;
    match.timeLimitMinutes = 0;
    match.matchSeed = sweepSeed(seed * 31 + index);
    const produced = createFrameControls();
    const executed = createFrameControls();
    const runtime = createPacingAndPresentation();
    const row = createMatchFrameInput();
    const me = fighterAt(world, 0);
    const other = fighterAt(world, 1);
    me.mana.points = ROSTER_MANA.max;
    const reach = ULTIMATE_REACH[character];
    let was = false;
    let watch = -1;
    let cooldown = 0;
    let base = 0.0;
    let stocks = 0;
    let used = 0;
    for (let n = 0; n < frames; n++) {
      const frame = runtime.simulationFrame + 1;
      if (cooldown > 0) cooldown--;
      else if (watch < 0 && !was && me.mana.points < ROSTER_MANA.max) me.mana.points = ROSTER_MANA.max;
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(world, slot)) continue;
        copyControls(produced.inputs[slot], neutralControls());
        clearAttackBuffer(produced.commands[slot]);
        produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot]);
      }
      const gap = Math.abs(f32(other.motion.x - me.motion.x));
      const shield = other.shield.raised;
      const damage = other.status.damage;
      const lives = other.status.stocks;
      captureFrame(row, frame, world.mask, produced, runtime);
      executeMatchFrame(row, match, world, executed, runtime, frame);
      const now = me.special.action === SpecialAction.heroUltimate;
      if (now && !was) {
        total.starts++;
        used++;
        if (shield) total.shielded++;
        if (reach === undefined || gap < reach.near || gap > reach.far) total.outOfReach++;
        watch = WATCH_FRAMES;
        base = damage;
        stocks = lives;
      }
      if (watch >= 0) {
        if (other.status.damage > base || other.status.stocks < stocks) {
          total.landed++;
          watch = -1;
          cooldown = REFILL_FRAMES;
        } else if (--watch < 0) cooldown = REFILL_FRAMES;
      }
      was = now;
    }
    if (used > 0) total.users++;
  }
  return total;
}

const SWEEP_FRAMES = 900;

sweep("Wren Rookie computers never press an ultimate and no computer does with Ultimates off [k3 measure #382]", () => {
  assertEquals(cpuUltimates(SELECTABLE_CHARACTERS, "rookie", 0, SWEEP_FRAMES, false).starts, 0);
  assertEquals(cpuUltimates(SELECTABLE_CHARACTERS, "expert", 0, SWEEP_FRAMES, true).starts, 0);
});


interface VoodooRun {
  /** Each bolt as it spawns: the dance frame, which side of him and which way it flies. */
  readonly bolts: { readonly frame: number; readonly side: number; readonly direction: number }[];
  hitFrame: number;
  wardsAfterHit: number;
}

const sign = (value: number): number => value > 0.0 ? 1 : value < 0.0 ? -1 : 0;

/** Shadow Hunter dances Big Bad Voodoo; a Blademaster beside him jabs him on `jabTick`. `survive` injects the fault: the wards outlive the hit. */
function voodoo(facing: number, jabTick: number, survive: boolean): VoodooRun {
  const b = bout({ character: Character.shadowHunter, x: 90.0, defence: "shield" }, facing);
  const placement = ultimateOf(Character.shadowHunter).placement;
  const run: VoodooRun = { bolts: [], hitFrame: -1, wardsAfterHit: 0 };
  b.step(ULTIMATE);
  const lives = [0, 0];
  for (let tick = 1; tick < ultimateOf(Character.shadowHunter).endFrame + 20; tick++) {
    if (tick === jabTick) queueAttack(b.commands[1] ?? attackBuffer(ATTACK_BUFFER_FRAMES), { style: AttackStyle.jab, facing: 0, frame: b.frame() + 1, mayCharge: false });
    const dancing = b.owner.special.action === SpecialAction.heroUltimate;
    lives[0] = placedObject(b.owner, 1).life;
    lives[1] = placedObject(b.owner, 2).life;
    b.step();
    for (const shot of b.owner.projectiles) {
      const spec = shot.spec;
      if (shot.life <= 0 || spec === undefined || (spec !== placement?.shot && spec !== placement?.finalShot) || shot.life !== spec.life) continue;
      run.bolts.push({ frame: b.owner.special.frame, side: sign(f32(shot.x - b.owner.motion.x) * facing), direction: sign(shot.velocityX * facing) });
    }
    if (dancing && b.owner.special.action !== SpecialAction.heroUltimate && run.hitFrame < 0 && b.owner.launch.hitstun > 0) run.hitFrame = tick;
    for (const slot of [1, 2]) {
      const ward = placedObject(b.owner, slot);
      const before = lives[slot - 1] ?? 0;
      if (survive && run.hitFrame >= 0 && ward.life <= 0 && before > 1) mutablePlacedObject(b.owner, slot).life = before - 1;
      if (run.hitFrame >= 0 && ward.life > 0) run.wardsAfterHit++;
    }
  }
  return run;
}

/** What breaks the move's promise: each volley fires from both wards outward, and a hit on the dancer removes both. */
function voodooFindings(facing: number, survive: boolean): string[] {
  const findings: string[] = [];
  const move = ultimateOf(Character.shadowHunter);
  const placement = move.placement;
  if (placement === undefined) return ["no wards"];
  const volleys = placement.fireAges.map((age) => placement.frame + age - 1);
  const untouched = voodoo(facing, 999, survive);
  for (const frame of volleys) {
    const volley = untouched.bolts.filter((bolt) => bolt.frame === frame);
    const outward = volley.filter((bolt) => bolt.side === bolt.direction && bolt.side !== 0);
    if (volley.length !== 2 || outward.length !== 2 || volley[0]?.side === volley[1]?.side) findings.push(`facing ${facing} volley ${frame}: ${volley.length} bolts, ${outward.length} outward`);
  }
  if (untouched.bolts.length !== 2 * volleys.length) findings.push(`facing ${facing}: ${untouched.bolts.length} bolts undisturbed`);
  const struck = voodoo(facing, 40, survive);
  if (struck.hitFrame < 0) findings.push(`facing ${facing}: the jab never hit the dancer`);
  if (struck.wardsAfterHit > 0) findings.push(`facing ${facing}: wards stood ${struck.wardsAfterHit} ward-frames after the hit`);
  const late = struck.bolts.filter((bolt) => bolt.frame === 0 || bolt.frame > struck.hitFrame);
  if (late.length > 0) findings.push(`facing ${facing}: ${late.length} bolts after the hit`);
  return findings;
}

test("Big Bad Voodoo: both wards fire every volley outward from their own side, and a jab on the dancer ends the dance and removes both, which an injected surviving-wards fault trips [k1 scenario]", () => {
  for (const facing of [-1, 1]) {
    assertEquals(voodooFindings(facing, false).join("; "), "");
    assertGreaterThan(voodooFindings(facing, true).length, 0);
  }
});

export const LICH_CONNECT_SEEDS = [17, 83, 241] as const;
export type LichAnswer = "standing" | "moving" | "shield" | "jump" | "roll";

export function ultimateFieldRun(stage: number, gap: number, seed: number, facing: number, answer: LichAnswer, character: Character = Character.lich, frames = 128): { started: boolean; damage: number; firstHit: number; shieldFrames: number } {
  const owner = createFighter(character, f32(-gap * facing * 0.5), facing);
  const target = createFighter(Character.blademaster, f32(gap * facing * 0.5), -facing);
  owner.motion.z = mainDeckZAt(stage, owner.motion.x);
  target.motion.z = mainDeckZAt(stage, target.motion.x);
  const world = createRoster(3, [owner, target]);
  const match = createMatchState();
  match.phase = Phase.match;
  match.stageChoice = stage;
  match.hazards = false;
  match.timeLimitMinutes = 0;
  match.matchSeed = seed;
  match.cpuOpponents[1] = "wren";
  match.cpuResolvedOpponents[1] = "wren";
  match.cpuTiers[1] = "expert";
  const runtime = createPacingAndPresentation();
  const produced = createFrameControls();
  const executed = createFrameControls();
  const row = createMatchFrameInput();
  const result = { started: false, damage: 0.0, firstHit: 0, shieldFrames: 0 };
  for (let frame = 1; frame <= frames; frame++) {
    const tick = frame - 8;
    copyControls(produced.inputs[0], tick === 1 ? controls({ specialPressed: true, ultimatePressed: true, attackHeld: true }) : neutralControls());
    copyControls(produced.inputs[1], neutralControls());
    clearAttackBuffer(produced.commands[0]);
    clearAttackBuffer(produced.commands[1]);
    if (tick === 1) owner.mana.points = 100;
    if (tick >= 1) {
      if (answer === "moving") produceComputerInput(match, world, runtime, 1, frame, produced.inputs[1], produced.commands[1]);
      if (answer === "shield") copyControls(produced.inputs[1], controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0 }));
      if (answer === "jump") copyControls(produced.inputs[1], controls({ jumpPressed: tick === 42, jumpHeld: tick >= 42 && tick < 72 }));
      if (answer === "roll") copyControls(produced.inputs[1], controls({ shield: tick >= 54 && tick <= 56, shieldTriggerActive: tick >= 54 && tick <= 56, shieldStrength: 1.0, groundDodgePressed: tick === 55, groundDodgeDirection: facing }));
    }
    assertTrue(captureFrame(row, frame, 3, produced, runtime));
    assertTrue(executeMatchFrame(row, match, world, executed, runtime, frame));
    if (tick === 1) result.started = owner.special.action === SpecialAction.heroUltimate;
    if (target.status.damage > 0.0 && result.firstHit === 0) result.firstHit = tick;
    if (target.shield.raised) result.shieldFrames++;
  }
  result.damage = target.status.damage;
  return result;
}

function connect(stageIds: readonly number[], seeds: readonly number[], answer: "standing" | "moving", character: Character = Character.lich, frames = 128): { hits: number; total: number } {
  let hits = 0;
  let total = 0;
  for (const stage of stageIds) for (const seed of seeds) for (const facing of [-1, 1]) {
    const run = ultimateFieldRun(stage, 300.0, seed, facing, answer, character, frames);
    assertEquals(run.started, true, `stage ${stage} gap 300 seed ${seed} facing ${facing}`);
    total++;
    if (run.damage > 0.0) hits++;
  }
  return { hits, total };
}

test("Frost Wyrm deals damage in at least 70% of fixed gap 300 standing and Wren Expert approaches [k3 measure docs/design/ultimates.md]", () => {
  for (const answer of ["standing", "moving"] as const) {
    const result = connect([0], LICH_CONNECT_SEEDS, answer);
    assertEquals(result.hits * 10 >= result.total * 7, true, `${answer}: ${result.hits}/${result.total}`);
  }
});

sweep("Frost Wyrm deals damage in at least 70% of fixed gap 300 standing and Wren Expert approaches on every stage [k3 measure docs/design/ultimates.md]", () => {
  for (const answer of ["standing", "moving"] as const) for (const stage of STAGE_CATALOG) {
    const result = connect([stage.id], LICH_CONNECT_SEEDS, answer);
    assertEquals(result.hits * 10 >= result.total * 7, true, `${stage.name} ${answer}: ${result.hits}/${result.total}`);
  }
});

test("Frost Wyrm startup can be answered with shield, jump or roll [k3 measure docs/design/ultimates.md]", () => {
  for (const facing of [-1, 1]) for (const answer of ["shield", "jump", "roll"] as const) {
    const run = ultimateFieldRun(0, 300.0, 17, facing, answer);
    assertTrue(run.started);
    assertEquals(run.damage, 0.0, `${answer} facing ${facing}`);
    if (answer === "shield") assertTrue(run.shieldFrames > 0);
  }
});

const TOWER_RUSH_FRAMES = 8 + 250;

test("Tower Rush deals damage in at least 70% of fixed gap 300 standing and Wren Expert approaches [k3 measure docs/design/ultimates.md]", () => {
  for (const answer of ["standing", "moving"] as const) {
    const result = connect([0], LICH_CONNECT_SEEDS, answer, Character.peon, TOWER_RUSH_FRAMES);
    assertEquals(result.hits * 10 >= result.total * 7, true, `${answer}: ${result.hits}/${result.total}`);
  }
});

sweep("Tower Rush deals damage in at least 70% of fixed gap 300 standing and Wren Expert approaches on every stage [k3 measure docs/design/ultimates.md]", () => {
  for (const answer of ["standing", "moving"] as const) for (const stage of STAGE_CATALOG) {
    const result = connect([stage.id], LICH_CONNECT_SEEDS, answer, Character.peon, TOWER_RUSH_FRAMES);
    assertEquals(result.hits * 10 >= result.total * 7, true, `${stage.name} ${answer}: ${result.hits}/${result.total}`);
  }
});

test("Tower Rush arrows are all taken on a held shield [k3 measure docs/design/ultimates.md]", () => {
  for (const facing of [-1, 1]) {
    const run = ultimateFieldRun(0, 300.0, 17, facing, "shield", Character.peon, TOWER_RUSH_FRAMES);
    assertTrue(run.started);
    assertEquals(run.damage, 0.0, `facing ${facing}`);
    assertTrue(run.shieldFrames > 0);
  }
});

function towerBreak(facing: number, smashTick: number): { arrows: number; crumbleTick: number; total: number } {
  const b = bout({ character: Character.peon, x: 250.0, defence: "shield" }, facing);
  const placement = ultimateOf(Character.peon).placement;
  const tower = placedObject(b.owner, 2);
  const result = { arrows: 0, crumbleTick: -1, total: 0 };
  b.step(ULTIMATE);
  for (let tick = 1; tick < 220; tick++) {
    if (tick === smashTick) queueAttack(b.commands[1] ?? attackBuffer(ATTACK_BUFFER_FRAMES), { style: AttackStyle.forwardSmash, facing: facing < 0 ? 1 : -1, frame: b.frame() + 1, mayCharge: false });
    b.step();
    if (result.crumbleTick < 0 && tower.spec === placement && tower.life > 0 && tower.life <= (placement?.crumble ?? 0)) result.crumbleTick = tick;
    for (const shot of b.owner.projectiles) {
      if (shot.life <= 0 || shot.spec !== placement?.shot || shot.life !== placement?.shot?.life) continue;
      result.total++;
      if (Math.abs(f32(shot.x - tower.x)) <= 40.0) result.arrows++;
    }
  }
  return result;
}

test("Tower Rush: a forward smash breaks a rising tower, which crumbles at once and never fires, while the rest keep shooting [k1 scenario]", () => {
  for (const facing of [-1, 1]) {
    const standing = towerBreak(facing, 999);
    assertGreaterThan(standing.arrows, 0);
    assertGreaterThan(standing.crumbleTick, 150);
    const broken = towerBreak(facing, 16);
    assertEquals(broken.arrows, 0, `facing ${facing}`);
    assertTrue(broken.crumbleTick > 0 && broken.crumbleTick < 60);
    assertGreaterThan(broken.total, 0);
  }
});

function refusedOverVoid(character: Character, facing: number): boolean {
  const b = airborneBout(scenarioOf(character), facing, 150.0);
  b.owner.motion.x = f32(mainDeckRight(0) + 300.0);
  b.step(ULTIMATE);
  return b.owner.special.action !== SpecialAction.heroUltimate && b.owner.mana.points === ROSTER_MANA.max;
}

test("Storm, Earth and Fire cast in the air holds Chen through his last strike, so each spirit strikes where it was drawn at his height and still stands there after Earth's hitlag (#98) [k1 scenario]", () => {
  const move = ultimateOf(Character.chen);
  const regions = move.regions ?? [];
  const spirits = move.projectiles ?? [];
  const failures: string[] = [];
  for (const facing of [-1, 1]) for (const [index, gap, earthStruck] of [[0, 100.0, undefined], [1, 220.0, undefined], [2, -240.0, undefined], [1, 220.0, 100.0], [2, -240.0, 100.0]] as const) {
    const region = regions[index];
    if (region === undefined) throw new Error(`Chen has no strike ${index}`);
    const b = airborneBout(scenarioOf(Character.chen), facing, 300.0, gap, earthStruck);
    b.step(ULTIMATE);
    const { x, z } = b.owner.motion;
    let struck = -1;
    let inPlace = false;
    let standing = false;
    let paused = false;
    for (let tick = 0; tick < 90 && struck < 0 && b.owner.special.action === SpecialAction.heroUltimate; tick++) {
      for (const foe of [b.target, b.bystander]) {
        if (foe === undefined || foe.launch.hitstun > 0 || foe.launch.hitlag > 0) continue;
        foe.motion.grounded = false;
        foe.motion.surface = undefined;
        foe.motion.z = z;
        foe.motion.vz = 0.0;
      }
      const before = b.target.status.damage;
      b.step();
      if (b.target.status.damage <= before) {
        if (b.owner.launch.hitlag > 0) paused = true;
        continue;
      }
      struck = b.owner.special.frame;
      inPlace = b.owner.motion.x === x && b.owner.motion.z === z;
      standing = b.owner.projectiles.some((projectile) => projectile.life > 0 && projectile.spec === spirits[index]);
    }
    if (struck !== region.firstFrame + 1 || !inPlace || !standing || (earthStruck !== undefined && !paused)) {
      failures.push(`facing ${facing} gap ${gap} earth-struck ${earthStruck}: struck f${struck} (strike f${region.firstFrame + 1}) in place ${inPlace}, spirit standing ${standing}, hitlag before ${paused}`);
    }
  }
  assertEquals(failures.join("; "), "");
});

test("Robo-Goblin Overdrive cast in the air drops the robot to the floor beneath Tinker, where it walks to a grounded foe, and refuses over the void (#98) [k1 scenario]", () => {
  const robot = ultimateOf(Character.tinker).projectiles?.[0];
  if (robot === undefined) throw new Error("no robot");
  const scenario = scenarioOf(Character.tinker);
  const failures: string[] = [];
  for (const facing of [-1, 1]) {
    const b = airborneBout(scenario, facing, 150.0, scenario.x);
    b.step(ULTIMATE);
    const floor = f32(mainDeckZAt(0, b.owner.motion.x) + robot.offsetZ);
    let walked: number | undefined;
    for (let tick = 0; tick < 120 && b.target.status.damage === 0.0; tick++) {
      b.step();
      const shot = b.owner.projectiles.find((projectile) => projectile.life > 0 && projectile.spec === robot);
      if (walked === undefined && shot !== undefined) walked = shot.z;
    }
    if (walked !== floor || !(b.target.status.damage > 0.0)) failures.push(`facing ${facing}: robot at z ${walked} (floor ${floor}), foe ${b.target.status.damage}%`);
    const ledge = airborneBout(scenario, facing, 150.0);
    ledge.owner.motion.x = f32(facing * (mainDeckRight(0) - 20.0));
    ledge.step(ULTIMATE);
    const deck = f32(mainDeckZAt(0, ledge.owner.motion.x) + robot.offsetZ);
    let pastLedge: number | undefined;
    for (let tick = 0; tick < 30 && pastLedge === undefined; tick++) {
      ledge.step();
      pastLedge = ledge.owner.projectiles.find((projectile) => projectile.life > 0 && projectile.spec === robot)?.z;
    }
    if (pastLedge !== deck) failures.push(`facing ${facing}: robot past the ledge at z ${pastLedge} (deck ${deck})`);
    if (!refusedOverVoid(Character.tinker, facing)) failures.push(`facing ${facing}: started over the void`);
  }
  assertEquals(failures.join("; "), "");
});

test("You No Take Candle! cast in the air dives into the floor beneath the Kobold and burrows along it to erupt under a grounded foe, on a rising lift or beneath a raised one too, and refuses over the void (#98) [k1 scenario]", () => {
  const dust = ultimateOf(Character.kobold).projectiles?.[0];
  if (dust === undefined) throw new Error("no dust");
  const scenario = scenarioOf(Character.kobold);
  const failures: string[] = [];
  for (const { stage, start, ceiling } of [
    { stage: 0, start: undefined, ceiling: SKY },
    { stage: SLOPE_TEST_STAGE, start: undefined, ceiling: SKY },
    { stage: TIMED_TEST_STAGE, start: LIFT_RISING, ceiling: SKY },
    { stage: TIMED_TEST_STAGE, start: LIFT_RAISED, ceiling: 100.0 },
  ]) for (const facing of [-1, 1]) {
    const b = airborneBout(scenario, facing, 150.0, scenario.x);
    b.game.stageChoice = stage;
    if (start !== undefined) b.game.matchFrame = start;
    const clock = (): number => stageClock(b.game);
    standOnFloor(b.target, stage, clock(), ceiling);
    b.owner.motion.z = f32((floorBelow(stage, clock(), b.owner.motion.x, ceiling) ?? 0.0) + 150.0);
    b.step(ULTIMATE);
    let dustZ: number | undefined;
    let floor: number | undefined;
    let buried = true;
    for (let tick = 0; tick < 120 && b.owner.special.action === SpecialAction.heroUltimate; tick++) {
      b.step();
      const { motion, special } = b.owner;
      const mark = b.owner.projectiles.find((projectile) => projectile.life > 0 && projectile.spec === dust);
      if (dustZ === undefined && mark !== undefined) {
        dustZ = mark.z;
        floor = floorBelow(stage, clock(), mark.x, motion.z);
      }
      const onFloor = motion.grounded && motion.surface !== undefined && motion.z === surfaceZAt(stage, motion.surface, clock(), motion.x);
      if (special.frame >= KOBOLD_BURROW_FIRST && special.frame <= KOBOLD_BURROW_LAST && (!onFloor || b.owner.landing.lag > 0)) buried = false;
    }
    if (dustZ === undefined || dustZ !== floor || !buried || !(b.target.status.damage > 0.0)) failures.push(`stage ${stage} from ${start} facing ${facing}: dust at z ${dustZ} (floor ${floor}), buried ${buried}, foe ${b.target.status.damage}%`);
    if (stage === 0 && !refusedOverVoid(Character.kobold, facing)) failures.push(`facing ${facing}: started over the void`);
  }
  assertEquals(failures.join("; "), "");
});

test("a computer Goblin Tinker or Kobold in the air over a raised lift aims its ultimate from the lift beneath it and presses it at a foe standing there before the lift comes down (#98) [k1 scenario]", () => {
  const failures: string[] = [];
  for (const character of [Character.tinker, Character.kobold]) for (const facing of [-1, 1]) {
    const me = createFighter(character, f32(-facing * 70.0), facing);
    const foe = createFighter(Character.blademaster, f32(facing * 80.0), -facing);
    const world = createRoster(3, [me, foe]);
    const match = createMatchState();
    match.phase = Phase.match;
    match.stageChoice = TIMED_TEST_STAGE;
    match.timeLimitMinutes = 0;
    match.cpuOpponents[0] = "wren";
    match.cpuResolvedOpponents[0] = "wren";
    match.cpuTiers[0] = "expert";
    const produced = createFrameControls();
    const executed = createFrameControls();
    const runtime = createPacingAndPresentation();
    const row = createMatchFrameInput();
    let pressed = false;
    const raised = surfaceZAt(TIMED_TEST_STAGE, LIFT, LIFT_RAISED, 0.0);
    for (let n = 0; n < 240 && !pressed && (n <= 8 || surfaceZAt(TIMED_TEST_STAGE, LIFT, stageClock(match), 0.0) === raised); n++) {
      const frame = runtime.simulationFrame + 1;
      if (n === 8) match.matchFrame = LIFT_RAISED;
      if (n >= 8) {
        me.mana.points = ROSTER_MANA.max;
        standOnFloor(foe, TIMED_TEST_STAGE, stageClock(match));
        standOnFloor(me, TIMED_TEST_STAGE, stageClock(match));
        me.motion.grounded = false;
        me.motion.surface = undefined;
        me.motion.z = f32(me.motion.z + 120.0);
      }
      for (const slot of [0, 1] as const) {
        copyControls(produced.inputs[slot], neutralControls());
        clearAttackBuffer(produced.commands[slot]);
      }
      produceComputerInput(match, world, runtime, 0, frame, produced.inputs[0], produced.commands[0]);
      captureFrame(row, frame, world.mask, produced, runtime);
      executeMatchFrame(row, match, world, executed, runtime, frame);
      pressed = produced.inputs[0].ultimatePressed;
    }
    if (!pressed) failures.push(`${name(character)} ${facing}: never pressed over the lift at ${surfaceZAt(TIMED_TEST_STAGE, LIFT, stageClock(match), me.motion.x)}`);
  }
  assertEquals(failures.join("; "), "");
});

test("Blood of Mannoroth caught in the air holds Grom and the foe at his height through the whole hold, past the charge's stop at f41, then flings the foe and Grom falls (#98) [k1 scenario]", () => {
  const move = ultimateOf(Character.grom);
  const grab = move.commandGrab;
  const stop = move.motion?.[1]?.first;
  if (grab === undefined || stop === undefined) throw new Error("Grom's ultimate has no grab or stop");
  const failures: string[] = [];
  for (const facing of [-1, 1]) {
    const b = airborneBout(scenarioOf(Character.grom), facing, 300.0, 400.0);
    b.step(ULTIMATE);
    const z = b.owner.motion.z;
    const label = `facing ${facing}`;
    let caught = 0;
    let fell = false;
    for (let tick = 0; tick < 120 && b.owner.special.action === SpecialAction.heroUltimate; tick++) {
      if (caught === 0) hover(b, z, z);
      b.step();
      const { special, motion } = b.owner;
      if (special.action !== SpecialAction.heroUltimate) break;
      if (caught === 0) caught = special.grabFrame;
      const held = caught > 0 && special.frame < caught + grab.holdFrames;
      if (held && (motion.z !== z || b.target.motion.z !== z || b.target.grab.owner !== 0)) failures.push(`${label}: f${special.frame} Grom at ${motion.z}, foe at ${b.target.motion.z} (held from ${z}), latched ${b.target.grab.owner === 0}`);
      if (caught > 0 && !held && motion.z < z) fell = true;
      if (special.fall) failures.push(`${label}: helpless at f${special.frame}`);
    }
    if (caught === 0 || caught + grab.holdFrames <= stop) failures.push(`${label}: caught at f${caught}, hold ends by f${stop}`);
    if (b.target.status.damage !== grab.effect.damage || !fell) failures.push(`${label}: foe took ${b.target.status.damage}%, Grom fell ${fell}`);
  }
  assertEquals([...new Set(failures)].join("; "), "");
});

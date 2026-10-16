import { STAGE_CATALOG } from "../menu/stageCatalog";
import { floorMod } from "wisp/src/sim/intMath";
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
import { Phase, createMatchState } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { AttackStyle, Character, ProjectileKind, SpecialAction } from "./codes";
import { type Fighter, createFighter, placedObject } from "./fighter";
import { ROSTER_MANA } from "./mana";
import { type Controls, copyControls, createRoster } from "./roster";
import { controls } from "./testWorld";
import { FIGHTER_ULTIMATES, ULTIMATE_REACH } from "./ultimates";
import type { AuthoredSpecial } from "./specials/schema";
import { firstStateDifference } from "../replay/difference";
import { stateChecksum } from "../replay/canonical";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { isIntangible } from "./conditions";
import { spawnProjectileMotion } from "./projectiles";
import { clearSpecialOnStock } from "./transitions";
import { mainDeckLeft, mainDeckRight, mainDeckZAt, SLOPE_TEST_STAGE } from "./stage";

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
  readonly step: (this: void, first?: Readonly<Controls>, second?: Readonly<Controls>) => void;
  readonly commands: readonly AttackBuffer[];
  readonly frame: () => number;
  readonly game: ReturnType<typeof createMatchState>;
}

function bout(scenario: Readonly<Scenario>, facing: number, target: Character = Character.blademaster, x = scenario.x, off = false): Bout {
  const game = createMatchState();
  game.phase = Phase.match;
  game.ultimatesOff = off;
  const owner = createFighter(scenario.character, f32(-x * facing * 0.5), facing);
  const victim = createFighter(target, f32(x * facing * 0.5), -facing);
  owner.mana.points = ROSTER_MANA.max;
  const world = createRoster(3, [owner, victim]);
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
  return { owner, target: victim, step, commands, frame: () => frame, game };
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

/** The first frame an ultimate can strike: a region, a striking projectile or summon, a grab or a guard. */
export function firstThreat(move: Readonly<AuthoredSpecial>): number {
  let first = move.endFrame;
  for (const region of move.regions ?? []) first = Math.min(first, region.firstFrame + 1);
  for (const shot of move.projectiles ?? []) if (shot.effect.damage > 0.0 || shot.expiresInto !== undefined) first = Math.min(first, shot.spawnFrame + (shot.expiresInto !== undefined && shot.effect.damage === 0.0 ? shot.life : 0));
  if (move.placement !== undefined) first = Math.min(first, move.placement.frame + (move.placement.fireAges[0] ?? 0));
  if (move.commandGrab !== undefined) first = Math.min(first, move.commandGrab.first);
  if (move.guard !== undefined) first = move.guard.last;
  return first;
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

const EX = controls({ specialPressed: true, exPressed: true });

test("Cairne centre ankh burst and arrival replay per frame, including a displaced-anchor fault [k1 scenario]", () => {
  for (const { stage, facing, answer } of [
    { stage: 0, facing: 1, answer: "hit" },
    { stage: SLOPE_TEST_STAGE, facing: -1, answer: "shield" },
    { stage: SLOPE_TEST_STAGE, facing: 1, answer: "leave" },
  ]) {
    const move = ultimateOf(Character.cairne);
    const ankhSpec = move.regionOrigin;
    assertTrue(ankhSpec !== undefined);
    const owner = createFighter(Character.cairne, facing * -450.0, facing);
    const inside = createFighter(Character.blademaster, answer === "leave" ? 250.0 : 50.0, -facing);
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
    assertEquals(firstHit, answer === "hit" ? 25 : 0, recorded.join("\n"));
    assertEquals(hits, answer === "hit" ? 1 : 0, recorded.join("\n"));
    assertEquals(arrival, answer === "hit" ? 32 : answer === "shield" ? 32 : 26, recorded.join("\n"));
    assertEquals(protectedFrames, 6, recorded.join("\n"));
    copyReplayState(replay, saved);
    const shifted = fighterAt(replay.world, 0).projectiles.find((projectile) => projectile.life > 0 && projectile.spec === ankhSpec);
    assertTrue(shifted !== undefined);
    if (shifted === undefined) throw new Error("missing recorded ankh");
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
        const piece = owner.projectiles.find((projectile) => projectile.life > 0 && projectile.spec?.trail !== undefined && projectile.spec.trail.every > 0 && projectile.x === Math.min(...xs));
        if (piece !== undefined) piece.life -= 10;
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
      if (survive && run.hitFrame >= 0 && ward.life <= 0 && before > 1) ward.life = before - 1;
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

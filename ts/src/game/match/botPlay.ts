// The computer opponent: each frame it reads the match and fills its
// fighter's controls and attack commands as a player's input would, so
// rollback replays and every client derive the same decisions from the same
// state. Every choice is a function of that state and the frame number.
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { type AttackBuffer, clearAttackBuffer, copyAttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_CAPACITY, PARTICIPANT_SLOTS, type ParticipantSlot, type Slots } from "../input/participants";
import { DownState, GrabAction, ShieldBreak } from "../sim/codes";
import { heroStatusBlocksActions, heroStatusMashes } from "../sim/heroStatus";
import type { Fighter } from "../sim/fighter";
import { Character, SpecialAction } from "../sim/codes";
import { isSmashAttack } from "../sim/moves";
import { type Controls, type Roster, copyControls, fighterAt, isActive, neutralControls } from "../sim/roster";
import { mainDeckLeft, mainDeckRight, surfacePass } from "../sim/stage";
import { ORB_WARNING_FRAMES, orbPoint, orbWarningFrames, orbsActive, orbWarned } from "../sim/orbs";
import { type FighterGameplan, GameplanThrow } from "../sim/gameplan";
import { SPACE_PLAN, avoids, gameplanGoal, gameplanOf, gameplanPlan, gameplanThrow, jumpsIn, keptGap, onAnotherDeck, plansRanged, spacingAerialAt } from "./botGameplan";
import { steerInAir, steerOnGround } from "./botFooting";
import { chooseAttack, lastChoicePassedForVariety, smashChargeGoal } from "./botMoves";
import { botChance, botChoice, useMatchSeed } from "./botRandom";
import type { CpuTier } from "./cpuProfiles";
import { type CpuSkill, cpuSkill, cpuReactionFloor, cpuReactionFrames, perceivedCpuSkill } from "./cpuSkill";
import { FAST_BOT_HISTORY_FRAMES, BOT_HISTORY_FRAMES, type BotMemory, observeOpponents, perceivedOpponent, perceivedHeldFighter, commitBotDirection, samePerception } from "./botPerception";
import { chooseDefense } from "./botDefense";
import { burnedMove, keepClearOfBurn, punishBlockedBurn } from "./botBurn";
import { choosePunish } from "./botPunish";
import { chooseLedgeTrap } from "./botLedgeTrap";
import { chooseRecoveryInput } from "./botRecovery";
import { guardOffstage, waitAtLip } from "./botEdgeGuard";
import { escapeCorner, pokeGoal, pressCorner, pressEdgeCancel, steerEdgeCancel } from "./botCorner";
import { holdAutoFollowUpOnDeck, pressHeroFollowUp } from "./botHeroKit";
import { holdChannelOnFoe } from "./botChannel";
import { holdsPartner, pressDuoCall, tossToward } from "./botDuo";
import { dashIn, holdAimAtFoe, pressKitOption, pressUltimate, steerHeroBranches, steerRunningSpecial, steerShotAtFoe } from "./botKitOptions";
import { MATCH_TICKS_PER_SECOND, type MatchState, stageClock, computerActive, fighterMask } from "../lobby/lobbyState";
import { trainingPartnerInput } from "./training";
import { sameFighterState } from "../../generated/state/fighterState";
import { type BotStrategy, copyBotStrategy, learnBotHabit, prepareBotRead, pressBotRead, sameBotStrategy } from "./botStrategy";
import { applyAerialExecutionNoise, chooseHitlagInput } from "./botExecutionNoise";
import { executeBotTechnique, type TechnicalOutcome } from "./botTechnicalExecution";
import type { BotDecision } from "./pacingAndPresentation";

const COMPUTER_NEUTRAL = neutralControls();
const TICK = f32(1.0 / MATCH_TICKS_PER_SECOND);
/** Frames each plan lasts before the computer weighs another. */
const PLAN_FRAMES = 40;
/** A carrying computer throws once this close to the ledge it walks toward. */
export const CARRY_THROW_GAP = 90.0;
/** A carrying computer throws by this many carry frames even short of the ledge, before a mash-out wastes the grab. */
const CARRY_WALK_FRAMES = 60;
/** Plans: pressure on the ground, jump in with aerials, or keep away and shoot. */
const Plan = { ground: 0, air: 1, range: 2 } as const;
type Plan = (typeof Plan)[keyof typeof Plan];
/** The distance a ranged plan keeps. */
const RANGE_SPACING = 320.0;
/** A target this much higher is worth a full jump. */
const ABOVE = 110.0;

interface BotRuntime { botAttackDelays: Slots<number>; readonly botMemory: BotMemory; readonly botStrategies: Slots<BotStrategy> }

function planFor(f: Readonly<Fighter>, slot: number, frame: number): Plan {
  const choice = botChoice(floorDiv(frame, PLAN_FRAMES), slot * 13 + f.character, 6);
  return choice < 3 ? Plan.ground : choice < 5 ? Plan.air : Plan.range;
}

/** Carrying: walks toward the nearer ledge, then cargo-throws off it, forward when facing it and back otherwise. */
function carryToLedge(f: Readonly<Fighter>, stage: number, input: Controls): void {
  const left = mainDeckLeft(stage);
  const right = mainDeckRight(stage);
  const side = f32(right - f.motion.x) <= f32(f.motion.x - left) ? 1 : -1;
  const gap = side > 0 ? f32(right - f.motion.x) : f32(f.motion.x - left);
  if (f.motion.grounded && gap > CARRY_THROW_GAP && f.grab.frame < CARRY_WALK_FRAMES) {
    input.direction = side;
    return;
  }
  input.attackPressed = true;
  input.direction = side === f.facing ? 0 : -f.facing;
}

/** Holding a grab: a carrier forward-throws into its carry; others take the gameplan's throw, or each hold frame pummel, throw one of four ways, or wait. */
function followUpGrab(f: Readonly<Fighter>, held: Readonly<Fighter>, gameplan: FighterGameplan | undefined, stage: number, frame: number, input: Controls): void {
  if (f.grab.action === GrabAction.carry) {
    carryToLedge(f, stage, input);
    return;
  }
  if (f.grab.action !== GrabAction.hold) return;
  if (f.tuning.moves?.carry !== undefined) {
    input.grabThrowX = f.facing;
    return;
  }
  const planned = gameplan === undefined ? undefined : gameplanThrow(gameplan, held, f.grab.serial, botChoice);
  if (planned !== undefined) {
    if (planned === GameplanThrow.forward || planned === GameplanThrow.back) input.grabThrowX = planned === GameplanThrow.forward ? f.facing : -f.facing;
    else input.grabThrowZ = planned === GameplanThrow.up ? 1 : -1;
    return;
  }
  const choice = botChoice(frame, f.grab.serial * 3 + f.character, 8);
  if (choice <= 2) input.attackPressed = true;
  else if (choice <= 4) input.grabThrowX = choice === 3 ? f.facing : -f.facing;
  else if (choice <= 6) input.grabThrowZ = choice === 5 ? 1 : -1;
}

/** Moves toward the target, or the plan's spot by it, staying on the stage; jumps for a target above or an aerial plan. */
function approach(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, plan: Plan, frame: number, input: Controls): void {
  const { motion } = f;
  const dx = f32(target.motion.x - motion.x);
  const dz = f32(target.motion.z - motion.z);
  const toward = dx < 0 ? -1 : 1;
  const goal = plan === Plan.range && !onAnotherDeck(f, target) ? f32(target.motion.x - f32(toward * RANGE_SPACING)) : target.motion.x;
  if (!motion.grounded) {
    // Tumbling, it lets itself land and techs or gets up there, steering only to stay over the deck.
    steerInAir(f, stage, f.down.state === DownState.tumble ? motion.x : goal, input);
    if (plan === Plan.air && dz > ABOVE && motion.vz < 0 && f.jump.remaining > 0 && Math.abs(dx) < 200) {
      input.jumpPressed = true;
      input.jumpHeld = true;
    }
    return;
  }
  steerOnGround(f, stage, goal, input);
  if (f.jump.squat > 0) {
    input.jumpHeld = dz > ABOVE;
    return;
  }
  // A platform drops through on a fresh press of down.
  if (motion.surface !== undefined && surfacePass(stage, motion.surface) && dz < -80) {
    input.down = floorMod(frame, 8) < 4;
    return;
  }
  const close = Math.abs(dx) >= 60 && Math.abs(dx) <= 240 && Math.abs(dz) <= 120;
  if ((dz > ABOVE && Math.abs(dx) < 300) || (plan === Plan.air && close)) {
    input.jumpPressed = true;
    input.jumpHeld = dz > ABOVE;
  }
}

/** Under a gameplan: keeps the plan's gap on the stage, short-hops into a spacing aerial, jumps in when the plan does. */
function approachByGameplan(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, gameplan: FighterGameplan, slot: number, planIndex: number, frame: number, input: Controls, skill: CpuSkill): void {
  const { motion } = f;
  const dx = f32(target.motion.x - motion.x);
  const dz = f32(target.motion.z - motion.z);
  const goal = gameplanGoal(gameplan, f, target, stage, keptGap(gameplan, f, target, slot, planIndex, frame, botChoice));
  if (!motion.grounded) {
    steerInAir(f, stage, f.down.state === DownState.tumble ? motion.x : goal, input);
    if (jumpsIn(gameplan, planIndex, f, target, dx, dz) && dz > ABOVE && motion.vz < 0 && f.jump.remaining > 0) {
      input.jumpPressed = true;
      input.jumpHeld = true;
    }
    return;
  }
  steerOnGround(f, stage, goal, input);
  dashIn(f, target, stage, skill, frame, !avoids(gameplan, "close"), input);
  if (f.jump.squat > 0) {
    input.jumpHeld = dz > ABOVE;
    return;
  }
  if (motion.surface !== undefined && surfacePass(stage, motion.surface) && dz < -80) {
    input.down = floorMod(frame, 8) < 4;
    return;
  }
  // Under the spacing plan a spacing aerial at its gap is a short hop away, one frame in four.
  const hop = planIndex === SPACE_PLAN && spacingAerialAt(gameplan, Math.abs(dx)) && botChoice(frame, slot * 5 + f.character, 4) === 0;
  if (hop || jumpsIn(gameplan, planIndex, f, target, dx, dz)) {
    input.jumpPressed = true;
    input.jumpHeld = dz > ABOVE;
  }
}

const CLIMB_STEP = 40.0;

export function orbContest(game: Readonly<MatchState>, fighter: Readonly<Fighter>, slot: ParticipantSlot, skill: CpuSkill): boolean {
  const { orbs } = game;
  if (!orbsActive(game)) return false;
  if (!orbs.live) {
    if (!orbWarned(game)) return false;
    const left = orbWarningFrames(game);
    if (!orbs.held && left !== undefined && left > ORB_WARNING_FRAMES - skill.contestDelay) return false;
  }
  const serial = orbs.live ? orbs.spawnSerial : orbs.spawnSerial + 1;
  return botChance(serial, slot * 29 + fighter.character, skill.contestTenths, 10);
}

export function approachPoint(f: Readonly<Fighter>, stage: number, x: number, z: number, frame: number, input: Controls): void {
  const { motion } = f;
  const dx = f32(x - motion.x);
  const dz = f32(z - motion.z);
  if (!motion.grounded) {
    steerInAir(f, stage, x, input);
    if (dz > CLIMB_STEP && motion.vz < 0 && f.jump.remaining > 0 && Math.abs(dx) < 200) {
      input.jumpPressed = true;
      input.jumpHeld = true;
    }
    return;
  }
  steerOnGround(f, stage, x, input);
  if (f.jump.squat > 0) {
    input.jumpHeld = dz > CLIMB_STEP;
    return;
  }
  if (motion.surface !== undefined && surfacePass(stage, motion.surface) && dz < -CLIMB_STEP) {
    input.down = floorMod(frame, 8) < 4;
    return;
  }
  if (dz > CLIMB_STEP && Math.abs(dx) < 260) {
    input.jumpPressed = true;
    input.jumpHeld = true;
  }
}

function computerOpponentMask(game: Readonly<MatchState>, slot: ParticipantSlot): number {
  if (!game.teamBattle) return (1 << PARTICIPANT_CAPACITY) - 1;
  const mask = fighterMask(game);
  let opponents = 0;
  for (const candidate of PARTICIPANT_SLOTS) if ((mask & (1 << candidate)) !== 0 && game.teamChoices[candidate] !== game.teamChoices[slot]) opponents |= 1 << candidate;
  return opponents;
}

function avoidTeamContact(game: Readonly<MatchState>, world: Readonly<Roster>, slot: ParticipantSlot, target: Readonly<Fighter> | undefined, input: Controls, commands: AttackBuffer): void {
  if (!game.teamBattle || !game.friendlyFire || target === undefined) return;
  const own = fighterAt(world, slot);
  const targetX = f32(target.motion.x - own.motion.x);
  const toward = targetX < 0.0 ? -1 : 1;
  for (const ally of PARTICIPANT_SLOTS) {
    if (ally === slot || !isActive(world, ally) || game.teamChoices[ally] !== game.teamChoices[slot]) continue;
    const teammate = fighterAt(world, ally);
    if (teammate.status.out || teammate.status.stocks <= 0) continue;
    const dx = f32(teammate.motion.x - own.motion.x);
    const dz = Math.abs(f32(teammate.motion.z - own.motion.z));
    const between = f32(dx * toward) > 0.0 && Math.abs(dx) < Math.abs(targetX);
    if (!(dz < 160.0 && (Math.abs(dx) < 140.0 || between)
      || (input.specialPressed || input.ultimatePressed) && Math.abs(dx) < 400.0 && dz < 300.0)) continue;
    clearAttackBuffer(commands);
    input.attackRequested = false;
    input.attackPressed = false;
    input.attackHeld = false;
    input.specialPressed = false;
    input.ultimatePressed = false;
    input.getupAttackPressed = false;
    return;
  }
}

function reactionDelay(game: Readonly<MatchState>, world: Readonly<Roster>, runtime: Readonly<BotRuntime>, fighter: Readonly<Fighter>, slot: ParticipantSlot, frame: number, skill: CpuSkill, floor = cpuReactionFloor(fighter, skill)): number {
  const cue = perceivedOpponent(runtime.botMemory, world, fighter, slot, frame, floor, computerOpponentMask(game, slot), game.stageChoice, skill.tier === "expert");
  // Only information old enough for this kind of answer may affect its seeded delay.
  const key = cue === undefined ? 0 : cue.attack.serial * 31 + cue.special.action * 17
    + (cue.motion.x < fighter.motion.x ? 1 : 2) + (cue.shield.raised ? 4 : 0)
    + (cue.motion.grounded ? 8 : 0) + cue.ledge.state * 64 + cue.down.state * 256;
  return cpuReactionFrames(fighter, skill, game.matchSeed, slot, key, floor);
}

const slowTier = (tier: CpuTier | undefined): boolean => tier === "rookie" || tier === "beginner";

function observationFrames(game: Readonly<MatchState>, skill: CpuSkill): number {
  if (slowTier(skill.tier)) return BOT_HISTORY_FRAMES;
  const tiers = game.cpuTiers;
  if (!slowTier(tiers[0]) && !slowTier(tiers[1]) && !slowTier(tiers[2]) && !slowTier(tiers[3])) return FAST_BOT_HISTORY_FRAMES;
  for (const slot of PARTICIPANT_SLOTS) if (computerActive(game, slot) && slowTier(tiers[slot])) return BOT_HISTORY_FRAMES;
  return FAST_BOT_HISTORY_FRAMES;
}

/**
 * The computer in `slot` plays its resolved identity and tier under the match seed. Correcting
 * human movement also corrects every computer decision derived from it.
 */
export function produceComputerInput(game: Readonly<MatchState>, world: Roster, runtime: BotRuntime, slot: ParticipantSlot, frame: number, input: Controls, commands: AttackBuffer, skillOverride?: CpuSkill): TechnicalOutcome {
  useMatchSeed(game.matchSeed);
  const opponent = game.cpuResolvedOpponents[slot];
  const tier = game.cpuTiers[slot];
  const skill = skillOverride ?? cpuSkill(opponent, tier);
  observeOpponents(runtime.botMemory, world, frame, observationFrames(game, skill));
  const fighter = fighterAt(world, slot);
  const reactionFrames = reactionDelay(game, world, runtime, fighter, slot, frame, skill);
  useMatchSeed(game.matchSeed);
  const target = fighter.grab.target === undefined || holdsPartner(fighter) ? perceivedOpponent(runtime.botMemory, world, fighter, slot, frame, reactionFrames, computerOpponentMask(game, slot), game.stageChoice, skill.tier === "expert")
    : perceivedHeldFighter(runtime.botMemory, fighter.grab.target, frame, reactionFrames);
  const strategy = runtime.botStrategies[slot];
  if (target !== undefined) {
    const ownObserved = perceivedHeldFighter(runtime.botMemory, slot, frame, reactionFrames);
    const opponent = PARTICIPANT_SLOTS.find(candidate => candidate !== slot && perceivedHeldFighter(runtime.botMemory, candidate, frame, reactionFrames) === target);
    if (ownObserved !== undefined && opponent !== undefined) learnBotHabit(strategy, ownObserved, target, opponent, frame - reactionFrames, skill.decision);
    prepareBotRead(strategy, fighter, target, frame, reactionFrames, skill.decision);
  }
  decide(game, world, runtime, slot, frame, input, commands, skillOverride === undefined ? perceivedCpuSkill(opponent, tier) : { ...skill, reactionFrames: 0 }, target, reactionFrames);
  if (!game.training) steerEdgeCancel(fighter, target, game.stageChoice, skill, input);
  const execution = executeBotTechnique(fighter, input, commands, frame, slot, skill.decision);
  if (fighter.launch.hitlag <= 0 && fighter.launch.hitstun > 0) chooseHitlagInput(fighter, slot, frame, skill, input);
  if (!game.training) applyAerialExecutionNoise(fighter, target, slot, skill, input);
  // DI and escape mashing are reactions to the fighter's own state, not steering.
  if (fighter.launch.hitlag <= 0 && fighter.grab.owner === undefined) commitBotDirection(runtime.botMemory, slot, frame, input, tier, skill.decision);
  avoidTeamContact(game, world, slot, target, input, commands);
  holdAutoFollowUpOnDeck(fighter, game.stageChoice, stageClock(game), input);
  useMatchSeed(0);
  return execution;
}

const negativeZero = (value: number): boolean => value === 0 && 1 / value < 0;

/**
 * Whether produceComputerInput for `slot` at `frame` reads the same state as
 * it did from `before`, so it decides the same. It reads the match seed, the
 * slot's identity and tier, training, the stage and its clock, the time
 * limit, the slot's own fighter, its perceived sample and committed
 * direction, its strategy, its attack delay and the orb it contests;
 * a new read joins this list.
 * `fighterSame` says the slot's fighter is known to equal the earlier one.
 */
export function sameComputerInputs(game: Readonly<MatchState>, world: Readonly<Roster>, runtime: Readonly<BotRuntime>, before: Readonly<MatchState>, beforeWorld: Readonly<Roster>, beforeRuntime: Readonly<BotRuntime>, slot: ParticipantSlot, frame: number, fighterSame = false): boolean {
  if (game.training || before.training || game.teamBattle || before.teamBattle || world.mask !== beforeWorld.mask) return false;
  const opponent = game.cpuResolvedOpponents[slot];
  const tier = game.cpuTiers[slot];
  if (opponent !== before.cpuResolvedOpponents[slot] || tier !== before.cpuTiers[slot] || game.matchSeed !== before.matchSeed) return false;
  if (game.stageChoice !== before.stageChoice || stageClock(game) !== stageClock(before)) return false;
  if (game.timeLimitMinutes !== before.timeLimitMinutes || game.remainingFrames !== before.remainingFrames) return false;
  const fighter = fighterAt(world, slot);
  if (fighter.duo !== undefined) return false;
  const skill = cpuSkill(opponent, tier);
  useMatchSeed(game.matchSeed);
  const contest = orbContest(game, fighter, slot, skill) === orbContest(before, fighterAt(beforeWorld, slot), slot, skill);
  useMatchSeed(0);
  if (!contest) return false;
  const attackDelay = runtime.botAttackDelays[slot];
  const beforeDelay = beforeRuntime.botAttackDelays[slot];
  if (attackDelay !== beforeDelay || negativeZero(attackDelay) !== negativeZero(beforeDelay)) return false;
  if (!sameBotStrategy(runtime.botStrategies[slot], beforeRuntime.botStrategies[slot])) return false;
  if (observationFrames(game, skill) !== observationFrames(before, skill)) return false;
  const floor = cpuReactionFloor(fighter, skill);
  const delay = reactionDelay(game, world, runtime, fighter, slot, frame, skill, floor);
  // With no delay the computer sees this frame's observation, which a rollback rewrites.
  if (delay < 1) return false;
  const earlier = fighterAt(beforeWorld, slot);
  // The newer cue only seeds the delay: a rewritten cue that yields the same delay decides the same.
  if (!samePerception(runtime.botMemory, beforeRuntime.botMemory, slot, frame, floor) && reactionDelay(before, beforeWorld, beforeRuntime, earlier, slot, frame, skill) !== delay) return false;
  if (!samePerception(runtime.botMemory, beforeRuntime.botMemory, slot, frame, delay)) return false;
  return fighterSame || sameFighterState(fighter, earlier);
}

/**
 * As produceComputerInput, from a state sameComputerInputs matched with the
 * state before a step that decided `decision`: the computer observes this
 * frame and takes that step's decision and its strategy, delay and direction.
 */
export function repeatComputerInput(world: Readonly<Roster>, runtime: BotRuntime, after: Readonly<BotRuntime>, decision: Readonly<BotDecision>, slot: ParticipantSlot, frame: number, input: Controls, commands: AttackBuffer): void {
  observeOpponents(runtime.botMemory, world, frame, Math.max(FAST_BOT_HISTORY_FRAMES, after.botMemory.history.length));
  copyControls(input, decision.input);
  const grace = commands.graceFrames;
  clearAttackBuffer(commands);
  copyAttackBuffer(commands, decision.commands);
  commands.graceFrames = grace;
  runtime.botAttackDelays[slot] = after.botAttackDelays[slot];
  copyBotStrategy(runtime.botStrategies[slot], after.botStrategies[slot]);
  runtime.botMemory.directions[slot] = after.botMemory.directions[slot];
  runtime.botMemory.directionFrames[slot] = after.botMemory.directionFrames[slot];
}

/** Half a second: a computer that idles stands still this long. */
const IDLE_FRAMES = 30;

function decide(game: Readonly<MatchState>, world: Roster, runtime: BotRuntime, slot: ParticipantSlot, frame: number, input: Controls, commands: AttackBuffer, skill: CpuSkill, target: Readonly<Fighter> | undefined, observationAge: number): void {
  const fighter = fighterAt(world, slot);
  copyControls(input, COMPUTER_NEUTRAL);
  clearAttackBuffer(commands);
  if (fighter.status.out) return;
  if (game.training && trainingPartnerInput(game.trainer, world, slot, game.stageChoice, stageClock(game), frame, input, commands)) return;
  const delay = f32(runtime.botAttackDelays[slot] - TICK);
  runtime.botAttackDelays[slot] = delay;
  const stage = game.stageChoice;
  const stageFrame = stageClock(game);
  const gameplan = gameplanOf(fighter.character, skill.basicMoves);
  if (fighter.launch.hitlag > 0) {
    chooseHitlagInput(fighter, slot, frame, skill, input);
    return;
  }
  if (fighter.status.frozenFrames > 0 || heroStatusMashes(fighter)) {
    // A human-paced mash, 10 presses a second, so a trap, a Sleep or a Hex still rewards its user.
    input.grabMashPressed = floorMod(frame, skill.freezeMashFrames) === 0;
    // A freeze, Sleep or Hex leaves nothing but the mash (#521).
    if (fighter.status.frozenFrames > 0 || heroStatusBlocksActions(fighter)) return;
  }
  if (fighter.grab.owner !== undefined) {
    input.grabMashPressed = floorMod(frame, skill.grabMashFrames) === 0;
    input.direction = floorMod(frame, 4) < 2 ? 1 : -1;
    return;
  }
  if (fighter.grab.target !== undefined) {
    if (holdsPartner(fighter)) {
      if (target !== undefined) tossToward(fighter, target, input);
    } else if (skill.basicMoves !== undefined) {
      input.grabThrowX = fighter.facing;
      input.attackPressed = fighter.grab.action === GrabAction.carry;
    }
    else if (target !== undefined) followUpGrab(fighter, target, gameplan, stage, frame, input);
    return;
  }
  if (fighter.shield.breakState !== ShieldBreak.none) {
    input.mashPressed = floorMod(frame, skill.grabMashFrames) === 0;
    return;
  }
  if (skill.basicMoves === undefined && target !== undefined && pressDuoCall(world, fighter, target, stage, skill, frame, input, commands)) return;
  if (skill.basicMoves === undefined && target !== undefined && (steerHeroBranches(fighter, target, skill, input) || pressHeroFollowUp(fighter, target, stage, stageFrame, input))) return;
  if (skill.basicMoves === undefined && target !== undefined && !game.training && guardOffstage(fighter, target, stage, skill, slot, frame, observationAge, input, commands)) return;
  const recovering = chooseRecoveryInput(fighter, stage, stageFrame, input, target, skill);
  if (steerRunningSpecial(fighter, target, stage, skill, input) || recovering) return;
  if (isSmashAttack(fighter.attack.style) && fighter.attack.smashChargeAllowed) input.attackHeld = fighter.attack.smashChargeFrames < smashChargeGoal(fighter);
  holdAimAtFoe(fighter, target, input);
  holdChannelOnFoe(fighter, target, input);
  if (steerShotAtFoe(fighter, target, input)) return;
  if (target === undefined) return;
  if (skill.basicMoves === undefined && !game.training && waitAtLip(fighter, target, stage, skill, slot, frame, input)) return;
  const burned = burnedMove(runtime.botStrategies[slot], target, frame, observationAge);
  if (skill.basicMoves === undefined && punishBlockedBurn(runtime.botStrategies[slot], burned, fighter, target, frame, input, commands)) return;
  if (chooseDefense(fighter, target, stage, input, skill, observationAge)) return;
  // An opponent that can't act yet is punished before any pause or idle stretch.
  if (skill.basicMoves === undefined && choosePunish(fighter, target, stage, stageFrame, frame, skill, input, commands, observationAge, burned)) {

    runtime.botAttackDelays[slot] = f32(f32(skill.attackPause + botChoice(frame, fighter.attack.serial, skill.attackSpread)) * TICK);
    return;
  }
  if (skill.cornerPlay && skill.basicMoves === undefined && chooseLedgeTrap(fighter, target, stage, observationAge, input)) return;
  if (skill.basicMoves === undefined && pressBotRead(runtime.botStrategies[slot], fighter, target, stage, stageFrame, frame, input, commands)) return;
  if (skill.basicMoves === undefined && keepClearOfBurn(runtime.botStrategies[slot], burned, fighter, target, stage, frame, observationAge, stageFrame, input)) return;
  if (escapeCorner(fighter, target, stage, skill, slot, frame, input) || pressEdgeCancel(fighter, target, stage, skill, slot, frame, input, commands)) return;
  // A cornered opponent is pressed, never left to an idle stretch or a keep-away plan.
  const pressing = pressCorner(fighter, target, stage, skill);
  // An idle stretch stands where it is: no approach, no attack.
  if (!pressing && botChance(floorDiv(frame, IDLE_FRAMES), slot * 17 + fighter.character, skill.idle, 100)) return;
  if (skill.basicMoves === undefined && !game.ultimatesOff && pressUltimate(fighter, target, stage, stageFrame, skill, frame, input)) return;
  if (skill.basicMoves === undefined && pressKitOption(fighter, target, stage, skill, frame, delay <= 0, input, commands)) {
    if (input.specialPressed || input.attackHeld) runtime.botAttackDelays[slot] = f32(f32(skill.attackPause + botChoice(frame, fighter.attack.serial, skill.attackSpread)) * TICK);
    return;
  }
  const targetOnStage = target.motion.x >= mainDeckLeft(stage) && target.motion.x <= mainDeckRight(stage) && target.motion.z >= 0.0;
  const contest = targetOnStage && orbContest(game, fighter, slot, skill);
  if (gameplan === undefined) {
    const plan = planFor(fighter, slot, frame);
    if (delay <= 0 && chooseAttack(fighter, target, stage, stageFrame, frame, plan === Plan.range, input, commands, slot, SPACE_PLAN, skill, observationAge, { strategy: runtime.botStrategies[slot], policy: skill.decision, game })) {
      runtime.botAttackDelays[slot] = f32(f32(skill.attackPause + botChoice(frame, fighter.attack.serial, skill.attackSpread)) * TICK);
      if (!fighter.motion.grounded) steerInAir(fighter, stage, target.motion.x, input);
      return;
    }
    if (contest) approachPoint(fighter, stage, orbPoint(stage).x, orbPoint(stage).z, frame, input);
    else if (pressing) steerOnGround(fighter, stage, pokeGoal(target), input);
    else approach(fighter, target, stage, plan, frame, input);
    return;
  }
  const planIndex = gameplanPlan(gameplan, fighter, slot, frame, botChoice);
  if (delay <= 0 && chooseAttack(fighter, target, stage, stageFrame, frame, plansRanged(gameplan, planIndex), input, commands, slot, planIndex, skill, observationAge, { strategy: runtime.botStrategies[slot], policy: skill.decision, game })) {
    runtime.botAttackDelays[slot] = f32(f32(skill.attackPause + botChoice(frame, fighter.attack.serial, skill.attackSpread)) * TICK);
    if (!fighter.motion.grounded) steerInAir(fighter, stage, gameplanGoal(gameplan, fighter, target, stage, gameplan.range.near), input);
    return;
  }
  if (contest) approachPoint(fighter, stage, orbPoint(stage).x, orbPoint(stage).z, frame, input);
  else if (pressing) steerOnGround(fighter, stage, pokeGoal(target), input);
  else if (delay <= 0 && lastChoicePassedForVariety() && gameplan.whenStale !== "hold") approach(fighter, target, stage, Plan.ground, frame, input);
  else approachByGameplan(fighter, target, stage, gameplan, slot, planIndex, frame, input, skill);
}

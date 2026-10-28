// The first field that differs between two replay states, by Wurst
// ReplayState's diagnostic path and checked in its order, which is not the
// canonical tape's order.
import { attackBufferCanonicalState, sameAttackBuffer, type AttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { firstFighterPoseDifference } from "../presentation/fighterPose";
import { firstImpactDifference } from "../presentation/impactState";
import { firstSpecialEffectDifference } from "../presentation/specialEffectState";
import { firstSummonDifference } from "../presentation/summonState";
import { fighterAt, isActive } from "../sim/roster";
import { firstTrainingDifference } from "../match/trainingState";
import { firstRunDifference } from "../classic/runState";
import { firstItemsDifference } from "../match/items";
import { firstOrbsDifference } from "../sim/orbState";
import { firstBotMemoryDifference, sameBotMemory } from "../match/botPerception";
import { botStrategyValues, sameBotStrategy } from "../match/botStrategy";
import { type MatchState, ResultPick } from "../lobby/lobbyState";
import { sameControls } from "../sim/roster";
import { sameFighterState } from "../../generated/state/fighterState";
import { firstFighterDifference } from "../../generated/state/fighterDifference";
import type { ReplayState } from "./snapshot";

function firstCommandDifference(expected: Readonly<AttackBuffer>, actual: Readonly<AttackBuffer>): string | undefined {
  const e = attackBufferCanonicalState(expected);
  const a = attackBufferCanonicalState(actual);
  if (e.graceFrames !== a.graceFrames) return "windowFrames";
  if (e.style !== a.style) return "style";
  if (e.facing !== a.facing) return "facing";
  if (e.targetFrame !== a.targetFrame) return "targetFrame";
  if (e.consumedFacing !== a.consumedFacing) return "consumedFacing";
  if (e.mayCharge !== a.mayCharge) return "mayCharge";
  if (e.consumedMayCharge !== a.consumedMayCharge) return "consumedMayCharge";
  return undefined;
}

/** Wurst ReplaySnapshot.firstDifference: gameplay state only; firstPoseDifference covers presentation. */
export function firstStateDifference(expected: Readonly<ReplayState>, actual: Readonly<ReplayState>): string | undefined {
  if (expected.world.mask !== actual.world.mask) return "participantMask";
  if (expected.world.teamBattle !== actual.world.teamBattle) return "world.teamBattle";
  if (expected.world.friendlyFire !== actual.world.friendlyFire) return "world.friendlyFire";
  for (const slot of PARTICIPANT_SLOTS) if (expected.world.teamChoices[slot] !== actual.world.teamChoices[slot]) return `world.slot${slot}.team`;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(expected.world, slot)) continue;
    const fighter = firstFighterDifference(fighterAt(expected.world, slot), fighterAt(actual.world, slot), expected.world.mask, actual.world.mask);
    if (fighter !== undefined) return `fighter[${slot}].${fighter}`;
    const command = firstCommandDifference(expected.controls.commands[slot], actual.controls.commands[slot]);
    if (command !== undefined) return `commands[${slot}].${command}`;
  }
  const match = firstMatchDifference(expected.match, actual.match);
  if (match !== undefined) return match;
  if (expected.runtime.simulationFrame !== actual.runtime.simulationFrame) return "runtime.simulationFrame";
  for (const slot of PARTICIPANT_SLOTS) {
    if (expected.runtime.botAttackDelays[slot] !== actual.runtime.botAttackDelays[slot]) return `runtime.botAttackDelays[${slot}]`;
  }
  const botMemory = firstBotMemoryDifference(expected.runtime.botMemory, actual.runtime.botMemory);
  if (botMemory !== undefined) return `runtime.botMemory.${botMemory}`;
  for (const slot of PARTICIPANT_SLOTS) {
    const e = botStrategyValues(expected.runtime.botStrategies[slot]);
    const a = botStrategyValues(actual.runtime.botStrategies[slot]);
    if (e.length !== a.length) return `runtime.botStrategies[${slot}].values.length`;
    for (let index = 0; index < e.length; index++) if (e[index] !== a[index]) return `runtime.botStrategies[${slot}].values[${index}]`;
  }
  return undefined;
}

function firstMatchDifference(e: Readonly<MatchState>, a: Readonly<MatchState>): string | undefined {
  if (e.phase !== a.phase) return "match.phase";
  for (const key of ["initialized", "x", "z", "distance", "tangent", "left", "right", "bottom", "top"] as const) if (e.camera[key] !== a.camera[key]) return `match.camera.${key}`;
  for (const slot of PARTICIPANT_SLOTS) for (const key of ["left", "right", "bottom", "top"] as const) if (e.camera.boxes[slot][key] !== a.camera.boxes[slot][key]) return `match.camera.box${slot}.${key}`;
  if (e.stageChoice !== a.stageChoice) return "match.stageChoice";
  if (e.stageResolved !== a.stageResolved) return "match.stageResolved";
  for (const key of ["only", "selectedMask", "remainingMask"] as const) if (e.stagePool[key] !== a.stagePool[key]) return `match.stagePool.${key}`;
  if (e.hazards !== a.hazards) return "match.hazards";
  if (e.ultimatesOff !== a.ultimatesOff) return "match.ultimatesOff";

  if (e.winner !== a.winner) return "match.winner";
  if (e.teamBattle !== a.teamBattle) return "match.teamBattle";
  if (e.friendlyFire !== a.friendlyFire) return "match.friendlyFire";
  for (const slot of PARTICIPANT_SLOTS) if (e.teamChoices[slot] !== a.teamChoices[slot]) return `match.slot${slot}.team`;
  if (e.departedMask !== a.departedMask) return "match.departedMask";
  if (e.interrupted !== a.interrupted) return "match.interrupted";
  if (e.humanFighterMask !== a.humanFighterMask) return "match.humanFighterMask";
  if (e.computerMask !== a.computerMask) return "match.computerMask";
  if (e.humanMask !== a.humanMask) return "match.humanMask";
  for (const slot of PARTICIPANT_SLOTS) {
    if (e.characterChoices[slot] !== a.characterChoices[slot]) return `match.slot${slot}.character`;
    if (e.characterReadiness[slot] !== a.characterReadiness[slot]) return `match.slot${slot}.ready`;
    if (e.rematchReadiness[slot] !== a.rematchReadiness[slot]) return `match.slot${slot}.rematch`;
    if (e.rematchReadiness[slot] && e.resultPicks[slot] !== a.resultPicks[slot]) return `match.slot${slot}.resultPick`;
    if (e.cpuOpponents[slot] !== a.cpuOpponents[slot]) return `match.slot${slot}.cpuOpponent`;
    if (e.cpuRandomFighters[slot] !== a.cpuRandomFighters[slot]) return `match.slot${slot}.cpuRandomFighter`;
    if (e.cpuTiers[slot] !== a.cpuTiers[slot]) return `match.slot${slot}.cpuTier`;
    if (e.cpuResolvedOpponents[slot] !== a.cpuResolvedOpponents[slot]) return `match.slot${slot}.cpuResolvedOpponent`;
  }
  if (e.humanCount !== a.humanCount) return "match.humanCount";
  if (e.practice !== a.practice) return "match.practice";
  if (e.training !== a.training) return "match.training";
  const training = firstTrainingDifference(e.trainer, a.trainer);
  if (training !== undefined) return training;
  if (e.classic !== a.classic) return "match.classic";
  if (e.classicTier !== a.classicTier) return "match.classicTier";
  if (e.lore !== a.lore) return "match.lore";
  if (e.loreBattle !== a.loreBattle) return "match.loreBattle";
  const run = firstRunDifference(e.run, a.run);
  if (run !== undefined) return run;
  if (e.stockCount !== a.stockCount) return "match.stockCount";
  if (e.timeLimitMinutes !== a.timeLimitMinutes) return "match.timeLimitMinutes";
  if (e.endless !== a.endless) return "match.endless";
  if (e.automaticRematch !== a.automaticRematch) return "match.automaticRematch";
  if (e.rematchCountdown !== a.rematchCountdown) return "match.rematchCountdown";
  if (e.remainingFrames !== a.remainingFrames) return "match.remainingFrames";
  if (e.matchSeed !== a.matchSeed) return "match.matchSeed";
  if (e.matchFrame !== a.matchFrame) return "match.matchFrame";
  if (e.startHold !== a.startHold) return "match.startHold";
  const items = firstItemsDifference(e.items, a.items);
  if (items !== undefined) return items;
  const orbs = firstOrbsDifference(e.orbs, a.orbs);
  if (orbs !== undefined) return orbs;
  if (e.timedOut !== a.timedOut) return "match.timedOut";
  return undefined;
}

/**
 * Whether two states hold everything copyReplayState copies equal, signed
 * zeros in fighters apart: a repair whose state reaches a stored snapshot
 * may keep every later one (ReplayHistory.repair). Fighters likeliest to
 * differ, `first`, compare first.
 */
export function sameReplayState(expected: Readonly<ReplayState>, actual: Readonly<ReplayState>, first = 0): boolean {
  const mask = expected.world.mask;
  if (mask !== actual.world.mask) return false;
  for (const slot of PARTICIPANT_SLOTS) {
    if ((first & (1 << slot)) === 0 || !isActive(expected.world, slot)) continue;
    if (!sameFighterState(fighterAt(expected.world, slot), fighterAt(actual.world, slot))) return false;
  }
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(expected.world, slot)) continue;
    if ((first & (1 << slot)) === 0 && !sameFighterState(fighterAt(expected.world, slot), fighterAt(actual.world, slot))) return false;
    if (!sameAttackBuffer(expected.controls.commands[slot], actual.controls.commands[slot])) return false;
  }
  if (firstMatchDifference(expected.match, actual.match) !== undefined) return false;
  const e = expected.runtime;
  const a = actual.runtime;
  if (e.simulationFrame !== a.simulationFrame) return false;
  for (const slot of PARTICIPANT_SLOTS) {
    if (e.botAttackDelays[slot] !== a.botAttackDelays[slot] || e.observedLegal[slot] !== a.observedLegal[slot] || e.observedStarted[slot] !== a.observedStarted[slot]) return false;
    if (!sameBotStrategy(e.botStrategies[slot], a.botStrategies[slot])) return false;
    const decision = e.botDecisions[slot];
    const other = a.botDecisions[slot];
    if (decision.decided !== other.decided) return false;
    if (decision.decided && (!sameControls(decision.input, other.input) || !sameAttackBuffer(decision.commands, other.commands))) return false;
  }
  if (!sameBotMemory(e.botMemory, a.botMemory)) return false;
  return firstPoseDifference(expected, actual) === undefined;
}

/** Wurst ReplaySnapshot.firstPoseDifference: presentation history, which the checksum leaves out. */
export function firstPoseDifference(expected: Readonly<ReplayState>, actual: Readonly<ReplayState>): string | undefined {
  if (expected.world.mask !== actual.world.mask) return "participantMask";
  if (expected.world.teamBattle !== actual.world.teamBattle) return "world.teamBattle";
  if (expected.world.friendlyFire !== actual.world.friendlyFire) return "world.friendlyFire";
  for (const slot of PARTICIPANT_SLOTS) if (expected.world.teamChoices[slot] !== actual.world.teamChoices[slot]) return `world.slot${slot}.team`;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(expected.world, slot)) continue;
    const pose = firstFighterPoseDifference(expected.runtime.poses[slot], actual.runtime.poses[slot], expected.world, actual.world);
    if (pose !== undefined) return `pose[${slot}].${pose}`;
  }
  const impact = firstImpactDifference(expected.runtime.impacts, actual.runtime.impacts);
  if (impact !== undefined) return `impacts.${impact}`;
  const special = firstSpecialEffectDifference(expected.runtime.specials, actual.runtime.specials);
  if (special !== undefined) return `specials.${special}`;
  const summon = firstSummonDifference(expected.runtime.summons, actual.runtime.summons);
  return summon === undefined ? undefined : `summons.${summon}`;
}

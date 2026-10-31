import { traceCallbacks } from "../../game/session/traceSettings";


import { hasPendingAttack, type AttackBuffer } from "../../game/input/attackBuffer";
import { pulsePending } from "../../game/input/directionalInput";
import { encodeBindings } from "../../game/input/keyBindings";
import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../../game/input/participants";
import { directionX, directionZ } from "../../game/input/playerKeys";
import { characterFor, characterReady, computerActive, fighterMask, firstHumanSlot, humanActive, humanFighterActive } from "../../game/lobby/lobbyState";
import { captureReplaySnapshot } from "../../game/replay/snapshot";
import { beginStateChecksum, foldStateChecksum, stateChecksum } from "../../game/replay/canonical";
import { fighterAt, isActive, type Controls } from "../../game/sim/roster";
import { floorMod, idiv } from "wisp/src/sim/intMath";
import { INPUT_START_FILE, MELEE_READY_FILE, traceStartLine } from "../../game/core/gameFiles";
import { writeLines } from "wisp/src/platform/fileio";
import { type ShellState, activeRollback, localSlot } from "./state";
import { views } from "./ui";
import { type InputTrace, beginInputTrace, closeTraceWindow, finishInputTrace, traceInput, traceParticipantWindow, traceSeconds } from "./trace";
import { knownFrame } from "wisp/src/netcode/shadowSchedule";
import { nextCaptureTarget } from "../../game/netcode/inputSchedule";
import { formatReal } from "wisp/game/text";

const bit = (value: boolean) => (value ? "1" : "0");

export function presentedCueTrace(s: ShellState, slot: number, frame: number): ((text: string) => void) | undefined {
  return s.trace.active ? (text) => traceInput(s.trace, `participant ${slot} presented ${frame} confirmed ${s.runtime.simulationFrame} meter-cue ${text}`) : undefined;
}

export function traceParticipant(s: ShellState, slot: number, entry: string): void {
  traceInput(s.trace, `participant ${slot} frame ${s.runtime.simulationFrame} phase ${s.game.phase} ${entry}`);
}


export function confirmedChecksum(s: ShellState): string {
  captureReplaySnapshot(s.diagnostic, s.world, s.game, s.controls, s.runtime);
  return stateChecksum(s.diagnostic);
}






const CHECKSUM_FOLD_CALLBACKS = 45;


function traceConfirmedState(s: ShellState): void {
  const first = firstHumanSlot(s.game);
  if (first === undefined || s.participants[first].body === undefined) return;
  foldConfirmedState(s.trace, true);
  const started = traceSeconds(s.trace);
  captureReplaySnapshot(s.diagnostic, s.world, s.game, s.controls, s.runtime);
  const fold = beginStateChecksum(s.diagnostic);
  traceInput(s.trace, `checksum capture native-seconds ${formatReal(traceSeconds(s.trace) - started)}`);
  s.trace.checksum = { frame: s.runtime.simulationFrame, fold, slice: idiv(fold.text.length + CHECKSUM_FOLD_CALLBACKS - 1, CHECKSUM_FOLD_CALLBACKS) };
}


function foldConfirmedState(trace: InputTrace, all: boolean): void {
  const pending = trace.checksum;
  if (pending === undefined) return;
  const state = foldStateChecksum(pending.fold, all ? pending.fold.text.length : pending.slice);
  if (state === undefined) return;
  trace.checksum = undefined;
  traceInput(trace, `confirmed frame ${pending.frame} state ${state}`);
}

export function traceSelectionState(s: ShellState, reason: string): void {
  if (!s.trace.active) return;
  const { game } = s;
  traceInput(s.trace, `selection ${reason} phase ${game.phase} connected ${game.humanMask} human-fighters ${game.humanFighterMask} computers ${game.computerMask} fighters ${fighterMask(game)}`);
  for (const slot of PARTICIPANT_SLOTS) {
    const mode = humanFighterActive(game, slot) ? "HMN" : computerActive(game, slot) ? "CPU" : "EMPTY";
    traceInput(s.trace, `selection slot ${slot} mode ${mode} choice ${characterFor(game, slot) ?? -1} ready ${bit(characterReady(game, slot))}`);
  }
}

function traceLitMeterCues(s: ShellState): void {
  for (const slot of PARTICIPANT_SLOTS) {
    const lit = s.ui?.fighters[slot]?.meter?.litAura();
    if (lit !== undefined) traceInput(s.trace, `participant ${slot} frame ${lit.frame} phase ${s.game.phase} meter-cue ${lit.line}`);
  }
}

export function startInputTrace(s: ShellState): void {
  beginInputTrace(s.trace);
  const stamps = s.rollback?.keyboard?.stamps;
  if (stamps !== undefined) for (const stamp of stamps) stamp.traced = false;
  traceInput(s.trace, `start ${s.build.id} input ${s.build.inputProfile} presentation ${s.build.presentation}`);
  traceInput(s.trace, `humans ${s.game.humanCount} frame ${s.runtime.simulationFrame} phase ${s.game.phase}`);
  traceConfirmedState(s);
  traceSelectionState(s, "trace-start");
  traceLitMeterCues(s);
  const receiptStarted = traceSeconds(s.trace);
  writeLines(INPUT_START_FILE, [traceStartLine(s.build.id)]);
  traceInput(s.trace, `trace-start receipt native-seconds ${formatReal(traceSeconds(s.trace) - receiptStarted)}`);
}


export function traceFrameInput(s: ShellState, slot: ParticipantSlot, input: Readonly<Controls>, attacks: Readonly<AttackBuffer>, frame: number): void {
  const attacking = hasPendingAttack(attacks, frame);
  if (!s.trace.active || !(input.jumpPressed || input.airDodgePressed || input.specialPressed || attacking)) return;
  const attack = attacking ? attacks.pending?.style ?? -1 : -1;
  traceInput(s.trace, `participant ${slot} frame ${frame} phase ${s.game.phase} sampled x ${input.direction} z ${input.verticalDirection} jump ${bit(input.jumpPressed)} dodge ${bit(input.airDodgePressed)} special ${bit(input.specialPressed)} attack ${attack}`);
}


export function localParticipantSlot(s: Readonly<ShellState>): ParticipantSlot | undefined {
  const slot = localSlot();
  for (const candidate of PARTICIPANT_SLOTS) if (candidate === slot && humanActive(s.game, candidate)) return candidate;
  return firstHumanSlot(s.game);
}


function traceLength(s: Readonly<ShellState>): number {
  return traceCallbacks(s.build, s.trace.limit);
}


export function traceTick(s: ShellState): void {
  const { trace } = s;
  if (!trace.active) return;
  trace.ticks++;

  if (s.session.paused) trace.pausedTicks++;
  foldConfirmedState(trace, false);
  const local = localParticipantSlot(s);
  if (local !== undefined && s.participants[local].body !== undefined && isActive(s.world, local)) {
    const { keys } = s.participants[local];
    const fighter = fighterAt(s.world, local);
    const axes = directionX(keys) + 3 * directionZ(keys);
    const pulse = pulsePending(keys.directions);
    if (axes !== trace.lastAxes || pulse || floorMod(trace.ticks, 60) === 0) {
      traceInput(trace, `sample ${axes} pulse ${pulse ? `${keys.directions.pulseX}:${keys.directions.pulseZ}` : "none"} hitlag ${fighter.launch.hitlag}`);
      trace.lastAxes = axes;
    }
    if (trace.lastDodge !== fighter.dodge.airFrame || trace.lastLandingLag !== fighter.landing.lag) {
      traceInput(trace, `motion air ${fighter.dodge.airFrame} landing ${fighter.landing.lag} x ${formatReal(fighter.motion.x)} z ${formatReal(fighter.motion.z)}`);
      trace.lastDodge = fighter.dodge.airFrame;
      trace.lastLandingLag = fighter.landing.lag;
    }
  }
  if (floorMod(trace.ticks, 60) === 0) {

    if (trace.ticks - trace.pausedTicks + CHECKSUM_FOLD_CALLBACKS < traceLength(s)) traceConfirmedState(s);
    const rollback = activeRollback(s);
    if (rollback !== undefined) {
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(s.world, slot)) continue;
        const missing = views(s).fighters[slot]?.pool?.missingSelections;
        if (missing !== undefined) traceInput(trace, `local presentation ${s.build.presentation} participant ${slot} admitted ${bit(s.participants[slot].pooled)} missing-selections ${missing}`);
        traceParticipantWindow(trace, slot);
      }
      const { schedule } = rollback;
      closeTraceWindow(trace, {
        known: knownFrame(schedule), confirmed: schedule.nextConfirmed - 1, rollback: schedule.window,
        speculative: schedule.nextSpeculative, target: nextCaptureTarget(schedule), batchPending: rollback.keyboard?.outgoing.size() ?? rollback.journal?.outgoing.pending() ?? 0,
      }, rollback.journal?.readyMask ?? 0);
    }
  }
  if (trace.ticks - trace.pausedTicks >= traceLength(s)) {
    foldConfirmedState(trace, true);
    finishInputTrace(trace);
  }
}


export function writeReadyMarker(s: ShellState): void {
  const local = localParticipantSlot(s);
  if (s.readyMarkerWritten || local === undefined || !s.participants[local].bindings.ready) return;
  s.readyMarkerWritten = true;
  const lines = [
    `BUILD ${s.build.id}`,
    `INPUT ${s.build.inputProfile} PRESENTATION ${s.build.presentation}`,
    `SCENARIO ${s.build.scenario}`,
    `CONSOLE ${s.build.devConsole ? "dev" : "off"}`,
    `BINDINGS ${encodeBindings(s.participants[local].bindings.bindings)}`,
    `HUMANS ${s.game.humanMask} FIGHTERS ${s.world.mask}`,
  ];
  for (const slot of PARTICIPANT_SLOTS) {
    if (isActive(s.world, slot)) lines.push(`BINDINGS${slot} ${humanActive(s.game, slot) ? encodeBindings(s.participants[slot].bindings.bindings) : "BOT"}`);
  }
  writeLines(MELEE_READY_FILE, lines);
}

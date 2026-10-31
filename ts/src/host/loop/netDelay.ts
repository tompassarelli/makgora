import { trampoline } from "wisp/src/platform/dispatch";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { type MatchState, firstHumanSlot, humanActive, humanCount } from "../../game/lobby/lobbyState";
import {
  AUTO_DELAY, DEFAULT_DELAY, type DelayCorrection, type DelayPolicy, HELD_ERROR_CALLBACKS, type RttEstimate, agreedDelay, chosenDelay, connectionPoor, correctDelay,
  autoDelay, correctedDelay, delayCorrection, delayPolicy, highDelay, nextDelay, observeRtt, resetRtt, rttEstimate, smoothedRttMs, stepManualDelay,
} from "wisp/src/netcode/delay";
import { type FixedDelay, MAX_INPUT_DELAY, PENDING_CAPACITY, isFixedDelay } from "../../game/netcode/inputSchedule";
import { createText, gameUi, placeTopLeft } from "../../game/ui/frames";
import { MENU_STYLE, NET_INDICATOR_TOP } from "../../game/ui/hudLayout";
import type { LobbyNet } from "../../game/ui/selectionActions";
import { at } from "wisp/src/runtime/lookup";
import { type MachineRate, machineRate, noteMachineSecond } from "wisp/src/netcode/rate";
import { type Roster, isActive } from "../../game/sim/roster";
import { LEDGER_MARK, handleLedger, receiveLedgerReport, takeLedgerReport } from "./handleLedger";
import { createEvents, onEvents } from "wisp/game/events";
import { setFrameSize, setFrameText, setFrameVisible } from "wisp/game/frames";
import { eventPlayer, localPlayer, player, playerSlot } from "wisp/game/players";
import { addSyncEvent, sendSync, syncData } from "wisp/game/sync";

export const DELAY_PREFIX = "SC_DY";
export const DELAY_RECEIVED = "shell.delayProposal";
const PING_MARK = "p";
const DELAY_MARK = "d";
const ECHO_MARK = "e";
const RATE_MARK = "r";
const SLOW_MARK = "s";
const HOST_MARK = "h";
const NO_HOST_DELAY = -2;
const FREEZING_TEXT = "|cffffcc00Freezing: inputs late, host can raise input delay|r";
const SECOND = 60;
const slowMachineText = (slot: number, fps: number): string =>
  `P${slot + 1}'s machine is running slow (${fps} fps) — the match runs at its pace`;
export const POP_UNITS = 20;
const POP_BUCKETS = 1024;

export interface NetDelay {
  policy: DelayPolicy;
  readonly estimate: RttEstimate;
  readonly sentTicks: number[];
  readonly proposals: number[];
  readonly slotEchoMs: number[];
  readonly slotFps: number[];
  readonly slotSlow: boolean[];
  readonly rate: MachineRate;
  sentFps: number;
  sentSlow: boolean;
  readonly depths: number[];
  ticks: number;
  proposed: number;
  depth: number;
  shownDepth: number;
  indicator: framehandle | undefined;
  shownText: string;
  readonly arrivals: number[];
  readonly lateSum: number[];
  readonly lateMax: number[];
  echoes: number;
  echoSum: number;
  echoMax: number;
  corrections: number;
  replayed: number;
  rollbacks: number;
  replayedFrom: number;
  replayedDepth: number;
  deepest: number;
  readonly popX: number[];
  readonly popZ: number[];
  readonly popCounts: number[];
  popMax: number;
  popOver: number;
  readonly correction: DelayCorrection;
  readonly second: { held: number; arrivals: number; deep: number };
  pingDelay: number;
  measured: boolean;
  manual: number;
}

export function createNetDelay(window: number): NetDelay {
  const policy = delayPolicy(window, MAX_INPUT_DELAY);
  return {
    policy, correction: delayCorrection(policy), second: { held: 0, arrivals: 0, deep: 0 }, pingDelay: DEFAULT_DELAY, measured: false, estimate: rttEstimate(), sentTicks: Array.from({ length: PENDING_CAPACITY }, () => -1),
    proposals: [DEFAULT_DELAY, DEFAULT_DELAY, DEFAULT_DELAY, DEFAULT_DELAY], slotEchoMs: [-1, -1, -1, -1], slotFps: [-1, -1, -1, -1], slotSlow: [false, false, false, false], rate: machineRate(), sentFps: -1, sentSlow: false, depths: Array.from({ length: window + 2 }, () => 0), ticks: 0, proposed: DEFAULT_DELAY, depth: 0, shownDepth: 0,
    indicator: undefined, shownText: "", arrivals: [0, 0, 0, 0], lateSum: [0, 0, 0, 0], lateMax: [0, 0, 0, 0],
    echoes: 0, echoSum: 0, echoMax: 0, corrections: 0, replayed: 0, rollbacks: 0, replayedFrom: -1, replayedDepth: 0, deepest: 0,
    popX: [0, 0, 0, 0], popZ: [0, 0, 0, 0], popCounts: Array.from({ length: POP_BUCKETS }, () => 0), popMax: 0, popOver: 0, manual: AUTO_DELAY,
  };
}

export const isOnline = (game: Readonly<MatchState>): boolean => humanCount(game) > 1;

export function requestFor(net: Readonly<NetDelay>, game: Readonly<MatchState>, slot: number): number {
  return isOnline(game) ? at(net.proposals, slot) : DEFAULT_DELAY;
}

function humanRequests(net: Readonly<NetDelay>, game: Readonly<MatchState>): number[] {
  const requests: number[] = [];
  for (const slot of PARTICIPANT_SLOTS) if (humanActive(game, slot)) requests.push(requestFor(net, game, slot));
  return requests;
}

export const autoMatchDelay = (net: Readonly<NetDelay>, game: Readonly<MatchState>): number => agreedDelay(humanRequests(net, game));

export function matchDelay(net: Readonly<NetDelay>, game: Readonly<MatchState>): FixedDelay {
  const chosen = chosenDelay(humanRequests(net, game), isOnline(game) ? net.manual : AUTO_DELAY);
  return isFixedDelay(chosen) ? chosen : DEFAULT_DELAY;
}

export const isHost = (game: Readonly<MatchState>, slot: number): boolean => isOnline(game) && firstHumanSlot(game) === slot;

export function hostDelayFrom(net: NetDelay, game: Readonly<MatchState>, sender: number, manual: number): void {
  if (isHost(game, sender) && (manual === AUTO_DELAY || isFixedDelay(manual))) net.manual = manual;
}

export const nextManualDelay = (net: Readonly<NetDelay>, game: Readonly<MatchState>, direction: -1 | 1): number => stepManualDelay(net.policy, net.manual, autoMatchDelay(net, game), direction);

export function sendHostDelay(manual: number): void {
  sendSync(DELAY_PREFIX, `${HOST_MARK}${I2S(manual)}`);
}

export function lobbyNet(net: Readonly<NetDelay>, game: Readonly<MatchState>, local: number): LobbyNet {
  const online = isOnline(game);
  const delay = matchDelay(net, game);
  const echoes = PARTICIPANT_SLOTS.map((slot) => {
    const echo = at(net.slotEchoMs, slot);
    if (!online || !humanActive(game, slot) || echo < 0) return "";
    return at(net.slotSlow, slot) ? ` · echo |cffff4040${I2S(echo)} ms|r` : ` · echo ${I2S(echo)} ms`;
  });
  const shown = `${highDelay(delay) ? "|cffff4040" : MENU_STYLE.gold}${I2S(delay)}`;
  const delayText = !online ? `Input delay: ${shown} frames|r` : net.manual === AUTO_DELAY ? `Input delay: Auto (${shown}|r)` : `Input delay: ${shown}|r (Auto ${I2S(autoMatchDelay(net, game))})`;
  return { delayText, echoes, hostControl: isHost(game, local) };
}

export function slowMachineLine(net: Readonly<NetDelay>, game: Readonly<MatchState>): string {
  if (!isOnline(game)) return "";
  const warnings: string[] = [];
  for (const slot of PARTICIPANT_SLOTS) if (humanActive(game, slot) && at(net.slotSlow, slot)) warnings.push(slowMachineText(slot, at(net.slotFps, slot)));
  return warnings.length === 0 ? "" : `|cffffcc00${warnings.join(" · ")}|r`;
}

export const echoMs =(estimate: Readonly<RttEstimate>): number => estimate.samples === 0 ? -1 : floorDiv(smoothedRttMs(estimate), 2);

export interface DelayMessage {
  readonly ping: number;
  readonly delay: number;
  readonly echo: number;
  readonly fps: number;
  readonly slow: boolean;
  readonly host: number;
}

export function delayMessage(ping: number, delay: number, echo: number, fps = -1, slow = false): string {
  const parts: string[] = [];
  if (ping >= 0) parts.push(`${PING_MARK}${I2S(ping)}`);
  parts.push(`${DELAY_MARK}${I2S(delay)}`);
  if (echo >= 0) parts.push(`${ECHO_MARK}${I2S(echo)}`);
  if (fps >= 0) parts.push(`${RATE_MARK}${I2S(fps)}`);
  if (slow) parts.push(`${SLOW_MARK}1`);
  return parts.join(" ");
}

export function parseDelayMessage(data: string): DelayMessage {
  let ping = -1;
  let delay = -1;
  let echo = -1;
  let fps = -1;
  let slow = false;
  let host = NO_HOST_DELAY;
  for (const token of data.split(" ")) {
    const mark = token.substring(0, 1);
    const value = S2I(token.substring(1));
    if (mark === PING_MARK) ping = value;
    else if (mark === DELAY_MARK) delay = value;
    else if (mark === ECHO_MARK) echo = value;
    else if (mark === RATE_MARK) fps = value;
    else if (mark === SLOW_MARK) slow = value === 1;
    else if (mark === HOST_MARK) host = value;
  }
  return { ping, delay, echo, fps, slow, host };
}

export function noteSent(net: NetDelay, frame: number): void {
  net.sentTicks[floorMod(frame, PENDING_CAPACITY)] = net.ticks;
}

export function noteEcho(net: NetDelay, frame: number): void {
  const index = floorMod(frame, PENDING_CAPACITY);
  const sent = at(net.sentTicks, index);
  if (sent < 0) return;
  net.sentTicks[index] = -1;
  const echo = net.ticks - sent;
  net.echoMax = net.echoes === 0 ? echo : Math.max(net.echoMax, echo);
  net.echoes++;
  net.echoSum += echo;
  // Warcraft relays each sync message through the host, so a row's echo age is the remote row's age too: the round trip is twice it.
  if (!net.measured) observeRtt(net.estimate, floorDiv(echo * 100, 3));
}

/**
 * The round trip the transport measured end to end (wisp:host/net/peer.ts), handed over before the match. Under the lockstep link a sync row's echo
 * is a whole number of turns and sees only the turn delay, so from here the echoes no longer move the estimate; returns the delay it sets.
 */
export function handMeasuredRtt(net: NetDelay, rttMs: number): number {
  resetRtt(net.estimate);
  observeRtt(net.estimate, rttMs);
  net.measured = true;
  net.pingDelay = autoDelay(net.policy, net.estimate);
  return net.pingDelay;
}

/** The delay `handMeasuredRtt` will set, for a caller that must report it before the map's state exists. */
export function measuredDelay(window: number, rttMs: number): number {
  const estimate = rttEstimate();
  observeRtt(estimate, rttMs);
  return autoDelay(delayPolicy(window, MAX_INPUT_DELAY), estimate);
}

export function beginNetEpoch(net: NetDelay): void {
  net.sentTicks.fill(-1);
  net.depths.fill(0);
  net.depth = 0;
  resetArrivals(net);
  resetSecond(net);
  net.correction.windowSeconds = 0;
  net.correction.errorSeconds = 0;
  net.correction.cleanSeconds = 0;
}

function resetSecond(net: NetDelay): void {
  const { second } = net;
  second.held = 0;
  second.arrivals = 0;
  second.deep = 0;
}

function resetArrivals(net: NetDelay): void {
  net.arrivals.fill(0);
  net.lateSum.fill(0);
  net.lateMax.fill(0);
  net.echoes = 0;
  net.echoSum = 0;
  net.echoMax = 0;
  net.corrections = 0;
  net.replayed = 0;
  net.deepest = 0;
  net.popMax = 0;
  net.popOver = 0;
}

export function noteReceived(net: NetDelay, sender: number, own: boolean, frame: number, speculative: number): void {
  if (own) noteEcho(net, frame);
  else if (sender >= 0 && sender < net.arrivals.length) noteArrival(net, sender, speculative - frame);
}

function noteArrival(net: NetDelay, sender: number, late: number): void {
  const arrivals = at(net.arrivals, sender);
  net.lateMax[sender] = arrivals === 0 ? late : Math.max(at(net.lateMax, sender), late);
  net.arrivals[sender] = arrivals + 1;
  net.lateSum[sender] = at(net.lateSum, sender) + late;
  const { second } = net;
  second.arrivals++;
  if (late > net.policy.budget) second.deep++;
}

const meanOf = (sum: number, count: number): number => count === 0 ? 0 : floorDiv(sum, count);

export function takeNetRates(net: NetDelay): string {
  let total = 0;
  const senders: string[] = [];
  for (let slot = 0; slot < net.arrivals.length; slot++) {
    const arrivals = at(net.arrivals, slot);
    if (arrivals === 0) continue;
    total += arrivals;
    senders.push(`P${slot + 1}:${meanOf(at(net.lateSum, slot), arrivals)}/${at(net.lateMax, slot)}`);
  }
  const text = `arr=${total} lt=${senders.length === 0 ? "-" : senders.join(",")} echo=${meanOf(net.echoSum, net.echoes)}/${net.echoMax} rb=${net.corrections} rbf=${net.replayed} rbd=${net.deepest} pop=${net.popMax}/${net.popOver}`;
  resetArrivals(net);
  return text;
}

export function noteDepth(net: NetDelay, depth: number, from: number): void {
  net.corrections++;
  net.rollbacks++;
  net.replayedFrom = from;
  net.replayedDepth = depth;
  net.replayed += depth;
  net.deepest = Math.max(net.deepest, depth);
  net.depth = Math.max(net.depth, depth);
  const bucket = Math.min(depth, net.depths.length - 1);
  net.depths[bucket] = at(net.depths, bucket) + 1;
}

export function notePopBefore(net: NetDelay, world: Readonly<Roster>): void {
  for (let slot = 0; slot < net.popX.length; slot++) {
    const motion = world.fighters[slot]?.motion;
    net.popX[slot] = motion === undefined ? 0 : motion.x;
    net.popZ[slot] = motion === undefined ? 0 : motion.z;
  }
}

export function notePop(net: NetDelay, world: Readonly<Roster>): void {
  let pop = 0;
  for (let slot = 0; slot < net.popX.length; slot++) {
    const motion = world.fighters[slot]?.motion;
    if (motion === undefined || !isActive(world, slot)) continue;
    const dx = motion.x - at(net.popX, slot);
    const dz = motion.z - at(net.popZ, slot);
    pop = Math.max(pop, Math.floor(Math.sqrt(dx * dx + dz * dz)));
  }
  net.popMax = Math.max(net.popMax, pop);
  if (pop > POP_UNITS) net.popOver++;
  const bucket = Math.min(pop, net.popCounts.length - 1);
  net.popCounts[bucket] = at(net.popCounts, bucket) + 1;
}

function proposeDelay(net: NetDelay, players: number, active: boolean, inMatch: boolean, delay: number): void {
  const online = players > 1;
  if (online && inMatch) correctDelay(net.policy, net.correction, delay, net.second);
  resetSecond(net);
  if (!active) return;
  if (net.estimate.samples > 0) net.pingDelay = nextDelay(net.policy, net.estimate, net.pingDelay);
  const proposal = correctedDelay(net.policy, net.correction, net.pingDelay);
  const { rate } = net;
  const rateChanged = rate.slow !== net.sentSlow || (rate.slow && rate.fps !== net.sentFps);
  if (!inMatch || proposal !== net.proposed || rateChanged) {
    if (sendSync(DELAY_PREFIX, delayMessage(inMatch ? -1 : net.ticks, proposal, echoMs(net.estimate), rate.fps, rate.slow))) {
      net.proposed = proposal;
      net.sentFps = rate.fps;
      net.sentSlow = rate.slow;
    }
  }
}

export function noteLocalSecond(net: NetDelay, fps: number, busyMs: number): void {
  noteMachineSecond(net.rate, fps, busyMs);
}

export function serviceNetDelay(net: NetDelay, game: Readonly<MatchState>, local: number, delay: number, inMatch: boolean, held: boolean): void {
  net.ticks++;
  if (inMatch && held) net.second.held++;
  if (floorMod(net.ticks, SECOND) !== 0) return;
  if (net.indicator === undefined) {
    net.indicator = createText("SmashcraftNetIndicator", gameUi(), 0);
    placeTopLeft(net.indicator, f32(0.01), NET_INDICATOR_TOP);
    setFrameSize(net.indicator, f32(0.5), f32(0.016));
    setFrameVisible(net.indicator, false);
  }
  const online = isOnline(game);
  const freezing = net.second.held >= HELD_ERROR_CALLBACKS;
  proposeDelay(net, humanCount(game), online && humanActive(game, local), inMatch, delay);
  net.shownDepth = net.depth;
  net.depth = 0;
  const poor = connectionPoor(net.policy, net.estimate, delay);
  const slow = inMatch ? slowMachineLine(net, game) : "";
  const behind = poor ? ` · ${I2S(net.shownDepth)} frames behind` : "";
  const network = highDelay(delay) ? `|cffff4040Laggy connection: ${I2S(delay)} frames of input delay|r${behind}` : poor ? `|cffff4040Connection poor|r · input delay ${I2S(delay)}${behind}` : "";
  const text = slow !== "" ? slow : !inMatch || !online ? "" : freezing ? FREEZING_TEXT : network;
  if (text === net.shownText) return;
  net.shownText = text;
  setFrameText(net.indicator, text);
  setFrameVisible(net.indicator, text !== "");
}

export function sendHandleLedger(game: Readonly<MatchState>): void {
  if (!isOnline(game)) return;
  const report = takeLedgerReport(handleLedger());
  if (report !== undefined) sendSync(DELAY_PREFIX, report);
}

export function receiveDelayProposal(net: NetDelay, game: Readonly<MatchState>): void {
  const slot = playerSlot(eventPlayer());
  const data = syncData();
  if (data.substring(0, 1) === LEDGER_MARK) {
    receiveLedgerReport(handleLedger(), playerSlot(localPlayer()), slot, data);
    return;
  }
  const message = parseDelayMessage(data);
  if (message.host !== NO_HOST_DELAY) {
    hostDelayFrom(net, game, slot, message.host);
    return;
  }
  if (message.ping >= 0 && !net.measured && eventPlayer() === localPlayer()) observeRtt(net.estimate, floorDiv((net.ticks - message.ping) * 100, 3));
  if (slot < 0 || slot >= net.proposals.length) return;
  if (isFixedDelay(message.delay)) net.proposals[slot] = Math.max(DEFAULT_DELAY, message.delay);
  if (message.echo >= 0) net.slotEchoMs[slot] = message.echo;
  if (message.fps >= 0) net.slotFps[slot] = message.fps;
  net.slotSlow[slot] = message.slow;
}

export function registerDelayProposals(handler: string): void {
  const trigger = createEvents();
  for (const slot of PARTICIPANT_SLOTS) addSyncEvent(trigger, player(slot), DELAY_PREFIX);
  onEvents(trigger, trampoline(handler));
}

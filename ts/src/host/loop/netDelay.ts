import { trampoline } from "wisp/src/platform/dispatch";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { type MatchState, humanActive } from "../../game/lobby/lobbyState";
import {
  AUTO_DELAY, DEFAULT_DELAY, type DelayCorrection, type DelayPolicy, HIGH_DELAY_FRAMES, type RttEstimate, agreedDelay, connectionPoor, correctDelay, correctedDelay,
  delayCorrection, delayPolicy, expectedRollback, highDelay, nextDelay, observeRtt, requestedDelay, rttEstimate, smoothedRttMs,
} from "../../game/netcode/delayPolicy";
import { type FixedDelay, isFixedDelay } from "../../game/netcode/fixedSchedule";
import { PENDING_CAPACITY } from "../../game/netcode/shadowSchedule";
import { createText, gameUi, placeTopLeft } from "../../game/ui/frames";
import { at } from "wisp/src/runtime/lookup";

export const DELAY_PREFIX = "SC_DY";
export const DELAY_RECEIVED = "shell.delayProposal";
const PING_MARK = "p";
const SECOND = 60;

export interface NetDelay {
  readonly policy: DelayPolicy;
  readonly estimate: RttEstimate;
  readonly sentTicks: number[];
  readonly proposals: number[];
  readonly depths: number[];
  ticks: number;
  proposed: number;
  depth: number;
  shownDepth: number;
  indicator: framehandle | undefined;
  shownText: string;
  arrivals: number;
  lateSum: number;
  lateMax: number;
  readonly correction: DelayCorrection;
  readonly second: { held: number; arrivals: number; deep: number };
  pingDelay: number;
}

export function createNetDelay(window: number): NetDelay {
  const policy = delayPolicy(window);
  return {
    policy, correction: delayCorrection(policy), second: { held: 0, arrivals: 0, deep: 0 }, pingDelay: DEFAULT_DELAY, estimate: rttEstimate(), sentTicks: Array.from({ length: PENDING_CAPACITY }, () => -1),
    proposals: [DEFAULT_DELAY, DEFAULT_DELAY, DEFAULT_DELAY, DEFAULT_DELAY], depths: Array.from({ length: window + 2 }, () => 0), ticks: 0, proposed: DEFAULT_DELAY, depth: 0, shownDepth: 0,
    indicator: undefined, shownText: "", arrivals: 0, lateSum: 0, lateMax: 0,
  };
}

function humans(game: Readonly<MatchState>): number {
  let count = 0;
  for (const slot of PARTICIPANT_SLOTS) if (humanActive(game, slot)) count++;
  return count;
}

export const isOnline = (game: Readonly<MatchState>): boolean => humans(game) > 1;

export function requestFor(net: Readonly<NetDelay>, game: Readonly<MatchState>, slot: number, choice: number): number {
  return requestedDelay(choice, isOnline(game) ? at(net.proposals, slot) : DEFAULT_DELAY);
}

export function matchDelay(net: Readonly<NetDelay>, game: Readonly<MatchState>, choices: readonly number[]): FixedDelay {
  const requests: number[] = [];
  for (const slot of PARTICIPANT_SLOTS) if (humanActive(game, slot)) requests.push(requestFor(net, game, slot, at(choices, slot)));
  const agreed = agreedDelay(requests);
  return isFixedDelay(agreed) ? agreed : DEFAULT_DELAY;
}

export function lobbyDelayText(net: Readonly<NetDelay>, game: Readonly<MatchState>, choices: readonly number[]): string {
  const parts: string[] = [];
  for (const slot of PARTICIPANT_SLOTS) {
    if (!humanActive(game, slot)) continue;
    const choice = at(choices, slot);
    const request = requestFor(net, game, slot, choice);
    parts.push(`P${I2S(slot + 1)} ${choice === AUTO_DELAY ? `Auto (${I2S(request)})` : I2S(request)}`);
  }
  const agreed = matchDelay(net, game, choices);
  const line = `Input delay: ${parts.join(" · ")} → ${I2S(agreed)} frames`;
  return highDelay(agreed) ? `${line}\n|cffff4040Input delay of ${I2S(HIGH_DELAY_FRAMES)}+ frames: this connection will feel sluggish|r` : line;
}

export const recalibratedDelay = (net: Readonly<NetDelay>, game: Readonly<MatchState>, slot: number): number => requestFor(net, game, slot, AUTO_DELAY);

export function recalibrateText(net: Readonly<NetDelay>, game: Readonly<MatchState>, slot: number): string {
  const { estimate } = net;
  const auto = recalibratedDelay(net, game, slot);
  if (estimate.samples === 0) return `Recalibrate: no ping measured yet · Auto ${I2S(auto)} frames`;
  return `Ping ${I2S(smoothedRttMs(estimate))} ms · Auto ${I2S(auto)} frames · expected rollback ${I2S(expectedRollback(estimate, auto))}`;
}

export function noteSent(net: NetDelay, frame: number): void {
  net.sentTicks[floorMod(frame, PENDING_CAPACITY)] = net.ticks;
}

export function noteEcho(net: NetDelay, frame: number): void {
  const index = floorMod(frame, PENDING_CAPACITY);
  const sent = at(net.sentTicks, index);
  if (sent < 0) return;
  net.sentTicks[index] = -1;
  // Warcraft relays each sync message through the host, so a row's echo age is the remote row's age too: the round trip is twice it.
  observeRtt(net.estimate, floorDiv((net.ticks - sent) * 100, 3));
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
  net.arrivals = 0;
  net.lateSum = 0;
  net.lateMax = 0;
}

export function noteReceived(net: NetDelay, own: boolean, frame: number, speculative: number): void {
  if (own) noteEcho(net, frame);
  else noteArrival(net, speculative - frame);
}

function noteArrival(net: NetDelay, late: number): void {
  net.lateMax = net.arrivals === 0 ? late : Math.max(net.lateMax, late);
  net.arrivals++;
  net.lateSum += late;
  const { second } = net;
  second.arrivals++;
  if (late > net.policy.budget) second.deep++;
}

export function takeArrivals(net: NetDelay): string {
  const text = `arr=${net.arrivals} late=${net.arrivals === 0 ? 0 : floorDiv(net.lateSum, net.arrivals)} lmax=${net.lateMax}`;
  resetArrivals(net);
  return text;
}

export function noteDepth(net: NetDelay, depth: number): void {
  net.depth = Math.max(net.depth, depth);
  const bucket = Math.min(depth, net.depths.length - 1);
  net.depths[bucket] = at(net.depths, bucket) + 1;
}

function proposeDelay(net: NetDelay, online: boolean, active: boolean, inMatch: boolean, delay: number): void {
  if (active && !inMatch) BlzSendSyncData(DELAY_PREFIX, `${PING_MARK}${I2S(net.ticks)}`);
  if (online && inMatch) correctDelay(net.policy, net.correction, delay, net.second);
  resetSecond(net);
  if (!active) return;
  if (net.estimate.samples > 0) net.pingDelay = nextDelay(net.policy, net.estimate, net.pingDelay);
  const proposal = correctedDelay(net.policy, net.correction, net.pingDelay);
  if (proposal !== net.proposed && BlzSendSyncData(DELAY_PREFIX, I2S(proposal))) net.proposed = proposal;
}

export function serviceNetDelay(net: NetDelay, game: Readonly<MatchState>, local: number, delay: number, inMatch: boolean, held: boolean): void {
  net.ticks++;
  if (inMatch && held) net.second.held++;
  if (floorMod(net.ticks, SECOND) !== 0) return;
  if (net.indicator === undefined) {
    net.indicator = createText("SmashcraftNetIndicator", gameUi(), 0);
    placeTopLeft(net.indicator, f32(0.01), f32(0.03));
    BlzFrameSetSize(net.indicator, f32(0.3), f32(0.016));
    BlzFrameSetVisible(net.indicator, false);
  }
  const online = isOnline(game);
  proposeDelay(net, online, online && humanActive(game, local), inMatch, delay);
  net.shownDepth = net.depth;
  net.depth = 0;
  const poor = connectionPoor(net.policy, net.estimate, delay);
  const text = !inMatch || !online || !poor ? "" : `|cffff4040Connection poor|r · input delay ${I2S(delay)} · ${I2S(net.shownDepth)} frames behind`;
  if (text === net.shownText) return;
  net.shownText = text;
  BlzFrameSetText(net.indicator, text);
  BlzFrameSetVisible(net.indicator, text !== "");
}

export function receiveDelayProposal(net: NetDelay): void {
  const slot = GetPlayerId(GetTriggerPlayer());
  const data = BlzGetTriggerSyncData();
  if (data.startsWith(PING_MARK)) {
    if (GetTriggerPlayer() === GetLocalPlayer()) observeRtt(net.estimate, floorDiv((net.ticks - S2I(data.substring(PING_MARK.length))) * 100, 3));
    return;
  }
  const value = S2I(data);
  if (slot >= 0 && slot < net.proposals.length && isFixedDelay(value)) net.proposals[slot] = Math.max(DEFAULT_DELAY, value);
}

export function registerDelayProposals(handler: string): void {
  const trigger = CreateTrigger();
  for (const slot of PARTICIPANT_SLOTS) BlzTriggerRegisterPlayerSyncEvent(trigger, Player(slot), DELAY_PREFIX, false);
  TriggerAddAction(trigger, trampoline(handler));
}

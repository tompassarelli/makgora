import type { HeadlessClient } from "wisp/src/headless/client";
import type { SyncDelivery } from "wisp/src/headless/lockstep";
import { knownFrame } from "wisp/src/netcode/shadowSchedule";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import type { InputSchedule } from "../../src/game/netcode/inputSchedule";

export interface LagSpikes {
  readonly first: number;
  readonly period: number;
  readonly hold: number;
}

export const DEEP_ROLLBACK_SPIKES: LagSpikes = { first: 230, period: 301, hold: 40 };


export function lagSpikeDelivery(base: SyncDelivery, spikes: LagSpikes, senders: number): SyncDelivery {
  const last = new Map<number, number>();
  return {
    arrivalFrame: (sender, frame, message) => {
      const since = frame - spikes.first;
      const spike = since < 0 ? -1 : floorDiv(since, spikes.period);
      const into = since - spike * spikes.period;
      const held = spike >= 0 && floorMod(spike, senders) === floorMod(sender, senders) && into < spikes.hold ? frame - into + spikes.hold : 0;
      const arrival = Math.max(base.arrivalFrame(sender, frame, message), held, last.get(sender) ?? 0);
      last.set(sender, arrival);
      return arrival;
    },
  };
}

interface DepthShell {
  readonly rollback?: {
    readonly window: number;
    readonly delay: number;
    readonly predictionHeld: boolean;
    readonly net: { readonly depths: readonly number[]; manual: number };
    readonly schedule: InputSchedule;
  };
}

const hasRollback = (shell: unknown): shell is DepthShell => typeof shell === "object" && shell !== null && "rollback" in shell;

function rollbackOf(client: HeadlessClient): DepthShell["rollback"] {
  let shell: unknown = client.natives.__makgoraShell;
  if (!hasRollback(shell)) client.run(() => { shell = globalThis.__makgoraShell; });
  return hasRollback(shell) ? shell.rollback : undefined;
}

export function confirmedLag(client: HeadlessClient): number | undefined {
  const rollback = rollbackOf(client);
  return rollback === undefined ? undefined : knownFrame(rollback.schedule) - rollback.schedule.nextConfirmed + 1;
}

export function framesRun(client: HeadlessClient): { readonly confirmed: number; readonly speculative: number } | undefined {
  const rollback = rollbackOf(client);
  return rollback === undefined ? undefined : { confirmed: rollback.schedule.nextConfirmed, speculative: rollback.schedule.nextSpeculative };
}

export function deepestRollback(client: HeadlessClient): { readonly window: number; readonly deepest: number; readonly corrections: number } | undefined {
  const rollback = rollbackOf(client);
  if (rollback === undefined) return undefined;
  const { depths } = rollback.net;
  let deepest = 0;
  let corrections = 0;
  for (let depth = 0; depth < depths.length; depth++) {
    const count = depths[depth] ?? 0;
    corrections += count;
    if (count > 0) deepest = depth;
  }
  return { window: rollback.window, deepest, corrections };
}

export function forceInputDelay(client: HeadlessClient, delay: number): void {
  const rollback = rollbackOf(client);
  if (rollback === undefined) throw new Error(`p${client.slot} has no rollback session to take input delay ${delay}`);
  rollback.net.manual = delay;
}

export function rollbackState(client: HeadlessClient): { readonly delay: number; readonly held: boolean; readonly depths: readonly number[] } | undefined {
  const rollback = rollbackOf(client);
  return rollback === undefined ? undefined : { delay: rollback.delay, held: rollback.predictionHeld, depths: rollback.net.depths };
}

export function depthRanks(depths: readonly number[]): { readonly rollbacks: number; readonly p50: number; readonly p99: number; readonly max: number } {
  const rollbacks = depths.reduce((total, count) => total + count, 0);
  const rankOf = (percent: number) => {
    const wanted = Math.max(1, Math.ceil((percent * rollbacks) / 100));
    let seen = 0;
    for (let depth = 0; depth < depths.length; depth++) {
      seen += depths[depth] ?? 0;
      if (seen >= wanted) return depth;
    }
    return 0;
  };
  return { rollbacks, p50: rankOf(50), p99: rankOf(99), max: rankOf(100) };
}

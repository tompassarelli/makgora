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
    readonly net: { readonly depths: readonly number[] };
    readonly schedule: InputSchedule;
  };
}

const hasRollback = (shell: unknown): shell is DepthShell => typeof shell === "object" && shell !== null && "rollback" in shell;

function rollbackOf(client: HeadlessClient): DepthShell["rollback"] {
  let shell: unknown = client.natives.__smashcraftShell;
  if (!hasRollback(shell)) client.run(() => { shell = globalThis.__smashcraftShell; });
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

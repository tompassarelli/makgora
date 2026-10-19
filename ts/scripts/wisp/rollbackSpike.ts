import type { HeadlessClient } from "wisp/src/headless/client";
import type { SyncDelivery } from "wisp/src/headless/lockstep";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";

export interface LagSpikes {
  readonly first: number;
  readonly period: number;
  readonly hold: number;
}

export const DEEP_ROLLBACK_SPIKES: LagSpikes = { first: 240, period: 301, hold: 40 };

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

interface DepthShell { readonly rollback?: { readonly window: number; readonly net: { readonly depths: readonly number[] } } }

const hasRollback = (shell: unknown): shell is DepthShell => typeof shell === "object" && shell !== null && "rollback" in shell;

export function deepestRollback(client: HeadlessClient): { readonly window: number; readonly deepest: number; readonly corrections: number } | undefined {
  let shell: unknown = client.natives.__smashcraftShell;
  if (!hasRollback(shell)) client.run(() => { shell = globalThis.__smashcraftShell; });
  if (!hasRollback(shell) || shell.rollback === undefined) return undefined;
  const { depths } = shell.rollback.net;
  let deepest = 0;
  let corrections = 0;
  for (let depth = 0; depth < depths.length; depth++) {
    const count = depths[depth] ?? 0;
    corrections += count;
    if (count > 0) deepest = depth;
  }
  return { window: shell.rollback.window, deepest, corrections };
}

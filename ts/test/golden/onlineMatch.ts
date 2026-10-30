// The recorded behaviour of a four-human match under seeded 1% loss. Bun and 32-bit Lua print the same lines; test/online-golden.test.ts holds the record.
import type { HeadlessClient } from "wisp/src/headless/client";
import { floorMod } from "wisp/src/sim/intMath";
import type { PerfMeasure } from "wisp/src/headless/luaPerf";
import type { Lockstep, SyncDelivery } from "wisp/src/headless/lockstep";
import { Random } from "wisp/src/headless/random";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { HUMAN_FOUR, playBotMatch } from "../../scripts/wisp/botMatch";
import { PLAYABLE_BUILD } from "../../src/game/session/currentBuild";
import { confirmedChecksum } from "../../src/host/loop/diagnostics";
import type { NetDelay } from "../../src/host/loop/netDelay";
import type { ShellState } from "../../src/host/loop/state";

export const GOLDEN_PREFIX = "golden ";
export const ONLINE_PLAYERS = [0, 1, 2, 3];
export const ONLINE_FRAMES = 900;
const SEED = 802;
const LOSS_BOUND = 21474836;
const RETRANSMIT_FRAMES = 12;
const CHECKSUM_EVERY = 60;

export function onlineDelivery(): SyncDelivery {
  const base = syncDelivery(MEASURED_BATTLE_NET, SEED);
  const senders = new Map<number, { readonly random: Random; last: number }>();
  return {
    arrivalFrame: (sender, frame, message) => {
      let state = senders.get(sender);
      if (state === undefined) {
        state = { random: new Random(SEED * 104729 + sender * 7919 + 5), last: 0 };
        senders.set(sender, state);
      }
      const lost = state.random.nextState() < LOSS_BOUND;
      state.last = Math.max(state.last, base.arrivalFrame(sender, frame, message) + (lost ? RETRANSMIT_FRAMES : 0));
      return state.last;
    },
  };
}

interface Observed {
  readonly rollback?: { readonly net: NetDelay };
  readonly runtime: ShellState["runtime"];
}

const shellOf = (client: HeadlessClient): ShellState & Observed => {
  let shell: unknown = client.natives.__smashcraftShell;
  if (shell === undefined) client.run(() => { shell = globalThis.__smashcraftShell; });
  if (shell === undefined) throw new Error(`p${client.slot} has no shell`);
  return shell as ShellState & Observed;
};

export function playOnlineGolden(clients: Lockstep, measure: PerfMeasure): string[] {
  const seen = clients.clients.map(() => 0);
  const record: string[] = [];
  const played = () => {
    clients.clients.forEach((client, index) => {
      const shell = shellOf(client);
      const net = shell.rollback?.net;
      if (net !== undefined && net.rollbacks !== seen[index]) {
        record.push(`${GOLDEN_PREFIX}p${client.slot} frame ${clients.frame} rollback ${net.rollbacks} from ${net.replayedFrom} depth ${net.replayedDepth}`);
        seen[index] = net.rollbacks;
      }
      if (floorMod(clients.frame, CHECKSUM_EVERY) === 0) record.push(`${GOLDEN_PREFIX}p${client.slot} frame ${clients.frame} confirmed ${confirmedChecksum(shell)}`);
    });
  };
  const result = playBotMatch(clients, HUMAN_FOUR, ONLINE_FRAMES, measure, PLAYABLE_BUILD, played);
  for (const line of result.lines) record.push(`${GOLDEN_PREFIX}problem ${line}`);
  return record;
}

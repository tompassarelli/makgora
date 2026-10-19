import { expect, test } from "bun:test";
import type { SyncDelivery } from "wisp/src/headless/lockstep";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { Phase } from "../src/game/lobby/lobbyState";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { HUMAN_DUEL, gameOf, playBotMatch } from "../scripts/wisp/botMatch";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(PREDICTED_HEADLESS);
const FIRST_OUTAGE = 900;
const OUTAGE_EVERY = 600;
const SHORTEST_OUTAGE = 30;

function relayOutages(base: SyncDelivery): SyncDelivery {
  return {
    arrivalFrame: (sender, frame, message) => {
      const arrival = base.arrivalFrame(sender, frame, message);
      if (arrival < FIRST_OUTAGE) return arrival;
      const cycle = floorDiv(arrival - FIRST_OUTAGE, OUTAGE_EVERY);
      const until = FIRST_OUTAGE + cycle * OUTAGE_EVERY + SHORTEST_OUTAGE * (1 + floorMod(cycle, 4));
      return Math.max(arrival, until);
    },
  };
}

test("two humans whose relay drops for 0.5 to 2 s every 10 s finish a predicted match with the same native calls on both clients [k1 scenario]", () => {
  const clients = headless.clients({ start: () => startBuild(PLAYABLE_BUILD), install }, [0, 1], { delivery: relayOutages(syncDelivery(MEASURED_BATTLE_NET, 7)), keepCalls: 64 });
  playBotMatch(clients, HUMAN_DUEL, 3000, { typed: () => {}, begin: () => {} }, PLAYABLE_BUILD);
  expect(clients.clients.map(client => gameOf(client).phase)).toEqual([Phase.result, Phase.result]);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
}, 120_000);

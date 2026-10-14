import { expect, test } from "bun:test";
import { testHeadless } from "./headless";
import type { Lockstep, SyncDelivery } from "wisp/src/headless/lockstep";
import { Phase } from "../src/game/match/rules";
import type { MapBuild } from "../src/game/shell/build";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { shellState } from "../src/platform/shell/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { entryFor } from "./desync/journeys";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

const CAPPED_PER_SECOND = 48;
const LATENCY_FRAMES = 6;
const MEASURED_FRAMES = 1500;
const RIGHT_KEY = 0x27;

function capped(perSecond: number): SyncDelivery & { sent: () => number } {
  let free = 0;
  let sent = 0;
  return {
    sent: () => sent,
    arrivalFrame: (_sender, frame, message) => {
      if (message.prefix !== "SC_GP") return frame + LATENCY_FRAMES;
      sent++;
      const arrival = Math.max(frame + LATENCY_FRAMES, free);
      free = arrival + 60 / perSecond;
      return Math.ceil(arrival);
    },
  };
}

function speculative(clients: Lockstep): number {
  let frame = 0;
  clients.clients[0]?.run(() => {
    frame = shellState()?.rollback?.schedule.speculativeFrame() ?? 0;
  });
  return frame;
}

function phase(clients: Lockstep): Phase | undefined {
  let found: Phase | undefined;
  clients.clients[0]?.run(() => {
    found = shellState()?.game.phase;
  });
  return found;
}

function framesPerSecondAlone(build: MapBuild, perSecond: number = CAPPED_PER_SECOND): { readonly rate: number; readonly messagesPerSecond: number } {
  const delivery = capped(perSecond);
  const clients = headless.clients(entryFor({ ...build, devConsole: true }), [0], { delivery });
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick cpu wren expert");
  for (let frame = 0; frame < 600 && phase(clients) !== Phase.match; frame++) clients.frames(1);
  clients.frames(30);
  const before = speculative(clients);
  const sentBefore = delivery.sent();
  let ran = 0;
  for (; ran < MEASURED_FRAMES && phase(clients) === Phase.match; ran += 20) {
    clients.key(0, RIGHT_KEY, 0, ran % 40 === 0);
    clients.frames(20);
  }
  const seconds = ran / 60;
  return { rate: (speculative(clients) - before) / seconds, messagesPerSecond: (delivery.sent() - sentBefore) / seconds };
}

test("alone against a computer, the playable build keeps 60 frames a second when Warcraft delivers at most 48 input messages a second [k1 scenario]", () => {
  const paired = framesPerSecondAlone(PLAYABLE_BUILD);
  expect(paired.messagesPerSecond).toBeLessThanOrEqual(31);
  expect(paired.rate).toBeGreaterThan(59);
  const unpaired = framesPerSecondAlone({ ...PLAYABLE_BUILD, input: { kind: "keyboard", pairedSends: false, delay: 2, rollback: 24 } });
  expect(unpaired.messagesPerSecond).toBeGreaterThan(48);
  expect(unpaired.rate).toBeLessThan(55);
}, 600_000);

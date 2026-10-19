import { expect } from "bun:test";
import { testHeadless } from "./headless";
import { install, start } from "../src/platform/main";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { confirmedChecksum } from "../src/host/loop/diagnostics";
import { shellState } from "../src/host/loop/state";
import { drawAtBurstTime, drawBetweenFrames } from "../src/host/loop/betweenFrames";
import { effectMotion } from "../src/game/render/effects";
import { expectNoDivergence } from "./desync/journeys";
import { sweep } from "./sweep";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

const MATCH_FRAMES = 300;

const BURSTS = [1, 2, 1, 2, 2, 1, 2, 1, 1, 2];


function quickMatch(drawing: boolean): { checksums: string[][]; smoothed: number; drawnPositions: number } {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick cpu wren expert");
  clients.everywhere(() => drawAtBurstTime(drawing));
  const checksums: string[][] = [[], []];
  let smoothed = 0;
  for (let frame = 0, burst = 0; frame < MATCH_FRAMES; burst++) {
    const size = Math.min(BURSTS[burst % BURSTS.length] ?? 1, MATCH_FRAMES - frame);
    for (let step = 0; step < size; step++, frame++) {
      clients.frames(1);
      clients.everywhere(() => {
        const s = shellState();
        if (s === undefined) throw new Error("no shell");
        checksums[GetPlayerId(GetLocalPlayer())]?.push(confirmedChecksum(s));
        if (effectMotion().smoothing) smoothed++;
      });
    }
    clients.everywhere(drawBetweenFrames);
  }
  expectNoDivergence(clients);
  const drawnPositions = clients.clients[0]?.log.filter(({ name }) => name === "BlzSetSpecialEffectPosition").length ?? 0;
  return { checksums, smoothed, drawnPositions };
}

sweep("drawing each burst at its game time leaves every confirmed checksum unchanged [k1 scenario]", () => {
  const plain = quickMatch(false);
  const smooth = quickMatch(true);
  expect(plain.smoothed).toBe(0);

  expect(smooth.smoothed).toBeGreaterThan(MATCH_FRAMES);
  expect(smooth.drawnPositions).toBeGreaterThan(plain.drawnPositions);
  expect(smooth.checksums[0]?.length).toBe(MATCH_FRAMES);
  expect(smooth.checksums).toEqual(plain.checksums);
}, 120_000);

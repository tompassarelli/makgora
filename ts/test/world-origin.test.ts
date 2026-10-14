import { expect, test } from "bun:test";
import { testHeadless } from "./headless";
import { install, start } from "../src/platform/main";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { shellState } from "../src/platform/shell/state";
import { FLOOR_HEIGHT } from "../src/game/presentation/arenaCamera";

const WATER_SURFACE_Z = 500.0;
const headless = testHeadless({ ...SMASHCRAFT_HEADLESS, natives: (client) => ({ ...SMASHCRAFT_HEADLESS.natives?.(client), GetLocationZ: () => WATER_SURFACE_Z }) });

test("the arena origin stands FLOOR_HEIGHT above the base map's ground whatever terrain water the map's centre reads [k5 boundary world-origin-terrain]", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(5);
  const heights: number[] = [];
  clients.everywhere(() => {
    const s = shellState();
    if (s === undefined) throw new Error("no shell");
    heights.push(s.origin.z);
  });
  expect(heights.length).toBeGreaterThan(0);
  for (const z of heights) expect(z).toBe(FLOOR_HEIGHT);
});

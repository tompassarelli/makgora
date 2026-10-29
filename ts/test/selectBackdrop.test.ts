import { expect, test } from "bun:test";
import type { MapBuild } from "../src/game/session/build";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-select-backdrop" };

// Engine: the select backdrops hang beside ConsoleUIBackdrop, so a game UI frame created before one is drawn under it and the select screen shows only the backdrop.
test("each select backdrop is created before every frame of its screen, so Warcraft draws the cards and buttons over it [k2 property]", () => {
  const clients = headless.clients({ install, start: () => startBuild(BUILD) }, [0]);
  clients.start();
  clients.frames(120);
  const names = clients.client(0).frames.snapshot().map(frame => frame.name);
  const order = (name: string) => names.indexOf(name);
  for (const [backdrop, screen] of [["MeleeSelectBackdrop0", /^Melee(Select|Tile|Moves|Mode)/], ["MeleeStageBackdrop", /^MeleeStage/]] as const) {
    const first = order(backdrop);
    expect(first).toBeGreaterThanOrEqual(0);
    const drawnFirst = names.filter((name, index) => index < first && screen.test(name) && !name.includes("Backdrop"));
    expect(drawnFirst).toEqual([]);
    expect(names.filter(name => screen.test(name)).length).toBeGreaterThan(1);
  }
});

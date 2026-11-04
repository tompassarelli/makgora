import { expect, test } from "bun:test";
import { frameEnabled, originFrame, OriginFrame } from "wisp/game/frames";
import type { MapBuild } from "../src/game/session/build";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { STOCK_FRAME_COUNTS } from "../src/host/loop/stockFrames";
import { install, startBuild } from "../src/platform/main";
import { MAKGORA_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(MAKGORA_HEADLESS);

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-stock-frames" };

test("the startup hide list names these stock frame groups and counts, none of them the game UI, world, simple UI parent or chat [k2 property]", () => {
  expect(STOCK_FRAME_COUNTS).toEqual({
    command: 12, item: 6, heroBar: 1, heroButton: 7, heroHealthBar: 7, heroManaBar: 7, heroButtonIndicator: 7, minimap: 1, minimapButton: 5,
  });
});

// Engine: hiding a stock frame that is an ancestor of one of ours (the game UI, ConsoleUIBackdrop, the world frame) takes our frames down with it.
test("startup hides and disables every listed stock frame, and none of them is an ancestor of a frame the map made [k2 property]", () => {
  const clients = headless.clients({ install, start: () => startBuild(BUILD) }, [0]);
  clients.start();
  clients.frames(120);
  const frames = clients.client(0).frames.snapshot();
  const parents = new Set(frames.map(frame => frame.parentId));
  const stock = frames.filter(frame => frame.name === "" && frame.parentId === undefined && !frame.visible);
  const expected = Object.values(STOCK_FRAME_COUNTS).reduce((sum, count) => sum + count, 0);
  expect(stock.length).toBeGreaterThanOrEqual(expected);
  expect(stock.filter(frame => parents.has(frame.handle.id))).toEqual([]);
  expect(frames.find(frame => frame.name === "ConsoleUIBackdrop")?.visible ?? true).toBe(true);
});

// Engine: F9 to F12 are the hotkeys of the stock system buttons, and a disabled system button drops its key, so F10 would not open the Game Menu.
test("startup leaves Warcraft's four system buttons enabled, so F10 still opens the Game Menu [k2 property]", () => {
  const clients = headless.clients({ install, start: () => startBuild(BUILD) }, [0]);
  clients.start();
  clients.frames(120);
  const enabled: boolean[] = [];
  clients.client(0).run(() => {
    for (let index = 0; index < 4; index++) enabled.push(frameEnabled(originFrame(OriginFrame.systemButton, index)));
  });
  expect(enabled).toEqual([true, true, true, true]);
});

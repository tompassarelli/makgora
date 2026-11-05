import { expect, test } from "bun:test";
import { frameEnabled, originFrame, OriginFrame } from "wisp/game/frames";
import type { MapBuild } from "../src/game/session/build";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { MAKGORA_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(MAKGORA_HEADLESS);

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-stock-frames" };

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

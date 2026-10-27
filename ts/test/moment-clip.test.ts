import { expect, test } from "bun:test";
import { Phase } from "../src/game/lobby/lobbyState";
import type { MapBuild } from "../src/game/session/build";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { shellState } from "../src/host/loop/state";
import { install, startBuild } from "../src/platform/main";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-moment-clip", devConsole: true };
const LOBBY_FRAMES = 600;
const WARMUP_FRAMES = 700;
const SAVE_FRAMES = 120;
const KEY_EQUALS = 0xbb;

test("the -clip chat command saves a moment and the = key does not [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(BUILD) }, [0]);
  const client = clients.client(0);
  const saved = () => [...client.files.keys()].filter(name => name.includes("smashcraft-repro")).length;
  clients.start();
  clients.frames(120);
  clients.chat(0, "-dev quick cpu wren expert hero rifleman");
  let phase = -1;
  for (let frame = 0; frame < LOBBY_FRAMES && phase !== Phase.match; frame++) {
    clients.frames(1);
    client.run(() => { phase = shellState()?.game.phase ?? -1; });
  }
  expect(phase).toBe(Phase.match);
  clients.frames(WARMUP_FRAMES);
  clients.press(0, KEY_EQUALS);
  clients.frames(SAVE_FRAMES);
  expect(saved()).toBe(0);
  clients.chat(0, "-clip");
  clients.frames(SAVE_FRAMES);
  expect(saved()).toBe(1);
  expect(client.errors).toEqual([]);
}, 60000);

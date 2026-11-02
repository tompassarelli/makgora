import { expect, test } from "bun:test";
import { createKeyFeed } from "wisp/src/headless/keyInput";
import { Phase } from "../src/game/lobby/lobbyState";
import type { MapBuild } from "../src/game/session/build";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { shellState } from "../src/host/loop/state";
import { install, startBuild } from "../src/platform/main";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { passStartControls } from "../scripts/wisp/startControls";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-match-chat-hidden", devConsole: true };
const PLACEHOLDER = "Type your chat here";
const ENTER = 0x0d;
const FRAMES_PER_SECOND = 60;

test("a match's chat is fully hidden, typing line included, until a line arrives or the player types, then a line fades out in six seconds and the box goes again [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(BUILD) }, [0]);
  const client = clients.client(0);
  const shown = (text: string): boolean => client.frames.shownText().some(line => line.includes(text));
  const press = (key: number, typed?: string) => createKeyFeed(clients, 0)([{ key, meta: 0, down: true, ...(typed === undefined ? {} : { typed }) }, { key, meta: 0, down: false }]);
  clients.start();
  passStartControls(clients);
  clients.frames(30);
  expect(shown(PLACEHOLDER), "select screen shows the typing line").toBe(true);

  clients.chat(0, "-dev quick cpu wren expert hero rifleman");
  let phase = -1;
  for (let frame = 0; frame < 600 && phase !== Phase.match; frame++) {
    clients.frames(1);
    client.run(() => { phase = shellState()?.game.phase ?? -1; });
  }
  expect(phase).toBe(Phase.match);
  clients.frames(FRAMES_PER_SECOND);
  expect(shown(PLACEHOLDER), "match start: no typing line").toBe(false);
  expect(shown("Chat"), "match start: no chat title").toBe(false);

  clients.chat(0, "gg well played");
  clients.frames(2);
  expect(shown("gg well played"), "a new line shows").toBe(true);
  expect(shown(PLACEHOLDER), "a line does not bring the typing line").toBe(false);
  clients.frames(5 * FRAMES_PER_SECOND);
  expect(shown("gg well played"), "still there after five seconds").toBe(true);
  clients.frames(2 * FRAMES_PER_SECOND);
  expect(shown("gg well played"), "gone after the fade").toBe(false);

  press(ENTER);
  clients.frames(2);
  press(0x47, "h");
  clients.frames(2);
  expect(client.frames.shownText().some(line => line.startsWith("h")), "typing shows the line being typed").toBe(true);
  expect(shown(PLACEHOLDER), "typing shows no placeholder").toBe(false);
  press(0x1b);
  clients.frames(2);
  expect(client.frames.shownText().some(line => line.startsWith("h")), "closing the line hides it again").toBe(false);
  expect(client.errors).toEqual([]);
}, 120000);

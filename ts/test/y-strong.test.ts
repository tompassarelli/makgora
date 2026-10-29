import { expect, test } from "bun:test";
import { install, startBuild } from "../src/platform/main";
import { Action, bit } from "../src/game/input/actions";
import { pollLocalKeys } from "../src/host/loop/inputs";
import { Phase } from "../src/game/lobby/lobbyState";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { Character } from "../src/game/sim/codes";
import { Key } from "../src/host/loop/keyEvents";
import { panelActions } from "../src/host/loop/menus";
import { shell } from "../src/host/loop/state";
import { passStartControls } from "../scripts/wisp/startControls";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const NINE = 0x39;

const headless = testHeadless(SMASHCRAFT_HEADLESS);

test("Y starts from fighter and stage select and is not Strong once the match begins, held or as a tap between polls, while 9 is [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, [0]);
  const host = clients.client(0);
  const read = <T>(body: () => T): T => {
    let result: T | undefined;
    host.run(() => { result = body(); });
    return result as T;
  };
  const phase = () => read(() => shell().game.phase);
  const strongHeld = () => read(() => (pollLocalKeys(shell()) & bit(Action.strong)) !== 0);
  const until = (what: string, done: () => boolean) => {
    for (let frame = 0; frame < 120 && !done(); frame++) clients.frames(1);
    if (!done()) throw new Error(`${what} not reached`);
  };
  clients.start();
  clients.frames(30);
  passStartControls(clients);
  clients.press(0, Key.n);
  clients.frames(5);
  clients.everywhere(() => panelActions().selection.cycleMode(0, 1));
  clients.everywhere(() => panelActions().selection.cycleMode(0, 1));
  clients.everywhere(() => panelActions().selection.selectCpuChoice(0, 1, Character.demonHunter));
  clients.press(0, Key.y);
  until("stage selection", () => phase() === Phase.stageMenu);
  expect(strongHeld()).toBe(false);
  clients.press(0, Key.y);
  until("the match", () => phase() === Phase.match);
  expect(strongHeld()).toBe(false);
  clients.key(0, NINE, 0, true);
  clients.frames(2);
  expect(strongHeld()).toBe(true);
  clients.key(0, NINE, 0, false);
  clients.frames(2);
  expect(strongHeld()).toBe(false);
  clients.key(0, Key.y, 0, true);
  clients.frames(2);
  expect(strongHeld()).toBe(false);
  clients.key(0, Key.y, 0, false);
  clients.frames(2);
  expect(strongHeld()).toBe(false);
  clients.press(0, Key.y);
  expect(strongHeld()).toBe(false);
  expect(host.errors).toEqual([]);
});

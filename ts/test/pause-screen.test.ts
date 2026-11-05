import { expect, test } from "bun:test";
import { install, startBuild } from "../src/platform/main";
import { Phase, setParticipants } from "../src/game/lobby/lobbyState";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { KEYBOARD_PAUSE_PREFIX, Key } from "../src/host/loop/keyEvents";
import { sendSync } from "wisp/game/sync";
import { shell } from "../src/host/loop/state";
import { passStartControls } from "../scripts/wisp/startControls";
import { MAKGORA_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(MAKGORA_HEADLESS);

const HUMANS = [0, 1];



for (const {} of [[0], HUMANS]) {
}

test("holding Esc with key repeat on the pause screen leaves to fighter selection and stays there while the key repeats on [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, [0]);
  const state = () => {
    let result = { phase: -1, paused: false, title: false };
    clients.client(0).run(() => { const s = shell(); result = { phase: s.game.phase, paused: s.session.paused, title: s.pauseMenu?.title === true }; });
    return result;
  };
  const until = (what: string, done: () => boolean) => {
    for (let frame = 0; frame < 600 && !done(); frame++) clients.frames(1);
    expect(done(), what).toBe(true);
  };
  clients.start();
  passStartControls(clients);
  clients.frames(10);
  clients.everywhere(() => { const g = shell().game; g.training = false; setParticipants(g, 1, 0); g.characterReadiness[0] = true; });
  clients.frames(5);
  clients.press(0, Key.y);
  until("stage selection", () => state().phase === Phase.stageMenu);
  clients.frames(5);
  clients.press(0, Key.y);
  until("the match", () => state().phase === Phase.match);
  clients.frames(30);
  clients.press(0, Key.escape);
  until("the pause", () => state().paused);
  clients.frames(5);
  const phases: number[] = [];
  for (let frame = 0; frame < 240; frame += 2) {
    clients.key(0, Key.escape, 0, true);
    clients.frames(2);
    phases.push(state().phase);
  }
  clients.client(0).run(() => { sendSync(KEYBOARD_PAUSE_PREFIX, "E"); });
  clients.frames(10);
  expect(state().phase).toBe(Phase.characterMenu);
  clients.key(0, Key.escape, 0, false);
  clients.frames(120);
  const left = phases.indexOf(Phase.characterMenu);
  expect(left).toBeGreaterThan(0);
  expect(phases.slice(left).filter(phase => phase !== Phase.characterMenu)).toEqual([]);
  expect(state()).toEqual({ phase: Phase.characterMenu, paused: false, title: false });
  expect(clients.client(0).errors).toEqual([]);
}, 120_000);

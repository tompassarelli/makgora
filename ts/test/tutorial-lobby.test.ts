import { expect, test } from "bun:test";
import { f32 } from "wisp/src/sim/f32";
import { install, startBuild } from "../src/platform/main";
import { Phase, characterFor } from "../src/game/lobby/lobbyState";
import { LESSONS, NO_LESSON } from "../src/game/match/tutorial";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { GUIDE_ROWS, SELECT_BAR } from "../src/game/core/selectBarLayout";
import { Key } from "../src/host/loop/keyEvents";
import { shell } from "../src/host/loop/state";
import { passStartControls, tutorialPrompted } from "../scripts/wisp/startControls";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { RIGHT_KEY, testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

const HUMANS = [0, 1];
const START_TUTORIAL = { x: f32(0.23), y: f32(0.315), width: f32(0.16), height: f32(0.035) };
const centre = (box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }) => [f32(box.x + f32(box.width / 2)), f32(box.y - f32(box.height / 2))] as const;

test("one of two players starts the Tutorial, quits it partway, and both lobbies come back to fighter selection in Versus with the other player's fighter kept [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, HUMANS);
  const lobby = (slot: number) => {
    let seen = { phase: -1, training: true, lesson: NO_LESSON, other: undefined as number | undefined };
    clients.client(slot).run(() => {
      const { game } = shell();
      seen = { phase: game.phase, training: game.training, lesson: game.trainer.lesson, other: characterFor(game, 1) };
    });
    return seen;
  };
  const until = (what: string, done: () => boolean) => {
    for (let frame = 0; frame < 600 && !done(); frame++) clients.frames(1);
    expect(done(), what).toBe(true);
  };
  clients.start();
  passStartControls(clients);
  clients.frames(10);
  const other = lobby(1).other;
  expect(clients.click(0, ...centre(SELECT_BAR.guide))).toBe(true);
  clients.frames(2);
  expect(clients.click(0, ...centre(GUIDE_ROWS.tutorial))).toBe(true);
  clients.frames(3);
  expect(clients.click(0, ...centre(START_TUTORIAL))).toBe(true);
  until("the tutorial match", () => HUMANS.every(slot => lobby(slot).phase === Phase.match));
  for (const slot of HUMANS) expect(lobby(slot)).toMatchObject({ training: true, lesson: 0 });
  const tap = (key: number) => {
    clients.key(0, key, 0, true);
    clients.frames(5);
    clients.key(0, key, 0, false);
    clients.frames(5);
  };
  tap(Key.backspace);
  until("the pause", () => HUMANS.every(slot => {
    let paused = false;
    clients.client(slot).run(() => { paused = shell().session.paused; });
    return paused;
  }));
  const hold = [0x51, 0x45, Key.n];
  for (const key of hold) clients.key(0, key, 0, true);
  clients.frames(3);
  tap(Key.backspace);
  for (const key of hold) clients.key(0, key, 0, false);
  until("fighter selection", () => HUMANS.every(slot => lobby(slot).phase === Phase.characterMenu));
  for (const slot of HUMANS) expect(lobby(slot)).toEqual({ phase: Phase.characterMenu, training: false, lesson: NO_LESSON, other });
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});

test("a key pressed while the first-run Tutorial prompt is open does the same on every client: Right steps the lesson on both and moves no fighter [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, HUMANS);
  const lobby = (slot: number) => {
    let seen = { lesson: NO_LESSON, fighters: [] as (number | undefined)[] };
    clients.client(slot).run(() => {
      const { game } = shell();
      seen = { lesson: game.trainer.lesson, fighters: HUMANS.map(human => characterFor(game, human)) };
    });
    return seen;
  };
  clients.start();
  passStartControls(clients);
  for (let frame = 0; frame < 240 && !clients.clients.every(tutorialPrompted); frame++) clients.frames(1);
  expect(clients.clients.every(tutorialPrompted)).toBe(true);
  const before = lobby(0);
  clients.key(0, RIGHT_KEY, 0, true);
  clients.frames(5);
  clients.key(0, RIGHT_KEY, 0, false);
  clients.frames(5);
  for (const slot of HUMANS) expect(lobby(slot)).toEqual({ lesson: 1 % LESSONS.length, fighters: before.fighters });
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});

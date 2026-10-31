import { expect, test } from "bun:test";
import { f32 } from "wisp/src/sim/f32";
import { install, startBuild } from "../src/platform/main";
import { Phase, characterFor } from "../src/game/lobby/lobbyState";
import { NO_LESSON } from "../src/game/match/tutorial";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { TUTORIAL_BOX } from "../src/game/ui/selectionLayout";
import { Key } from "../src/host/loop/keyEvents";
import { shell } from "../src/host/loop/state";
import { passStartControls } from "../scripts/wisp/startControls";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

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
  expect(clients.click(0, ...centre(TUTORIAL_BOX))).toBe(true);
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

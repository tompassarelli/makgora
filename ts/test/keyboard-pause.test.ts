import { expect, test } from "bun:test";
import { RIGHT_KEY, testHeadless } from "./headless";
import { Phase, holdingStart } from "../src/game/lobby/lobbyState";
import { install, start } from "../src/host/entries/playableMain";
import { Key } from "../src/host/loop/keyEvents";
import { shell } from "../src/host/loop/state";
import { fighterAt } from "../src/game/sim/roster";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";

const headless = testHeadless(PREDICTED_HEADLESS);

test("in a match Backspace pauses and resumes both clients, Y does not, and typing with chat open neither pauses nor moves [k1 scenario]", () => {
  const clients = headless.clients({ install, start }, [0, 1], { keepCalls: 64 });
  const read = <T>(body: () => T): T[] => {
    const values: T[] = [];
    for (const client of clients.clients) client.run(() => { values.push(body()); });
    return values;
  };
  const until = (done: () => boolean, frames: number) => {
    for (let frame = 0; frame < frames && !done(); frame++) clients.frames(1);
  };
  const tap = (slot: number, key: number) => {
    clients.key(slot, key, 0, true);
    clients.frames(1);
    clients.key(slot, key, 0, false);
    clients.frames(1);
  };
  const paused = () => read(() => shell().session.paused);
  const x = () => read(() => fighterAt(shell().world, 0).motion.x);
  const walk = () => {
    const before = x();
    clients.key(0, RIGHT_KEY, 0, true);
    clients.frames(20);
    clients.key(0, RIGHT_KEY, 0, false);
    clients.frames(20);
    return x()[0] !== before[0];
  };
  clients.start();
  clients.frames(30);
  for (const slot of [0, 1] as const) tap(slot, RIGHT_KEY);
  tap(0, Key.y);
  until(() => read(() => shell().game.phase).every(phase => phase === Phase.stageMenu), 60);
  tap(0, Key.y);
  until(() => read(() => shell().game.phase).every(phase => phase === Phase.match), 120);
  until(() => read(() => holdingStart(shell().game)).every(held => !held), 240);
  expect(read(() => shell().game.phase)).toEqual([Phase.match, Phase.match]);

  tap(0, Key.y);
  clients.frames(30);
  expect(paused(), "Y no longer pauses a match").toEqual([false, false]);
  tap(0, Key.backspace);
  until(() => paused().every(p => p), 60);
  expect(paused(), "Backspace pauses both clients").toEqual([true, true]);
  tap(0, Key.backspace);
  until(() => paused().every(p => !p), 60);
  expect(paused(), "Backspace resumes both clients").toEqual([false, false]);

  clients.clients.forEach((client, slot) => client.run(() => { shell().chatOpen = () => slot === 0; }));
  expect(walk(), "keys typed into chat do not move the fighter").toBe(false);
  tap(0, Key.backspace);
  clients.frames(30);
  expect(paused(), "Backspace typed into chat does not pause").toEqual([false, false]);
  for (const client of clients.clients) client.run(() => { shell().chatOpen = () => false; });
  expect(walk(), "the same keys move the fighter once chat closes").toBe(true);

  for (const client of clients.clients) {
    expect(client.errors).toEqual([]);
    expect(client.missingNatives).toEqual([]);
  }
  expect(clients.firstDivergence()).toBeUndefined();
});

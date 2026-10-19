import { expect, test } from "bun:test";
import { passStartControls } from "../scripts/wisp/startControls";
import { RIGHT_KEY, testHeadless } from "./headless";
import { Phase, ResultPick, holdingStart } from "../src/game/lobby/lobbyState";
import { install, start } from "../src/host/entries/playableMain";
import { Key } from "../src/host/loop/keyEvents";
import { shell } from "../src/host/loop/state";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { BUTTON_WIDTH, CHOICE_HEIGHT, CHOICE_TOP, choiceLeft } from "../src/game/ui/resultsBanner";
import { Action } from "../src/game/input/actions";
import { DEFAULT_PRESET, keyFor, presetBindings } from "../src/game/input/keyBindings";
import { f32 } from "wisp/src/sim/f32";

const headless = testHeadless(PREDICTED_HEADLESS);
const ATTACK_KEY = keyFor(presetBindings(DEFAULT_PRESET), Action.attack, 0) ?? 0;

test("three online players each pick a different result choice: attacks held into GAME! cast no vote, and the last pick alone never decides [k1 scenario]", () => {
  const players = [0, 1, 2] as const;
  const clients = headless.clients({ install, start }, [...players], { keepCalls: 64 });
  const read = <T>(body: () => T): T[] => {
    const values: T[] = [];
    for (const client of clients.clients) client.run(() => { values.push(body()); });
    return values;
  };
  const phases = () => read(() => shell().game.phase);
  const until = (done: () => boolean, frames: number) => {
    for (let frame = 0; frame < frames && !done(); frame++) clients.frames(1);
  };
  const tap = (slot: number, key: number) => {
    clients.key(slot, key, 0, true);
    clients.frames(1);
    clients.key(slot, key, 0, false);
    clients.frames(1);
  };
  const y = f32(CHOICE_TOP - CHOICE_HEIGHT / 2);
  const pick = (slot: number, choice: ResultPick) => {
    expect(clients.click(slot, f32(choiceLeft(choice) + BUTTON_WIDTH / 2), y)).toBe(true);
    clients.frames(2);
  };
  clients.start();
  clients.frames(30);
  passStartControls(clients);
  for (const slot of players) tap(slot, RIGHT_KEY);
  tap(0, Key.y);
  until(() => phases().every(phase => phase === Phase.stageMenu), 60);
  tap(0, Key.y);
  until(() => phases().every(phase => phase === Phase.match), 120);
  until(() => read(() => holdingStart(shell().game)).every(held => !held), 240);
  for (const client of clients.clients) client.run(() => { shell().game.timeLimitMinutes = 1; shell().game.remainingFrames = 30; });
  until(() => phases().every(phase => phase === Phase.result), 400);
  expect(phases()).toEqual([Phase.result, Phase.result, Phase.result]);
  for (const slot of [1, 2]) tap(slot, ATTACK_KEY);
  tap(2, Key.y);
  expect(read(() => [...shell().game.rematchReadiness]), "presses during GAME! are not votes").toEqual(players.map(() => [false, false, false, false]));
  until(() => read(() => shell().ui?.match.resultsShown() === true).every(Boolean), 240);
  clients.frames(2);
  pick(1, ResultPick.rematch);
  pick(2, ResultPick.characters);
  expect(phases()).toEqual([Phase.result, Phase.result, Phase.result]);
  pick(0, ResultPick.newStage);
  expect(phases(), "disagreeing picks go to Character select").toEqual([Phase.characterMenu, Phase.characterMenu, Phase.characterMenu]);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
});

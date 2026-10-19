import { expect, test } from "bun:test";
import { passStartControls } from "../scripts/wisp/startControls";
import { RIGHT_KEY, testHeadless } from "./headless";
import { Phase, holdingStart } from "../src/game/lobby/lobbyState";
import { install, start } from "../src/host/entries/playableMain";
import { Key } from "../src/host/loop/keyEvents";
import { shell } from "../src/host/loop/state";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";

const headless = testHeadless(PREDICTED_HEADLESS);

test("keyboard players choose fighters, release Start, choose a stage and reach GO together [k1 scenario]", () => {
  const clients = headless.clients({ install, start }, [0, 1], { keepCalls: 64 });
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
  clients.start();
  clients.frames(30);
  passStartControls(clients);
  expect(phases()).toEqual([Phase.characterMenu, Phase.characterMenu]);
  for (const slot of [0, 1] as const) {
    const before = read(() => shell().game.characterChoices[slot]);
    tap(slot, RIGHT_KEY);
    expect(read(() => shell().game.characterChoices[slot])).not.toEqual(before);
    expect(read(() => shell().game.characterReadiness[slot])).toEqual([true, true]);
    expect(read(() => shell().participants[slot].keys.down[RIGHT_KEY])).toEqual([false, false]);
  }
  tap(0, Key.y);
  until(() => phases().every(phase => phase === Phase.stageMenu), 60);
  expect(phases(), "Y opens stage select on both clients").toEqual([Phase.stageMenu, Phase.stageMenu]);
  expect(read(() => shell().session.startHeld[0])).toEqual([false, false]);
  const beforeStage = read(() => shell().game.stageChoice);
  tap(0, RIGHT_KEY);
  expect(read(() => shell().game.stageChoice)).not.toEqual(beforeStage);
  const chosenStage = read(() => shell().game.stageChoice);
  expect(chosenStage[0]).toBe(chosenStage[1]);
  tap(0, Key.y);
  until(() => phases().every(phase => phase === Phase.match), 120);
  expect(phases(), "released Y can start the match on both clients").toEqual([Phase.match, Phase.match]);
  until(() => read(() => holdingStart(shell().game)).every(held => !held), 240);
  expect(read(() => holdingStart(shell().game)), "both players reach GO").toEqual([false, false]);
  expect(read(() => shell().game.stageChoice)).toEqual(chosenStage);
  expect(read(() => shell().session.paused)).toEqual([false, false]);
  for (const client of clients.clients) {
    expect(client.errors).toEqual([]);
    expect(client.missingNatives).toEqual([]);
  }
  expect(clients.firstDivergence()).toBeUndefined();
});

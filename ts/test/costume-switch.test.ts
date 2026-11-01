import { expect, test } from "bun:test";
import { f32 } from "wisp/src/sim/f32";
import { install, startBuild } from "../src/platform/main";
import { costumeFor, selectCharacter } from "../src/game/lobby/lobbyState";
import { Character } from "../src/game/sim/codes";
import { costumeSystem } from "../src/game/roster/costumeSwitch";
import { Action } from "../src/game/input/actions";
import { DEFAULT_PRESET, keyFor, presetBindings } from "../src/game/input/keyBindings";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { costumePortraitBox } from "../src/game/ui/selectionCards";
import { shell } from "../src/host/loop/state";
import { declineTutorial, passStartControls } from "../scripts/wisp/startControls";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);
const JUMP_KEY = keyFor(presetBindings(DEFAULT_PRESET), Action.jump, 0) ?? 0;

function costumeLobby(enabled: boolean) {
  costumeSystem.enabled = enabled;
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, [0]);
  clients.start();
  passStartControls(clients);
  declineTutorial(clients);
  clients.frames(60);
  clients.client(0).run(() => selectCharacter(shell().game, 0, Character.grom));
  clients.frames(10);
  const dots = () => clients.client(0).frames.snapshot().filter(frame => frame.name.startsWith("MeleeCostumeDot"));
  const costume = () => {
    let seen = -1;
    clients.client(0).run(() => { seen = costumeFor(shell().game, 0); });
    return seen;
  };
  const jump = () => {
    clients.key(0, JUMP_KEY, 0, true);
    clients.frames(5);
    clients.key(0, JUMP_KEY, 0, false);
    clients.frames(5);
  };
  const box = costumePortraitBox(0);
  const clickPortrait = () => {
    clients.click(0, f32(box.x + f32(box.width / 2)), f32(box.y - f32(box.height / 2)));
    clients.frames(5);
  };
  return { clients, dots, costume, jump, clickPortrait };
}

test("with the costume system off, character select draws no costume dots and neither Jump nor a portrait click moves the costume off the default [k2 property]", () => {
  const lobby = costumeLobby(false);
  try {
    expect(lobby.dots()).toEqual([]);
    expect(lobby.costume()).toBe(0);
    lobby.jump();
    lobby.clickPortrait();
    expect(lobby.costume()).toBe(0);
    expect(lobby.dots()).toEqual([]);
  } finally {
    costumeSystem.enabled = false;
  }
  for (const client of lobby.clients.clients) expect(client.errors).toEqual([]);
});

test("with the costume system on, character select draws the costume dots and both Jump and a portrait click cycle the costume [k2 property]", () => {
  const lobby = costumeLobby(true);
  try {
    expect(lobby.dots().length).toBeGreaterThan(1);
    lobby.jump();
    expect(lobby.costume()).toBe(1);
    lobby.clickPortrait();
    expect(lobby.costume()).toBe(2);
  } finally {
    costumeSystem.enabled = false;
  }
  for (const client of lobby.clients.clients) expect(client.errors).toEqual([]);
});

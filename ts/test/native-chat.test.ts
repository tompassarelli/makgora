import { expect, test } from "bun:test";
import { RIGHT_KEY, testHeadless } from "./headless";
import type { HeadlessClient } from "wisp/src/headless/client";
import type { FrameSnapshot } from "wisp/src/headless/frames";
import { Phase } from "../src/game/lobby/lobbyState";
import { install, start } from "../src/host/entries/playableMain";
import { Key } from "../src/host/loop/keyEvents";
import { shell } from "../src/host/loop/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { PICKER_DONE } from "../src/game/ui/settingsUi";
import { START_BUTTON } from "../src/game/ui/selectionLayout";
import { f32 } from "wisp/src/sim/f32";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

function phaseOf(client: HeadlessClient): Phase {
  let phase: Phase = Phase.characterMenu;
  client.run(() => { phase = shell().game.phase; });
  return phase;
}

function chatFrame(client: HeadlessClient): FrameSnapshot | undefined {
  let id = -1;
  client.run(() => { id = (BlzGetOriginFrame(ORIGIN_FRAME_CHAT_MSG, 0) as unknown as { id: number }).id; });
  return client.frames.snapshot().find(frame => frame.handle.id === id);
}

test("the map leaves Warcraft's own chat frame where Warcraft keeps it, never moved, resized or hidden, through character select, stage select and a match [k1 scenario]", () => {
  const clients = headless.clients({ install, start });
  const untouched = clients.clients.map(chatFrame);
  for (const frame of untouched) expect(frame?.visible).toBe(true);
  clients.start();
  clients.frames(30);
  for (const slot of [0, 1]) expect(clients.click(slot, f32(PICKER_DONE.x + f32(PICKER_DONE.width / 2)), f32(PICKER_DONE.y - f32(PICKER_DONE.height / 2)))).toBe(true);
  clients.frames(2);
  for (const slot of [0, 1]) expect(clients.click(slot, f32(0.49), f32(0.2975))).toBe(true);
  clients.frames(4);
  for (const client of clients.clients) {
    expect(phaseOf(client)).toBe(Phase.characterMenu);
    expect(chatFrame(client)).toEqual(untouched[clients.clients.indexOf(client)]);
  }
  for (const slot of [0, 1]) clients.press(slot, RIGHT_KEY);
  clients.frames(10);
  clients.press(0, Key.y);
  clients.frames(30);
  for (const client of clients.clients) {
    expect(phaseOf(client)).toBe(Phase.stageMenu);
    expect(chatFrame(client)).toEqual(untouched[clients.clients.indexOf(client)]);
  }
  expect(clients.click(0, f32(START_BUTTON.x + f32(0.003)), f32(START_BUTTON.y - f32(0.003)))).toBe(true);
  for (let frame = 0; frame < 120 && !clients.clients.every(client => phaseOf(client) === Phase.match); frame++) clients.frames(1);
  clients.frames(10);
  for (const client of clients.clients) {
    expect(phaseOf(client)).toBe(Phase.match);
    expect(chatFrame(client)).toEqual(untouched[clients.clients.indexOf(client)]);
    expect(client.errors).toEqual([]);
  }
}, 120000);

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
import { MATCH_CHAT_BOX, SELECT_CHAT_BOX } from "../src/game/ui/nativeChat";
import type { TextBox } from "../src/game/ui/hudLayout";
import { f32 } from "wisp/src/sim/f32";

const headless = testHeadless(SMASHCRAFT_HEADLESS);
const area = (box: TextBox) => [box.left, box.top, f32(box.left + box.width), f32(box.top - box.height)] as const;

function phaseOf(client: HeadlessClient): Phase {
  let phase: Phase = Phase.characterMenu;
  client.run(() => { phase = shell().game.phase; });
  return phase;
}

function overlaps(a: readonly number[], b: readonly number[]): boolean {
  const [aLeft, aTop, aRight, aBottom] = a as [number, number, number, number];
  const [bLeft, bTop, bRight, bBottom] = b as [number, number, number, number];
  return aLeft < bRight && bLeft < aRight && aBottom < bTop && bBottom < aTop;
}

function chatPlace(client: HeadlessClient): { readonly rectangle: readonly number[] | undefined; readonly visible: boolean; readonly covered: readonly string[] } {
  let id = -1;
  client.run(() => { id = (BlzGetOriginFrame(ORIGIN_FRAME_CHAT_MSG, 0) as unknown as { id: number }).id; });
  const all = client.frames.snapshot();
  const byId = new Map(all.map(frame => [frame.handle.id, frame]));
  const shown = (frame: FrameSnapshot): boolean => {
    for (let at: FrameSnapshot | undefined = frame; at !== undefined; at = at.parentId === undefined ? undefined : byId.get(at.parentId)) if (!at.visible || at.alpha <= 0) return false;
    return true;
  };
  const chat = byId.get(id);
  const rectangle = chat?.rectangle;
  const covered = rectangle === undefined ? [] : all.filter(frame => frame.handle.id !== id && !/Backdrop\d*$/.test(frame.name) && frame.rectangle !== undefined && shown(frame) && overlaps(frame.rectangle, rectangle)).map(frame => frame.name);
  return { rectangle, visible: chat !== undefined && shown(chat), covered };
}

test("Warcraft's own chat sits in the free strip below the cards on character and stage select and above the fighter plates in a match, clear of every drawn frame [k1 scenario]", () => {
  const clients = headless.clients({ install, start });
  clients.start();
  clients.frames(30);
  for (const slot of [0, 1]) expect(clients.click(slot, f32(PICKER_DONE.x + f32(PICKER_DONE.width / 2)), f32(PICKER_DONE.y - f32(PICKER_DONE.height / 2)))).toBe(true);
  clients.frames(2);
  for (const slot of [0, 1]) expect(clients.click(slot, f32(0.49), f32(0.2975))).toBe(true);
  clients.frames(4);
  for (const client of clients.clients) {
    expect(phaseOf(client)).toBe(Phase.characterMenu);
    expect(chatPlace(client)).toEqual({ rectangle: area(SELECT_CHAT_BOX), visible: true, covered: [] });
  }
  for (const slot of [0, 1]) clients.press(slot, RIGHT_KEY);
  clients.frames(10);
  clients.press(0, Key.y);
  clients.frames(30);
  for (const client of clients.clients) {
    expect(phaseOf(client)).toBe(Phase.stageMenu);
    expect(chatPlace(client)).toEqual({ rectangle: area(SELECT_CHAT_BOX), visible: true, covered: [] });
  }
  expect(clients.click(0, f32(START_BUTTON.x + f32(0.003)), f32(START_BUTTON.y - f32(0.003)))).toBe(true);
  for (let frame = 0; frame < 120 && !clients.clients.every(client => phaseOf(client) === Phase.match); frame++) clients.frames(1);
  clients.frames(10);
  for (const client of clients.clients) {
    expect(phaseOf(client)).toBe(Phase.match);
    expect(chatPlace(client)).toEqual({ rectangle: area(MATCH_CHAT_BOX), visible: true, covered: [] });
    expect(client.errors).toEqual([]);
  }
}, 120000);

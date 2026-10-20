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
import { f32 } from "wisp/src/sim/f32";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

// Warcraft draws chat from the screen's left edge, about 0.11 wide, between y 0.21 and 0.45, and our frames can't move it.
const CHAT_RIGHT = f32(0.125);
const CHAT_BOTTOM = f32(0.2);
const CHAT_TOP = f32(0.46);

function phaseOf(client: HeadlessClient): Phase {
  let phase: Phase = Phase.characterMenu;
  client.run(() => { phase = shell().game.phase; });
  return phase;
}

function inChatColumn(client: HeadlessClient, aspect: number): readonly string[] {
  let chat = -1;
  client.run(() => { chat = (BlzGetOriginFrame(ORIGIN_FRAME_CHAT_MSG, 0) as unknown as { id: number }).id; });
  const all = client.frames.snapshot();
  const byId = new Map(all.map(frame => [frame.handle.id, frame]));
  const shown = (frame: FrameSnapshot): boolean => {
    for (let at: FrameSnapshot | undefined = frame; at !== undefined; at = at.parentId === undefined ? undefined : byId.get(at.parentId)) if (!at.visible || at.alpha <= 0) return false;
    return true;
  };
  const screenLeft = f32(f32(0.4) - f32(0.3) * aspect);
  return all.filter(frame => {
    if (frame.handle.id === chat || /Backdrop\d*$/.test(frame.name) || frame.rectangle === undefined || !shown(frame)) return false;
    const [left, top, right, bottom] = frame.rectangle as [number, number, number, number];
    if (left <= screenLeft && right >= f32(f32(0.4) + f32(0.3) * aspect)) return false;
    return left < CHAT_RIGHT && right > screenLeft && bottom < CHAT_TOP && top > CHAT_BOTTOM;
  }).map(frame => frame.name);
}

test("character select and stage select keep Warcraft's chat column at the left edge clear of every drawn frame at 16:9, 3:2 and 4:3 [k1 scenario]", () => {
  for (const screen of [{ width: 1920, height: 1080 }, { width: 2256, height: 1504 }, { width: 1600, height: 1200 }]) {
    const aspect = screen.width / screen.height;
    const label = `${screen.width}x${screen.height}`;
    const clients = headless.clients({ install, start }, undefined, { screen });
    clients.start();
    clients.frames(30);
    for (const slot of [0, 1]) expect(clients.click(slot, f32(PICKER_DONE.x + f32(PICKER_DONE.width / 2)), f32(PICKER_DONE.y - f32(PICKER_DONE.height / 2)))).toBe(true);
    clients.frames(2);
    for (const slot of [0, 1]) expect(clients.click(slot, f32(0.49), f32(0.2975))).toBe(true);
    clients.frames(4);
    for (const client of clients.clients) {
      expect(phaseOf(client)).toBe(Phase.characterMenu);
      expect(inChatColumn(client, aspect), `${label} character select`).toEqual([]);
    }
    for (const slot of [0, 1]) clients.press(slot, RIGHT_KEY);
    clients.frames(10);
    clients.press(0, Key.y);
    clients.frames(30);
    for (const client of clients.clients) {
      expect(phaseOf(client)).toBe(Phase.stageMenu);
      expect(inChatColumn(client, aspect), `${label} stage select`).toEqual([]);
      expect(client.errors).toEqual([]);
    }
  }
}, 240000);

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
import { MOVES_BOX, SETTINGS_BOX, START_BUTTON, TUTORIAL_BOX } from "../src/game/ui/selectionLayout";
import { RULE_BUTTONS, type RuleBox } from "../src/game/ui/ruleButtons";
import { BACK_BUTTON, DROPS_BUTTON, HAZARDS_BUTTON, STAGE_POOL_BUTTON } from "../src/game/ui/stageUi";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

// Warcraft draws chat from the screen's left edge between y 0.21 and 0.45, its lines run right, and our frames can't move it.
const CHARACTER_CHAT_RIGHT = f32(0.24);
const STAGE_CHAT_RIGHT = f32(0.48);
const CHAT_BOTTOM = f32(0.2);
const CHAT_TOP = f32(0.46);
const HEADER_RAIL = f32(0.486);
const BOTTOM_BAND_TOP = f32(0.2);

function phaseOf(client: HeadlessClient): Phase {
  let phase: Phase = Phase.characterMenu;
  client.run(() => { phase = shell().game.phase; });
  return phase;
}

function shownFrames(client: HeadlessClient): readonly FrameSnapshot[] {
  const all = client.frames.snapshot();
  const byId = new Map(all.map(frame => [frame.handle.id, frame]));
  const shown = (frame: FrameSnapshot): boolean => {
    for (let at: FrameSnapshot | undefined = frame; at !== undefined; at = at.parentId === undefined ? undefined : byId.get(at.parentId)) if (!at.visible || at.alpha <= 0) return false;
    return true;
  };
  return all.filter(frame => frame.rectangle !== undefined && shown(frame));
}

function inChatColumn(client: HeadlessClient, aspect: number, chatRight: number): readonly string[] {
  let chat = -1;
  client.run(() => { chat = (BlzGetOriginFrame(ORIGIN_FRAME_CHAT_MSG, 0) as unknown as { id: number }).id; });
  const screenLeft = f32(f32(0.4) - f32(0.3) * aspect);
  return shownFrames(client).filter(frame => {
    if (frame.handle.id === chat || /Backdrop\d*$/.test(frame.name)) return false;
    const [left, top, right, bottom] = frame.rectangle as [number, number, number, number];
    if (left <= screenLeft && right >= f32(f32(0.4) + f32(0.3) * aspect)) return false;
    return left < chatRight && right > screenLeft && bottom < CHAT_TOP && top > CHAT_BOTTOM;
  }).map(frame => frame.name);
}

const overlaps = (a: RuleBox, b: RuleBox): boolean => a.x < f32(b.x + b.width) && b.x < f32(a.x + a.width) && f32(a.y - a.height) < b.y && f32(b.y - b.height) < a.y;

function headerButtons(client: HeadlessClient, buttons: readonly RuleBox[], others: readonly RuleBox[], label: string): void {
  for (const [index, box] of buttons.entries()) {
    expect(f32(box.y - box.height), `${label} button ${index} sits above the header rail`).toBeGreaterThanOrEqual(HEADER_RAIL);
    expect(box.y, `${label} button ${index} stays on screen`).toBeLessThanOrEqual(f32(0.6));
    expect(f32(box.x + box.width), `${label} button ${index} stays inside 4:3`).toBeLessThanOrEqual(f32(0.8));
    for (const other of [...buttons.slice(index + 1), ...others]) expect(overlaps(box, other), `${label} button ${index} overlaps another header control`).toBe(false);
    const target = client.clickTarget(f32(box.x + f32(box.width / 2)), f32(box.y - f32(box.height / 2)));
    const hit = client.frames.snapshot().find(frame => frame.handle.id === target?.id);
    const [left, top, right, bottom] = (hit?.rectangle ?? [0, 0, 0, 0]) as [number, number, number, number];
    expect([left, top, right, bottom].map(value => Math.round(value * 1000)), `${label} button ${index} is the click target at its centre`)
      .toEqual([box.x, box.y, f32(box.x + box.width), f32(box.y - box.height)].map(value => Math.round(value * 1000)));
  }
}

function cardRow(client: HeadlessClient, label: string): void {
  const cards = shownFrames(client).filter(frame => /^MeleeCard\d+_\d$/.test(frame.name)).map(frame => frame.rectangle as [number, number, number, number]);
  expect(cards.length, `${label} shows four player cards`).toBe(4);
  for (const [left, top, right, bottom] of cards) {
    expect(top, `${label} card sits in the lower band`).toBeLessThanOrEqual(BOTTOM_BAND_TOP);
    expect(bottom, `${label} card stays on screen`).toBeGreaterThanOrEqual(0);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(f32(0.8));
  }
  const lefts = cards.map(card => card[0]).sort((a, b) => a - b);
  const rights = cards.map(card => card[2]).sort((a, b) => a - b);
  expect(lefts[0] ?? 1, `${label} cards start at the band's left`).toBeLessThanOrEqual(f32(0.05));
  expect(rights[3] ?? 0, `${label} cards reach the band's right`).toBeGreaterThanOrEqual(f32(0.75));
  for (let index = 1; index < 4; index++) expect(lefts[index] ?? 0, `${label} cards don't overlap`).toBeGreaterThan(rights[index - 1] ?? 1);
}

test("character select and stage select keep Warcraft's chat column at the left edge clear of every drawn frame, with their buttons in the header band and the player cards along the bottom, at 16:9, 3:2 and 4:3 [k1 scenario]", () => {
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
      expect(inChatColumn(client, aspect, CHARACTER_CHAT_RIGHT), `${label} character select`).toEqual([]);
      headerButtons(client, [START_BUTTON, MOVES_BOX, SETTINGS_BOX], [TUTORIAL_BOX, ...Object.values(RULE_BUTTONS)], `${label} character select`);
      cardRow(client, `${label} character select`);
    }
    for (const slot of [0, 1]) clients.press(slot, RIGHT_KEY);
    clients.frames(10);
    clients.press(0, Key.y);
    clients.frames(30);
    for (const client of clients.clients) {
      expect(phaseOf(client)).toBe(Phase.stageMenu);
      expect(inChatColumn(client, aspect, STAGE_CHAT_RIGHT), `${label} stage select`).toEqual([]);
      headerButtons(client, [START_BUTTON, BACK_BUTTON, HAZARDS_BUTTON, DROPS_BUTTON, STAGE_POOL_BUTTON], [], `${label} stage select`);
      expect(client.errors).toEqual([]);
    }
    const solo = headless.clients({ install, start }, [0], { screen });
    solo.start();
    solo.frames(30);
    expect(solo.click(0, f32(PICKER_DONE.x + f32(PICKER_DONE.width / 2)), f32(PICKER_DONE.y - f32(PICKER_DONE.height / 2)))).toBe(true);
    solo.frames(2);
    expect(solo.click(0, f32(0.49), f32(0.2975))).toBe(true);
    solo.frames(4);
    for (const client of solo.clients) {
      expect(phaseOf(client)).toBe(Phase.characterMenu);
      expect(inChatColumn(client, aspect, CHARACTER_CHAT_RIGHT), `${label} solo character select`).toEqual([]);
      headerButtons(client, [START_BUTTON, MOVES_BOX, SETTINGS_BOX, TUTORIAL_BOX], Object.values(RULE_BUTTONS), `${label} solo character select`);
      expect(client.errors).toEqual([]);
    }
  }
}, 240000);

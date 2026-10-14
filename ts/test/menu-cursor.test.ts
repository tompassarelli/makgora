import { expect, test } from "bun:test";
import { testHeadless } from "./headless";
import type { HeadlessClient } from "wisp/src/headless/client";
import { Phase } from "../src/game/match/rules";
import { install, start } from "../src/platform/playableMain";
import { Key } from "../src/platform/shell/keyEvents";
import { shell } from "../src/platform/shell/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { cellRect, rosterGrid } from "../src/game/menu/selectionGrid";
import { cardX } from "../src/game/menu/selectionDrag";
import { PLAYABLE_CHARACTERS } from "../src/game/sim/heroes/registry";
import { START_BUTTON } from "../src/game/ui/selectionLayout";
import { pixelX, pixelY } from "../src/game/menu/pointer";
import { f32 } from "wisp/src/sim/f32";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

type Native = (...args: unknown[]) => unknown;

interface Watch {
  cursor: boolean[];
  warps: number;
  hand: unknown;
  handShown: boolean;
  stageDialogs: { frame: unknown; events: unknown[] }[];
}

function watch(client: HeadlessClient): Watch {
  const seen: Watch = { cursor: [], warps: 0, hand: undefined, handShown: false, stageDialogs: [] };
  const { natives } = client;
  const stageParents = new Set<unknown>();
  const create = natives.BlzCreateFrameByType as Native;
  natives.BlzCreateFrameByType = (...args: unknown[]) => {
    const frame = create(...args);
    if (args[1] === `MeleeHand${client.slot}`) seen.hand = frame;
    if (args[1] === "MeleeStageRoot" || args[1] === "MeleeStagePoolRoot") stageParents.add(frame);
    return frame;
  };
  const dialog = natives.BlzCreateFrame as Native;
  natives.BlzCreateFrame = (...args: unknown[]) => {
    const frame = dialog(...args);
    if (args[0] === "ScriptDialogButton" && stageParents.has(args[1])) seen.stageDialogs.push({ frame, events: [] });
    return frame;
  };
  const register = natives.BlzTriggerRegisterFrameEvent as Native;
  natives.BlzTriggerRegisterFrameEvent = (...args: unknown[]) => {
    const button = seen.stageDialogs.find(button => button.frame === args[1]);
    if (button !== undefined) button.events.push(args[2]);
    return register(...args);
  };
  const visible = natives.BlzFrameSetVisible as Native | undefined;
  natives.BlzFrameSetVisible = (frame: unknown, shown: boolean) => {
    if (frame === seen.hand) seen.handShown = shown;
    return visible?.(frame, shown);
  };
  natives.BlzGetMouseScreenPosX = () => client.mouseScreenX;
  natives.BlzGetMouseScreenPosY = () => client.mouseScreenY;
  natives.BlzIsMouseButtonPressed = (button: unknown) => client.heldMouseButtons.has(button);
  natives.BlzEnableCursor = (enabled: boolean) => { seen.cursor.push(enabled); };
  natives.BlzSetMousePos = () => { seen.warps++; };
  return seen;
}

function menu() {
  const clients = headless.clients({ install, start });
  const watches = clients.clients.map(watch);
  const phases = () => clients.clients.map(client => {
    let phase: Phase = Phase.characterMenu;
    client.run(() => { phase = shell().game.phase; });
    return phase;
  });
  const point = (x: number, y: number, down = false) => {
    for (const client of clients.clients) {
      const width = Number((client.natives.BlzGetLocalClientWidth as Native)());
      const height = Number((client.natives.BlzGetLocalClientHeight as Native)());
      client.mouseScreenX = pixelX(x, width, height);
      client.mouseScreenY = pixelY(y, height);
      if (down) client.heldMouseButtons.add(client.natives.MOUSE_BUTTON_TYPE_LEFT);
      else client.heldMouseButtons.delete(client.natives.MOUSE_BUTTON_TYPE_LEFT);
    }
  };
  clients.start();
  clients.frames(30);
  for (const slot of [0, 1]) expect(clients.click(slot, f32(0.49), f32(0.2975))).toBe(true);
  clients.frames(2);
  return { clients, watches, phases, point };
}

const AWAY = { x: f32(0.7), y: f32(0.1) };

test("fighter select shows Warcraft's own cursor at rest and hides it only while a chip is carried, asserting the shown cursor once [k1 scenario]", () => {
  const { clients, watches, point } = menu();
  const [seen] = watches;
  if (seen === undefined) throw new Error("no client");
  const grid = rosterGrid(PLAYABLE_CHARACTERS.length);
  const first = cellRect(grid, 0);
  const chip = { x: f32(cardX(0) + f32(0.126)), y: f32(0.17) };
  const cell = { x: (first.left + first.right) / 2, y: (first.top + first.bottom) / 2 };
  point(AWAY.x, AWAY.y);
  clients.frames(5);
  expect(seen.handShown).toBe(false);
  expect(seen.cursor.at(-1)).toBe(true);
  seen.cursor.length = 0;
  clients.frames(20);
  expect(seen.cursor).toEqual([]);

  point(chip.x, chip.y);
  clients.frames(2);
  point(chip.x, chip.y, true);
  clients.frames(5);
  expect(seen.handShown).toBe(true);
  expect(seen.cursor.length).toBeGreaterThanOrEqual(4);
  expect(seen.cursor.every(enabled => !enabled)).toBe(true);
  point(cell.x, cell.y, true);
  clients.frames(5);
  expect(seen.handShown).toBe(true);
  point(cell.x, cell.y);
  clients.frames(3);
  point(AWAY.x, AWAY.y);
  clients.frames(5);
  expect(seen.handShown).toBe(false);
  expect(seen.cursor.at(-1)).toBe(true);
  expect(seen.cursor.filter(enabled => enabled).length).toBe(1);
  seen.cursor.length = 0;
  clients.frames(20);
  expect(seen.cursor).toEqual([]);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});

test("entering stage select avoids cursor-displacing dialog hover events and cursor toggles, leaves a pointer inside Start, and moves one outside it once [k1 scenario]", () => {
  const { clients, watches, phases, point } = menu();
  const centre = { x: START_BUTTON.x + START_BUTTON.width / 2, y: START_BUTTON.y - START_BUTTON.height / 2 };
  for (const slot of [0, 1]) clients.press(slot, Key.r);
  clients.frames(10);
  point(AWAY.x, AWAY.y);
  clients.frames(5);
  for (const seen of watches) seen.cursor.length = 0;
  clients.press(0, Key.y);
  clients.frames(30);
  expect(phases()).toEqual([Phase.stageMenu, Phase.stageMenu]);
  for (const [index, seen] of watches.entries()) {
    expect(seen.stageDialogs.length).toBeGreaterThan(0);
    for (const dialog of seen.stageDialogs) expect(dialog.events).toEqual([clients.clients[index]?.natives.FRAMEEVENT_CONTROL_CLICK]);
    expect(seen.cursor.filter(enabled => !enabled)).toEqual([]);
    expect(seen.cursor.length).toBeLessThanOrEqual(1);
    expect(seen.warps).toBe(1);
  }
  clients.frames(20);
  for (const seen of watches) expect(seen.cursor.length).toBeLessThanOrEqual(1);

  expect(clients.click(0, f32(0.13), f32(0.0635))).toBe(true);
  clients.frames(10);
  expect(phases()).toEqual([Phase.characterMenu, Phase.characterMenu]);
  point(centre.x, centre.y);
  clients.frames(5);
  for (const seen of watches) seen.warps = 0;
  clients.press(0, Key.y);
  clients.frames(30);
  expect(phases()).toEqual([Phase.stageMenu, Phase.stageMenu]);
  for (const seen of watches) expect(seen.warps).toBe(0);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});

test("Start answers clicks in one rectangle on character select and on stage select [k3 measure #550]", () => {
  const { clients, phases } = menu();
  const inset = f32(0.003);
  const left = START_BUTTON.x;
  const right = f32(START_BUTTON.x + START_BUTTON.width);
  const top = START_BUTTON.y;
  const bottom = f32(START_BUTTON.y - START_BUTTON.height);
  const middle = f32(START_BUTTON.y - START_BUTTON.height / 2);
  for (const slot of [0, 1]) clients.press(slot, Key.r);
  clients.frames(10);

  const outside = [[left - 0.01, middle], [right + 0.005, middle], [f32(left + START_BUTTON.width / 2), top + 0.001], [f32(left + START_BUTTON.width / 2), bottom - 0.003]] as const;
  for (const [x, y] of outside) {
    expect(clients.click(0, x, y)).toBe(false);
    clients.frames(2);
    expect(phases()).toEqual([Phase.characterMenu, Phase.characterMenu]);
  }
  expect(clients.click(0, left + inset, top - inset)).toBe(true);
  clients.frames(10);
  expect(phases()).toEqual([Phase.stageMenu, Phase.stageMenu]);

  for (const [x, y] of outside) {
    expect(clients.click(0, x, y)).toBe(false);
    clients.frames(2);
    expect(phases()).toEqual([Phase.stageMenu, Phase.stageMenu]);
  }
  expect(clients.click(0, right - inset, bottom + inset)).toBe(true);
  for (let frame = 0; frame < 120 && !phases().every(phase => phase === Phase.match); frame++) clients.frames(1);
  expect(phases()).toEqual([Phase.match, Phase.match]);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});

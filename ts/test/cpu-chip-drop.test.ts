import { expect, test } from "bun:test";
import { passStartControls } from "../scripts/wisp/startControls";
import { testHeadless } from "./headless";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/host/loop/state";
import { Phase } from "../src/game/lobby/lobbyState";
import { PLAYABLE_CHARACTERS } from "../src/game/sim/heroes/registry";
import type { Character } from "../src/game/sim/codes";
import { cellRect, rosterGrid } from "../src/game/menu/selectionGrid";
import { cardX } from "../src/game/menu/selectionDrag";
import { pixelX, pixelY } from "../src/game/menu/pointer";
import { f32 } from "wisp/src/sim/f32";

type Native = (...args: unknown[]) => unknown;

const CPU = 2;

function fighter(tile: number): Character {
  const character = PLAYABLE_CHARACTERS[tile];
  if (character === undefined) throw new Error(`no fighter on tile ${tile}`);
  return character;
}

const headless = testHeadless({
  ...PREDICTED_HEADLESS,
  natives: client => ({
    ...PREDICTED_HEADLESS.natives?.(client),
    GetPlayerController: (player: unknown) => Number(player) < 2 ? "MAP_CONTROL_USER" : "MAP_CONTROL_COMPUTER",
    GetPlayerSlotState: () => "PLAYER_SLOT_STATE_PLAYING",
    BlzGetMouseScreenPosX: () => client.mouseScreenX,
    BlzGetMouseScreenPosY: () => client.mouseScreenY,
    BlzIsMouseButtonPressed: (button: unknown) => client.heldMouseButtons.has(button),
  }),
});

function value<T>(client: { run(body: () => void): void }, body: () => T): T {
  let result: { value: T } | undefined;
  client.run(() => { result = { value: body() }; });
  if (result === undefined) throw new Error("the client did not run");
  return result.value;
}

function menu() {
  const clients = headless.clients({ install, start: () => startBuild(PLAYABLE_BUILD) }, [0, 1]);
  clients.start();
  clients.frames(1);
  for (let frame = 0; frame < 120 && !value(clients.client(0), () => shell().startingChoicesReady); frame++) clients.frames(1);
  const host = clients.client(0);
  passStartControls(clients);
  expect(value(host, () => shell().game.phase)).toBe(Phase.characterMenu);
  expect(value(host, () => shell().startingChoicesReady)).toBe(true);
  const point = (x: number, y: number, down: boolean) => {
    const width = Number((host.natives.BlzGetLocalClientWidth as Native)());
    const height = Number((host.natives.BlzGetLocalClientHeight as Native)());
    host.mouseScreenX = pixelX(x, width, height);
    host.mouseScreenY = pixelY(y, height);
    if (down) host.heldMouseButtons.add(host.natives.MOUSE_BUTTON_TYPE_LEFT);
    else host.heldMouseButtons.delete(host.natives.MOUSE_BUTTON_TYPE_LEFT);
  };
  const drag = (x: number, y: number) => {
    const card = { x: f32(cardX(CPU) + f32(0.08)), y: f32(0.17) };
    point(card.x, card.y, false);
    clients.frames(2);
    point(card.x, card.y, true);
    clients.frames(3);
    point(x, y, true);
    clients.frames(3);
    point(x, y, false);
    clients.frames(30);
    point(f32(0.7), f32(0.05), false);
    clients.frames(2);
    return value(host, () => shell().game.characterChoices[CPU]);
  };
  return { clients, drag };
}

test("a dragged CPU chip lands on the tile it is released over, and released in empty space between tiles lands on the nearest tile [k1 scenario]", () => {
  const { clients, drag } = menu();
  const grid = rosterGrid(PLAYABLE_CHARACTERS.length);
  const shortRow = grid.rows * grid.columns - grid.count;
  expect(shortRow).toBeGreaterThan(0);
  const firstShort = grid.count - (grid.columns - 1);
  const short = cellRect(grid, firstShort);
  const above = cellRect(grid, firstShort - grid.columns);
  expect(short.left).toBeGreaterThan(above.left);
  const gapX = (above.left + short.left) / 2;

  const releases = [
    { x: f32(short.left + (short.right - short.left) * f32(0.9)), y: f32(short.bottom + (short.top - short.bottom) * f32(0.1)), tile: firstShort },
    { x: f32(gapX), y: f32(short.top - (short.top - short.bottom) * f32(0.05)), tile: firstShort - grid.columns },
    { x: f32(gapX), y: f32(short.bottom + (short.top - short.bottom) * f32(0.4)), tile: firstShort },
    { x: f32((above.left + above.right) / 2), y: f32((above.top + above.bottom) / 2), tile: firstShort - grid.columns },
    { x: f32(cellRect(grid, 1).left + f32(0.001)), y: f32(cellRect(grid, 1).top - f32(0.001)), tile: 1 },
  ];
  for (const release of releases) {
    const before = value(clients.client(0), () => shell().game.characterChoices[CPU]);
    const expected = fighter(release.tile);
    expect(expected).not.toBe(before);
    expect(drag(release.x, release.y)).toBe(expected);
  }
  expect(drag(f32(0.8), f32(0.4))).toBe(fighter(1));
  for (const client of clients.clients) {
    expect(value(client, () => shell().game.characterChoices[CPU])).toBe(fighter(1));
    expect(client.errors).toEqual([]);
  }
  expect(clients.firstDivergence()).toBeUndefined();
});

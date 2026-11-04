import { expect, test } from "bun:test";
import { f32 } from "wisp/src/sim/f32";
import type { HeadlessClient } from "wisp/src/headless/client";
import { install, startBuild } from "../src/platform/main";
import { Phase } from "../src/game/lobby/lobbyState";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { Character } from "../src/game/sim/codes";
import { fighterAt } from "../src/game/sim/roster";
import { fighterStatus } from "../src/game/roster/forge";
import { type RosterGrid, cellRect, laidOut } from "../src/game/menu/selectionGrid";
import { RANDOM_FIGHTER_TILE, ROSTER_TILES, characterOfTile, selectGrid, tileLabel, tileOfCharacter } from "../src/game/ui/selectionFrames";
import { FORGE_ICON, setForgeShown } from "../src/game/ui/forgeSetting";
import { Key } from "../src/host/loop/keyEvents";
import { shell } from "../src/host/loop/state";
import { declineTutorial, passStartControls } from "../scripts/wisp/startControls";
import { MAKGORA_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(MAKGORA_HEADLESS);
const FORGE_FIGHTER = Character.jaina;
const FEATURED_FIGHTER = Character.archimonde;

function centre(grid: RosterGrid, character: number): readonly [number, number] {
  const rect = cellRect(grid, tileOfCharacter(character));
  return [f32((rect.left + rect.right) / 2), f32((rect.top + rect.bottom) / 2)];
}

function value<T>(client: HeadlessClient, body: () => T): T {
  let result: T | undefined;
  client.run(() => { result = body(); });
  return result as T;
}

const tileFrame = (client: HeadlessClient, kind: "Portrait" | "Forge", tile: number) =>
  client.frames.snapshot().find(frame => frame.name === `MeleeTile${kind}${client.slot}_${tile}`);

test("a player with Show the Forge on picks a Forge fighter on the full grid while the other player picks on the compact grid with it off, and only the full grid's Forge tiles carry the Hammer badge, and both clients fight both picks with no divergence [k1 scenario]", () => {
  expect(fighterStatus(FORGE_FIGHTER)).toBe("forge");
  expect(fighterStatus(FEATURED_FIGHTER)).toBe("featured");
  const [full, compact] = [selectGrid(true), selectGrid(false)];
  expect(laidOut(compact, tileOfCharacter(FORGE_FIGHTER))).toBe(false);
  expect(centre(full, FEATURED_FIGHTER)).not.toEqual(centre(compact, FEATURED_FIGHTER));
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, [0, 1]);
  const [a, b] = [clients.client(0), clients.client(1)];
  clients.start();
  passStartControls(clients);
  declineTutorial(clients);
  a.run(() => setForgeShown(true));
  clients.frames(10);
  const tile = tileOfCharacter(FORGE_FIGHTER);
  expect(tileFrame(a, "Portrait", tile)?.visible).toBe(true);
  expect(tileFrame(a, "Forge", tile)?.visible).toBe(true);
  expect(tileFrame(b, "Portrait", tile)?.visible).toBe(false);
  for (let grid = 0; grid < ROSTER_TILES; grid++) {
    const forge = grid !== RANDOM_FIGHTER_TILE && fighterStatus(characterOfTile(grid)) === "forge";
    expect(tileFrame(a, "Forge", grid)?.visible ?? false, tileLabel(grid)).toBe(forge);
    expect(tileFrame(b, "Forge", grid)?.visible ?? false, tileLabel(grid)).toBe(false);
    if (forge) expect(tileFrame(a, "Forge", grid)?.texture).toBe(FORGE_ICON);
  }
  for (const fighter of [Character.whitemane, Character.valeera]) expect(tileFrame(a, "Forge", tileOfCharacter(fighter))?.visible).toBe(true);
  expect(a.frames.snapshot().find(frame => frame.name === `MeleeSettingsForgeIcon${a.slot}`)?.texture).toBe(FORGE_ICON);
  for (const slot of [0, 1]) clients.press(slot, Key.n);
  clients.frames(5);
  const [x, y] = centre(full, FORGE_FIGHTER);
  clients.click(1, x, y);
  clients.frames(10);
  expect(value(b, () => shell().game.characterChoices[1])).not.toBe(FORGE_FIGHTER);
  expect(clients.click(0, x, y)).toBe(true);
  expect(clients.click(1, ...centre(compact, FEATURED_FIGHTER))).toBe(true);
  clients.frames(10);
  for (const client of [a, b]) {
    expect(value(client, () => shell().game.characterChoices[0])).toBe(FORGE_FIGHTER);
    expect(value(client, () => shell().game.characterChoices[1])).toBe(FEATURED_FIGHTER);
  }
  const until = (what: string, phase: Phase) => {
    for (let frame = 0; frame < 120 && value(a, () => shell().game.phase) !== phase; frame++) clients.frames(1);
    expect(value(a, () => shell().game.phase), what).toBe(phase);
  };
  clients.press(0, Key.y);
  until("stage selection", Phase.stageMenu);
  clients.press(0, Key.y);
  until("the match", Phase.match);
  clients.frames(240);
  for (const client of [a, b]) {
    expect(client.errors).toEqual([]);
    expect(value(client, () => fighterAt(shell().world, 0).character)).toBe(FORGE_FIGHTER);
    expect(value(client, () => fighterAt(shell().world, 1).character)).toBe(FEATURED_FIGHTER);
  }
  expect(clients.firstDivergence()).toBeUndefined();
}, 60_000);

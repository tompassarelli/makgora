import { expect, test } from "bun:test";
import { f32 } from "wisp/src/sim/f32";
import type { HeadlessClient } from "wisp/src/headless/client";
import { install, startBuild } from "../src/platform/main";
import { Phase, createMatchState } from "../src/game/lobby/lobbyState";
import { applyRulePreset } from "../src/game/lobby/rulePresets";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { Character } from "../src/game/sim/codes";
import { fighterAt } from "../src/game/sim/roster";
import { fighterStatus } from "../src/game/roster/forge";
import { type BarBox, DRAWER_ROWS, SELECT_BAR } from "../src/game/core/selectBarLayout";
import { type RosterGrid, cellRect, laidOut } from "../src/game/menu/selectionGrid";
import { RANDOM_FIGHTER_TILE, ROSTER_TILES, characterOfTile, selectGrid, tileLabel, tileOfCharacter } from "../src/game/ui/selectionFrames";
import { FORGE_ICON } from "../src/game/ui/ruleText";
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

const middle = (b: BarBox): readonly [number, number] => [f32(b.x + f32(b.width / 2)), f32(b.y - f32(b.height / 2))];

function value<T>(client: HeadlessClient, body: () => T): T {
  let result: T | undefined;
  client.run(() => { result = body(); });
  return result as T;
}

const frameNamed = (client: HeadlessClient, name: string) => client.frames.snapshot().find(frame => frame.name === name);
const tileFrame = (client: HeadlessClient, kind: "Portrait" | "Forge", tile: number) => frameNamed(client, `MeleeTile${kind}${client.slot}_${tile}`);

test("the Forge match rule starts Off and Reset default turns it Off [k2 property]", () => {
  const game = createMatchState();
  expect(game.forge).toBe(false);
  game.forge = true;
  applyRulePreset(game, 0, "standard");
  expect(game.forge).toBe(false);
});

test("one player turning the Forge rule on in Match Rules shows the Forge tiles with the Hammer badge on both clients' grids, Reset default hides them on both, and a Forge pick fights on both clients with no divergence [k1 scenario]", () => {
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
  for (const slot of [0, 1]) clients.press(slot, Key.n);
  clients.frames(10);
  const tile = tileOfCharacter(FORGE_FIGHTER);
  const expectGrid = (forge: boolean) => {
    for (const client of [a, b]) {
      expect(value(client, () => shell().game.forge)).toBe(forge);
      if (client === a) expect(frameNamed(client, `MeleeRulesForge${client.slot}Text`)?.text).toContain(forge ? "Forge: On" : "Forge: Off");
      expect(tileFrame(client, "Portrait", tile)?.visible).toBe(forge);
      for (let grid = 0; grid < ROSTER_TILES; grid++) {
        const marked = forge && grid !== RANDOM_FIGHTER_TILE && fighterStatus(characterOfTile(grid)) === "forge";
        expect(tileFrame(client, "Forge", grid)?.visible ?? false, tileLabel(grid)).toBe(marked);
        if (marked) expect(tileFrame(client, "Forge", grid)?.texture).toBe(FORGE_ICON);
      }
    }
  };
  expect(clients.click(0, ...middle(SELECT_BAR.rules))).toBe(true);
  clients.frames(5);
  expect(frameNamed(a, `MeleeRulesForgeIcon${a.slot}`)?.texture).toBe(FORGE_ICON);
  expectGrid(false);
  expect(clients.click(0, ...middle(DRAWER_ROWS.forge))).toBe(true);
  clients.frames(10);
  expectGrid(true);
  for (const fighter of [Character.whitemane, Character.valeera]) expect(tileFrame(b, "Forge", tileOfCharacter(fighter))?.visible).toBe(true);
  expect(clients.click(0, ...middle(DRAWER_ROWS.reset))).toBe(true);
  clients.frames(10);
  expectGrid(false);
  expect(clients.click(0, ...middle(DRAWER_ROWS.forge))).toBe(true);
  clients.frames(10);
  expectGrid(true);
  expect(clients.click(0, ...middle(SELECT_BAR.rules))).toBe(true);
  clients.frames(5);
  const [x, y] = centre(full, FORGE_FIGHTER);
  expect(clients.click(0, x, y)).toBe(true);
  expect(clients.click(1, ...centre(full, FEATURED_FIGHTER))).toBe(true);
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

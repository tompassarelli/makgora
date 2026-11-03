import { expect, test } from "bun:test";
import { f32 } from "wisp/src/sim/f32";
import type { HeadlessClient } from "wisp/src/headless/client";
import { install, startBuild } from "../src/platform/main";
import { Phase } from "../src/game/lobby/lobbyState";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { Character } from "../src/game/sim/codes";
import { fighterAt } from "../src/game/sim/roster";
import { fighterStatus } from "../src/game/roster/forge";
import { cellRect, rosterGrid } from "../src/game/menu/selectionGrid";
import { ROSTER_TILES, tileOfCharacter } from "../src/game/ui/selectionFrames";
import { setForgeShown } from "../src/game/ui/forgeSetting";
import { Key } from "../src/host/loop/keyEvents";
import { shell } from "../src/host/loop/state";
import { declineTutorial, passStartControls } from "../scripts/wisp/startControls";
import { MAKGORA_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(MAKGORA_HEADLESS);
const FORGE_FIGHTER = Character.jaina;

function value<T>(client: HeadlessClient, body: () => T): T {
  let result: T | undefined;
  client.run(() => { result = body(); });
  return result as T;
}

const tileFrame = (client: HeadlessClient, kind: "Portrait" | "Forge", tile: number) =>
  client.frames.snapshot().find(frame => frame.name === `MeleeTile${kind}${client.slot}_${tile}`);

test("a player with Show the Forge on picks a Forge fighter while the other player has it off, and both clients fight that fighter with no divergence [k1 scenario]", () => {
  expect(fighterStatus(FORGE_FIGHTER)).toBe("forge");
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
  for (const slot of [0, 1]) clients.press(slot, Key.n);
  clients.frames(5);
  const rect = cellRect(rosterGrid(ROSTER_TILES), tile);
  const [x, y] = [f32((rect.left + rect.right) / 2), f32((rect.top + rect.bottom) / 2)];
  clients.click(1, x, y);
  clients.frames(10);
  expect(value(b, () => shell().game.characterChoices[1])).not.toBe(FORGE_FIGHTER);
  expect(clients.click(0, x, y)).toBe(true);
  clients.frames(10);
  for (const client of [a, b]) expect(value(client, () => shell().game.characterChoices[0])).toBe(FORGE_FIGHTER);
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
  }
  expect(clients.firstDivergence()).toBeUndefined();
});

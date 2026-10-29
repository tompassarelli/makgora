import { expect, test } from "bun:test";
import { f32 } from "wisp/src/sim/f32";
import { install, startBuild } from "../src/platform/main";
import { RANDOM_FIGHTER, fighterActive } from "../src/game/lobby/lobbyState";
import { fighterPortrait } from "../src/game/roster/looks";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { RULE_BUTTONS, teamSettingsBox } from "../src/game/ui/ruleButtons";
import { RANDOM_FIGHTER_TEXTURE, characterOfTile } from "../src/game/ui/selectionFrames";
import { shell } from "../src/host/loop/state";
import { passStartControls } from "../scripts/wisp/startControls";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

const HUMANS = [0, 1, 2, 3];
const centre = (box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }) => [f32(box.x + f32(box.width / 2)), f32(box.y - f32(box.height / 2))] as const;

test("every participant's select grid draws each tile portrait in the palette of that participant's own card, slot colour in Versus and team colour in Team Battle, following a team change [k2 property]", () => {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, HUMANS);
  clients.start();
  passStartControls(clients);
  clients.frames(10);
  const ownPalette = (slot: number) => {
    let palette = -1;
    clients.client(slot).run(() => {
      const { game } = shell();
      palette = game.teamBattle && fighterActive(game, slot) ? game.teamChoices[slot] ?? -1 : slot;
    });
    return palette;
  };
  const expectTiles = (slot: number, palette: number) => {
    const tiles = clients.client(slot).frames.snapshot().filter(frame => frame.name.startsWith(`MeleeTilePortrait${slot}_`));
    expect(tiles.length).toBeGreaterThan(1);
    for (const frame of tiles) {
      const character = characterOfTile(Number(frame.name.slice(frame.name.indexOf("_") + 1)));
      expect(frame.texture, frame.name).toBe(character === RANDOM_FIGHTER ? RANDOM_FIGHTER_TEXTURE : fighterPortrait(character, "Tile", palette));
    }
  };
  for (const slot of HUMANS) {
    expect(ownPalette(slot)).toBe(slot);
    expectTiles(slot, slot);
  }
  expect(clients.click(0, ...centre(RULE_BUTTONS.teamBattle))).toBe(true);
  clients.frames(10);
  const teams = HUMANS.map(ownPalette);
  expect(teams).not.toEqual(HUMANS);
  for (const slot of HUMANS) expectTiles(slot, teams[slot] ?? -1);
  expect(clients.click(1, ...centre(teamSettingsBox(1)))).toBe(true);
  clients.frames(10);
  const changed = ownPalette(1);
  expect(changed).not.toBe(teams[1]);
  expectTiles(1, changed);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});

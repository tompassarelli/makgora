import { f32 } from "wisp/src/sim/f32";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { RENDERED_FIGHTERS } from "../roster/kits";
import { RACES, fighterRace } from "../roster/races";
import { CAP_HEIGHT, DAMAGE_FONT, NAME_FONT, STOCK_SHOWN_PX, type PlateBox, panelLayout, plateRow, pingBars, stockFadeAlpha, STOCK_FADE_FRAMES } from "./plateLayout";
import { RACE_FRAME_PX, partScale, raceFrameParts } from "./raceFrame";
import { pixelsForUnits } from "./portraitFrames";

test("each fighter's portrait frame is its race's console art: playable races their own, neutrals by the side they fought on, Vashj and the Murlocs Night Elf and Ragnaros Orc since Classic has no Naga console [k3 measure docs/design/fighter-portraits.md]", () => {
  const expected: readonly (readonly [Character, string])[] = [
    [Character.uther, "Human"], [Character.demonHunter, "NightElf"], [Character.thrall, "Orc"], [Character.lich, "Undead"],
    [Character.onyxia, "Human"], [Character.onyxiaDragon, "Human"], [Character.kaelthas, "Human"], [Character.sylvanas, "Undead"], [Character.lichKing, "Undead"],
    [Character.dreadlord, "Undead"], [Character.anubarak, "Undead"], [Character.butcher, "Undead"], [Character.archimonde, "Undead"], [Character.pitLord, "Undead"],
    [Character.tinker, "Orc"], [Character.chen, "Orc"], [Character.firelord, "Orc"], [Character.ladyVashj, "NightElf"], [Character.murloc, "NightElf"],
  ];
  for (const [character, race] of expected) assertEquals(fighterRace(character), race, `fighter ${character}`);
  for (const character of RENDERED_FIGHTERS) assertTrue(RACES.includes(fighterRace(character)));
});

test("the match HUD bust stands free with no arch or border: each race frame holds only the portrait, in the same 156x208 box at (28, 56) of the 212x272 frame the arch opening had, drawn at most one pixel per texel with equal scale on both axes [k2 property]", () => {
  const parts = raceFrameParts();
  assertEquals(parts.length, 1, "only the portrait is drawn");
  const portrait = parts[0];
  assertTrue(portrait !== undefined);
  if (portrait === undefined) return;
  assertEquals(portrait.key, "portrait");
  assertEquals(portrait.file, undefined, "no console art is drawn");
  assertEquals(portrait.layer, "BACKGROUND");
  assertEquals(portrait.x, 28);
  assertEquals(portrait.y, 56);
  assertEquals(portrait.width, 156);
  assertEquals(portrait.height, 208);
  assertEquals(RACE_FRAME_PX.width, 212);
  assertEquals(RACE_FRAME_PX.height, 272);
  const [left, right, top, bottom] = portrait.texCoord;
  assertTrue(Math.min(left, right) >= 0.0 && Math.max(left, right) <= 1.0 && left !== right && top >= 0.0 && top < bottom && bottom <= 1.0);
  const scale = partScale(portrait);
  assertTrue(scale.x <= 1.0 && scale.y <= 1.0);
  assertTrue(Math.abs(scale.x - scale.y) < f32(0.001));
});

const right = (box: PlateBox): number => box.x + box.width;
const bottom = (box: PlateBox): number => box.y + box.height;
const apart = (a: PlateBox, b: PlateBox): boolean => right(a) <= b.x || right(b) <= a.x || bottom(a) <= b.y || bottom(b) <= a.y;
const inside = (inner: PlateBox, outer: PlateBox): boolean => inner.x >= outer.x && inner.y >= outer.y && right(inner) <= right(outer) && bottom(inner) <= bottom(outer);

test("both plates mirror each other: the frame keeps its texture's size, the stocks sit below the frame and clear of it with no backing strip, each over its own shadow, at least as tall as the name's capitals, and the ping sits beside the frame on the outer side [k2 property]", () => {
  const capitals = (font: number) => pixelsForUnits(font, 1920) * CAP_HEIGHT;
  assertTrue(STOCK_SHOWN_PX >= capitals(NAME_FONT));
  assertTrue(capitals(NAME_FONT) >= capitals(DAMAGE_FONT) / 4);
  for (const [position, count] of [[0, 1], [0, 2], [1, 2], [0, 4], [3, 4]] as const) {
    const panel = panelLayout(position, plateRow(count));
    const where = `${count} players, position ${position}`;
    assertEquals(panel.frame.width, RACE_FRAME_PX.width, `${where} frame width`);
    assertEquals(panel.frame.height, RACE_FRAME_PX.height, `${where} frame height`);
    assertEquals(panel.stockShadows.length, panel.stocks.length, `${where} one shadow per stock`);
    panel.stocks.forEach((stock, index) => {
      const shadow = panel.stockShadows[index];
      assertTrue(shadow !== undefined && inside(stock, shadow));
      if (shadow === undefined) return;
      assertTrue(shadow.y >= bottom(panel.frame));
      assertTrue(apart(shadow, panel.frame));
      const next = panel.stockShadows[index + 1];
      if (next !== undefined) assertTrue(apart(shadow, next));
    });
    for (const bar of [panel.pingSignal, panel.pingNumber]) {
      assertTrue(apart(bar, panel.frame));
      assertTrue(panel.mirrored ? bar.x >= right(panel.frame) : right(bar) <= panel.frame.x);
      assertTrue(bar.y < bottom(panel.namePlate) && bottom(bar) > panel.namePlate.y);
    }
  }
  const leftPanel = panelLayout(0, plateRow(2)), rightPanel = panelLayout(1, plateRow(2));
  assertEquals(leftPanel.frame.x, 544 - right(rightPanel.frame), "frames mirror");
  leftPanel.stocks.forEach((stock, index) => assertEquals(stock.x, 544 - right(rightPanel.stocks[index] ?? stock), `stock ${index} mirrors`));
});

test("the ping shows 4 bars under 60 ms, 3 under 100, 2 under 150, 1 above and hides with no measurement, and a lost stock fades out over its fade frames [k2 property]", () => {
  for (const [ms, bars] of [[-1, 0], [0, 4], [59, 4], [60, 3], [99, 3], [100, 2], [149, 2], [150, 1], [900, 1]] as const) assertEquals(pingBars(ms), bars, `${ms} ms`);
  assertEquals(stockFadeAlpha(0), 255);
  assertEquals(stockFadeAlpha(STOCK_FADE_FRAMES), 0);
  for (let frame = 1; frame <= STOCK_FADE_FRAMES; frame++) assertTrue(stockFadeAlpha(frame) < stockFadeAlpha(frame - 1));
});

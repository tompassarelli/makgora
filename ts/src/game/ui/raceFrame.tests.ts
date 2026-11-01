import { f32 } from "wisp/src/sim/f32";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { RENDERED_FIGHTERS } from "../roster/kits";
import { RACES, fighterRace } from "../roster/races";
import { CAP_HEIGHT, DAMAGE_FONT, NAME_FONT, STOCK_SHOWN_PX, type PlateBox, panelLayout, pingBars, stockFadeAlpha, STOCK_FADE_FRAMES } from "./plateLayout";
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

test("the race frame stands level and is never stretched or squashed: both arch halves share one row of texels, every part draws at most one pixel per texel with equal scale on both axes, on a 1920-tall display [k2 property]", () => {
  for (const race of RACES) {
    const parts = raceFrameParts(race);
    for (const part of parts) {
      const [left, right, top, bottom] = part.texCoord;
      assertTrue(left >= 0.0 && left < right && right <= 1.0 && top >= 0.0 && top < bottom && bottom <= 1.0);
      const scale = partScale(part);
      assertTrue(scale.x <= 1.0 && scale.y <= 1.0);
      assertTrue(Math.abs(scale.x - scale.y) < f32(0.001));
      assertTrue(part.x >= 0 && part.y >= 0 && part.x + part.width <= RACE_FRAME_PX.width && part.y + part.height <= RACE_FRAME_PX.height);
    }
    const halves = parts.filter(part => part.layer === "ARTWORK");
    const [archLeft, archRight] = halves;
    assertTrue(archLeft !== undefined && archRight !== undefined);
    if (archLeft === undefined || archRight === undefined) continue;
    assertEquals(archLeft.y, archRight.y, `${race} halves share a top`);
    assertEquals(archLeft.height, archRight.height, `${race} halves share a height`);
    assertEquals(archLeft.texCoord[2], archRight.texCoord[2], `${race} halves cut from one texel row`);
    assertEquals(archLeft.texCoord[3], archRight.texCoord[3], `${race} halves end on one texel row`);
    assertEquals(archLeft.x + archLeft.width, archRight.x, `${race} halves meet`);
    assertEquals(archLeft.texCoord[1], 1.0, `${race} left half runs to its tile's edge`);
    assertEquals(archRight.texCoord[0], 0.0, `${race} right half starts at its tile's edge`);
  }
});

const right = (box: PlateBox): number => box.x + box.width;
const bottom = (box: PlateBox): number => box.y + box.height;
const apart = (a: PlateBox, b: PlateBox): boolean => right(a) <= b.x || right(b) <= a.x || bottom(a) <= b.y || bottom(b) <= a.y;
const inside = (inner: PlateBox, outer: PlateBox): boolean => inner.x >= outer.x && inner.y >= outer.y && right(inner) <= right(outer) && bottom(inner) <= bottom(outer);

test("both plates mirror each other: the frame keeps its texture's size, the stocks sit on their dark strip below the frame and clear of it, at least as tall as the name's capitals, and the ping sits beside the frame on the outer side [k2 property]", () => {
  const capitals = (font: number) => pixelsForUnits(font, 1920) * CAP_HEIGHT;
  assertTrue(STOCK_SHOWN_PX >= capitals(NAME_FONT));
  assertTrue(capitals(NAME_FONT) >= capitals(DAMAGE_FONT) / 4);
  for (const [position, count] of [[0, 1], [0, 2], [1, 2], [0, 4], [3, 4]] as const) {
    const panel = panelLayout(position, count);
    const where = `${count} players, position ${position}`;
    assertEquals(panel.frame.width, RACE_FRAME_PX.width, `${where} frame width`);
    assertEquals(panel.frame.height, RACE_FRAME_PX.height, `${where} frame height`);
    assertTrue(panel.stockStrip.y >= bottom(panel.frame));
    panel.stockRings.forEach((ring, index) => {
      assertTrue(inside(ring, panel.stockStrip));
      assertTrue(apart(ring, panel.frame));
      const next = panel.stockRings[index + 1];
      if (next !== undefined) assertTrue(apart(ring, next));
    });
    for (const bar of [panel.pingSignal, panel.pingNumber]) {
      assertTrue(apart(bar, panel.frame));
      assertTrue(panel.mirrored ? bar.x >= right(panel.frame) : right(bar) <= panel.frame.x);
      assertTrue(bar.y < bottom(panel.namePlate) && bottom(bar) > panel.namePlate.y);
    }
  }
  const leftPanel = panelLayout(0, 2), rightPanel = panelLayout(1, 2);
  assertEquals(leftPanel.frame.x, 544 - right(rightPanel.frame), "frames mirror");
  assertEquals(leftPanel.stockStrip.x, 544 - right(rightPanel.stockStrip), "strips mirror");
});

test("the ping shows 4 bars under 60 ms, 3 under 100, 2 under 150, 1 above and hides with no measurement, and a lost stock fades out over its fade frames [k2 property]", () => {
  for (const [ms, bars] of [[-1, 0], [0, 4], [59, 4], [60, 3], [99, 3], [100, 2], [149, 2], [150, 1], [900, 1]] as const) assertEquals(pingBars(ms), bars, `${ms} ms`);
  assertEquals(stockFadeAlpha(0), 255);
  assertEquals(stockFadeAlpha(STOCK_FADE_FRAMES), 0);
  for (let frame = 1; frame <= STOCK_FADE_FRAMES; frame++) assertTrue(stockFadeAlpha(frame) < stockFadeAlpha(frame - 1));
});

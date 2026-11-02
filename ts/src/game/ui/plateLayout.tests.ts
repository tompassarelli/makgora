import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { idiv, imod } from "wisp/src/sim/intMath";
import { createTapeSession, performTapeOperation } from "../replay/tapeRunner";
import { createMatchTally, resultRows } from "../presentation/matchCues";
import { createTrainingState } from "../match/trainingState";
import { trainingReadout } from "../session/messages";
import { PLAYABLE_CHARACTERS } from "../roster/kits";
import { fighterAt } from "../sim/roster";
import { Phase, requestStageSelect, selectCharacter } from "../lobby/lobbyState";
import { DAMAGE_DARK_FROM, PLATE_TOP, SHAKE_FRAMES, type PlateBox, type PlateRow, boxLeft, boxTop, damageColour, damageText, meterPlacement, numberJolt, panelLayout, panelMirrored, percentText, plateLeft, plateOrder, plateRow, previewPanelLeft, stepJolt, NAME_FONT } from "./plateLayout";
import { PREVIEW_PANEL, PREVIEW_TEXT_MAX, previewTextFit } from "./keyboardPreview";
import { NET_INDICATOR_TOP } from "./hudLayout";
import { presetBindings } from "../input/keyBindings";
import { unitsForPixels } from "./portraitFrames";

const channels = (colour: number): readonly number[] => [imod(idiv(colour, 65536), 256), imod(idiv(colour, 256), 256), imod(colour, 256)];
const plain = (text: string): string => text.substring(10, text.length - 2);

test("every damage readout shows the whole percent, 5.4 as 5 and 99.9 as 99, while the simulated damage keeps its fraction [k3 measure #570]", () => {
  const session = createTapeSession();
  const game = session.live.match;
  selectCharacter(game, 0, at(PLAYABLE_CHARACTERS, 0));
  selectCharacter(game, 1, at(PLAYABLE_CHARACTERS, 1));
  assertTrue(requestStageSelect(game, 0));
  assertEquals(performTapeOperation(session, { kind: "start", line: 1, slot: 0 }), undefined);
  assertEquals(game.phase, Phase.match);
  const training = createTrainingState();
  training.comboHits = 3;
  for (const [damage, whole] of [[f32(5.4), "5"], [f32(99.9), "99"]] as const) {
    const fighter = fighterAt(session.live.world, 0);
    fighter.status.damage = damage;
    const hud = `${plain(damageText(damage))}${plain(percentText(damage))}`;
    assertEquals(hud, `${whole}%`, "HUD");
    const row = resultRows(game, session.live.world, createMatchTally()).find(entry => entry.slot === 0);
    assertTrue(row !== undefined && row.text.includes(`Damage ${whole}%\n`));
    training.comboDamage = damage;
    assertTrue(trainingReadout(training).endsWith(`· ${whole}%`));
    assertEquals(fighter.status.damage, damage, "simulated damage");
  }
});

test("the percent blends white at 0, yellow near 50, red at 100 and dark red from 150 with no colour jump [k3 measure #570]", () => {
  assertEquals(damageColour(0.0), 0xffffff);
  const [yellowRed, yellowGreen, yellowBlue] = channels(damageColour(50.0));
  assertTrue((yellowRed ?? 0) > 240 && (yellowGreen ?? 0) > 200 && (yellowBlue ?? 255) < 100);
  const [red, green, blue] = channels(damageColour(100.0));
  assertTrue((red ?? 0) > 220 && (green ?? 255) < 60 && (blue ?? 255) < 60);
  const dark = damageColour(DAMAGE_DARK_FROM);
  assertTrue((channels(dark)[0] ?? 255) < 160);
  for (const held of [175.0, 300.0, 999.0]) assertEquals(damageColour(held), dark, `held at ${held}`);
  let previous = damageColour(0.0);
  for (let percent = 1; percent <= 200; percent++) {
    const colour = damageColour(percent);
    const step = Math.max(...channels(colour).map((value, index) => Math.abs(value - (channels(previous)[index] ?? 0))));
    assertTrue(step <= 6);
    previous = colour;
  }
  assertEquals(damageColour(f32(99.9)), damageColour(99.0));
});

test("a fighter at 150% that takes no hit keeps its percent at rest on every frame, a hit shakes it, and it returns to rest after the shake [k1 scenario]", () => {
  const jolt = numberJolt();
  stepJolt(jolt, false, 150.0);
  for (let frame = 0; frame < 30; frame++) {
    stepJolt(jolt, true, 150.0);
    assertEquals(jolt.dx, 0.0, `no hit, frame ${frame} dx`);
    assertEquals(jolt.dy, 0.0, `no hit, frame ${frame} dy`);
  }
  assertTrue(stepJolt(jolt, true, 162.5));
  assertTrue(jolt.dx !== 0.0 && jolt.dy !== 0.0);
  for (let frame = 1; frame < SHAKE_FRAMES; frame++) stepJolt(jolt, true, 162.5);
  stepJolt(jolt, true, 162.5);
  assertEquals(jolt.dx, 0.0, "rest after the shake dx");
  assertEquals(jolt.dy, 0.0, "rest after the shake dy");
  assertTrue(!stepJolt(jolt, true, 162.5));
});

const span = (left: number, centerY: number, width: number, height: number) => ({ left, right: left + width, top: centerY + height / 2, bottom: centerY - height / 2 });
const boxSpan = (left: number, box: PlateBox) => span(boxLeft(left, box), boxTop(box) - unitsForPixels(box.height) / 2, unitsForPixels(box.width), unitsForPixels(box.height));
const overlaps = (a: ReturnType<typeof span>, b: ReturnType<typeof span>) => a.left < b.right && b.left < a.right && a.bottom < b.top && b.bottom < a.top;

test("the ultimate bar is a long thin strip under the damage number, clear of the name, stocks and doom, on both sides of the screen for two to four players [k3 measure docs/design/mana.md]", () => {
  for (let count = 1; count <= 4; count++) {
    for (let position = 0; position < count; position++) {
      const ultimateBar = meterPlacement(position, plateRow(count));
      const where = `${count} players, position ${position}`;
      assertEquals(ultimateBar.width >= 8 * ultimateBar.height, true, `${where}: ultimate bar is long and thin`);
      const bar = span(ultimateBar.left, ultimateBar.centerY, ultimateBar.width, ultimateBar.height);
      const left = plateLeft(position, plateRow(count));
      const panel = panelLayout(position, plateRow(count));
      for (const other of [panel.name, panel.doom, panel.stockCount, ...panel.stocks]) assertEquals(!overlaps(bar, boxSpan(left, other)), true, `${where}: no overlap with name, stocks or doom`);
      const damage = boxSpan(left, panel.damage);
      assertEquals(bar.top <= damage.bottom + unitsForPixels(4), true, `${where}: bar is under the damage number`);
    }
  }
});

const SCREEN_WIDTH = f32(0.8);
const PLATE_WIDTH = unitsForPixels(544);

const DAMAGE_DIGITS_PX = 192;
const SCREEN_LEFT = 0.0;

function plateParts(left: number, row: PlateRow, position: number): ReturnType<typeof span>[] {
  const panel = panelLayout(position, row);
  const digits: PlateBox = { ...panel.damage, x: panel.damage.x + panel.damage.width - DAMAGE_DIGITS_PX, width: DAMAGE_DIGITS_PX };
  return [panel.frame, panel.namePlate, panel.percent, digits, panel.pingSignal, panel.pingNumber, ...panel.stockShadows].map(box => boxSpan(left, box));
}

const ARRANGEMENTS: readonly { readonly name: string; readonly active: readonly number[]; readonly teams?: readonly number[]; readonly slots: string; readonly split: number }[] = [
  { name: "1 player", active: [0], slots: "0", split: 1 },
  { name: "2-player free-for-all", active: [0, 1], slots: "0,1", split: 1 },
  { name: "3-player free-for-all", active: [0, 1, 2], slots: "0,1,2", split: 2 },
  { name: "4-player free-for-all", active: [0, 1, 2, 3], slots: "0,1,2,3", split: 2 },
  { name: "2v2 Team Battle", active: [0, 1, 2, 3], teams: [0, 1, 0, 1], slots: "0,2,1,3", split: 2 },
  { name: "1v1 Team Battle", active: [0, 2], teams: [1, 0, 0, 1], slots: "2,0", split: 1 },
  { name: "1v2 Team Battle", active: [0, 1, 2], teams: [1, 0, 0, 0], slots: "1,2,0", split: 2 },
  { name: "1v3 Team Battle", active: [0, 1, 2, 3], teams: [1, 0, 0, 0], slots: "1,2,3,0", split: 3 },
  { name: "three-team battle", active: [0, 1, 2, 3], teams: [2, 0, 1, 1], slots: "1,2,3,0", split: 1 },
];

test("the bottom row puts p1 | preview | p2, p1 p2 | preview | p3 and p1 p2 | preview | p3 p4, keeps each Team Battle team on its own side of the preview, mirrors the plates right of it, never overlaps a plate with another or the preview, stays inside the 4:3 screen and the HUD band, and with the preview off closes up evenly spaced and centred [k2 property]", () => {
  for (const arrangement of ARRANGEMENTS) {
    const teams = arrangement.teams;
    const order = plateOrder(arrangement.active, teams !== undefined, slot => teams?.[slot] ?? 0);
    assertEquals(order.slots.join(","), arrangement.slots, `${arrangement.name}: plate order`);
    assertEquals(order.split, arrangement.split, `${arrangement.name}: plates left of the preview`);
    const count = order.slots.length;
    for (const preview of [true, false]) {
      const row = plateRow(count, preview, order.split);
      const where = `${arrangement.name}, preview ${preview ? "on" : "off"}`;
      const lefts = order.slots.map((_slot, position) => plateLeft(position, row));
      const parts = lefts.map((left, position) => plateParts(left, row, position));
      const panelLeft = previewPanelLeft(row);
      const panel = span(panelLeft, f32(0.012) + PREVIEW_PANEL.height / 2, PREVIEW_PANEL.width, PREVIEW_PANEL.height);
      parts.forEach((plate, position) => {
        assertEquals(panelMirrored(position, row), count > 1 && position >= order.split, `${where}: plate ${position} faces the middle`);
        for (const part of plate) {
          assertEquals(part.left >= SCREEN_LEFT && part.right <= SCREEN_WIDTH && part.top <= PLATE_TOP + f32(0.000001), true, `${where}: plate ${position} inside the screen and the HUD band`);
          if (preview) assertEquals(position < order.split ? part.right <= panel.left : part.left >= panel.right, true, `${where}: plate ${position} on its side of the preview`);
          for (let other = position + 1; other < parts.length; other++) for (const theirs of parts[other] ?? []) assertEquals(!overlaps(part, theirs), true, `${where}: plates ${position} and ${other} apart`);
        }
      });
      if (preview) assertEquals(panel.left >= SCREEN_LEFT && panel.right <= SCREEN_WIDTH && panel.top <= f32(0.012) + PREVIEW_PANEL.height + f32(0.000001) && panel.top < NET_INDICATOR_TOP, true, `${where}: preview inside the screen and under the netplay warning`);
      if (preview) continue;
      for (let position = 2; position < count; position++) assertEquals(Math.abs((lefts[position] ?? 0) - (lefts[position - 1] ?? 0) - ((lefts[1] ?? 0) - (lefts[0] ?? 0))) < f32(0.0001), true, `${where}: even spacing`);
      const middle = ((lefts[0] ?? 0) + (lefts[count - 1] ?? 0) + unitsForPixels(544)) / 2;
      assertEquals(Math.abs(middle - SCREEN_WIDTH / 2) < f32(0.001), true, `${where}: centred`);
    }
  }
});

test("with the CONTROLS panel on, the plates crowd to the screen's edges and shrink only as far as the panel needs, the panel is wider and taller than before and its text is at least the fighter name text, and with it off the plates are unscaled and unmoved [k2 property]", () => {
  const SCREEN_RIGHT = f32(0.8);
  const OLD_PANEL = { width: f32(0.116), height: f32(0.104) };
  assertEquals(PREVIEW_PANEL.width > OLD_PANEL.width * 2 && PREVIEW_PANEL.height > OLD_PANEL.height, true, "the panel's slot is wider and taller");
  const fit = previewTextFit(presetBindings("wasd"));
  assertEquals(fit.size >= NAME_FONT && PREVIEW_TEXT_MAX >= NAME_FONT, true, "panel text at least as tall as the fighter name text");
  for (const arrangement of ARRANGEMENTS) {
    const count = arrangement.slots.split(",").length;
    const on = plateRow(count, true, arrangement.split), off = plateRow(count, false, arrangement.split);
    const where = arrangement.name;
    assertEquals(off.scale, 1.0, `${where}: preview off keeps the plates unscaled`);
    assertEquals(on.scale <= 1.0 && on.scale >= f32(0.7), true, `${where}: plates shrink at most to 0.7 (${on.scale})`);
    assertEquals(Math.abs(plateLeft(0, on) - f32(0.005)) < f32(0.0001), true, `${where}: the first plate sits at the left edge`);
    if (count > arrangement.split) assertEquals(Math.abs(plateLeft(count - 1, on) + unitsForPixels(544) * on.scale - (SCREEN_RIGHT - f32(0.005))) < f32(0.0001), true, `${where}: the last plate sits at the right edge`);
    const left = previewPanelLeft(on);
    const leftEnd = plateLeft(arrangement.split - 1, on) + unitsForPixels(544) * on.scale;
    const rightStart = count > arrangement.split ? plateLeft(arrangement.split, on) : SCREEN_RIGHT;
    assertEquals(left >= leftEnd && left + PREVIEW_PANEL.width <= rightStart, true, `${where}: the whole panel fits between the groups`);
    if (2 * arrangement.split === count) assertEquals(Math.abs(left + PREVIEW_PANEL.width / 2 - SCREEN_RIGHT / 2) < f32(0.0001), true, `${where}: the panel is centred`);
  }
  assertEquals(plateRow(2, true).scale, 1.0, "two plates need no scaling");
  assertEquals(plateRow(4, true).scale < plateRow(3, true).scale && plateRow(3, true).scale < 1.0 && plateRow(4, true).scale > 0.0, true, "more plates shrink more");
});

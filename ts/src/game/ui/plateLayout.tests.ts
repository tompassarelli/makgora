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
import { DAMAGE_DARK_FROM, SHAKE_FRAMES, type PlateBox, boxLeft, boxTop, damageColour, damageText, meterPlacement, numberJolt, panelLayout, percentText, plateLeft, stepJolt } from "./plateLayout";
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
  stepJolt(jolt, true, 150.0);
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
      const ultimateBar = meterPlacement(position, count);
      const where = `${count} players, position ${position}`;
      assertEquals(ultimateBar.width >= 8 * ultimateBar.height, true, `${where}: ultimate bar is long and thin`);
      const bar = span(ultimateBar.left, ultimateBar.centerY, ultimateBar.width, ultimateBar.height);
      const left = plateLeft(position, count);
      const panel = panelLayout(position, count);
      for (const other of [panel.name, panel.doom, panel.stockCount, ...panel.stocks]) assertEquals(!overlaps(bar, boxSpan(left, other)), true, `${where}: no overlap with name, stocks or doom`);
      const damage = boxSpan(left, panel.damage);
      assertEquals(bar.top <= damage.bottom + unitsForPixels(4), true, `${where}: bar is under the damage number`);
    }
  }
});

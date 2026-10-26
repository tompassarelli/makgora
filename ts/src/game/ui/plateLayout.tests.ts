import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
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
import { DAMAGE_DARK_FROM, TREMBLE_FROM, TREMBLE_MAX_PX, damageColour, damageText, percentText, trembleStrength } from "./plateLayout";

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

test("the percent blends white at 0, yellow near 50, red at 100 and dark red from 150 with no colour jump, and trembles only past 100 by a few pixels [k3 measure #570]", () => {
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
  for (let percent = 0; percent <= TREMBLE_FROM; percent++) assertEquals(trembleStrength(percent), 0.0, `still at ${percent}`);
  assertEquals(trembleStrength(f32(100.9)), 0.0, "still at 100.9");
  let shaken = 0.0;
  for (let percent = TREMBLE_FROM + 1; percent <= 400; percent++) {
    const strength = trembleStrength(percent);
    assertGreaterThan(strength, 0.0);
    assertTrue(strength >= shaken && strength <= TREMBLE_MAX_PX);
    shaken = strength;
  }
});

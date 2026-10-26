import { expect, test } from "bun:test";
import { anatomyFindings, elbowFlex, swingForearm } from "../scripts/wisp/victoryAnatomy";
import { VICTORY_ANATOMY_RECORD, VICTORY_UNJOINTED, type VictoryAnatomyRecord } from "../scripts/wisp/victoryAnatomyRecord";
import { victoryAnimation } from "../src/game/presentation/matchAudio";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";

const records: readonly VictoryAnatomyRecord[] = await Bun.file(VICTORY_ANATOMY_RECORD).json();

test("every fighter's victory bends each elbow one way within a human range, holds its bone lengths and keeps its arms out of its torso [k3 measure #496]", () => {
  const wanted = SELECTABLE_CHARACTERS.map(fighterName).filter((name) => VICTORY_UNJOINTED[name] === undefined);
  expect(records.map(({ fighter, clip }) => [fighter, clip])).toEqual(wanted.map((name) => [name, victoryAnimation(SELECTABLE_CHARACTERS.find((character) => fighterName(character) === name)!)]));
  expect(records.flatMap(({ fighter, rest, samples }) => anatomyFindings(rest, samples).map((finding) => ({ fighter, ...finding })))).toEqual([]);
});

test("a forearm swung backward past straight is found as an elbow bending backward on that frame and side [k2 property]", () => {
  const kael = records.find(({ fighter }) => fighter === "Kael'thas Sunstrider");
  if (kael === undefined) throw new Error("no Kael'thas record");
  const sample = kael.samples[10]!;
  const bent = { ...sample, pose: swingForearm(sample.pose, 0, -elbowFlex(sample.pose.arms[0]) - 45) };
  expect(anatomyFindings(kael.rest, [bent]).map(({ frame, side, joint, rule }) => ({ frame, side, joint, rule }))).toEqual([{ frame: sample.frame, side: 0, joint: "elbow", rule: "bends backward" }]);
});

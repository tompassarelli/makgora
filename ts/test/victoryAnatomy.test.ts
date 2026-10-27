import { expect, test } from "bun:test";
import { anatomyFindings, elbowFlex, swingForearm } from "../scripts/wisp/victoryAnatomy";
import { VICTORY_ANATOMY_RECORD, VICTORY_SEAM_DEBT, VICTORY_UNJOINTED, type VictoryAnatomyRecord } from "../scripts/wisp/victoryAnatomyRecord";
import { victoryAnimation } from "../src/game/presentation/matchAudio";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/roster/kits";

const records: readonly VictoryAnatomyRecord[] = await Bun.file(VICTORY_ANATOMY_RECORD).json();
const raisedKael: VictoryAnatomyRecord = await Bun.file(new URL("fixtures/victory-anatomy-kael-raised.json", import.meta.url)).json();
const seamless = (fighter: string) => VICTORY_SEAM_DEBT[fighter] === undefined;

test("every fighter's victory bends each elbow one way within a human range, holds its bone lengths, keeps its arms out of its torso and its upper arms in their shoulders [k3 measure #496]", () => {
  const wanted = SELECTABLE_CHARACTERS.map(fighterName).filter((name) => VICTORY_UNJOINTED[name] === undefined);
  expect(records.map(({ fighter, clip }) => [fighter, clip])).toEqual(wanted.map((name) => [name, victoryAnimation(SELECTABLE_CHARACTERS.find((character) => fighterName(character) === name)!)]));
  expect(records.flatMap(({ fighter, rest, samples }) => anatomyFindings(rest, samples).filter(({ rule }) => seamless(fighter) || rule !== "leaves its socket").map((finding) => ({ fighter, ...finding })))).toEqual([]);
});

test("each fighter listed as owing a shoulder seam still opens it, so the list shrinks when a cheer is fixed [k3 measure #496]", () => {
  expect(records.filter(({ fighter, rest, samples }) => anatomyFindings(rest, samples).some(({ rule }) => rule === "leaves its socket")).map(({ fighter }) => fighter).toSorted()).toEqual(Object.keys(VICTORY_SEAM_DEBT).toSorted());
});

test("Kael'thas's arms-overhead cheer that read as a dislocated arm is found leaving its shoulder sockets [k3 measure #496]", () => {
  const found = anatomyFindings(raisedKael.rest, raisedKael.samples).filter(({ rule }) => rule === "leaves its socket");
  expect(new Set(found.map(({ side }) => side))).toEqual(new Set([0, 1]));
  expect(found.length).toBeGreaterThan(10);
});

test("a forearm swung backward past straight is found as an elbow bending backward on that frame and side [k2 property]", () => {
  const sound = records.find(({ fighter }) => seamless(fighter));
  if (sound === undefined) throw new Error("no victory record without a seam debt");
  const sample = sound.samples[10]!;
  const bent = { ...sample, pose: swingForearm(sample.pose, 0, -elbowFlex(sample.pose.arms[0]) - 45) };
  expect(anatomyFindings(sound.rest, [bent]).map(({ frame, side, joint, rule }) => ({ frame, side, joint, rule }))).toEqual([{ frame: sample.frame, side: 0, joint: "elbow", rule: "bends backward" }]);
});

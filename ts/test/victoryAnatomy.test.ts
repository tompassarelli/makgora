import { expect, test } from "bun:test";
import { anatomyFindings } from "../scripts/wisp/victoryAnatomy";
import { VICTORY_ANATOMY_RECORD, VICTORY_SEAM_DEBT, VICTORY_UNJOINTED, type VictoryAnatomyRecord } from "../scripts/wisp/victoryAnatomyRecord";
import { victoryAnimation } from "../src/game/presentation/matchAudio";
import { fighterName } from "../src/game/roster/kits";
import { gatedFighters } from "../src/game/roster/forge";

const featured = new Set(gatedFighters().map(fighterName));
const recorded: readonly VictoryAnatomyRecord[] = await Bun.file(VICTORY_ANATOMY_RECORD).json();
const records = recorded.filter(({ fighter }) => featured.has(fighter));
const seamless = (fighter: string) => VICTORY_SEAM_DEBT[fighter] === undefined;

test("every fighter's victory bends each elbow one way within a human range, holds its bone lengths, keeps its arms out of its torso and its upper arms in their shoulders [k3 measure #496]", () => {
  const wanted = gatedFighters().map(fighterName).filter((name) => VICTORY_UNJOINTED[name] === undefined);
  expect(records.map(({ fighter, clip }) => [fighter, clip])).toEqual(wanted.map((name) => [name, victoryAnimation(gatedFighters().find((character) => fighterName(character) === name)!)]));
  expect(records.flatMap(({ fighter, rest, samples }) => anatomyFindings(rest, samples).filter(({ rule }) => seamless(fighter) || rule !== "leaves its socket").map((finding) => ({ fighter, ...finding })))).toEqual([]);
});

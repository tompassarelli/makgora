import { expect, test } from "bun:test";
import { Character } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS } from "../src/game/sim/heroes/registry";
import { TARGETS, trueZeroToDeaths } from "../scripts/advantageState";
import { sweep } from "./sweep";

sweep("the combo explorer finds no true zero-to-death from 0% for any fighter against the light, medium and heavy target at the centre and the ledge, from any opener against the escape-optimal DI [k2 property]", () => {
  expect(SELECTABLE_CHARACTERS.flatMap((attacker) => trueZeroToDeaths(attacker))).toEqual([]);
}, 300_000);

test("the combo explorer finds no true zero-to-death from 0% for Rifleman against the medium target at the ledge [k2 property]", () => {
  expect(trueZeroToDeaths(Character.rifleman, TARGETS.filter((target) => target.weight === "medium"), ["ledge"])).toEqual([]);
});

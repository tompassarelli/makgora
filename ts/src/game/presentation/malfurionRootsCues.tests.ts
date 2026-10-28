import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { MALFURION_SPECIALS } from "../fighters/malfurion/specials";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { fighterAttackCues } from "./attackCues";
import { DISJOINT_CUES, disjointNormals } from "./disjointCues";
import { fighterBranchCues, HERO_CUES } from "./specialCues";

const ROOTS = "EntanglingRoots";
const cues = HERO_CUES[Character.malfurion];

function drawsRoots(value: unknown): boolean {
  if (typeof value === "string") return value.indexOf(ROOTS) >= 0;
  if (typeof value !== "object" || value === null) return false;
  for (const inner of Object.values(value)) if (drawsRoots(inner)) return true;
  return false;
}

test("only Malfurion's neutral special draws Entangling Roots art; no other special, normal, branch cue or disjoint flare references it [k2 property]", () => {
  assertTrue(drawsRoots(cues?.neutral));
  assertTrue(drawsRoots(MALFURION_SPECIALS.neutral));
  assertTrue(disjointNormals(createFighter(Character.malfurion, 0.0, 1)).length > 0);
  for (const other of [MALFURION_SPECIALS.side, MALFURION_SPECIALS.up, MALFURION_SPECIALS.down, cues?.side, cues?.up, cues?.down, ...fighterAttackCues(Character.malfurion), ...fighterBranchCues(Character.malfurion), DISJOINT_CUES[Character.malfurion]]) {
    assertEquals(drawsRoots(other), false);
  }
});

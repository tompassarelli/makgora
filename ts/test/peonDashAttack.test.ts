import { expect, test } from "bun:test";
import { judgeDashAttack, ourDashAttack } from "../scripts/dashAttackShapes";
import { SELECTABLE_CHARACTERS } from "../src/game/roster/kits";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../src/game/sim/hitRegions";
import { authoredHurtboxes } from "../src/game/sim/hurtboxes";
import { authoredTuning } from "../src/game/sim/tuning";
import { PEON_MOVES } from "../src/game/fighters/peon/moves";

const dive = PEON_MOVES.normals[AttackStyle.dashAttack]!;
const reach = (character: Character): number => {
  const moves = authoredTuning(character).moves;
  const move = moves?.normals[moves.dashAttack];
  return move === undefined ? Number.NaN : Math.max(...move.regions.map((r) => r.hit.maxX));
};
const strongest = (frame: number) => {
  let best = emptyHitRegion();
  for (let index = 0; index < authoredHitRegionCount(AttackStyle.dashAttack, PEON_MOVES); index++) {
    const region = authoredHitRegion(emptyHitRegion(), Character.peon, AttackStyle.dashAttack, frame - 1, 0, index, PEON_MOVES);
    if (region.effect.damage > best.effect.damage) best = region;
  }
  return best;
};

test("Peon's trip-and-dive meets Melee's dash-attack rule, travel and end lag included [k4 reference docs/design/melee/attacks.md]", () => {
  const row = judgeDashAttack(ourDashAttack(Character.peon));
  expect(row.measures.filter((m) => !m.pass).map((m) => m.measure.label)).toEqual([]);
  const value = (label: string) => row.measures.find((m) => m.measure.label === label)?.value;
  expect(value("Travel to the last hitbox")).toBeGreaterThanOrEqual(20);
  expect(value("Ending lag after the last hitbox")).toBeGreaterThanOrEqual(20);
});

test("Peon's dive reaches into the middle half of the roster's dash attacks, well past the old chop's 79 [k3 measure docs/design/peasant.md]", () => {
  const all = SELECTABLE_CHARACTERS.map(reach).filter(Number.isFinite).sort((a, b) => a - b);
  const quartile = (q: number) => all[Math.round(q * (all.length - 1))]!;
  const peon = reach(Character.peon);
  expect(peon).toBeGreaterThanOrEqual(110);
  expect(peon).toBeGreaterThanOrEqual(quartile(0.25));
  expect(peon).toBeLessThanOrEqual(quartile(0.75));
});

test("the dive's first frames hit clean and launch; the slide after them is a weaker, flatter hit [k3 measure docs/design/peasant.md]", () => {
  const clean = strongest(8), late = strongest(13);
  expect(dive.startupFrames + 1).toBe(8);
  expect(clean.effect.damage).toBeGreaterThan(11);
  expect(late.effect.damage).toBeGreaterThan(0);
  expect(late.effect.damage).toBeLessThan(clean.effect.damage * 0.7);
  expect(clean.effect.launchZ).toBeGreaterThan(late.effect.launchZ);
  expect(strongest(16).effect.damage).toBe(0);
});

test("Peon lies prone through the slide: his hurtbox is flat and low, then he scrambles up [k3 measure docs/design/peasant.md]", () => {
  const poses = authoredHurtboxes(Character.peon, PEON_MOVES).attacks[AttackStyle.dashAttack]!;
  const at = (frame: number) => poses.find((p) => frame - 1 >= p.firstFrame && frame - 1 <= p.lastFrame)?.parts;
  for (const frame of [8, 12, 15, 18]) {
    const parts = at(frame)!;
    expect(Math.max(...parts.map((p) => Math.max(p.z1, p.z2) + p.radius))).toBeLessThan(40);
    expect(Math.max(...parts.map((p) => Math.max(p.x1, p.x2) - Math.min(p.x1, p.x2)))).toBeGreaterThan(60);
  }
  expect(at(36)).toBeUndefined();
});

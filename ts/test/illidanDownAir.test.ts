import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { readFightCore } from "../../references/melee-frame-data/fightcore";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { ILLIDAN_MOVES } from "../src/game/sim/originalMoves";
import { aerialAutoCancel, attackLandingLag } from "../src/game/sim/moves";

const REFERENCES = join(import.meta.dir, "../../references/melee-frame-data");

interface Phase { readonly start: number; readonly end: number; readonly hitboxes: readonly { readonly damage: number; readonly angle: number; readonly base_knockback: number; readonly knockback_growth: number }[] }

const falcoPhases = (): Phase[] => readFileSync(join(REFERENCES, "fightcore-phases.jsonl"), "utf8").trim().split("\n")
  .map((line) => JSON.parse(line) as Phase & { character: string; move: string })
  .filter((phase) => phase.character === "falco" && phase.move === "dair");

const falcoRow = () => {
  const row = readFightCore(join(import.meta.dir, "../..")).find((r) => r.character === "Falco" && r.move === "Down Air");
  if (row === undefined) throw new Error("fightcore.csv has no Falco Down Air row");
  return row;
};

const move = () => {
  const authored = ILLIDAN_MOVES.normals[AttackStyle.downAir];
  if (authored === undefined) throw new Error("Illidan has no authored down air");
  return authored;
};

test("Illidan's down air has Falco's frame data: first and last active frame, total frames, landing lag and auto-cancel window [k4 reference references/melee-frame-data/fightcore.csv]", () => {
  const row = falcoRow();
  const authored = move();
  expect(authored.startupFrames + 1).toBe(row.firstActive!);
  expect(authored.startupFrames + authored.activeFrames).toBe(row.lastActive!);
  expect(authored.totalFrames).toBe(row.totalFrames!);
  expect(row.lCancelledLandingLag).toBe(9);
  expect(attackLandingLag(AttackStyle.downAir, ILLIDAN_MOVES)).toBe(row.lCancelledLandingLag!);
  expect(aerialAutoCancel(Character.demonHunter, AttackStyle.downAir, ILLIDAN_MOVES)).toEqual(row.autocancel!);
});

test("Illidan's down air has Falco's clean and late hit: frames, damage, angle, base knockback and growth [k4 reference references/melee-frame-data/fightcore-phases.jsonl]", () => {
  const phases = falcoPhases();
  const regions = move().regions;
  expect(phases.length).toBe(2);
  expect(regions.length).toBe(phases.length);
  phases.forEach((phase, index) => {
    const region = regions[index]!;
    const hitbox = phase.hitboxes[0]!;
    const { effect } = region.hit;
    expect(region.firstFrame + 1).toBe(phase.start);
    expect(region.lastFrame + 1).toBe(phase.end);
    expect(effect.damage).toBe(hitbox.damage);
    expect(effect.base).toBe(hitbox.base_knockback);
    expect(effect.growth).toBe(hitbox.knockback_growth);
    const degrees = (Math.atan2(effect.launchZ, effect.launchX) * 180 / Math.PI + 360) % 360;
    expect(degrees).toBeCloseTo(hitbox.angle, 3);
  });
});

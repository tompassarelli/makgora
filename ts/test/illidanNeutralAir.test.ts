import { expect, test } from "bun:test";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../src/game/sim/hitRegions";
import { aerialAutoCancel, attackDurationFramesForGrounding, attackLandingLag } from "../src/game/sim/moves";
import { ILLIDAN_MOVES } from "../src/game/sim/originalMoves";

const STYLE = AttackStyle.neutralAir;
const FIRST_ACTIVE_INDEX = 3;
const ACTIVE_FRAMES = 28;
const CLEAN_FRAMES = 4;
const FOOT_REACH = 100.0;

const liveRegions = (frame: number) => {
  const out = emptyHitRegion();
  const live = [];
  for (let index = 0; index < authoredHitRegionCount(STYLE, ILLIDAN_MOVES); index++) {
    authoredHitRegion(out, Character.demonHunter, STYLE, frame, 0, index, ILLIDAN_MOVES);
    if (out.window > 0) live.push({ effect: { ...out.effect }, strike: out.strike });
  }
  return live;
};

test("Illidan's neutral air keeps its shared timing: first active frame, 28 active frames, 41 in all, landing lag 5 and the shared auto-cancel window [k3 measure docs/design/melee-parity.md]", () => {
  const move = ILLIDAN_MOVES.normals[STYLE];
  expect(move?.startupFrames).toBe(FIRST_ACTIVE_INDEX);
  expect(move?.activeFrames).toBe(ACTIVE_FRAMES);
  expect(attackDurationFramesForGrounding(STYLE, false, ILLIDAN_MOVES)).toBe(41);
  expect(attackLandingLag(STYLE, ILLIDAN_MOVES)).toBe(5);
  expect(aerialAutoCancel(Character.demonHunter, STYLE, ILLIDAN_MOVES)).toEqual({ before: 4, from: 40 });
});

test("Illidan's neutral air has a body hit region and a leg hit region live on every active frame, none outside them [k3 measure docs/disjoint-legibility.md]", () => {
  for (let frame = 0; frame < FIRST_ACTIVE_INDEX; frame++) expect(liveRegions(frame).length).toBe(0);
  for (let frame = FIRST_ACTIVE_INDEX; frame < FIRST_ACTIVE_INDEX + ACTIVE_FRAMES; frame++) {
    const live = liveRegions(frame);
    expect(live.length).toBe(2);
    const reach = Math.max(...live.map(({ strike }) => Math.max(strike?.x1 ?? 0, strike?.x2 ?? 0) + (strike?.radius ?? 0)));
    expect(reach).toBeGreaterThanOrEqual(FOOT_REACH);
    expect(live.some(({ strike }) => strike !== undefined && Math.min(strike.x1, strike.x2) < 0)).toBe(true);
  }
  expect(liveRegions(FIRST_ACTIVE_INDEX + ACTIVE_FRAMES).length).toBe(0);
});

test("Illidan's neutral air hits for the same clean then late effect from the leg as from the body: 7% with growth 95 and base 16 for the first four frames, then 70% of that [k3 measure docs/design/melee-parity.md]", () => {
  for (let frame = FIRST_ACTIVE_INDEX; frame < FIRST_ACTIVE_INDEX + ACTIVE_FRAMES; frame++) {
    const [leg, body] = liveRegions(frame);
    expect(leg?.effect).toEqual(body?.effect);
    const clean = frame < FIRST_ACTIVE_INDEX + CLEAN_FRAMES;
    expect(leg?.effect.strong).toBe(clean);
    expect(leg?.effect.damage).toBeCloseTo(clean ? 7.0 : 4.9, 5);
    expect(leg?.effect.growth).toBeCloseTo(clean ? 95.0 : 80.75, 5);
    expect(leg?.effect.base).toBeCloseTo(clean ? 16.0 : 13.6, 5);
  }
});

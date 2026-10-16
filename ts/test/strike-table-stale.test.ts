import { expect, test } from "bun:test";
import { AttackStyle } from "../src/game/sim/codes";
import { HERO_ROSTER } from "../src/game/sim/heroes/registry";
import { attackPose, clipFor, ownAttackClip } from "../src/game/presentation/fighterClips";
import { HERO_STRIKE_MOMENTS } from "../src/game/presentation/heroStrikeMomentInfo";
import { type StrikeMoment, staleStrikeFighters } from "../scripts/wisp/strikeMoments";

const ENDS: Readonly<Record<number, number>> = { 59: 0.733, 65: 0.233, 60: 0.767, 75: 0.733 };
const moment = (character: number, style: number, seconds: number, clip = 59): StrikeMoment => ({ character, style, clip, seconds, end: ENDS[clip] ?? 0.5 });
const committed = { 5: { 3: { clip: 59, seconds: 0.133, end: 0.733 }, 0: { clip: 65, seconds: 0.033, end: 0.233 } }, 6: { 3: { clip: 60, seconds: 0.35, end: 0.767 } } };

test("a fighter whose measured strike differs from its committed row is stale, and one that matches is not [k2 property]", () => {
  const measured = [moment(5, 3, 0.167), moment(5, 0, 0.033, 65), moment(6, 3, 0.35, 60)];
  expect(staleStrikeFighters(measured, committed, [5, 6])).toEqual([5]);
  expect(staleStrikeFighters([moment(5, 3, 0.133), moment(5, 0, 0.033, 65)], committed, [5])).toEqual([]);
});

test("a committed row bound to another clip than the model now measures is stale [k2 property]", () => {
  expect(staleStrikeFighters([moment(5, 3, 0.133, 75), moment(5, 0, 0.033, 65)], committed, [5])).toEqual([5]);
});

test("a fighter with no committed row, or a row the model no longer measures, is stale [k2 property]", () => {
  expect(staleStrikeFighters([moment(7, 3, 0.2)], committed, [7])).toEqual([7]);
  expect(staleStrikeFighters([moment(5, 0, 0.033, 65)], committed, [5])).toEqual([5]);
});

test("a sub-millisecond difference is the same strike [k2 property]", () => {
  expect(staleStrikeFighters([moment(5, 3, 0.1334), moment(5, 0, 0.033, 65)], committed, [5])).toEqual([]);
});

test("every roster fighter has a strike row, bound to its current clip, for each swing the table can measure [k2 property]", () => {
  for (const hero of HERO_ROSTER) {
    const rows = HERO_STRIKE_MOMENTS[hero.character];
    expect(rows, `${hero.character} has strike rows`).toBeDefined();
    for (const style of Object.values(AttackStyle)) {
      const move = hero.moves.normals[style];
      const pose = attackPose(style);
      const clip = ownAttackClip(hero.character, style) ?? (pose === undefined ? undefined : clipFor(hero.character, pose));
      if (move === undefined || move.regions[0] === undefined || style === AttackStyle.grab || clip === undefined) continue;
      expect(rows?.[style]?.clip, `${hero.character} style ${style}`).toBe(clip.index);
    }
  }
});

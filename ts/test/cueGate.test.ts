import { expect, test } from "bun:test";
import { judgeUse, projectileUse, type ModelFacts } from "../scripts/wisp/effectVisibility";
import { Character } from "../src/game/sim/codes";
import { projectileModelScale } from "../src/game/presentation/projectilePose";
import { FLAME_STRIKE_BURST } from "../src/game/fighters/kaelthas/specials";

const birthOnly: ModelFacts = {
  sequences: [{ name: "Birth", start: 0, end: 2000, looping: false, rarity: 0 }, { name: "Stand", start: 3000, end: 4000, looping: true, rarity: 0 }],
  particles: 0, legacyParticles: false, emitters: [], ribbons: [],
  geosets: [{ faces: true, supported: true, invalid: false, area: true, flat: false, alpha: { line: 0, global: false, keys: [[3000, 0]] }, layers: [{ alpha: { line: 1, global: false, keys: [[0, 0], [900, 0], [1000, 1], [2000, 1]] }, texture: true }] }],
};

test("a fixed-radius projectile is judged at its radius over model radius, and a column that draws only in birth reads only while its model animation holds birth [k2 property]", () => {
  const pillar = projectileUse(Character.kaelthas, "fixture", "pillar", FLAME_STRIKE_BURST);
  expect(pillar?.scale).toBe(projectileModelScale(FLAME_STRIKE_BURST.radius, FLAME_STRIKE_BURST));
  expect(pillar === undefined ? undefined : judgeUse(pillar, birthOnly).status).toBe("visible");
  const { modelAnimation: _held, ...standing } = FLAME_STRIKE_BURST;
  const stood = projectileUse(Character.kaelthas, "fixture", "pillar", standing);
  expect(stood === undefined ? undefined : judgeUse(stood, birthOnly).status).toBe("invisible");
});

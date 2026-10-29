import { imod } from "wisp/src/sim/intMath";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { createImpactEvents } from "./impactEvents";
import { IMPACT_SCREEN_KO, IMPACT_STAR_KO, IMPACTS_PER_KIND, KO_STAR_FLIGHT_FRAMES, createImpactState, emitImpacts, projectKo, projectImpact, topKoKind } from "./impactState";
import { presentStarKoTwinkle } from "./hitPresentation";

const SEEDS = 1000;

test("Over 1,000 seeded top KOs about 7 in 8 are Star KOs and about 1 in 8 Screen KOs, and the choice repeats for the same frame, slot and character [k3 measure docs/design/melee/hit-effects.md]", () => {
  let screen = 0;
  for (let seed = 0; seed < SEEDS; seed++) {
    const kind = topKoKind(seed * 7 + 3, imod(seed, 4), imod(seed, 11));
    assertEquals(topKoKind(seed * 7 + 3, imod(seed, 4), imod(seed, 11)), kind);
    if (kind === IMPACT_SCREEN_KO) screen++;
    else assertEquals(kind, IMPACT_STAR_KO);
  }
  assertTrue(screen >= 100 && screen <= 150);
});

test("A top KO spawns the kind topKoKind chose, in the slot's owner and character [k1 scenario]", () => {
  for (let frame = 0; frame < 40; frame++) {
    const state = createImpactState();
    const events = { ...createImpactEvents(), koDirectionZ: 1.0, character: Character.peon, facing: 1 };
    emitImpacts(state, events, frame, 2);
    const kind = topKoKind(frame, 2, Character.peon);
    assertEquals(state.occupied[kind], 1);
    assertEquals(state.owner[kind * IMPACTS_PER_KIND], 2);
  }
});

test("A Star KO flight shrinks the fighter and carries it toward the screen centre, then hides it as the star glints [k1 scenario]", () => {
  const state = createImpactState();
  emitImpacts(state, { ...createImpactEvents(), koDirectionZ: 1.0, x: 400.0, z: 100.0, facing: -1 }, 0, 0);
  let frame = 0;
  while (topKoKind(frame, 0, 0) !== IMPACT_STAR_KO) frame++;
  const star = createImpactState();
  emitImpacts(star, { ...createImpactEvents(), koDirectionZ: 1.0, x: 400.0, z: 100.0, facing: -1 }, frame, 0);
  const slot = IMPACT_STAR_KO * IMPACTS_PER_KIND;
  const start = projectKo(star, slot);
  star.ages[slot] = KO_STAR_FLIGHT_FRAMES / 2;
  const middle = projectKo(star, slot);
  assertTrue(middle.scale < start.scale && middle.x < start.x && middle.x > 0.0);
  assertEquals(projectImpact(star, slot).visible, false);
  star.ages[slot] = KO_STAR_FLIGHT_FRAMES;
  assertEquals(projectKo(star, slot).visible, false);
  assertEquals(projectImpact(star, slot).visible, true);
});

test("The Star KO twinkle is a high-pitched Dispel Magic chime at the star's place on the KO sound class [k1 scenario]", () => {
  const heard: [string, number, number, number, number][] = [];
  presentStarKoTwinkle(10.0, 20.0, (sound, x, z, volume, pitch) => { heard.push([sound, x, z, volume, pitch]); });
  assertEquals(heard.length, 1);
  assertEquals(heard[0]?.[0], "DispelMagic");
  assertTrue((heard[0]?.[4] ?? 0) >= 1.5);
});

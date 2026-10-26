import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, HeroStatusGroup, HeroStatusKind, SpecialAction } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { applyHeroStatus } from "../sim/heroStatus";
import { PHOENIX_BURN_FRAMES, PHOENIX_STARTUP_FRAMES } from "../sim/heroes/kaelthasSpecials";
import { ROSTER_MANA } from "../sim/mana";
import type { Roster } from "../sim/roster";
import { becomeEgg } from "../sim/specials/engine";
import { duelPair, lift, stepDuel } from "../sim/testDuel";
import { controls } from "../sim/testWorld";
import { FULL_GLOW, meterGlowColor } from "./meterGlow";
import { specialCueState } from "./specialCues";

const SHOWN = "S", HIDDEN = "H";

function fullPair(character: Character, z = 0.0) {
  const pair = duelPair(createFighter(character, 0.0, 1), createFighter(Character.rifleman, -600.0, 1));
  if (z > 0.0) lift(pair.owner, z);
  return pair;
}

function rim(fighter: Readonly<Fighter>): string {
  const color = meterGlowColor(fighter, false);
  assertTrue(color === undefined || color === FULL_GLOW);
  return color === undefined ? HIDDEN : SHOWN;
}

function trace(world: Roster, owner: Fighter, first: ReturnType<typeof controls>, morphed: (fighter: Readonly<Fighter>) => boolean, limit = 400): { rim: string; morph: string } {
  let rims = "", morphs = "";
  for (let frame = 0; frame < limit; frame++) {
    owner.mana.points = ROSTER_MANA.max;
    rims += rim(owner);
    morphs += morphed(owner) ? HIDDEN : SHOWN;
    stepDuel(world, frame === 0 ? first : controls());
  }
  owner.mana.points = ROSTER_MANA.max;
  rims += rim(owner);
  morphs += morphed(owner) ? HIDDEN : SHOWN;
  return { rim: rims, morph: morphs };
}

function spans(frames: string): string {
  let out = "";
  for (let index = 0; index < frames.length; index++) if (index === 0 || frames.charAt(index) !== frames.charAt(index - 1)) out += frames.charAt(index);
  return out;
}

function assertHiddenThroughMorph(run: { rim: string; morph: string }): void {
  assertEquals(spans(run.morph), SHOWN + HIDDEN + SHOWN);
  assertEquals(run.rim, run.morph);
}

test("The meter rim hides on the first frame of every model-swapping state and returns on the first frame back in the normal model, at a full bar [k3 measure #499]", () => {
  const stag = fullPair(Character.malfurion);
  assertHiddenThroughMorph(trace(stag.world, stag.owner, controls({ specialPressed: true, specialX: 1 }), (f) => f.special.action === SpecialAction.heroSide && specialCueState(f).phase === "active"));

  const phoenix = fullPair(Character.kaelthas, 300.0);
  const flight = trace(phoenix.world, phoenix.owner, controls({ specialPressed: true, specialZ: 1, verticalDirection: 1 }), (f) => f.special.action === SpecialAction.heroUp && f.special.frame > PHOENIX_STARTUP_FRAMES && f.special.frame <= PHOENIX_STARTUP_FRAMES + PHOENIX_BURN_FRAMES);
  assertHiddenThroughMorph(flight);

  const egg = fullPair(Character.kaelthas, 300.0);
  stepDuel(egg.world, controls({ specialPressed: true, specialZ: 1, verticalDirection: 1 }));
  while (egg.owner.special.frame <= PHOENIX_STARTUP_FRAMES + 4) stepDuel(egg.world, controls());
  becomeEgg(egg.owner);
  const hatch = trace(egg.world, egg.owner, controls(), (f) => f.special.egg);
  assertEquals(spans(hatch.morph), HIDDEN + SHOWN);
  assertEquals(hatch.rim, hatch.morph);

  const frog = fullPair(Character.malfurion);
  const hexed = trace(frog.world, frog.owner, controls(), (f) => f.status.condition === HeroStatusKind.hex, 200);
  assertEquals(hexed.rim.indexOf(HIDDEN), -1);
  applyHeroStatus(frog.owner, { kind: HeroStatusKind.hex, frames: 110, group: HeroStatusGroup.silence, immunityFrames: 240 });
  const hex = trace(frog.world, frog.owner, controls(), (f) => f.status.condition === HeroStatusKind.hex, 200);
  assertEquals(spans(hex.morph), HIDDEN + SHOWN);
  assertEquals(hex.rim, hex.morph);
});

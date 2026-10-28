import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { type Controls, type Roster } from "./roster";
import { controls } from "./testWorld";
import { duelPair, lift, stepDuel } from "./testDuel";

const SLOTS = [
  { name: "neutral", press: { specialPressed: true } },
  { name: "side", press: { specialPressed: true, specialX: 1 } },
  { name: "up", press: { specialPressed: true, specialZ: 1 } },
  { name: "down", press: { specialPressed: true, specialZ: -1 } },
] as const;

const MOVEMENT_SPECIALS = [
  "rifleman up", "demonHunter side", "demonHunter up",
  "blademaster side", "blademaster up", "blademaster down", "mountainKing side", "mountainKing up", "warden side", "warden up",
  "lich up", "uther side", "uther up", "dreadlord side", "dreadlord up", "shadowHunter up",
  "pitLord side", "pitLord up", "lichKing up", "thrall up", "jaina up", "sylvanas up", "cairne side", "cairne up",
  "chen up", "peon up", "tinker up", "kaelthas up", "murloc side", "murloc up", "grom side", "grom up",
  "anubarak side", "anubarak up", "malfurion side", "malfurion up", "medivh side", "medivh up", "medivh down",
];
const AIR_ONLY_EXCEPTIONS = ["beastmaster up", "tinker side"];

const WALK_FRAMES = 12;
const WATCHED_FRAMES = 6;
const AIR_HEIGHT = 300.0;

interface Run { readonly world: Roster; readonly f: Fighter }

function standing(character: Character): Run {
  const { world, owner } = duelPair(createFighter(character, 0.0, 1), createFighter(Character.rifleman, -900.0, -1));
  for (let i = 0; i < 3; i++) stepDuel(world);
  owner.motion.x = 0.0;
  return { world, f: owner };
}

function airborne(character: Character): Run {
  const run = standing(character);
  lift(run.f, f32(run.f.motion.z + AIR_HEIGHT));
  run.f.motion.vx = run.f.tuning.physics.airSpeed;
  return run;
}

function speeds(run: Run, first: Readonly<Controls>): number[] {
  const out: number[] = [];
  stepDuel(run.world, first);
  for (let i = 0; i < WATCHED_FRAMES; i++) {
    out.push(run.f.motion.vx);
    stepDuel(run.world);
  }
  return out;
}

test("Every fighter's four specials stop horizontal movement when started walking on the ground and keep the air's own horizontal velocity when started airborne, movement specials excepted [k1 scenario]", () => {
  for (const [name, character] of Object.entries(Character)) {
    for (const slot of SLOTS) {
      const special = `${name} ${slot.name}`;
      const movement = MOVEMENT_SPECIALS.includes(special);
      if (!movement) {
        const ground = standing(character);
        for (let i = 0; i < WALK_FRAMES; i++) stepDuel(ground.world, controls({ direction: 1, walking: true }));
        assertTrue(ground.f.motion.grounded);
        assertGreaterThan(ground.f.motion.vx, 0.0);
        const vx = speeds(ground, controls(slot.press));
        assertTrue(ground.f.special.action !== SpecialAction.none);
        for (let frame = 0; frame < WATCHED_FRAMES; frame++) assertEquals(vx[frame], 0.0, `${special} ground horizontal speed on frame ${frame + 1}`);
      }
      if (movement || AIR_ONLY_EXCEPTIONS.includes(special)) continue;
      const air = airborne(character);
      const vx = speeds(air, controls(slot.press));
      assertTrue(air.f.special.action !== SpecialAction.none);
      const drift = speeds(airborne(character), controls());
      for (let frame = 0; frame < WATCHED_FRAMES; frame++) assertEquals(vx[frame], drift[frame], `${special} air horizontal speed on frame ${frame + 1}`);
    }
  }
});

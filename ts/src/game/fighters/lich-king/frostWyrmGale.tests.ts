import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character, SpecialAction } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { type Controls, copyControls, fighterAt } from "../../sim/roster";
import { controls } from "../../sim/testWorld";
import { GALE_BOOST_FRAMES, GALE_SPAWN_FRAME } from "./specials";

const RIDE_WATCH = 60;

interface Bout {
  readonly state: ReplayState;
  readonly king: Fighter;
  tick: number;
}

const side = (facing: number): Controls => controls({ specialPressed: true, specialHeld: true, specialX: facing });
const up = controls({ specialPressed: true, specialHeld: true, specialZ: 1, verticalDirection: 1 });

function bout(facing: number): Bout {
  const state = createReplaySnapshot();
  copyFighterState(fighterAt(state.world, 0), createFighter(Character.lichKing, 0.0, facing), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.warden, f32(facing * 900.0), -facing), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 13;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, king: fighterAt(state.world, 0), tick: 0 };
}

function step(b: Bout, first: Readonly<Controls> = controls()): void {
  b.tick++;
  copyControls(b.state.controls.inputs[0], first);
  copyControls(b.state.controls.inputs[1], controls());
  stepMatch(b.state.match, b.state.world, b.state.controls, b.tick);
}

interface Ride { readonly variant: number; readonly rise: number; readonly reach: number }

function ride(facing: number, galeLead: number | undefined): Ride {
  const b = bout(facing);
  step(b);
  if (galeLead !== undefined) {
    step(b, side(facing));
    for (let frame = 1; frame < galeLead; frame++) step(b);
  }
  const x = b.king.motion.x;
  const z = b.king.motion.z;
  const stick = controls({ ...up, direction: facing });
  step(b, stick);
  assertEquals(b.king.special.action, SpecialAction.heroUp);
  const variant = b.king.special.variant;
  let rise = 0.0;
  for (let frame = 0; frame < RIDE_WATCH; frame++) {
    step(b, controls({ specialHeld: true, direction: facing }));
    rise = Math.max(rise, f32(b.king.motion.z - z));
  }
  return { variant, rise, reach: f32(f32(b.king.motion.x - x) * facing) };
}

test("Frost Wyrm flies faster and farther when he calls it during the gale or within 60 frames of the gust rising, and plainly after that, in both facings [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const plain = ride(facing, undefined);
    assertEquals(plain.variant, 0);
    for (const lead of [34, GALE_SPAWN_FRAME + GALE_BOOST_FRAMES - 4]) {
      const boosted = ride(facing, lead);
      assertEquals(boosted.variant, 1);
      assertGreaterThan(boosted.rise, f32(plain.rise * f32(1.15)));
      assertGreaterThan(boosted.reach, f32(plain.reach * f32(1.15)));
    }
    assertEquals(ride(facing, GALE_SPAWN_FRAME + GALE_BOOST_FRAMES + 6).variant, 0);
  }
});

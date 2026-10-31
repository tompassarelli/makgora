import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { stepMatch } from "../../match/step";
import { chooseRecoveryInput } from "../../match/botRecovery";
import { useMatchSeed } from "../../match/botRandom";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { LedgeState } from "../../sim/codes";
import { copyControls, neutralControls } from "../../sim/roster";
import { mainDeckLeft, mainDeckZ } from "../../sim/stage";
import { SURF_CLIMB, SURF_CLIMB_IN_HEIGHTS, SURF_DRIFT, SURF_FLAME_JET_RATIO, SURF_HITS, SURF_LIFT, SURF_RIDE_FRAMES, SURF_RIDE_LENGTH, SURF_RISE } from "./surf";
import { type Duel, type Stick, duel, lift, step } from "./testDuel";

const AIR_HEIGHT = 400.0;
const WATCH = 80;
const HIGH_FOE = 90.0;
const DIAGONAL = f32(0.7071067690849304);
const UP: Stick = { x: 0, z: 1 };

const surfStep = (d: Duel, tick: number, stick: Stick): void => step(d, tick === 1 ? "down" : "hold", stick, UP);

const STICKS: readonly (readonly [string, Stick])[] = [
  ["none", { x: 0, z: 0 }], ["up", { x: 0, z: 1 }], ["down", { x: 0, z: -1 }], ["left", { x: -1, z: 0 }], ["right", { x: 1, z: 0 }],
  ["up and left", { x: -DIAGONAL, z: DIAGONAL }], ["up and right", { x: DIAGONAL, z: DIAGONAL }],
  ["down and left", { x: -DIAGONAL, z: -DIAGONAL }], ["down and right", { x: DIAGONAL, z: -DIAGONAL }],
];

interface Ridden { readonly dx: number; readonly dz: number; readonly helpless: boolean; readonly ledgeHang: boolean }

function ride(d: Duel, stick: Stick, ticks = WATCH): Ridden {
  const startX = d.caster.motion.x;
  const startZ = d.caster.motion.z;
  let endX = startX;
  let endZ = startZ;
  let helpless = false;
  for (let tick = 1; tick <= ticks; tick++) {
    surfStep(d, tick, stick);
    if (d.caster.special.frame > 0 && d.caster.special.frame <= SURF_RIDE_FRAMES.last + 1) {
      endX = d.caster.motion.x;
      endZ = d.caster.motion.z;
    }
    helpless ||= d.caster.special.fall;
  }
  return { dx: f32(endX - startX), dz: f32(endZ - startZ), helpless, ledgeHang: d.caster.ledge.state === LedgeState.hang };
}

const near = (actual: number, expected: number, slack: number, label: string): void => {
  assertEquals(Math.abs(actual - expected) <= slack, true, `${label}: ${actual} is not within ${slack} of ${expected}`);
};

test("Lava Surf steers by the stick in all eight directions and neutral, from the ground and the air, facing either way [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    for (const airborne of [false, true]) {
      for (const [label, stick] of STICKS) {
        const where = `${label}, facing ${facing}${airborne ? ", airborne" : ""}`;
        const d = duel(2000.0, facing);
        if (airborne) lift(d.caster, AIR_HEIGHT);
        const ridden = ride(d, stick);
        const run = f32(SURF_RISE + f32(stick.z * SURF_LIFT));
        near(ridden.dx, f32(stick.x * SURF_DRIFT * SURF_RIDE_LENGTH), 12.0, `${where} sideways`);
        if (airborne || run > 0.0) near(ridden.dz, f32(run * SURF_RIDE_LENGTH), 12.0, `${where} vertical`);
        else assertEquals(ridden.dz <= 0.0, true, `${where} from the floor does not climb, ${ridden.dz}`);
      }
    }
  }
});

function foeStrikes(foeAhead: number, foeHeight: number): { readonly damage: number; readonly hits: number; readonly ticks: string } {
  const d = duel(foeAhead, 1);
  const foeX = d.foe.motion.x;
  let hits = 0;
  let last = 0.0;
  let ticks = "";
  for (let tick = 1; tick <= 50; tick++) {
    lift(d.foe, foeHeight, foeX);
    surfStep(d, tick, { x: 0, z: 0 });
    if (d.foe.status.damage > last) {
      hits++;
      ticks += ` ${tick}:${d.foe.status.damage}`;
    }
    last = d.foe.status.damage;
  }
  return { damage: last, hits, ticks };
}

test("Lava Surf climbs 2.6 hero heights at most, 1.3 times Flame Jet's 2.0, in three hits for 8 damage [k3 measure docs/design/roster.md]", () => {
  assertEquals(SURF_HITS.length, 3);
  near(SURF_CLIMB_IN_HEIGHTS, 2.5, 0.125, "climb in heights");
  near(SURF_FLAME_JET_RATIO, 1.25, 0.125, "against Flame Jet");
  const d = duel(2000.0, 1);
  const up = ride(d, { x: 0, z: 1 });
  near(up.dz, SURF_CLIMB, 12.0, "full climb");
  assertGreaterThan(up.dz, 0.0);
  const struck = foeStrikes(40.0, HIGH_FOE);
  assertEquals(struck.hits, 3, `one hit per window, hits at${struck.ticks}`);
  near(struck.damage, 8.0, 0.5, `damage, hits at${struck.ticks}`);
});

test("Lava Surf leaves him helpless at the end, and the computer still reaches the ledge from 300 units out [k1 scenario]", () => {
  assertEquals(ride(duel(2000.0, 1), { x: 0, z: 1 }).helpless, true);
  const d = duel(2000.0, 1);
  const { caster, foe } = d;
  lift(caster, f32(mainDeckZ(0) - 40.0), f32(mainDeckLeft(0) - 300.0));
  caster.facing = 1;
  caster.jump.remaining = 0;
  useMatchSeed(0);
  const controls = neutralControls();
  let hung = false;
  let surfed = false;
  for (let tick = 1; tick <= 400 && !hung && !caster.motion.grounded; tick++) {
    copyControls(d.state.controls.inputs[0], controls);
    chooseRecoveryInput(caster, 0, tick, d.state.controls.inputs[0], foe);
    stepMatch(d.state.match, d.state.world, d.state.controls, tick);
    surfed ||= caster.special.fall;
    hung = caster.ledge.state === LedgeState.hang;
  }
  assertEquals(hung || caster.motion.grounded, true, `ends at ${caster.motion.x}, ${caster.motion.z}`);
  assertEquals(surfed, true, "recovered by riding the lava");
});

const ROLLBACK_END = 60;
function replayFrom(saveTick: number): { readonly expected: string; readonly replayed: string } {
  const run = duel(40.0);
  lift(run.foe, HIGH_FOE);
  const snapshot = createReplaySnapshot();
  const stick = (tick: number): Stick => ({ x: tick < 30 ? 1 : -1, z: 1 });
  const play = (from: number): void => {
    for (let tick = from; tick <= ROLLBACK_END; tick++) surfStep(run, tick, stick(tick));
  };
  for (let tick = 1; tick <= ROLLBACK_END; tick++) {
    if (tick === saveTick) copyReplayState(snapshot, run.state);
    surfStep(run, tick, stick(tick));
  }
  const expected = canonicalState(run.state);
  copyReplayState(run.state, snapshot);
  run.tick = saveTick - 1;
  play(saveTick);
  return { expected, replayed: canonicalState(run.state) };
}

test("A rollback replays Lava Surf from mid-ride and from the hits to the same state [k1 scenario]", () => {
  for (const saveTick of [8, 15, 26]) {
    const { expected, replayed } = replayFrom(saveTick);
    assertEquals(replayed, expected, `saved at tick ${saveTick}`);
  }
});

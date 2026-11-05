import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { type Controls, copyControls, fighterAt } from "../../sim/roster";
import { controls } from "../../sim/testWorld";

const AIR_HEIGHT = 700.0;
const LOW_HOVER = 40.0;
const MID_FOE = 300.0;

interface Bout {
  readonly state: ReplayState;
  readonly king: Fighter;
  readonly foe: Fighter;
  readonly facing: number;
  tick: number;
}

interface Setup {
  readonly facing: number;
  readonly foeAhead: number;
  readonly kingHeight?: number | undefined;
  readonly foeHover?: number | undefined;
}

const side = (facing: number): Controls => controls({ specialPressed: true, specialHeld: true, specialX: facing });

function bout(setup: Readonly<Setup>): Bout {
  const state = createReplaySnapshot();
  copyFighterState(fighterAt(state.world, 0), createFighter(Character.lichKing, 0.0, setup.facing), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.warden, f32(setup.facing * setup.foeAhead), -setup.facing), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 11;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, king: fighterAt(state.world, 0), foe: fighterAt(state.world, 1), facing: setup.facing, tick: 0 };
}

function hover(f: Fighter, z: number): void {
  f.motion.z = z;
  f.motion.vz = 0.0;
  f.motion.grounded = false;
  f.motion.surface = undefined;
}

function step(b: Bout, first: Readonly<Controls> = controls()): void {
  b.tick++;
  copyControls(b.state.controls.inputs[0], first);
  copyControls(b.state.controls.inputs[1], controls());
  stepMatch(b.state.match, b.state.world, b.state.controls, b.tick);
}

function hold(b: Bout, setup: Readonly<Setup>): void {
  if (setup.kingHeight !== undefined) hover(b.king, setup.kingHeight);
  if (setup.foeHover !== undefined && b.foe.status.damage === 0.0) hover(b.foe, f32(b.king.motion.z + setup.foeHover));
}

test("A rollback across the gale's spawn, its push and its hits replays to the live checksum [k1 scenario]", () => {
  const end = 72;
  for (const facing of [1, -1]) {
    for (const setup of [{ facing, foeAhead: MID_FOE, foeHover: LOW_HOVER }, { facing, foeAhead: MID_FOE, kingHeight: AIR_HEIGHT, foeHover: 0.0 }] as const) {
      for (const save of [10, 16, 24, 30, 40]) {
        const run = bout(setup);
        const snapshot = createReplaySnapshot();
        const script = (tick: number): Controls => tick === 2 ? side(facing) : controls();
        for (let tick = 1; tick <= end; tick++) {
          if (tick === save) copyReplayState(snapshot, run.state);
          hold(run, setup);
          step(run, script(tick));
        }
        assertGreaterThan(run.foe.status.damage, 0.0);
        const expected = canonicalState(run.state);
        copyReplayState(run.state, snapshot);
        run.tick = save - 1;
        for (let tick = save; tick <= end; tick++) {
          hold(run, setup);
          step(run, script(tick));
        }
        assertEquals(canonicalState(run.state), expected);
      }
    }
  }
});

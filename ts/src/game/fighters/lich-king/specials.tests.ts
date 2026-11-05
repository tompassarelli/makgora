import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { adaptInput } from "../../match/inputAdapter";
import { stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, HeroStatusKind } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { fighterAt } from "../../sim/roster";

type Press = "neutral" | "shield" | "none";

interface Duel {
  readonly state: ReplayState;
  readonly king: Fighter;
  readonly foe: Fighter;
  readonly facing: number;
  tick: number;
}

interface Setup {
  readonly facing: number;
  readonly foeAhead: number;
  readonly height?: number;
}

function duel(setup: Setup): Duel {
  const state = createReplaySnapshot();
  const king = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(king, createFighter(Character.lichKing, 0.0, setup.facing), 3);
  copyFighterState(foe, createFighter(Character.warden, f32(setup.facing * setup.foeAhead), -setup.facing), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 7;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const d: Duel = { state, king, foe, facing: setup.facing, tick: 0 };
  if (setup.height !== undefined) lift(d, setup.height);
  return d;
}

function lift(d: Duel, z: number): void {
  hover(d.king, z);
  hover(d.foe, z);
}

function hover(f: Fighter, z: number): void {
  f.motion.z = z;
  f.motion.vz = 0.0;
  f.motion.grounded = false;
  f.motion.surface = undefined;
}

function row(_d: Readonly<Duel>, press: Press): Parameters<typeof inputRow>[0] {
  switch (press) {
    case "neutral": return { held: maskOf(Action.special), pressed: maskOf(Action.special) };
    case "shield": return { held: maskOf(Action.rightTrigger), pressed: maskOf(Action.rightTrigger) };
    default: return {};
  }
}

function step(d: Duel, own: Press, other: Press = "none"): void {
  d.tick++;
  const first = inputRow(row(d, own));
  const second = inputRow(row(d, other));
  if (first === undefined || second === undefined) throw new Error("the Lich King's input row");
  adaptInput(first, d.king, d.tick, d.state.controls.inputs[0], d.state.controls.commands[0]);
  adaptInput(second, d.foe, d.tick, d.state.controls.inputs[1], d.state.controls.commands[1]);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}

const pulling = (f: Readonly<Fighter>): boolean => f.status.condition === HeroStatusKind.gripped && f.status.pullBy !== undefined;

test("A rollback across Death Grip's coil, pull and stun replays to the live checksum [k1 scenario]", () => {
  const end = 70;
  const script = (tick: number): Press => tick === 2 ? "neutral" : "none";
  for (const facing of [1, -1]) {
    for (const save of [10, 20, 26, 30, 36, 44]) {
      const run = duel({ facing, foeAhead: 300.0 });
      const snapshot = createReplaySnapshot();
      let shown = false;
      for (let tick = 1; tick <= end; tick++) {
        if (tick === save) copyReplayState(snapshot, run.state);
        step(run, script(tick));
        shown ||= pulling(run.foe);
      }
      assertTrue(shown);
      const expected = canonicalState(run.state);
      copyReplayState(run.state, snapshot);
      run.tick = save - 1;
      for (let tick = save; tick <= end; tick++) step(run, script(tick));
      assertEquals(canonicalState(run.state), expected);
    }
  }
});

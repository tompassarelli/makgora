import { expect, test } from "bun:test";
import { NEUTRAL_INPUT, createStandaloneSession } from "../scripts/wisp/standalone";
import { RESULTS_CAMERA_FRAMES } from "../src/game/presentation/arenaCamera";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { fighterAt, isActive } from "../src/game/sim/roster";
import { mainDeckRight } from "../src/game/sim/stage";
import { TOP_KO_MINIMUM_UPWARD_KNOCKBACK } from "../src/game/sim/knockback";
import { setWorldMotionValue } from "../src/game/sim/motion";
import { Phase, START_HOLD_FRAMES } from "../src/game/lobby/lobbyState";
import { shell } from "../src/host/loop/state";

type Ending = "left" | "right" | "top" | "bottom" | "time";
interface Shot { readonly x: number; readonly z: number; readonly distance: number; readonly tangent: number }

const FLIGHT_FRAMES = 600;
const FLIGHT_STEP = 24.0;
const AXES = ["x", "z", "distance", "tangent"] as const;

function launch(ending: Ending, loser: number): void {
  const state = shell();
  if (state.rollback !== undefined) state.rollback.active = false;
  if (ending === "time") {
    state.game.remainingFrames = Math.min(state.game.remainingFrames, 2);
    return;
  }
  const fighter = fighterAt(state.world, loser);
  const { motion } = fighter;
  fighter.status.stocks = 1;
  motion.grounded = false;
  fighter.launch.knockbackZ = TOP_KO_MINIMUM_UPWARD_KNOCKBACK + 10;
  const offDeck = Math.max(motion.x, mainDeckRight(state.game.stageChoice) + FLIGHT_STEP * 6.0);
  const x = ending === "left" ? motion.x - FLIGHT_STEP : ending === "right" ? motion.x + FLIGHT_STEP : ending === "bottom" ? offDeck : motion.x;
  const z = ending === "top" ? Math.max(motion.z, 200.0) + FLIGHT_STEP : ending === "bottom" ? motion.z - FLIGHT_STEP : Math.max(motion.z, 200.0);
  setWorldMotionValue(motion.meleeX, x);
  setWorldMotionValue(motion.meleeZ, z);
  motion.x = motion.meleeX.published;
  motion.z = motion.meleeZ.published;
}

async function finalShots(ending: Ending): Promise<{ readonly shots: readonly Shot[]; readonly ko: { readonly x: number; readonly z: number } }> {
  const session = await createStandaloneSession({ start: "results" });
  const read = <T>(view: () => T): T => {
    let result: T | undefined;
    session.client.run(() => { result = view(); });
    if (result === undefined) throw new Error("standalone state missing");
    return result;
  };
  const shot = (): Shot => read(() => { const { x, z, distance, tangent } = shell().camera; return { x, z, distance, tangent }; });
  const playing = (): boolean => read(() => shell().game.phase === Phase.match);
  try {
    for (let frame = 0; frame < START_HOLD_FRAMES + 10; frame++) session.step(NEUTRAL_INPUT);
    const loser = read(() => PARTICIPANT_SLOTS.find(slot => slot !== 0 && isActive(shell().world, slot)) ?? -1);
    if (loser < 0) throw new Error("quick match has no opponent");
    let last = shot();
    let ko = { x: 0.0, z: 0.0 };
    for (let frame = 0; frame < FLIGHT_FRAMES && playing(); frame++) {
      last = shot();
      session.client.run(() => launch(ending, loser));
      ko = read(() => { const { x, z } = fighterAt(shell().world, loser).motion; return { x, z }; });
      session.step(NEUTRAL_INPUT);
    }
    expect(playing()).toBe(false);
    if (ending !== "time") expect(read(() => ({ winner: shell().game.winner, out: fighterAt(shell().world, loser).status.out }))).toEqual({ winner: 0, out: true });
    const shots: Shot[] = [last];
    for (let frame = 0; frame <= RESULTS_CAMERA_FRAMES + 10; frame++) {
      shots.push(shot());
      session.step(NEUTRAL_INPUT);
    }
    return { shots, ko };
  } finally {
    session.close();
  }
}

for (const ending of ["left", "right", "top", "bottom", "time"] as const) {
  test(`from the ${ending === "time" ? "TIME! call" : `final KO off the ${ending}`} the camera only closes on the victory view [k1 scenario]`, async () => {
    const { shots, ko } = await finalShots(ending);
    const goal = shots[shots.length - 1];
    for (let index = 1; index < shots.length; index++) {
      const before = shots[index - 1], after = shots[index];
      for (const axis of AXES) expect(Math.abs(after[axis] - goal[axis])).toBeLessThanOrEqual(Math.abs(before[axis] - goal[axis]) + 1e-6);
      if (ending !== "time") expect(Math.hypot(after.x - ko.x, after.z - ko.z)).toBeGreaterThanOrEqual(Math.min(Math.hypot(before.x - ko.x, before.z - ko.z), Math.hypot(goal.x - ko.x, goal.z - ko.z)) - 1e-6);
    }
    expect(shots[RESULTS_CAMERA_FRAMES + 1]).toEqual(goal);
  }, 60_000);
}

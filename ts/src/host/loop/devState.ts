import { copyReplayState } from "../../game/replay/snapshot";
import { type ShellState, keepShellMomentEnd } from "./state";
import { endReplaySegment } from "./replays";

export function prepareDevState(s: ShellState): void {
  const rollback = s.rollback;
  if (rollback !== undefined && rollback.active) {
    const next = s.runtime.simulationFrame + 1;
    if (!rollback.playback.rebase(rollback.schedule, rollback.epoch, next)) throw new Error("dev: cannot rewind prediction");
  }
  keepShellMomentEnd(s);
  endReplaySegment(s);
}

export function commitDevState(s: ShellState): void {
  const rollback = s.rollback;
  if (rollback === undefined || !rollback.active) return;
  const state = { world: s.world, match: s.game, controls: s.controls, runtime: s.runtime };
  const predicted = rollback.speculative;
  copyReplayState({ world: predicted.world, match: predicted.game, controls: predicted.controls, runtime: predicted.runtime }, state);
  if (s.runtime.simulationFrame === 0) copyReplayState(rollback.seed, state);
}

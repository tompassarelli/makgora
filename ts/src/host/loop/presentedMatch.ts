import type { PacingAndPresentation } from "../../game/match/pacingAndPresentation";
import { type MatchState, Phase } from "../../game/lobby/lobbyState";
import type { Roster } from "../../game/sim/roster";
import { type ShellState, activeRollback } from "./state";

export interface PresentedMatch {
  readonly game: MatchState;
  readonly world: Roster;
  readonly runtime: PacingAndPresentation;
  readonly playing: boolean;
}


type Presented = { -readonly [K in keyof PresentedMatch]: PresentedMatch[K] };

// Preallocated: every Lua callback asks for it several times, and each caller reads it before the next call.
let presented: Presented | undefined;

function present(game: MatchState, world: Roster, runtime: PacingAndPresentation, playing: boolean): PresentedMatch {
  if (presented === undefined) return presented = { game, world, runtime, playing };
  presented.game = game;
  presented.world = world;
  presented.runtime = runtime;
  presented.playing = playing;
  return presented;
}

export function presentedMatch(s: ShellState): PresentedMatch {
  const rollback = activeRollback(s);
  const confirmedPlaying = s.game.phase === Phase.match;
  if (s.build.presentation === "pool-predicted" && rollback !== undefined && confirmedPlaying) {
    const { speculative } = rollback;
    return present(speculative.game, speculative.world, speculative.runtime, speculative.game.phase === Phase.match);
  }
  return present(s.game, s.world, s.runtime, confirmedPlaying);
}


export function presentedFrame(s: ShellState): number {
  return presentedMatch(s).runtime.simulationFrame;
}

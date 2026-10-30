


import type { InputRow } from "../input/inputRow";
import { REPAIR_SCOPED_COST } from "../replay/history";
import { REPLAY_HISTORY_CAPACITY } from "../replay/limits";
import { floorDiv } from "wisp/src/sim/intMath";
import type { FrameControls } from "../match/controls";
import type { PacingAndPresentation } from "../match/pacingAndPresentation";
import type { MatchFrameInput } from "../match/frameInput";
import type { MatchState } from "../lobby/lobbyState";
import type { ReplayState } from "../replay/snapshot";
import { type InputSchedule } from "../netcode/inputSchedule";
import type { Roster } from "../sim/roster";


type Reconciliation = "unchanged" | "rejected" | { readonly replayedFrom: number };


type SpeculativeFrameObserver = (frame: number, local: Readonly<InputRow>) => void;


export interface SpeculativeMatch {
  readonly world: Roster;
  readonly game: MatchState;
  readonly controls: FrameControls;
  readonly runtime: PacingAndPresentation;
}

export interface RollbackPlayback {

  beginEpoch(epoch: number, window: number): boolean;




  reconcile(schedule: InputSchedule, epoch: number, localPlayer: number, match: SpeculativeMatch): Reconciliation;






  repair(epoch: number, match: SpeculativeMatch, budget: number, cost?: number): number | "rejected";

  pendingRepair(epoch: number): number | undefined;




  catchUp(schedule: InputSchedule, epoch: number, localPlayer: number, match: SpeculativeMatch, budget: number, stopBefore: number | undefined, executed: SpeculativeFrameObserver): boolean;





  confirmedState(epoch: number, frame: number, row: Readonly<MatchFrameInput>): Readonly<ReplayState> | undefined;





  rewind(schedule: InputSchedule, epoch: number, frame: number, match: SpeculativeMatch): boolean;

  rebase(schedule: InputSchedule, epoch: number, frame: number): boolean;

  visitWorlds(visit: (world: Roster) => void): void;

  repeatedComputerDecisions(): number;

  rerunComputerDecisions(): number;
}










export const CATCH_UP_FRAMES = 6;









// A callback's own frames cost about two units per fighter, so its repair keeps the rest: two whole four-fighter frames at about 2.5 ms each in Lua32 (#168).





const REPAIR_HEADROOM = 16;








export function repairBudget(speculative: number, depth: number, whole: number): { readonly frames: number; readonly cost: number } {
  const cost = REPAIR_HEADROOM - 2 * whole;
  const steps = floorDiv(cost, REPAIR_SCOPED_COST);
  if (depth <= REPLAY_HISTORY_CAPACITY / 2) return { frames: steps, cost };
  return { frames: Math.max(steps, speculative + 1), cost: Math.max(cost, (speculative + 1) * whole) };
}






const KEYBOARD_CONFIRMED = 2;

const PACED_CONFIRMABLE = 2;

// Confirmed frames make natives every client must call in the same callback, so nothing local may change this.
export const confirmedBudget = (confirmable: number, journal: boolean): number =>
  confirmable <= PACED_CONFIRMABLE ? 1 : journal ? (confirmable > 2 * CATCH_UP_FRAMES ? CATCH_UP_FRAMES : 3) : KEYBOARD_CONFIRMED;






export const speculativeBudget = (journal: boolean): number => (journal ? CATCH_UP_FRAMES : 1);

const KEYBOARD_CATCH_UP_MARGIN = 4;

const KEYBOARD_CATCH_UP_CONFIRMED = 3;

export const keyboardCatchesUp = (frame: number, due: number, window: number, remoteThrough: number, confirmed: number, repaired: number): boolean =>
  frame <= due && confirmed <= KEYBOARD_CATCH_UP_CONFIRMED && repaired === 0 && window - (frame - remoteThrough) >= KEYBOARD_CATCH_UP_MARGIN;

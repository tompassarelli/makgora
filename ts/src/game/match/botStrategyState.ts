import type { Direction } from "../input/inputRow";
import type { AttackStyle } from "../sim/codes";
import type { HabitChoice } from "./botHabits";
import type { MotionCast } from "./botMotionCast";

export interface BotStrategy extends MotionCast {
  // Lua arrays keep their peak capacity, so snapshots share each history instead of copying it; replace it, never mutate it.
  history: readonly number[];
  observedFrame: number;
  opponent: number;
  lastChoice: HabitChoice;
  lastContext: number;
  lastSerial: number;
  events: number;
  readActive: boolean;
  readChoice: HabitChoice;
  readContext: number;
  readExpectedFrame: number;
  readExpires: number;
  readConfidence: number;
  readActed: boolean;
  readActionFrame: number;
  readActionSerial: number;
  readActionStyle: number;
  readActionFacing: Direction;
  lastOption: number;
  burnHurt: boolean;
  burnStyle: AttackStyle | -1;
  burnCharacter: number;
  burnFrame: number;
  burnCount: number;
  burnGap: number;
  blockFrame: number;

  readonly recentOptions: number[];
}

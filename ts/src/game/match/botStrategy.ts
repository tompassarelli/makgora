

import { at } from "wisp/src/runtime/lookup";
import { floorDiv } from "wisp/src/sim/intMath";
import { f32 } from "wisp/src/sim/f32";
import { type AttackBuffer, queueAttack } from "../input/attackBuffer";
import type { Direction } from "../input/inputRow";
import { AttackStyle, DownState, LedgeState, SpecialAction } from "../sim/codes";
import { canAttack } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { attackStartupFrames } from "../sim/moves";
import type { Controls } from "../sim/roster";
import { VARIETY_STARTS, moveReachAhead, moveReaches } from "./botMoves";
import { botChance } from "./botRandom";
import { steerOnGround, slideStaysOnDeck } from "./botFooting";
import type { CpuDecisionPolicy } from "./cpuDecisionPolicy";
import { HABIT_FIELDS, HabitChoice, habitContext } from "./botHabits";
import { gameplanOf } from "./botGameplan";
import { heroStanceFits, heroStanceSlot, pressHeroStance } from "./botHeroKit";

const HISTORY_LIMIT = 128;
export const BURN_MEMORY_FRAMES = 150;
// Only a move that hits twice running is kept clear of (#412): after one hit the computer plays on, so a full ultimate meter still goes to its ultimate (#382).
export const BURN_REPEATS = 2;
const READ_CHOICES = [HabitChoice.attack, HabitChoice.shield, HabitChoice.jump, HabitChoice.retreat, HabitChoice.approach, HabitChoice.landing, HabitChoice.ledge] as const;

const retained: number[] = [];
const readCounts = [0, 0, 0, 0, 0, 0, 0, 0];
const readIntervals = [0, 0, 0, 0, 0, 0, 0, 0];
const readTimed = [0, 0, 0, 0, 0, 0, 0, 0];
const readLatest = [0, 0, 0, 0, 0, 0, 0, 0];

interface SavedBotHabit {
  readonly frame: number;
  readonly context: number;
  readonly choice: number;
  readonly interval: number;
}

interface SavedBotRead {
  readonly choice: HabitChoice;
  readonly context: number;
  readonly expectedFrame: number;
  readonly expires: number;
  readonly confidence: number;
  acted: boolean;
  actionFrame: number;
  actionSerial: number;
  actionStyle: number;
  actionFacing: Direction;
}

export interface BotStrategy {
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
  motionSlot: number;
  motionVariant: number;
  motionStep: number;
  motionSide: number;
  motionFrame: number;

  readonly recentOptions: number[];
}

const NO_HABITS: readonly number[] = [];

const noRecentOptions = (): number[] => Array.from({ length: 2 * VARIETY_STARTS }, () => -1);

export function createBotStrategy(): BotStrategy {
  return { history: NO_HABITS, observedFrame: -1, opponent: -1, lastChoice: HabitChoice.none, lastContext: 0, lastSerial: -1, events: 0, readActive: false, readChoice: HabitChoice.none, readContext: 0, readExpectedFrame: 0, readExpires: 0, readConfidence: 0, readActed: false, readActionFrame: -1, readActionSerial: -1, readActionStyle: -1, readActionFacing: 0, lastOption: -1, burnHurt: false, burnStyle: -1, burnCharacter: -1, burnFrame: -1, burnCount: 0, burnGap: 0, blockFrame: -1, motionSlot: -1, motionVariant: 0, motionStep: 0, motionSide: 0, motionFrame: -1, recentOptions: noRecentOptions() };
}

export type SavedBotStrategy = Pick<BotStrategy, "observedFrame" | "opponent" | "lastChoice" | "lastContext" | "lastSerial" | "events" | "lastOption" | "recentOptions" | "burnHurt" | "burnStyle" | "burnCharacter" | "burnFrame" | "burnCount" | "burnGap" | "blockFrame" | "motionSlot" | "motionVariant" | "motionStep" | "motionSide" | "motionFrame"> & {
  readonly history: readonly SavedBotHabit[];
  readonly read: SavedBotRead | undefined;
};


export function savedBotStrategy(state: Readonly<BotStrategy>): SavedBotStrategy {
  const history: SavedBotHabit[] = [];
  for (let index = 0; index < state.history.length; index += HABIT_FIELDS) {
    history.push({ frame: at(state.history, index), context: at(state.history, index + 1), choice: at(state.history, index + 2), interval: at(state.history, index + 3) });
  }
  const read = state.readActive ? {
    choice: state.readChoice,
    context: state.readContext,
    expectedFrame: state.readExpectedFrame,
    expires: state.readExpires,
    confidence: state.readConfidence,
    acted: state.readActed,
    actionFrame: state.readActionFrame,
    actionSerial: state.readActionSerial,
    actionStyle: state.readActionStyle,
    actionFacing: state.readActionFacing,
  } : undefined;
  return { history, observedFrame: state.observedFrame, opponent: state.opponent, lastChoice: state.lastChoice, lastContext: state.lastContext, lastSerial: state.lastSerial, events: state.events, read, lastOption: state.lastOption, burnHurt: state.burnHurt, burnStyle: state.burnStyle, burnCharacter: state.burnCharacter, burnFrame: state.burnFrame, burnCount: state.burnCount, burnGap: state.burnGap, blockFrame: state.blockFrame, motionSlot: state.motionSlot, motionVariant: state.motionVariant, motionStep: state.motionStep, motionSide: state.motionSide, motionFrame: state.motionFrame, recentOptions: [...state.recentOptions] };
}

export function restoredBotStrategy(saved: Readonly<SavedBotStrategy>): BotStrategy {
  const state = createBotStrategy();
  const history: number[] = [];
  for (const habit of saved.history) history.push(habit.frame, habit.context, habit.choice, habit.interval);
  state.history = history;
  state.observedFrame = saved.observedFrame;
  state.opponent = saved.opponent;
  state.lastChoice = saved.lastChoice;
  state.lastContext = saved.lastContext;
  state.lastSerial = saved.lastSerial;
  state.events = saved.events;
  state.lastOption = saved.lastOption;
  state.burnHurt = saved.burnHurt;
  state.burnStyle = saved.burnStyle;
  state.burnCharacter = saved.burnCharacter;
  state.burnFrame = saved.burnFrame;
  state.burnCount = saved.burnCount;
  state.burnGap = saved.burnGap;
  state.blockFrame = saved.blockFrame;
  state.motionSlot = saved.motionSlot;
  state.motionVariant = saved.motionVariant;
  state.motionStep = saved.motionStep;
  state.motionSide = saved.motionSide;
  state.motionFrame = saved.motionFrame;
  for (let index = 0; index < state.recentOptions.length; index++) state.recentOptions[index] = at(saved.recentOptions, index);
  if (saved.read !== undefined) {
    state.readActive = true;
    state.readChoice = saved.read.choice;
    state.readContext = saved.read.context;
    state.readExpectedFrame = saved.read.expectedFrame;
    state.readExpires = saved.read.expires;
    state.readConfidence = saved.read.confidence;
    state.readActed = saved.read.acted;
    state.readActionFrame = saved.read.actionFrame;
    state.readActionSerial = saved.read.actionSerial;
    state.readActionStyle = saved.read.actionStyle;
    state.readActionFacing = saved.read.actionFacing;
  }
  return state;
}

export function copyBotStrategy(target: BotStrategy, source: Readonly<BotStrategy>): void {
  target.history = source.history;
  target.observedFrame = source.observedFrame;
  target.opponent = source.opponent;
  target.lastChoice = source.lastChoice;
  target.lastContext = source.lastContext;
  target.lastSerial = source.lastSerial;
  target.events = source.events;
  target.lastOption = source.lastOption;
  target.burnHurt = source.burnHurt;
  target.burnStyle = source.burnStyle;
  target.burnCharacter = source.burnCharacter;
  target.burnFrame = source.burnFrame;
  target.burnCount = source.burnCount;
  target.burnGap = source.burnGap;
  target.blockFrame = source.blockFrame;
  target.motionSlot = source.motionSlot;
  target.motionVariant = source.motionVariant;
  target.motionStep = source.motionStep;
  target.motionSide = source.motionSide;
  target.motionFrame = source.motionFrame;
  const recent = source.recentOptions;
  const into = target.recentOptions;
  for (let index = 0; index < recent.length; index++) into[index] = recent[index] ?? 0;
  target.readActive = source.readActive;
  target.readChoice = source.readChoice;
  target.readContext = source.readContext;
  target.readExpectedFrame = source.readExpectedFrame;
  target.readExpires = source.readExpires;
  target.readConfidence = source.readConfidence;
  target.readActed = source.readActed;
  target.readActionFrame = source.readActionFrame;
  target.readActionSerial = source.readActionSerial;
  target.readActionStyle = source.readActionStyle;
  target.readActionFacing = source.readActionFacing;
}

function sameHistory(a: readonly number[], b: readonly number[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return false;
  return true;
}

export function sameBotStrategy(a: Readonly<BotStrategy>, b: Readonly<BotStrategy>): boolean {
  return sameHistory(a.history, b.history) && a.observedFrame === b.observedFrame && a.opponent === b.opponent && a.lastChoice === b.lastChoice
    && a.lastContext === b.lastContext && a.lastSerial === b.lastSerial && a.events === b.events && a.lastOption === b.lastOption
    && a.burnHurt === b.burnHurt && a.burnStyle === b.burnStyle && a.burnCharacter === b.burnCharacter && a.burnFrame === b.burnFrame && a.burnCount === b.burnCount && a.burnGap === b.burnGap && a.blockFrame === b.blockFrame
    && a.motionSlot === b.motionSlot && a.motionVariant === b.motionVariant && a.motionStep === b.motionStep && a.motionSide === b.motionSide && a.motionFrame === b.motionFrame
    && a.readActive === b.readActive && a.readChoice === b.readChoice && a.readContext === b.readContext && a.readExpectedFrame === b.readExpectedFrame
    && a.readExpires === b.readExpires && a.readConfidence === b.readConfidence && a.readActed === b.readActed && a.readActionFrame === b.readActionFrame
    && a.readActionSerial === b.readActionSerial && a.readActionStyle === b.readActionStyle && a.readActionFacing === b.readActionFacing;
}

export function clearBotStrategy(state: BotStrategy): void {
  copyBotStrategy(state, createBotStrategy());
}


export function botStrategyValues(state: Readonly<BotStrategy>): number[] {
  const values = [state.observedFrame, state.opponent, state.lastChoice, state.lastContext, state.lastSerial, state.events, state.lastOption, state.burnHurt ? 1 : 0, state.burnStyle, state.burnCharacter, state.burnFrame, state.burnCount, state.burnGap, state.blockFrame,
    state.readActive ? 1 : 0, state.readActive ? state.readChoice : 0, state.readActive ? state.readContext : 0, state.readActive ? state.readExpectedFrame : 0, state.readActive ? state.readExpires : 0, state.readActive ? state.readConfidence : 0, state.readActive && state.readActed ? 1 : 0,
    state.readActive ? state.readActionFrame : -1, state.readActive ? state.readActionSerial : -1, state.readActive ? state.readActionStyle : -1, state.readActive ? state.readActionFacing : 0, floorDiv(state.history.length, HABIT_FIELDS)];
  for (const value of state.recentOptions) values.push(value);
  for (const value of state.history) values.push(value);
  if (state.motionSlot >= 0) values.push(state.motionSlot, state.motionVariant, state.motionStep, state.motionSide, state.motionFrame);
  return values;
}

function visibleChoice(own: Readonly<Fighter>, target: Readonly<Fighter>): HabitChoice {
  if (target.ledge.state !== LedgeState.none) return HabitChoice.ledge;
  if (target.shield.raised) return HabitChoice.shield;
  if (target.attack.style !== undefined || target.special.action !== SpecialAction.none) return HabitChoice.attack;
  if (!target.motion.grounded && target.motion.vz > 0.0) return HabitChoice.jump;
  if (!target.motion.grounded && target.motion.vz < 0.0) return HabitChoice.landing;
  const toward = target.motion.x < own.motion.x ? 1 : -1;
  const moving = f32(target.motion.deltaX * toward);
  return moving > 1.0 ? HabitChoice.approach : moving < -1.0 ? HabitChoice.retreat : HabitChoice.none;
}


export function learnBotHabit(state: BotStrategy, ownObserved: Readonly<Fighter>, target: Readonly<Fighter>, opponent: number, observedFrame: number, policy: CpuDecisionPolicy): void {
  if (observedFrame <= state.observedFrame) return;
  if (opponent !== state.opponent) {
    clearBotStrategy(state);
    state.opponent = opponent;
  }
  const hurt = (ownObserved.launch.hitlag > 0 || ownObserved.launch.hitstun > 0) && ownObserved.hits.lastAttacker === opponent;
  const struck = target.attack.style;
  if (struck !== undefined && struck !== AttackStyle.shot && struck !== AttackStyle.grab) {
    const recent = target.character === state.burnCharacter && observedFrame - state.burnFrame <= BURN_MEMORY_FRAMES;
    const stray = recent && struck !== state.burnStyle && state.burnCount >= BURN_REPEATS;
    if (hurt && !state.burnHurt && !stray) {
      const repeated = struck === state.burnStyle && recent;
      state.burnCount = repeated ? state.burnCount + 1 : 1;
      state.burnStyle = struck;
      state.burnCharacter = target.character;
      state.burnFrame = observedFrame;
      state.burnGap = Math.abs(f32(ownObserved.motion.x - target.motion.x));
    } else if (struck === state.burnStyle && target.character === state.burnCharacter && target.attack.serial !== state.lastSerial) {
      state.burnFrame = observedFrame;
    }
  }
  state.burnHurt = hurt;
  const choice = visibleChoice(ownObserved, target);
  const context = habitContext(ownObserved, target);
  const changed = choice !== state.lastChoice || (choice === HabitChoice.attack && target.attack.serial !== state.lastSerial);
  if (changed && choice !== HabitChoice.none) {
    state.events++;
    if (floorDiv(state.events, policy.historyStride) !== floorDiv(state.events - 1, policy.historyStride)) {
      const fromContext = state.observedFrame < 0 ? context : state.lastContext;
      let previous = -1;
      for (let index = state.history.length - HABIT_FIELDS; index >= 0; index -= HABIT_FIELDS) {
        if (at(state.history, index + 1) === fromContext && at(state.history, index + 2) === choice) { previous = at(state.history, index); break; }
      }
      let kept = 0;
      let count = 0;
      for (let index = state.history.length - HABIT_FIELDS; index >= 0 && count < HISTORY_LIMIT - 1; index -= HABIT_FIELDS) {
        if (at(state.history, index + 1) === fromContext && ++kept >= policy.historyCapacity) continue;
        retained[count++] = index;
      }
      const history: number[] = [];
      for (let index = count - 1; index >= 0; index--) {
        const from = at(retained, index);
        for (let field = 0; field < HABIT_FIELDS; field++) history.push(at(state.history, from + field));
      }
      history.push(observedFrame, fromContext, choice, previous < 0 ? 0 : observedFrame - previous);
      state.history = history;
    }
  }
  state.observedFrame = observedFrame;
  state.lastChoice = choice;
  state.lastContext = context;
  state.lastSerial = target.attack.serial;
}


export function prepareBotRead(state: BotStrategy, own: Readonly<Fighter>, target: Readonly<Fighter>, frame: number, delay: number, policy: CpuDecisionPolicy): void {
  if (state.readActive && frame <= state.readExpires) return;
  state.readActive = false;
  const context = habitContext(own, target);
  const counts = readCounts, intervals = readIntervals, timed = readTimed, latest = readLatest;
  for (let index = 0; index < counts.length; index++) {
    counts[index] = 0;
    intervals[index] = 0;
    timed[index] = 0;
    latest[index] = 0;
  }
  let total = 0;
  for (let index = 0; index < state.history.length; index += HABIT_FIELDS) {
    if (at(state.history, index + 1) !== context) continue;
    const choice = at(state.history, index + 2);
    const interval = at(state.history, index + 3);
    counts[choice] = at(counts, choice) + 1;
    if (interval > 0) {
      intervals[choice] = at(intervals, choice) + interval;
      timed[choice] = at(timed, choice) + 1;
    }
    latest[choice] = at(state.history, index);
    total++;
  }
  let choice: HabitChoice = HabitChoice.none;
  for (const candidate of READ_CHOICES) {
    if (at(counts, candidate) > at(counts, choice)) choice = candidate;
  }
  const count = at(counts, choice);
  const confidence = total === 0 ? 0 : floorDiv(count * 100, total);
  const learned = count >= policy.readEvidence && confidence >= policy.readConfidence;
  const guessed = !learned && total > 0 && botChance(floorDiv(frame, 30), own.character * 31 + state.events, policy.guessPercent, 100);
  if ((!learned && !guessed) || !botChance(floorDiv(frame, 30), own.character * 17 + state.events, Math.min(90, learned ? confidence : 35), 100)) return;
  const interval = at(timed, choice) === 0 ? 40 : Math.max(12, floorDiv(at(intervals, choice), at(timed, choice)));
  let expectedFrame = at(latest, choice) + interval;
  while (expectedFrame <= frame) expectedFrame += interval;
  if (expectedFrame > frame + 90) return;
  state.readActive = true;
  state.readChoice = choice;
  state.readContext = context;
  state.readExpectedFrame = expectedFrame;
  state.readExpires = expectedFrame + delay + 6;
  state.readConfidence = confidence;
  state.readActed = false;
  state.readActionFrame = -1;
  state.readActionSerial = -1;
  state.readActionStyle = -1;
  state.readActionFacing = 0;
}


export function pressBotRead(state: BotStrategy, own: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, matchFrame: number, frame: number, input: Controls, commands: AttackBuffer): boolean {
  if (!state.readActive || frame > state.readExpires || !own.motion.grounded || own.down.state !== DownState.none || own.launch.hitstun > 0) return false;
  const ahead = state.readExpectedFrame - frame;
  const dx = f32(target.motion.x - own.motion.x);
  const toward = dx < 0 ? -1 : 1;
  if (state.readChoice === HabitChoice.attack) {
    if (ahead > 8 || ahead < -8) return false;
    if (state.readActed && own.special.action !== SpecialAction.none) return false;
    if (ahead >= 0 && gameplanOf(own.character)?.defense.includes("stance") === true) {
      const stance = heroStanceSlot(own, ahead);
      if (stance !== undefined) {
        pressHeroStance(own, stance, input);
        state.readActed = true;
        return true;
      }
      if (!own.shield.raised && heroStanceFits(own, ahead - 1) !== undefined) return true;
    }
    input.shield = true;
    state.readActed = true;
    return true;
  }
  if (state.readActed) {
    if (state.readActionFrame < 0 || frame - state.readActionFrame > 6 || own.attack.serial !== state.readActionSerial) return false;
    queueAttack(commands, { style: state.readActionStyle, facing: state.readActionFacing, frame: state.readActionFrame, mayCharge: false, cStick: false });
    input.attackHeld = true;
    return true;
  }
  const style = state.readChoice === HabitChoice.shield ? AttackStyle.grab
    : state.readChoice === HabitChoice.jump || state.readChoice === HabitChoice.landing ? AttackStyle.upTilt : AttackStyle.forwardTilt;
  const startup = attackStartupFrames(style, own.tuning.moves);
  const reach = moveReachAhead(own.character, style, target, own.tuning.moves);
  const goal = f32(target.motion.x - f32(toward * Math.max(20.0, f32(reach - 45.0))));
  if (ahead > startup + 2) {
    if (!canAttack(own)) return false;
    steerOnGround(own, stage, goal, input);
    return true;
  }
  if (ahead < -4 || !slideStaysOnDeck(own, stage, matchFrame)) return false;
  const anticipatedZ = state.readChoice === HabitChoice.jump ? 70.0 : state.readChoice === HabitChoice.landing ? 0.0 : f32(target.motion.z - own.motion.z);
  if (!moveReaches(own.character, style, target, Math.abs(dx), anticipatedZ, own.tuning.moves)) return false;
  queueAttack(commands, { style, facing: toward, frame, mayCharge: false, cStick: false });
  input.attackHeld = true;
  state.readActed = true;
  state.readActionFrame = frame;
  state.readActionSerial = own.attack.serial;
  state.readActionStyle = style;
  state.readActionFacing = toward;
  return true;
}

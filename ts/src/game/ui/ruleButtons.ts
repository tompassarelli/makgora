import { f32 } from "wisp/src/sim/f32";
import { cardDown, cardRight, cardSize } from "../menu/selectionDrag";
import { HEADER_BUTTON_HEIGHT, HEADER_BUTTON_TOP, SELECT_GAP, SELECT_LEFT, SELECT_RIGHT } from "./selectionLayout";


export interface RuleBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const STEP_WIDTH = f32(0.03);
export const RULE_HEIGHT = HEADER_BUTTON_HEIGHT;
const ROW_STEP = f32(RULE_HEIGHT + f32(0.002));
export const RULE_ROWS = [f32(HEADER_BUTTON_TOP - ROW_STEP), f32(HEADER_BUTTON_TOP - f32(2 * ROW_STEP)), f32(HEADER_BUTTON_TOP - f32(3 * ROW_STEP))] as const;
const [ROW_1, ROW_2, ROW_3] = RULE_ROWS;
const LEFT_WIDTH = f32(0.29);
const HALF_LEFT = f32(f32(LEFT_WIDTH - SELECT_GAP) / 2);
const LEFT_SECOND = f32(f32(SELECT_LEFT + HALF_LEFT) + SELECT_GAP);
const RIGHT_LEFT = f32(0.38);
const COLUMN_WIDTH = f32(f32(f32(SELECT_RIGHT - RIGHT_LEFT) - SELECT_GAP) / 2);
const RIGHT_SECOND = f32(SELECT_RIGHT - COLUMN_WIDTH);
const ITEMS_WIDTH = f32(0.08);
const stepBox = (x: number, y: number): RuleBox => ({ x, y, width: STEP_WIDTH, height: RULE_HEIGHT });
const stepEnd = (column: number, y: number): RuleBox => stepBox(f32(f32(column + COLUMN_WIDTH) - STEP_WIDTH), y);
const toggleBox = (x: number, y: number): RuleBox => ({ x, y, width: COLUMN_WIDTH, height: RULE_HEIGHT });
const leftBox = (x: number, y: number, width: number): RuleBox => ({ x, y, width, height: RULE_HEIGHT });

export const RULE_BUTTONS = {
  teamBattle: leftBox(SELECT_LEFT, ROW_3, HALF_LEFT),
  friendlyFire: leftBox(LEFT_SECOND, ROW_3, HALF_LEFT),
  fewerStocks: stepBox(RIGHT_LEFT, ROW_1),
  moreStocks: stepEnd(RIGHT_LEFT, ROW_1),
  lessTime: stepBox(RIGHT_SECOND, ROW_1),
  moreTime: stepEnd(RIGHT_SECOND, ROW_1),
  endless: toggleBox(RIGHT_LEFT, ROW_2),
  automaticRematch: toggleBox(RIGHT_SECOND, ROW_2),
  items: { x: RIGHT_LEFT, y: ROW_3, width: ITEMS_WIDTH, height: RULE_HEIGHT },
  itemSpeed: leftBox(SELECT_LEFT, ROW_1, HALF_LEFT),
  itemHeavy: leftBox(LEFT_SECOND, ROW_1, HALF_LEFT),
  training: leftBox(SELECT_LEFT, ROW_2, LEFT_WIDTH),
  inputDelay: toggleBox(RIGHT_SECOND, ROW_3),
  ultimates: { x: f32(f32(RIGHT_LEFT + ITEMS_WIDTH) + SELECT_GAP), y: ROW_3, width: f32(f32(COLUMN_WIDTH - ITEMS_WIDTH) - SELECT_GAP), height: RULE_HEIGHT },
  lessBehaviour: stepBox(RIGHT_LEFT, ROW_1),
  moreBehaviour: stepEnd(RIGHT_LEFT, ROW_1),
  lessEscape: stepBox(RIGHT_SECOND, ROW_1),
  moreEscape: stepEnd(RIGHT_SECOND, ROW_1),
  lessTech: stepBox(RIGHT_LEFT, ROW_2),
  moreTech: stepEnd(RIGHT_LEFT, ROW_2),
  lessDamage: stepBox(RIGHT_SECOND, ROW_2),
  moreDamage: stepEnd(RIGHT_SECOND, ROW_2),
  hitAreas: toggleBox(RIGHT_LEFT, ROW_3),
  speed: leftBox(SELECT_LEFT, ROW_3, LEFT_WIDTH),
  easierClassic: stepBox(RIGHT_LEFT, ROW_1),
  harderClassic: stepEnd(RIGHT_SECOND, ROW_1),
} as const;

export const CLASSIC_ROUTE_BOX: RuleBox = { x: RIGHT_LEFT, y: ROW_2, width: f32(SELECT_RIGHT - RIGHT_LEFT), height: RULE_HEIGHT };

const { inputDelay } = RULE_BUTTONS;

export const DELAY_CONTROLS = {
  less: stepBox(inputDelay.x, ROW_3),
  more: stepEnd(inputDelay.x, ROW_3),
  auto: { x: f32(f32(inputDelay.x + STEP_WIDTH) + SELECT_GAP), y: ROW_3, width: f32(inputDelay.width - f32(2 * f32(STEP_WIDTH + SELECT_GAP))), height: RULE_HEIGHT },
} as const;


export type TrainingSetting = "behaviour" | "escape" | "tech" | "damage";


export function cpuSettingsBox(slot: number): RuleBox {
  return { x: cardRight(slot, f32(0.007)), y: cardDown(f32(0.034)), width: cardSize(f32(0.146)), height: cardSize(f32(0.02)) };
}

export function teamSettingsBox(slot: number): RuleBox {
  return { x: cardRight(slot, f32(0.08)), y: cardDown(f32(0.004)), width: cardSize(f32(0.078)), height: cardSize(f32(0.026)) };
}

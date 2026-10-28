import { f32 } from "wisp/src/sim/f32";
import { cardDown, cardRight, cardSize } from "../menu/selectionDrag";


export interface RuleBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const STEP_WIDTH = f32(0.03);
export const RULE_HEIGHT = f32(0.023);
export const RULE_ROWS = [f32(0.561), f32(0.536), f32(0.511)] as const;
const [ROW_1, ROW_2, ROW_3] = RULE_ROWS;
const stepBox = (x: number, y: number): RuleBox => ({ x, y, width: STEP_WIDTH, height: RULE_HEIGHT });
const toggleBox = (x: number, y: number): RuleBox => ({ x, y, width: f32(0.178), height: RULE_HEIGHT });

export const RULE_BUTTONS = {
  teamBattle: { x: f32(0.055), y: ROW_3, width: f32(0.14), height: RULE_HEIGHT },
  friendlyFire: { x: f32(0.205), y: ROW_3, width: f32(0.14), height: RULE_HEIGHT },
  fewerStocks: stepBox(f32(0.38), ROW_1),
  moreStocks: stepBox(f32(0.528), ROW_1),
  lessTime: stepBox(f32(0.572), ROW_1),
  moreTime: stepBox(f32(0.72), ROW_1),
  endless: toggleBox(f32(0.38), ROW_2),
  automaticRematch: toggleBox(f32(0.572), ROW_2),
  items: { x: f32(0.38), y: ROW_3, width: f32(0.078), height: RULE_HEIGHT },
  itemSpeed: { x: f32(0.055), y: ROW_1, width: f32(0.14), height: RULE_HEIGHT },
  itemHeavy: { x: f32(0.205), y: ROW_1, width: f32(0.14), height: RULE_HEIGHT },
  training: { x: f32(0.05), y: ROW_2, width: f32(0.295), height: RULE_HEIGHT },
  inputDelay: toggleBox(f32(0.572), ROW_3),
  ultimates: { x: f32(0.462), y: ROW_3, width: f32(0.104), height: RULE_HEIGHT },
  lessBehaviour: stepBox(f32(0.38), ROW_1),
  moreBehaviour: stepBox(f32(0.528), ROW_1),
  lessEscape: stepBox(f32(0.572), ROW_1),
  moreEscape: stepBox(f32(0.72), ROW_1),
  lessTech: stepBox(f32(0.38), ROW_2),
  moreTech: stepBox(f32(0.528), ROW_2),
  lessDamage: stepBox(f32(0.572), ROW_2),
  moreDamage: stepBox(f32(0.72), ROW_2),
  hitAreas: toggleBox(f32(0.38), ROW_3),
  speed: toggleBox(f32(0.055), ROW_3),
  easierClassic: stepBox(f32(0.38), ROW_1),
  harderClassic: stepBox(f32(0.72), ROW_1),
} as const;

const DELAY_STEP_WIDTH = f32(0.02);

export const DELAY_CONTROLS = {
  less: { x: RULE_BUTTONS.inputDelay.x, y: ROW_3, width: DELAY_STEP_WIDTH, height: RULE_HEIGHT },
  more: { x: f32(RULE_BUTTONS.inputDelay.x + RULE_BUTTONS.inputDelay.width - DELAY_STEP_WIDTH), y: ROW_3, width: DELAY_STEP_WIDTH, height: RULE_HEIGHT },
  auto: { x: f32(RULE_BUTTONS.inputDelay.x + DELAY_STEP_WIDTH), y: ROW_3, width: f32(RULE_BUTTONS.inputDelay.width - DELAY_STEP_WIDTH - DELAY_STEP_WIDTH), height: RULE_HEIGHT },
} as const;


export type TrainingSetting = "behaviour" | "escape" | "tech" | "damage";


export function cpuSettingsBox(slot: number): RuleBox {
  return { x: cardRight(slot, f32(0.007)), y: cardDown(f32(0.032)), width: cardSize(f32(0.146)), height: cardSize(f32(0.017)) };
}

export function teamSettingsBox(slot: number): RuleBox {
  return { x: cardRight(slot, f32(0.08)), y: cardDown(f32(0.004)), width: cardSize(f32(0.078)), height: cardSize(f32(0.026)) };
}

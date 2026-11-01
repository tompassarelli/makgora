import { f32 } from "wisp/src/sim/f32";
import { cardDown, cardRight, cardSize } from "../menu/selectionDrag";
import { type BarBox, type BarPanel, CLASSIC_ROWS, DRAWER_ROWS, GEAR_ROWS, MODE_ROWS, SELECT_BAR, TRAINING_ROWS } from "./selectBarLayout";

export type RuleBox = BarBox;

/** Every rule control by name, and the bar panel it lives in (undefined: on the bar itself). */
export const RULE_BUTTONS = {
  teamBattle: SELECT_BAR.teams,
  friendlyFire: MODE_ROWS.friendlyToggle,
  fewerStocks: DRAWER_ROWS.stocks.less,
  moreStocks: DRAWER_ROWS.stocks.more,
  lessTime: DRAWER_ROWS.time.less,
  moreTime: DRAWER_ROWS.time.more,
  endless: DRAWER_ROWS.endless,
  automaticRematch: DRAWER_ROWS.automaticRematch,
  items: DRAWER_ROWS.items,
  ultimates: DRAWER_ROWS.ultimates,
  itemSpeed: DRAWER_ROWS.itemSpeed,
  itemHeavy: DRAWER_ROWS.itemHeavy,
  training: SELECT_BAR.mode,
  inputDelay: GEAR_ROWS.delay,
  lessBehaviour: TRAINING_ROWS.behaviour.less,
  moreBehaviour: TRAINING_ROWS.behaviour.more,
  lessEscape: TRAINING_ROWS.escape.less,
  moreEscape: TRAINING_ROWS.escape.more,
  lessTech: TRAINING_ROWS.tech.less,
  moreTech: TRAINING_ROWS.tech.more,
  lessDamage: TRAINING_ROWS.damage.less,
  moreDamage: TRAINING_ROWS.damage.more,
  hitAreas: TRAINING_ROWS.hitAreas,
  speed: TRAINING_ROWS.speed,
  easierClassic: CLASSIC_ROWS.tier.less,
  harderClassic: CLASSIC_ROWS.tier.more,
} as const;

export type RuleName = keyof typeof RULE_BUTTONS;

const ON_BAR: readonly RuleName[] = ["teamBattle", "training"];
const IN_MODE: readonly RuleName[] = ["friendlyFire"];
const IN_GEAR: readonly RuleName[] = ["inputDelay"];

/** The panel that must be open to click a rule, or undefined for a rule on the bar. */
export const rulePanel = (name: RuleName): BarPanel | undefined =>
  ON_BAR.includes(name) ? undefined : IN_MODE.includes(name) ? "mode" : IN_GEAR.includes(name) ? "gear" : "rules";


export type TrainingSetting = "behaviour" | "escape" | "tech" | "damage";


export function cpuSettingsBox(slot: number): RuleBox {
  return { x: cardRight(slot, f32(0.007)), y: cardDown(f32(0.034)), width: cardSize(f32(0.146)), height: cardSize(f32(0.02)) };
}

export function teamSettingsBox(slot: number): RuleBox {
  return { x: cardRight(slot, f32(0.08)), y: cardDown(f32(0.004)), width: cardSize(f32(0.078)), height: cardSize(f32(0.026)) };
}

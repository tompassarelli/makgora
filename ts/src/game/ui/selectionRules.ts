import { CLASSIC_ROUTE_BOX, DELAY_CONTROLS, RULE_BUTTONS, RULE_HEIGHT, type RuleBox, type TrainingSetting } from "./ruleButtons";
import { f32 } from "wisp/src/sim/f32";
import type { MatchState } from "../lobby/lobbyState";
import { MENU_STYLE } from "./hudLayout";
import { ItemKind, itemBit } from "../sim/codes";
import { type TutorialMenuFrames, showTutorialLesson } from "./tutorialMenu";
import { placeTopLeft, setMenuText } from "./frames";
import { label } from "./selectionFrames";
import type { SelectionActions } from "./selectionActions";
import { createFrame, Frame, namedFrame, setFrameEnabled, setFrameFont, setFrameSize, setFrameVisible } from "wisp/game/frames";
import { formatInt } from "wisp/game/text";

export type RuleButton = { kind: "teamBattle" } | { kind: "friendlyFire" } | { kind: "stocks"; direction: -1 | 1 } | { kind: "time"; direction: -1 | 1 } | { kind: "endless" } | { kind: "automaticRematch" }
  | { kind: "items" } | { kind: "ultimates" } | { kind: "itemKind"; item: ItemKind } | { kind: "training" } | { kind: "partner"; setting: TrainingSetting; direction: -1 | 1 } | { kind: "hitAreas" } | { kind: "speed" }
  | { kind: "classicTier"; direction: -1 | 1 } | { kind: "inputDelay"; step: -1 | 0 | 1 };

type AddRule = (frame: Frame, target: RuleButton) => Frame;

export interface MatchRuleFrames {
  readonly steps: readonly Frame[];
  readonly stockValue: Frame;
  readonly timeValue: Frame;
  readonly teamToggle: Frame;
  readonly friendlyFireToggle: Frame;
  readonly endlessToggle: Frame;
  readonly rematchToggle: Frame;
  readonly itemsToggle: Frame;
  readonly ultimatesToggle: Frame;
  readonly itemToggles: readonly Frame[];
  readonly trainingToggle: Frame;
  readonly hitAreasToggle: Frame;
  readonly speedToggle: Frame;
  readonly partnerValues: readonly Frame[];
  readonly trainingFrames: readonly Frame[];
}

export interface RuleFrames extends MatchRuleFrames {
  readonly classicFrames: readonly Frame[];
  readonly classicTierValue: Frame;
  readonly classicRoute: Frame;
  readonly matchRuleFrames: readonly Frame[];
}

function ruleButton(root: Frame, add: AddRule, box: RuleBox, target: RuleButton, text: string): Frame {
  const frame = createFrame("ScriptDialogButton", root, 0, 0);
  placeTopLeft(frame, box.x, box.y);
  setFrameSize(frame, box.width, box.height);
  setMenuText(frame, text);
  setFrameFont(frame, MENU_STYLE.font, MENU_STYLE.headerSize, 0);
  setFrameFont(namedFrame("ScriptDialogButtonText", 0), MENU_STYLE.font, MENU_STYLE.headerSize, 0);
  return add(frame, target);
}

export function createMatchRules(root: Frame, suffix: string, add: AddRule): MatchRuleFrames {
  const { fewerStocks, moreStocks, lessTime, moreTime, endless, automaticRematch } = RULE_BUTTONS;
  const steps = [
    ruleButton(root, add, fewerStocks, { kind: "stocks", direction: -1 }, "−"),
    ruleButton(root, add, moreStocks, { kind: "stocks", direction: 1 }, "+"),
    ruleButton(root, add, lessTime, { kind: "time", direction: -1 }, "−"),
    ruleButton(root, add, moreTime, { kind: "time", direction: 1 }, "+"),
  ];
  const valueX = fewerStocks.x + fewerStocks.width;
  const valueWidth = moreStocks.x - valueX;
  const stockValue = label(root, `MeleeRulesStocks${suffix}`, valueX, fewerStocks.y, valueWidth, RULE_HEIGHT, MENU_STYLE.headerSize);
  const timeValue = label(root, `MeleeRulesTime${suffix}`, lessTime.x + lessTime.width, lessTime.y, moreTime.x - lessTime.x - lessTime.width, RULE_HEIGHT, MENU_STYLE.headerSize);
  const teamToggle = ruleButton(root, add, RULE_BUTTONS.teamBattle, { kind: "teamBattle" }, "");
  const friendlyFireToggle = ruleButton(root, add, RULE_BUTTONS.friendlyFire, { kind: "friendlyFire" }, "");
  const endlessToggle = ruleButton(root, add, endless, { kind: "endless" }, "");
  const rematchToggle = ruleButton(root, add, automaticRematch, { kind: "automaticRematch" }, "");
  const itemsToggle = ruleButton(root, add, RULE_BUTTONS.items, { kind: "items" }, "");
  const ultimatesToggle = ruleButton(root, add, RULE_BUTTONS.ultimates, { kind: "ultimates" }, "");
  const itemToggles = [
    ruleButton(root, add, RULE_BUTTONS.itemSpeed, { kind: "itemKind", item: ItemKind.speed }, ""),
    ruleButton(root, add, RULE_BUTTONS.itemHeavy, { kind: "itemKind", item: ItemKind.heavy }, ""),
  ];
  const trainingToggle = ruleButton(root, add, RULE_BUTTONS.training, { kind: "training" }, "");
  const hitAreasToggle = ruleButton(root, add, RULE_BUTTONS.hitAreas, { kind: "hitAreas" }, "");
  const speedToggle = ruleButton(root, add, RULE_BUTTONS.speed, { kind: "speed" }, "");
  const partnerRows: readonly (readonly [TrainingSetting, RuleBox, RuleBox])[] = [
    ["behaviour", RULE_BUTTONS.lessBehaviour, RULE_BUTTONS.moreBehaviour],
    ["escape", RULE_BUTTONS.lessEscape, RULE_BUTTONS.moreEscape],
    ["tech", RULE_BUTTONS.lessTech, RULE_BUTTONS.moreTech],
    ["damage", RULE_BUTTONS.lessDamage, RULE_BUTTONS.moreDamage],
  ];
  const partnerFrames: Frame[] = [hitAreasToggle, speedToggle];
  const partnerValues = partnerRows.map(([setting, less, more]) => {
    partnerFrames.push(ruleButton(root, add, less, { kind: "partner", setting, direction: -1 }, "−"), ruleButton(root, add, more, { kind: "partner", setting, direction: 1 }, "+"));
    const value = label(root, `MeleeTraining${setting}${suffix}`, less.x + less.width, less.y, more.x - less.x - less.width, RULE_HEIGHT, f32(0.009));
    partnerFrames.push(value);
    return value;
  });
  return {
    steps, stockValue, timeValue, teamToggle, friendlyFireToggle, endlessToggle, rematchToggle, itemsToggle, ultimatesToggle, itemToggles, trainingToggle, hitAreasToggle, speedToggle,
    partnerValues, trainingFrames: partnerFrames,
  };
}

export function createClassicRules(root: Frame, suffix: string, add: AddRule, match: MatchRuleFrames): RuleFrames {
  const { easierClassic, harderClassic } = RULE_BUTTONS;
  const classicTierValue = label(root, `MeleeClassicTier${suffix}`, easierClassic.x + easierClassic.width, easierClassic.y, harderClassic.x - easierClassic.x - easierClassic.width, RULE_HEIGHT, f32(0.011));
  const classicRoute = label(root, `MeleeClassicRoute${suffix}`, CLASSIC_ROUTE_BOX.x, CLASSIC_ROUTE_BOX.y, CLASSIC_ROUTE_BOX.width, RULE_HEIGHT, f32(0.0085));
  const classicFrames = [
    ruleButton(root, add, easierClassic, { kind: "classicTier", direction: -1 }, "−"),
    ruleButton(root, add, harderClassic, { kind: "classicTier", direction: 1 }, "+"),
    classicTierValue, classicRoute,
  ];
  const matchRuleFrames = [...match.steps, match.stockValue, match.timeValue, match.teamToggle, match.endlessToggle, match.rematchToggle, match.itemsToggle, match.ultimatesToggle];
  return { ...match, classicFrames, classicTierValue, classicRoute, matchRuleFrames };
}

export interface DelayFrames {
  readonly steps: readonly Frame[];
  readonly line: Frame;
}

export function createDelayControls(root: Frame, add: AddRule, textSize: number): DelayFrames {
  const { less, more, auto } = DELAY_CONTROLS;
  const line = ruleButton(root, add, auto, { kind: "inputDelay", step: 0 }, "");
  setFrameFont(namedFrame("ScriptDialogButtonText", 0), MENU_STYLE.font, textSize, 0);
  return {
    steps: [ruleButton(root, add, less, { kind: "inputDelay", step: -1 }, "−"), ruleButton(root, add, more, { kind: "inputDelay", step: 1 }, "+")],
    line,
  };
}

export function presentDelayControls(frames: DelayFrames, hostControl: boolean): void {
  const box = hostControl ? DELAY_CONTROLS.auto : RULE_BUTTONS.inputDelay;
  placeTopLeft(frames.line, box.x, box.y);
  setFrameSize(frames.line, box.width, box.height);
  setFrameEnabled(frames.line, hostControl);
  for (const frame of frames.steps) setFrameVisible(frame, hostControl);
}

export function rulesKey(game: Readonly<MatchState>, clears: { count(): number }, fighter: number): string {
  const { stockCount, timeLimitMinutes, endless, automaticRematch, training, trainer, items, classic, classicTier, lore, loreBattle: battle } = game;
  return `${lore ? "1" : "0"} ${formatInt(battle)} ${formatInt(clears.count())} ${classic ? "1" : "0"} ${formatInt(classicTier)} ${formatInt(fighter)} ${formatInt(stockCount)} ${formatInt(timeLimitMinutes)} ${endless ? "1" : "0"} ${automaticRematch ? "1" : "0"} ${training ? "1" : "0"} ${formatInt(trainer.behaviour)} ${formatInt(trainer.escape)} ${formatInt(trainer.tech)} ${formatInt(trainer.damage)} ${trainer.showHitAreas ? "1" : "0"} ${formatInt(trainer.speed)} ${items.on ? "1" : "0"} ${game.ultimatesOff ? "1" : "0"} ${formatInt(items.enabledMask)} ${formatInt(trainer.lesson)} ${game.teamBattle ? "1" : "0"} ${game.friendlyFire ? "1" : "0"}`;
}

export function applyRuleButton(actions: SelectionActions, participantId: number, button: RuleButton): void {
  if (button.kind === "teamBattle") actions.toggleTeamBattle(participantId);
  else if (button.kind === "friendlyFire") actions.toggleFriendlyFire(participantId);
  else if (button.kind === "stocks") actions.changeStocks(participantId, button.direction);
  else if (button.kind === "time") actions.changeTime(participantId, button.direction);
  else if (button.kind === "endless") actions.toggleEndless(participantId);
  else if (button.kind === "items") actions.toggleItems(participantId);
  else if (button.kind === "ultimates") actions.toggleUltimates(participantId);
  else if (button.kind === "itemKind") actions.toggleItemKind(participantId, button.item);
  else if (button.kind === "training") actions.cycleMatchMode(participantId);
  else if (button.kind === "classicTier") actions.stepClassicTier(participantId, button.direction);
  else if (button.kind === "partner") actions.stepTraining(participantId, button.setting, button.direction);
  else if (button.kind === "hitAreas") actions.toggleHitAreas(participantId);
  else if (button.kind === "speed") actions.stepSpeed(participantId);
  else if (button.kind === "inputDelay") actions.changeInputDelay(participantId, button.step);
  else actions.toggleAutomaticRematch(participantId);
}

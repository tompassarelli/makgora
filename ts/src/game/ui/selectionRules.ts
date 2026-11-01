import type { TrainingSetting } from "./ruleButtons";
import { type MatchMode, type MatchState, matchMode } from "../lobby/lobbyState";
import { PRESET_NAMES, type RulePreset } from "../lobby/rulePresets";
import { ItemKind, itemBit } from "../sim/codes";
import type { SelectionActions } from "./selectionActions";
import { type BarBox, CLASSIC_ROWS, DRAWER_ROWS, GEAR_ROWS, TRAINING_ROWS, panelHeading } from "./selectBarLayout";
import { BAR_COLOURS, BAR_SMALL_TEXT, BAR_TEXT, type BarControl, barControl, barText, enableControl, labelControl, showControl } from "./barFrames";
import { setMenuText } from "./frames";
import {
  automaticRematchSetting, endlessSetting, hitAreasSetting, itemKindSetting, itemsSetting, partnerBehaviourSetting, partnerDamageSetting, partnerEscapeSetting, partnerTechSetting,
  stockSetting, timeSetting, trainingSpeedSetting, ultimatesSetting,
} from "../session/messages";
import { classicRouteSummary, classicTierSetting } from "../classic/classicText";
import { loreBattle, loreBattleSetting, loreBattleSummary } from "../classic/loreBattles";
import type { LoreClears } from "../classic/loreClears";
import { Frame, setFrameVisible, TextAlignment } from "wisp/game/frames";
import { formatInt } from "wisp/game/text";

export type RuleButton = { kind: "teamBattle" } | { kind: "friendlyFire" } | { kind: "stocks"; direction: -1 | 1 } | { kind: "time"; direction: -1 | 1 } | { kind: "endless" } | { kind: "automaticRematch" }
  | { kind: "items" } | { kind: "ultimates" } | { kind: "itemKind"; item: ItemKind } | { kind: "matchMode"; mode: MatchMode } | { kind: "partner"; setting: TrainingSetting; direction: -1 | 1 } | { kind: "hitAreas" } | { kind: "speed" }
  | { kind: "classicTier"; direction: -1 | 1 } | { kind: "inputDelay"; step: -1 | 0 | 1 } | { kind: "preset"; preset: RulePreset };

export type AddRule = (frame: Frame, target: RuleButton, box: BarBox) => Frame;

export interface RuleGroup {
  readonly controls: readonly BarControl[];
  readonly texts: readonly Frame[];
}

interface Stepper {
  readonly less: BarControl;
  readonly value: Frame;
  readonly more: BarControl;
}

export interface RuleFrames {
  readonly heading: Frame;
  readonly presets: readonly BarControl[];
  readonly reset: BarControl;
  readonly stocks: Stepper;
  readonly time: Stepper;
  readonly toggles: { readonly ultimates: BarControl; readonly items: BarControl; readonly endless: BarControl; readonly automaticRematch: BarControl };
  readonly itemKinds: readonly [BarControl, BarControl];
  readonly partner: Readonly<Record<TrainingSetting, Stepper>>;
  readonly hitAreas: BarControl;
  readonly speed: BarControl;
  readonly classic: Stepper;
  readonly route: Frame;
  readonly versus: RuleGroup;
  readonly training: RuleGroup;
  readonly classicFrames: RuleGroup;
}

const PRESETS: readonly RulePreset[] = ["tourney", "party", "endless"];

function pressable(parent: Frame, add: AddRule, name: string, b: BarBox, target: RuleButton, text: string, size = BAR_TEXT): BarControl {
  const control = barControl(parent, name, b, "Frame", size);
  labelControl(control, text);
  if (control.button !== undefined) add(control.button, target, b);
  return control;
}

function stepper(parent: Frame, add: AddRule, name: string, rows: { readonly less: BarBox; readonly value: BarBox; readonly more: BarBox }, target: (direction: -1 | 1) => RuleButton, size: number): Stepper {
  return {
    less: pressable(parent, add, `${name}Less`, rows.less, target(-1), "−"),
    value: barText(parent, `${name}Value`, rows.value, size),
    more: pressable(parent, add, `${name}More`, rows.more, target(1), "+"),
  };
}

export function createRulesDrawer(drawer: Frame, suffix: string, add: AddRule): RuleFrames {
  const name = (part: string) => `MeleeRules${part}${suffix}`;
  const heading = barText(drawer, name("Heading"), panelHeading("rules"), BAR_TEXT, TextAlignment.left);
  const presets = PRESETS.map((preset, index) => pressable(drawer, add, name(`Preset${formatInt(index)}`), DRAWER_ROWS.presets[index] ?? DRAWER_ROWS.presets[0], { kind: "preset", preset }, PRESET_NAMES[preset]));
  const reset = pressable(drawer, add, name("Reset"), DRAWER_ROWS.reset, { kind: "preset", preset: "standard" }, `${BAR_COLOURS.dim}${PRESET_NAMES.standard}|r`, BAR_SMALL_TEXT);
  const stockLabel = barText(drawer, name("StocksLabel"), DRAWER_ROWS.stocks.label, BAR_TEXT, TextAlignment.left);
  setMenuText(stockLabel, `${BAR_COLOURS.cream}Stock count|r`);
  const timeLabel = barText(drawer, name("TimeLabel"), DRAWER_ROWS.time.label, BAR_TEXT, TextAlignment.left);
  setMenuText(timeLabel, `${BAR_COLOURS.cream}Time limit|r`);
  const stocks = stepper(drawer, add, name("Stocks"), DRAWER_ROWS.stocks, direction => ({ kind: "stocks", direction }), BAR_TEXT);
  const time = stepper(drawer, add, name("Time"), DRAWER_ROWS.time, direction => ({ kind: "time", direction }), BAR_TEXT);
  const toggles = {
    ultimates: pressable(drawer, add, name("Ultimates"), DRAWER_ROWS.ultimates, { kind: "ultimates" }, ""),
    items: pressable(drawer, add, name("Items"), DRAWER_ROWS.items, { kind: "items" }, ""),
    endless: pressable(drawer, add, name("Endless"), DRAWER_ROWS.endless, { kind: "endless" }, ""),
    automaticRematch: pressable(drawer, add, name("Rematch"), DRAWER_ROWS.automaticRematch, { kind: "automaticRematch" }, ""),
  };
  const itemKinds: [BarControl, BarControl] = [
    pressable(drawer, add, name("ItemSpeed"), DRAWER_ROWS.itemSpeed, { kind: "itemKind", item: ItemKind.speed }, ""),
    pressable(drawer, add, name("ItemHeavy"), DRAWER_ROWS.itemHeavy, { kind: "itemKind", item: ItemKind.heavy }, ""),
  ];
  const partnerRow = (setting: TrainingSetting) => stepper(drawer, add, name(`Partner${setting}`), TRAINING_ROWS[setting], direction => ({ kind: "partner", setting, direction }), BAR_TEXT);
  const partner = { behaviour: partnerRow("behaviour"), escape: partnerRow("escape"), tech: partnerRow("tech"), damage: partnerRow("damage") };
  const hitAreas = pressable(drawer, add, name("HitAreas"), TRAINING_ROWS.hitAreas, { kind: "hitAreas" }, "");
  const speed = pressable(drawer, add, name("Speed"), TRAINING_ROWS.speed, { kind: "speed" }, "");
  const classic = stepper(drawer, add, name("Classic"), CLASSIC_ROWS.tier, direction => ({ kind: "classicTier", direction }), BAR_TEXT);
  const route = barText(drawer, name("Route"), CLASSIC_ROWS.route, BAR_SMALL_TEXT, TextAlignment.left);
  const steps = (...all: Stepper[]): RuleGroup => ({ controls: all.flatMap(s => [s.less, s.more]), texts: all.map(s => s.value) });
  const versusSteps = steps(stocks, time);
  const trainingSteps = steps(partner.behaviour, partner.escape, partner.tech, partner.damage);
  const classicSteps = steps(classic);
  return {
    heading, presets, reset, stocks, time, toggles, itemKinds, partner, hitAreas, speed, classic, route,
    versus: { controls: [...presets, reset, ...versusSteps.controls, toggles.ultimates, toggles.items, toggles.endless, toggles.automaticRematch], texts: [stockLabel, timeLabel, ...versusSteps.texts] },
    training: { controls: [...trainingSteps.controls, hitAreas, speed], texts: trainingSteps.texts },
    classicFrames: { controls: classicSteps.controls, texts: [...classicSteps.texts, route] },
  };
}

function showAll(group: RuleGroup, shown: boolean): void {
  for (const control of group.controls) showControl(control, shown);
  for (const text of group.texts) setFrameVisible(text, shown);
}

const onOff = (control: BarControl, text: string, on: boolean): void => {
  labelControl(control, on ? `${BAR_COLOURS.gold}${text}|r` : `${BAR_COLOURS.dim}${text}|r`);
};

function presentVersus(rules: RuleFrames, game: Readonly<MatchState>): void {
  const { stockCount, timeLimitMinutes, endless, automaticRematch, items } = game;
  setMenuText(rules.stocks.value, `${endless ? BAR_COLOURS.dim : BAR_COLOURS.gold}${stockSetting(stockCount)}|r`);
  setMenuText(rules.time.value, `${endless ? BAR_COLOURS.dim : BAR_COLOURS.gold}${timeSetting(timeLimitMinutes)}|r`);
  for (const control of [rules.stocks.less, rules.stocks.more, rules.time.less, rules.time.more]) {
    enableControl(control, !endless);
    labelControl(control, `${endless ? BAR_COLOURS.dim : BAR_COLOURS.cream}${control === rules.stocks.less || control === rules.time.less ? "−" : "+"}|r`);
  }
  onOff(rules.toggles.ultimates, ultimatesSetting(!game.ultimatesOff), !game.ultimatesOff);
  onOff(rules.toggles.items, itemsSetting(items.on), items.on);
  onOff(rules.toggles.endless, endlessSetting(endless), endless);
  onOff(rules.toggles.automaticRematch, automaticRematchSetting(automaticRematch), automaticRematch);
  rules.itemKinds.forEach((control, index) => {
    const kind = index === 0 ? ItemKind.speed : ItemKind.heavy;
    const on = (items.enabledMask & itemBit(kind)) !== 0;
    onOff(control, itemKindSetting(kind, on), on);
    showControl(control, items.on);
  });
}

function presentTraining(rules: RuleFrames, game: Readonly<MatchState>): void {
  const { trainer } = game;
  const { behaviour, escape, tech, damage } = rules.partner;
  setMenuText(behaviour.value, partnerBehaviourSetting(trainer.behaviour));
  setMenuText(escape.value, partnerEscapeSetting(trainer.escape));
  setMenuText(tech.value, partnerTechSetting(trainer.tech));
  setMenuText(damage.value, partnerDamageSetting(trainer.damage));
  onOff(rules.hitAreas, hitAreasSetting(trainer.showHitAreas), trainer.showHitAreas);
  onOff(rules.speed, trainingSpeedSetting(trainer.speed), trainer.speed !== 1);
}

function presentClassic(rules: RuleFrames, game: Readonly<MatchState>, clears: LoreClears, fighter: number): void {
  const { classicTier, lore, loreBattle: battle } = game;
  const chosen = loreBattle(battle);
  setMenuText(rules.classic.value, `${BAR_COLOURS.gold}${lore ? loreBattleSetting(battle, chosen !== undefined && clears.has(chosen.id)) : classicTierSetting(classicTier)}|r`);
  setMenuText(rules.route, lore ? loreBattleSummary(battle, clears.count()) : classicRouteSummary(fighter));
}

const HEADINGS = { versus: "Match Rules", training: "Training Partner", classic: "Classic Run", lore: "Lore Battle" } as const;

export function presentRules(rules: RuleFrames, game: Readonly<MatchState>, clears: LoreClears, fighter: number): void {
  const mode = matchMode(game);
  setMenuText(rules.heading, `${BAR_COLOURS.gold}${HEADINGS[mode]}|r`);
  showAll(rules.versus, mode === "versus");
  for (const control of rules.itemKinds) showControl(control, mode === "versus");
  showAll(rules.training, mode === "training");
  showAll(rules.classicFrames, mode === "classic" || mode === "lore");
  if (mode === "versus") presentVersus(rules, game);
  else if (mode === "training") presentTraining(rules, game);
  else presentClassic(rules, game, clears, fighter);
}

export interface DelayFrames {
  readonly line: BarControl;
  readonly less: BarControl;
  readonly more: BarControl;
}

export function createDelayControls(panel: Frame, suffix: string, add: AddRule): DelayFrames {
  const line = barControl(panel, `MeleeDelay${suffix}`, GEAR_ROWS.autoDelay, "Frame", BAR_SMALL_TEXT);
  if (line.button !== undefined) add(line.button, { kind: "inputDelay", step: 0 }, GEAR_ROWS.autoDelay);
  return {
    line,
    less: pressable(panel, add, `MeleeDelayLess${suffix}`, GEAR_ROWS.lessDelay, { kind: "inputDelay", step: -1 }, "−"),
    more: pressable(panel, add, `MeleeDelayMore${suffix}`, GEAR_ROWS.moreDelay, { kind: "inputDelay", step: 1 }, "+"),
  };
}

export function presentDelayControls(frames: DelayFrames, delayText: string, hostControl: boolean): void {
  labelControl(frames.line, delayText);
  enableControl(frames.line, hostControl);
  showControl(frames.less, hostControl);
  showControl(frames.more, hostControl);
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
  else if (button.kind === "matchMode") actions.chooseMatchMode(participantId, button.mode);
  else if (button.kind === "classicTier") actions.stepClassicTier(participantId, button.direction);
  else if (button.kind === "partner") actions.stepTraining(participantId, button.setting, button.direction);
  else if (button.kind === "hitAreas") actions.toggleHitAreas(participantId);
  else if (button.kind === "speed") actions.stepSpeed(participantId);
  else if (button.kind === "inputDelay") actions.changeInputDelay(participantId, button.step);
  else if (button.kind === "preset") actions.applyRulePreset(participantId, button.preset);
  else actions.toggleAutomaticRematch(participantId);
}

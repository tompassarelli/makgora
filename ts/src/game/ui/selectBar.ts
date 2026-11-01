import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { Action } from "../input/actions";
import { MATCH_MODES, type MatchMode, type MatchState, matchMode } from "../lobby/lobbyState";
import { ItemKind, itemBit } from "../sim/codes";
import { SELECT_LEVELS } from "./selectLevels";
import type { SelectText } from "./selectionActions";
import {
  BAR_CHECK_TEXTURE, BAR_CHEVRON_TEXTURE, BAR_CHEVRON_UP_TEXTURE, BAR_GEAR_TEXTURE, BAR_KEYS, BAR_ORDER, BAR_PANELS, BAR_STRIP, BAR_STRIP_TEXTURE, BAR_CHEVRONS, type BarBox, type BarItem, type BarPanel,
  GEAR_ICON, GEAR_ROWS, GUIDE_KEY, GUIDE_ROWS, MODE_ROWS, SELECT_BAR, barBoxContains, barTexture, panelHeading,
} from "../core/selectBarLayout";
import { BAR_COLOURS, BAR_SMALL_TEXT, BAR_TEXT, type BarControl, barControl, barText, clickArea, enableControl, labelControl, litControl, showControl, styleControl } from "./barFrames";
import { type DelayFrames, type RuleButton, type RuleFrames, createDelayControls, createRulesDrawer, presentDelayControls, presentRules, rulesKey } from "./selectionRules";
import { createBackdrop, placeTopLeft, setMenuText } from "./frames";
import { art } from "./selectionFrames";
import { createFrameByType, destroyFrame, Frame, setFrameLevel, setFrameSize, setFrameTexture, setFrameVisible, TextAlignment } from "wisp/game/frames";

export type BarButton = { kind: "barPanel"; panel: BarPanel } | { kind: "barClose" };
export type BarTarget = BarButton | RuleButton | { kind: "start" } | { kind: "settings" } | { kind: "moves" } | { kind: "tutorialOpen" } | { kind: "creditsOpen" } | { kind: "communityOpen" };
export type AddBarTarget = (frame: Frame, target: BarTarget, box: BarBox | undefined) => Frame;

const MODE_TEXT: Readonly<Record<MatchMode, string>> = {
  versus: "Fight players and computers",
  training: "Practise on a partner you set up",
  classic: "A run of fights ending with a boss",
  lore: "Story fights against set opponents",
};

const PANEL_OF: Readonly<Partial<Record<BarItem, BarPanel>>> = { mode: "mode", rules: "rules", guide: "guide", gear: "gear" };
const EMPTY_LIT: ReadonlySet<BarControl> = new Set();
const SEPARATOR = `${BAR_COLOURS.dim}  ·  |r`;

export interface BarStart {
  readonly ready: boolean;
  readonly text: string;
  readonly key: string | undefined;
}

export interface BarView {
  readonly game: Readonly<MatchState>;
  readonly fighter: number;
  readonly delayText: string;
  readonly delayBadge: string;
  readonly hostControl: boolean;
  readonly pointer: { readonly x: number; readonly y: number } | undefined;
  readonly focus: BarItem | undefined;
  readonly start: BarStart;
  readonly tutorial: boolean;
}

interface PadRow {
  readonly controls: readonly BarControl[];
  readonly press?: BarTarget;
  readonly step?: (direction: -1 | 1) => BarTarget | undefined;
}

interface ModeRow {
  readonly control: BarControl;
  readonly name: Frame;
  readonly about: Frame;
  readonly check: Frame;
}

function heading(panel: Frame, name: string, which: BarPanel, text: string): Frame {
  const frame = barText(panel, name, panelHeading(which), BAR_SMALL_TEXT, TextAlignment.left);
  setMenuText(frame, `${BAR_COLOURS.dim}${text}|r`);
  return frame;
}

function rowControl(parent: Frame, add: AddBarTarget, name: string, b: BarBox, target: BarTarget, text: string): BarControl {
  const control = barControl(parent, name, b, "Frame", BAR_TEXT, true, TextAlignment.left);
  labelControl(control, text);
  if (control.button !== undefined) add(control.button, target, undefined);
  return control;
}

function keyBadge(parent: Frame, name: string, b: BarBox, text: string): BarControl {
  const control = barControl(parent, name, b, "Key", BAR_SMALL_TEXT, false);
  labelControl(control, text);
  return control;
}

type Name = (part: string) => string;
type Lit = (control: BarControl, on: boolean) => void;

interface ToggleRow {
  readonly label: Frame;
  readonly toggle: BarControl;
}

interface ModePanel {
  readonly rows: readonly ModeRow[];
  readonly teamRow: ToggleRow;
  readonly friendlyRow: ToggleRow;
}

function createItems(root: Frame, name: Name, add: AddBarTarget): Readonly<Record<BarItem, BarControl>> {
  const item = (key: BarItem, target: BarTarget | undefined, align: TextAlignment = TextAlignment.center) => {
    const control = barControl(root, name(key), SELECT_BAR[key], key === "start" ? "Primary" : "Frame", BAR_TEXT, true, align);
    if (target !== undefined && control.button !== undefined) add(control.button, target, SELECT_BAR[key]);
    return control;
  };
  const items = {
    back: item("back", undefined),
    mode: item("mode", { kind: "barPanel", panel: "mode" }, TextAlignment.left),
    teams: item("teams", { kind: "teamBattle" }),
    rules: item("rules", { kind: "barPanel", panel: "rules" }),
    guide: item("guide", { kind: "barPanel", panel: "guide" }, TextAlignment.left),
    gear: item("gear", { kind: "barPanel", panel: "gear" }),
    start: item("start", { kind: "start" }, TextAlignment.left),
  };
  labelControl(items.back, `${BAR_COLOURS.cream}<  MENU|r`);
  labelControl(items.guide, `${BAR_COLOURS.cream}Guide|r`);
  return items;
}

function createPanel(parent: Frame, name: Name, which: BarPanel): Frame {
  const b = BAR_PANELS[which];
  // Engine: a panel stays enabled, because its row buttons are its children.
  const frame = createBackdrop(name(`Panel${which}`), parent, 0);
  setFrameTexture(frame, barTexture("Panel", b), 0, true);
  placeTopLeft(frame, b.x, b.y);
  setFrameSize(frame, b.width, b.height);
  setFrameLevel(frame, SELECT_LEVELS.barPanel);
  setFrameVisible(frame, false);
  return frame;
}

function modeRow(panel: Frame, name: Name, add: AddBarTarget, mode: MatchMode, index: number): ModeRow {
  const b = MODE_ROWS.modes[index] ?? MODE_ROWS.modes[0];
  const control = barControl(panel, name(`Mode${mode}`), b, "Frame", BAR_TEXT, true);
  if (control.button !== undefined) add(control.button, { kind: "matchMode", mode }, undefined);
  const half = f32(b.height / 2);
  const inset = f32(0.008);
  const title = barText(panel, name(`ModeName${mode}`), { x: f32(b.x + inset), y: f32(b.y - f32(0.002)), width: f32(b.width - f32(0.03)), height: half }, BAR_TEXT, TextAlignment.left);
  const about = barText(panel, name(`ModeAbout${mode}`), { x: f32(b.x + inset), y: f32(b.y - half), width: f32(b.width - f32(0.03)), height: half }, BAR_SMALL_TEXT, TextAlignment.left);
  setMenuText(about, `${BAR_COLOURS.dim}${MODE_TEXT[mode]}|r`);
  const size = f32(0.012);
  const check = art(panel, name(`ModeCheck${mode}`), BAR_CHECK_TEXTURE, f32(f32(b.x + b.width) - f32(0.02)), f32(b.y - f32(f32(b.height - size) / 2)), size, size);
  return { control, name: title, about, check };
}

function toggleRow(panel: Frame, name: Name, add: AddBarTarget, key: string, row: BarBox, toggle: BarBox, target: RuleButton, text: string): ToggleRow {
  const label = barText(panel, name(`${key}Label`), { x: f32(row.x + f32(0.008)), y: row.y, width: f32(toggle.x - row.x), height: row.height }, BAR_TEXT, TextAlignment.left);
  setMenuText(label, `${BAR_COLOURS.cream}${text}|r`);
  const control = barControl(panel, name(key), toggle, "Frame", BAR_SMALL_TEXT, true);
  if (control.button !== undefined) add(control.button, target, undefined);
  return { label, toggle: control };
}

function createModePanel(panel: Frame, name: Name, add: AddBarTarget): ModePanel {
  heading(panel, name("ModeHeading"), "mode", "SELECT MODE");
  return {
    rows: MATCH_MODES.map((mode, index) => modeRow(panel, name, add, mode, index)),
    teamRow: toggleRow(panel, name, add, "TeamBattle", MODE_ROWS.teamBattle, MODE_ROWS.teamToggle, { kind: "teamBattle" }, "Team Battle"),
    friendlyRow: toggleRow(panel, name, add, "FriendlyFire", MODE_ROWS.friendlyFire, MODE_ROWS.friendlyToggle, { kind: "friendlyFire" }, "Friendly Fire"),
  };
}

function createGuide(panel: Frame, name: Name, add: AddBarTarget): Readonly<Record<"controls" | "moves" | "tutorial", BarControl>> {
  heading(panel, name("GuideHeading"), "guide", "PLAYER GUIDE");
  keyBadge(panel, name("GuideRowKey"), GUIDE_KEY, `${BAR_COLOURS.gold}F1|r`);
  return {
    controls: rowControl(panel, add, name("GuideControls"), GUIDE_ROWS.controls, { kind: "settings" }, `${BAR_COLOURS.cream}Controls & Bindings|r`),
    moves: rowControl(panel, add, name("GuideMoves"), GUIDE_ROWS.moves, { kind: "moves" }, `${BAR_COLOURS.cream}Character Move List|r`),
    tutorial: rowControl(panel, add, name("GuideTutorial"), GUIDE_ROWS.tutorial, { kind: "tutorialOpen" }, `${BAR_COLOURS.cream}How to Play (Tutorial)|r`),
  };
}

function createGear(panel: Frame, name: Name): Readonly<Record<"community" | "credits", BarControl>> {
  heading(panel, name("GearHeading"), "gear", "SETTINGS");
  const gear = {
    community: barControl(panel, name("GearCommunity"), GEAR_ROWS.community, "Frame", BAR_TEXT, true, TextAlignment.left),
    credits: barControl(panel, name("GearCredits"), GEAR_ROWS.credits, "Frame", BAR_TEXT, true, TextAlignment.left),
  };
  labelControl(gear.community, `${BAR_COLOURS.cream}Community|r`);
  labelControl(gear.credits, `${BAR_COLOURS.cream}Credits|r`);
  return gear;
}

const teamsLabel = (game: Readonly<MatchState>): string => matchMode(game) !== "versus" ? `${BAR_COLOURS.dim}FFA|r` : game.teamBattle ? `${BAR_COLOURS.sky}TEAMS|r` : `${BAR_COLOURS.cream}FFA|r`;

/** The select screen's top bar: Back, Mode with its Teams toggle, the rules pill, Guide, the gear and Start, each panel opening under it. */
export class SelectBar {
  readonly root: Frame;
  private readonly scrim: Frame;
  readonly items: Readonly<Record<BarItem, BarControl>>;
  private readonly keys: Readonly<Record<"guide" | "gear" | "start", BarControl>>;
  private readonly chevrons: readonly (readonly [BarPanel, Frame])[];
  private readonly panels: Readonly<Record<BarPanel, Frame>>;
  private readonly modes: ModePanel;
  readonly guide: Readonly<Record<"controls" | "moves" | "tutorial", BarControl>>;
  readonly gear: Readonly<Record<"community" | "credits", BarControl>>;
  readonly rules: RuleFrames;
  private readonly delay: DelayFrames;
  private openPanel: BarPanel | undefined;
  private padRow = 0;
  private padActive = false;
  private shownKey: string | undefined;
  private shownChevron: BarPanel | undefined;

  constructor(parent: Frame, suffix: string, private text: SelectText, add: AddBarTarget) {
    const name = (part: string) => `MeleeBar${part}${suffix}`;
    this.scrim = clickArea(parent, name("Scrim"), { x: 0, y: f32(0.6), width: f32(0.8), height: f32(0.6) });
    setFrameLevel(this.scrim, SELECT_LEVELS.barScrim);
    add(this.scrim, { kind: "barClose" }, undefined);
    setFrameVisible(this.scrim, false);
    this.root = createFrameByType("FRAME", name("Root"), parent, "", 0);
    setFrameLevel(this.root, SELECT_LEVELS.bar);
    art(this.root, name("Strip"), BAR_STRIP_TEXTURE, BAR_STRIP.x, BAR_STRIP.y, BAR_STRIP.width, BAR_STRIP.height);
    this.items = createItems(this.root, name, add);
    art(this.root, name("GearIcon"), BAR_GEAR_TEXTURE, GEAR_ICON.x, GEAR_ICON.y, GEAR_ICON.width, GEAR_ICON.height);
    this.chevrons = (["mode", "rules", "guide"] as const).map(panel => {
      const b = BAR_CHEVRONS[panel];
      return [panel, art(this.root, name(`Chevron${panel}`), BAR_CHEVRON_TEXTURE, b.x, b.y, b.width, b.height)] as const;
    });
    this.keys = { guide: keyBadge(this.root, name("GuideKey"), BAR_KEYS.guide, `${BAR_COLOURS.gold}F1|r`), gear: keyBadge(this.root, name("GearKey"), BAR_KEYS.gear, ""), start: keyBadge(this.root, name("StartKey"), BAR_KEYS.start, "") };
    this.panels = { mode: createPanel(parent, name, "mode"), rules: createPanel(parent, name, "rules"), guide: createPanel(parent, name, "guide"), gear: createPanel(parent, name, "gear") };
    this.modes = createModePanel(this.panels.mode, name, add);
    this.rules = createRulesDrawer(this.panels.rules, suffix, (frame, target) => add(frame, target, undefined));
    this.guide = createGuide(this.panels.guide, name, add);
    this.delay = createDelayControls(this.panels.gear, suffix, (frame, target) => add(frame, target, undefined));
    this.gear = createGear(this.panels.gear, name);
  }

  bindText(text: SelectText): void {
    this.text = text;
    this.shownKey = undefined;
  }

  opened(): BarPanel | undefined {
    return this.openPanel;
  }

  /** Opens a panel, or closes it when it is the one open; a pad opening lights its first row. */
  toggle(panel: BarPanel, pad: boolean): void {
    this.openPanel = this.openPanel === panel ? undefined : panel;
    this.padRow = 0;
    this.padActive = pad;
  }

  close(): boolean {
    const was = this.openPanel !== undefined;
    this.openPanel = undefined;
    return was;
  }

  /** A pad or key press while a panel is open: what it presses, if anything; every press is the panel's while it is open. */
  padAction(action: Action, game: Readonly<MatchState>, hostControl: boolean, tutorial: boolean): BarTarget | undefined {
    const panel = this.openPanel;
    if (panel === undefined) return undefined;
    if (action === Action.special) {
      this.close();
      return undefined;
    }
    const rows = this.padRows(panel, game, hostControl, tutorial);
    if (rows.length === 0) return undefined;
    const index = this.padActive ? floorMod(this.padRow, rows.length) : 0;
    this.padActive = true;
    if (action === Action.moveUp || action === Action.moveDown) {
      this.padRow = floorMod(index + (action === Action.moveUp ? -1 : 1), rows.length);
      return undefined;
    }
    this.padRow = index;
    const row = rows[index];
    if (row === undefined) return undefined;
    if (action === Action.moveLeft || action === Action.moveRight) return row.step?.(action === Action.moveLeft ? -1 : 1);
    if (action === Action.attack) return row.press ?? row.step?.(1);
    return undefined;
  }

  private padRows(panel: BarPanel, game: Readonly<MatchState>, hostControl: boolean, tutorial: boolean): readonly PadRow[] {
    const press = (control: BarControl, target: BarTarget): PadRow => ({ controls: [control], press: target });
    if (panel === "mode") {
      const rows: PadRow[] = this.modes.rows.map((row, index) => press(row.control, { kind: "matchMode", mode: MATCH_MODES[index] ?? "versus" }));
      if (matchMode(game) === "versus") rows.push({ controls: [this.modes.teamRow.toggle], press: { kind: "teamBattle" }, step: () => ({ kind: "teamBattle" }) });
      if (matchMode(game) === "versus" && game.teamBattle) rows.push({ controls: [this.modes.friendlyRow.toggle], press: { kind: "friendlyFire" }, step: () => ({ kind: "friendlyFire" }) });
      return rows;
    }
    if (panel === "guide") return [press(this.guide.controls, { kind: "settings" }), press(this.guide.moves, { kind: "moves" }), ...(tutorial ? [press(this.guide.tutorial, { kind: "tutorialOpen" })] : [])];
    if (panel === "gear") {
      const delay: PadRow = hostControl
        ? { controls: [this.delay.line], press: { kind: "inputDelay", step: 0 }, step: direction => ({ kind: "inputDelay", step: direction }) }
        : { controls: [this.delay.line] };
      return [delay, press(this.gear.community, { kind: "communityOpen" }), press(this.gear.credits, { kind: "creditsOpen" })];
    }
    return this.ruleRows(game);
  }

  private ruleRows(game: Readonly<MatchState>): readonly PadRow[] {
    const { rules } = this;
    const mode = matchMode(game);
    const toggle = (control: BarControl, target: RuleButton): PadRow => ({ controls: [control], press: target, step: () => target });
    if (mode === "training") {
      const partner = (setting: "behaviour" | "escape" | "tech" | "damage"): PadRow => ({
        controls: [rules.partner[setting].less, rules.partner[setting].more], step: direction => ({ kind: "partner", setting, direction }),
      });
      return [partner("behaviour"), partner("escape"), partner("tech"), partner("damage"), toggle(rules.hitAreas, { kind: "hitAreas" }), toggle(rules.speed, { kind: "speed" })];
    }
    if (mode !== "versus") return [{ controls: [rules.classic.less, rules.classic.more], step: direction => ({ kind: "classicTier", direction }) }];
    const presets: PadRow[] = (["tourney", "party", "endless"] as const).map((preset, index) => ({ controls: [rules.presets[index] ?? rules.reset], press: { kind: "preset", preset } }));
    const kinds: PadRow[] = game.items.on ? [toggle(rules.itemKinds[0], { kind: "itemKind", item: ItemKind.speed }), toggle(rules.itemKinds[1], { kind: "itemKind", item: ItemKind.heavy })] : [];
    return [
      ...presets,
      { controls: [rules.stocks.less, rules.stocks.more], step: direction => game.endless ? undefined : { kind: "stocks", direction } },
      { controls: [rules.time.less, rules.time.more], step: direction => game.endless ? undefined : { kind: "time", direction } },
      toggle(rules.toggles.ultimates, { kind: "ultimates" }),
      toggle(rules.toggles.items, { kind: "items" }),
      toggle(rules.toggles.endless, { kind: "endless" }),
      toggle(rules.toggles.automaticRematch, { kind: "automaticRematch" }),
      ...kinds,
      { controls: [rules.reset], press: { kind: "preset", preset: "standard" } },
    ];
  }

  /** Whether the pointer is over a bar item or the open panel, for the menu hand. */
  over(x: number, y: number): boolean {
    for (const key of BAR_ORDER) if (barBoxContains(SELECT_BAR[key], x, y)) return true;
    const panel = this.openPanel;
    return panel !== undefined && barBoxContains(BAR_PANELS[panel], x, y);
  }

  /** Whether the pointer is over anything the bar draws, so clicks there never reach the grid under an open panel. */
  covers(x: number, y: number): boolean {
    if (barBoxContains(BAR_STRIP, x, y)) return true;
    const panel = this.openPanel;
    return panel !== undefined && barBoxContains(BAR_PANELS[panel], x, y);
  }

  present(view: BarView): void {
    const { pointer } = view;
    const open = this.openPanel;
    setFrameVisible(this.scrim, open !== undefined);
    for (const which of ["mode", "rules", "guide", "gear"] as const) setFrameVisible(this.panels[which], open === which);
    const hover = (control: BarControl) => pointer !== undefined && barBoxContains(control.box, pointer.x, pointer.y);
    const padLit = this.padLit(view);
    const lit: Lit = (control, on) => litControl(control, on || hover(control) || padLit.has(control));
    this.presentItems(view, lit, hover);
    if (open !== this.shownChevron) {
      this.shownChevron = open;
      for (const [panel, frame] of this.chevrons) setFrameTexture(frame, open === panel ? BAR_CHEVRON_UP_TEXTURE : BAR_CHEVRON_TEXTURE, 0, true);
    }
    if (open === "mode") this.presentMode(view.game, lit);
    else if (open === "rules") this.presentRules(view, lit);
    else if (open === "guide") this.presentGuide(view.tutorial, lit);
    else if (open === "gear") this.presentGear(view, lit);
  }

  private padLit(view: BarView): ReadonlySet<BarControl> {
    const open = this.openPanel;
    if (open === undefined || !this.padActive) return EMPTY_LIT;
    const rows = this.padRows(open, view.game, view.hostControl, view.tutorial);
    return new Set(rows[floorMod(this.padRow, Math.max(1, rows.length))]?.controls ?? []);
  }

  private presentItems(view: BarView, lit: Lit, hover: (control: BarControl) => boolean): void {
    const { game, start } = view;
    const open = this.openPanel;
    const versus = matchMode(game) === "versus";
    labelControl(this.items.mode, `${BAR_COLOURS.gold}${this.text.modeLabel(game)}|r`);
    labelControl(this.items.teams, teamsLabel(game));
    enableControl(this.items.teams, versus);
    labelControl(this.items.rules, this.text.rulesPill(game).map(part => `${BAR_COLOURS.gold}${part}|r`).join(SEPARATOR));
    labelControl(this.keys.gear, view.delayBadge);
    labelControl(this.items.start, `${BAR_COLOURS.cream}${start.ready ? "START" : start.text}|r`);
    labelControl(this.keys.start, start.key === undefined ? "" : `${BAR_COLOURS.gold}${start.key}|r`);
    showControl(this.keys.start, start.ready && start.key !== undefined);
    styleControl(this.items.start, !start.ready ? "Frame" : hover(this.items.start) ? "Lit" : "Primary");
    for (const key of BAR_ORDER) {
      const panel = PANEL_OF[key];
      if (key !== "start") lit(this.items[key], (panel !== undefined && open === panel) || view.focus === key || (key === "teams" && versus && game.teamBattle));
    }
  }

  private presentGuide(tutorial: boolean, lit: Lit): void {
    for (const control of [this.guide.controls, this.guide.moves, this.guide.tutorial]) lit(control, false);
    showControl(this.guide.tutorial, tutorial);
  }

  private presentGear(view: BarView, lit: Lit): void {
    presentDelayControls(this.delay, view.delayText, view.hostControl);
    for (const control of [this.delay.line, this.delay.less, this.delay.more, this.gear.community, this.gear.credits]) lit(control, false);
  }

  private presentMode(game: Readonly<MatchState>, lit: Lit): void {
    const mode = matchMode(game);
    const { rows, teamRow, friendlyRow } = this.modes;
    rows.forEach((row, index) => {
      const current = MATCH_MODES[index] === mode;
      setMenuText(row.name, `${current ? BAR_COLOURS.gold : BAR_COLOURS.cream}${this.text.modeName(MATCH_MODES[index] ?? "versus")}|r`);
      setFrameVisible(row.check, current);
      lit(row.control, current);
    });
    const versus = mode === "versus";
    setFrameVisible(teamRow.label, versus);
    showControl(teamRow.toggle, versus);
    labelControl(teamRow.toggle, game.teamBattle ? `${BAR_COLOURS.sky}ON (TEAMS)|r` : `${BAR_COLOURS.cream}OFF (FFA)|r`);
    lit(teamRow.toggle, game.teamBattle);
    const friendly = versus && game.teamBattle;
    setFrameVisible(friendlyRow.label, friendly);
    showControl(friendlyRow.toggle, friendly);
    labelControl(friendlyRow.toggle, game.friendlyFire ? `${BAR_COLOURS.gold}ON|r` : `${BAR_COLOURS.cream}OFF|r`);
    lit(friendlyRow.toggle, game.friendlyFire);
  }

  private presentRules(view: BarView, lit: Lit): void {
    const { game } = view;
    const mode = matchMode(game);
    const classic = mode === "classic" || mode === "lore" ? this.text.classicLines(game, view.fighter) : undefined;
    const key = rulesKey(game, classic);
    if (key !== this.shownKey) {
      this.shownKey = key;
      presentRules(this.rules, game, classic);
    }
    const { rules } = this;
    const steppers = [rules.stocks, rules.time, rules.partner.behaviour, rules.partner.escape, rules.partner.tech, rules.partner.damage, rules.classic];
    for (const stepper of steppers) for (const control of [stepper.less, stepper.more]) lit(control, false);
    for (const control of [...rules.presets, rules.reset]) lit(control, false);
    const toggles: readonly (readonly [BarControl, boolean])[] = [
      [rules.toggles.ultimates, !game.ultimatesOff], [rules.toggles.items, game.items.on], [rules.toggles.endless, game.endless], [rules.toggles.automaticRematch, game.automaticRematch],
      [rules.itemKinds[0], (game.items.enabledMask & itemBit(ItemKind.speed)) !== 0], [rules.itemKinds[1], (game.items.enabledMask & itemBit(ItemKind.heavy)) !== 0],
      [rules.hitAreas, game.trainer.showHitAreas], [rules.speed, game.trainer.speed !== 1],
    ];
    for (const [control, on] of toggles) lit(control, on);
  }

  destroy(): void {
    for (const which of ["mode", "rules", "guide", "gear"] as const) destroyFrame(this.panels[which]);
    destroyFrame(this.root);
    destroyFrame(this.scrim);
  }
}


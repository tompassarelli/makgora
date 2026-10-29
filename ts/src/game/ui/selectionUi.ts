import { SELECT_LEVELS } from "./selectLevels";
import { nextCpuCharacter, nextMatchCharacter, shownFighter } from "../lobby/lobbyState";
import { RULE_BUTTONS, RULE_HEIGHT, RULE_ROWS, type TrainingSetting, cpuSettingsBox, teamSettingsBox } from "./ruleButtons";
import { RULE_HELP_HEIGHT, RULE_HELP_WIDTH, hoveredRule, ruleHelp, visibleRuleGroups } from "./ruleHelp";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { Action } from "../input/actions";
import type { KeyBindings } from "../input/keyBindings";
import { createMenuPrompt, updateMenuPrompt } from "./menuPrompt";
import { bindPrototype } from "../../platform/rebind";
import { PARTICIPANT_SLOTS, type Slots } from "../input/participants";
import {
  type MatchState,
  Phase,
  allCharactersReady,
  canChooseComputer,
  validTeams,
  characterFor,
  characterReady,
  fighterActive,
  fighterMask,
  hasUnassignedHuman,
  humanActive,
  humanFighterActive,
} from "../lobby/lobbyState";
import { pointerX, pointerY } from "../menu/pointer";
import {
  type Placement,
  type Roster,
  type RosterChip,
  type RosterTile,
  HAND_WIDTH,
  HAND_HEIGHT,
  handLeft,
  handTop,
  clearSelectionDrag,
  decodeCpuPlacement,
  placeHovered,
  selectionDrag,
  updateSelectionDrag,
} from "../menu/selectionDrag";
import { cellRect, rosterGrid } from "../menu/selectionGrid";
import { MENU_FONT, MENU_STYLE, PANEL_TEXTURE, type TextBox } from "./hudLayout";
import { MOVES_BODY_BOX, MOVES_BOX, MOVES_BUTTON_HEIGHT, MOVES_BUTTON_TOP, MOVES_TITLE_BOX, SETTINGS_BOX, START_BUTTON, boxContains, selectionTitleBox } from "./selectionLayout";
import { PLAYABLE_CHARACTERS, nextSelectableCharacter } from "../roster/kits";
import {
  MOVES_HEADER, movesPage, itemsSetting, ultimatesSetting, itemKindSetting, automaticRematchSetting, selectionModeLabel, endlessSetting, hitAreasSetting, partnerBehaviourSetting, partnerDamageSetting,
  partnerEscapeSetting, partnerTechSetting, stockSetting, timeSetting, trainingSpeedSetting,
} from "../session/messages";
import { classicRouteSummary, classicTierSetting } from "../classic/classicText";
import { loreBattle, loreBattleSetting, loreBattleSummary } from "../classic/loreBattles";
import { type LoreClears, loreClears } from "../classic/loreClears";
import { Character, ItemKind, itemBit } from "../sim/codes";
import { TILE_PORTRAIT_SLOT, tilePortrait } from "./portraitFrames";
import { CreditsMenu } from "./creditsMenu";
import { CommunityMenu } from "./communityMenu";
import { type TutorialButton, type TutorialMenuFrames, createTutorialMenu, showTutorialLesson, markTutorialSeen, offersTutorial, tutorialAvailable, tutorialSeen } from "./tutorialMenu";
import { ButtonClicks, type MenuControls, bindSyncHandler, createBackdrop, createSyncTrigger, createText, createWindowBackdrop, fitToWindow, gameUi, highlightText, placeTopLeft, setFrameText, sizeText } from "./frames";
import { ROSTER_TILES, art, characterOfTile, decodeSlot, decodeTile, label, modeBox, portraitTexture, tileLabel, tileOfCharacter, tileOffered } from "./selectionFrames";
import { type CardButton, type CardFrames, type MenuFocus, cardPalette, createCard, menuFocusList, pointedCard, presentCardChip, presentCardCostume, presentCardCpu, presentCardStatus, presentCardTag, presentCardTeam } from "./selectionCards";
import { type DelayFrames, type RuleButton, type RuleFrames, applyRuleButton, createClassicRules, createDelayControls, createMatchRules, presentDelayControls } from "./selectionRules";
import { panelButton } from "./infoPanel";
import type { LobbyNet, SelectionActions } from "./selectionActions";
import { CPU_OPPONENT_CHOICE_DEFAULT, CPU_TIER_DEFAULT } from "../match/cpuProfiles";
import { type CpuButton, type CpuDefaults, type CpuSettingsFrames, cpuMenuFocus, createCpuSettings, showCpuSettings } from "./selectionCpuSettings";


type SelectionButton = { kind: "tile"; tile: number } | CardButton | CpuButton | { kind: "start" } | { kind: "settings" } | RuleButton
  | { kind: "moves" } | { kind: "movesBack" } | { kind: "movesStep"; direction: -1 | 1 } | TutorialButton;

const DELAY_TEXT_SIZE = f32(0.0095);
const TILE_NAME_INSET = f32(0.008);
const TILE_NAME_SIZE = f32(0.0078);
const CPU_DEFAULTS: CpuDefaults = { opponent: CPU_OPPONENT_CHOICE_DEFAULT, tier: CPU_TIER_DEFAULT };

function rulesKey(game: Readonly<MatchState>, clears: LoreClears, fighter: number): string {
  const { stockCount, timeLimitMinutes, endless, automaticRematch, training, trainer, items, classic, classicTier, lore, loreBattle: battle } = game;
  return `${lore ? "1" : "0"} ${I2S(battle)} ${I2S(clears.count())} ${classic ? "1" : "0"} ${I2S(classicTier)} ${I2S(fighter)} ${I2S(stockCount)} ${I2S(timeLimitMinutes)} ${endless ? "1" : "0"} ${automaticRematch ? "1" : "0"} ${training ? "1" : "0"} ${I2S(trainer.behaviour)} ${I2S(trainer.escape)} ${I2S(trainer.tech)} ${I2S(trainer.damage)} ${trainer.showHitAreas ? "1" : "0"} ${I2S(trainer.speed)} ${items.on ? "1" : "0"} ${game.ultimatesOff ? "1" : "0"} ${I2S(items.enabledMask)} ${I2S(trainer.lesson)} ${game.teamBattle ? "1" : "0"} ${game.friendlyFire ? "1" : "0"}`;
}

function presentMatchRules(rules: RuleFrames, game: Readonly<MatchState>): void {
  const { stockCount, timeLimitMinutes, endless, automaticRematch, training, items, classic, lore } = game;
  setFrameText(rules.stockValue, `${MENU_STYLE.gold}${stockSetting(stockCount)}|r`);
  setFrameText(rules.timeValue, `${MENU_STYLE.gold}${timeSetting(timeLimitMinutes)}|r`);
  setFrameText(rules.teamToggle, `Team Battle: ${game.teamBattle ? "On" : "Off"}`);
  setFrameText(rules.friendlyFireToggle, `Friendly Fire: ${game.friendlyFire ? "On" : "Off"}`);
  setFrameText(rules.endlessToggle, endlessSetting(endless));
  setFrameText(rules.rematchToggle, automaticRematchSetting(automaticRematch));
  for (const step of rules.steps) BlzFrameSetEnable(step, !endless);
  setFrameText(rules.itemsToggle, itemsSetting(items.on));
  setFrameText(rules.ultimatesToggle, ultimatesSetting(!game.ultimatesOff));
  for (let index = 0; index < rules.itemToggles.length; index++) {
    const frame = rules.itemToggles[index];
    if (frame === undefined) continue;
    const kind = index === 0 ? ItemKind.speed : ItemKind.heavy;
    setFrameText(frame, itemKindSetting(kind, (items.enabledMask & itemBit(kind)) !== 0));
    BlzFrameSetVisible(frame, items.on && !training && !classic && !lore);
  }
}

function presentModeRules(rules: RuleFrames, game: Readonly<MatchState>, clears: LoreClears, fighter: number, tutorial: TutorialMenuFrames): void {
  const { trainer, classicTier, lore, loreBattle: battle } = game;
  setFrameText(rules.trainingToggle, `${MENU_STYLE.gold}${selectionModeLabel(game)}|r`);
  const chosen = loreBattle(battle);
  setFrameText(rules.classicTierValue, lore ? loreBattleSetting(battle, chosen !== undefined && clears.has(chosen.id)) : classicTierSetting(classicTier));
  setFrameText(rules.classicRoute, lore ? loreBattleSummary(battle, clears.count()) : classicRouteSummary(fighter));
  showTutorialLesson(tutorial, trainer.lesson);
  setFrameText(rules.hitAreasToggle, hitAreasSetting(trainer.showHitAreas));
  setFrameText(rules.speedToggle, trainingSpeedSetting(trainer.speed));
  const [behaviour, escape, tech, damage] = rules.partnerValues;
  if (behaviour !== undefined) setFrameText(behaviour, partnerBehaviourSetting(trainer.behaviour));
  if (escape !== undefined) setFrameText(escape, partnerEscapeSetting(trainer.escape));
  if (tech !== undefined) setFrameText(tech, partnerTechSetting(trainer.tech));
  if (damage !== undefined) setFrameText(damage, partnerDamageSetting(trainer.damage));
}

function presentRuleVisibility(rules: RuleFrames, game: Readonly<MatchState>): void {
  const { training, items, classic, lore } = game;
  for (const frame of rules.matchRuleFrames) BlzFrameSetVisible(frame, !training && !classic && !lore);
  for (const frame of rules.itemToggles) BlzFrameSetVisible(frame, items.on && !training && !classic && !lore);
  BlzFrameSetVisible(rules.friendlyFireToggle, game.teamBattle && !training && !classic && !lore);
  for (const frame of rules.trainingFrames) BlzFrameSetVisible(frame, training);
  for (const frame of rules.classicFrames) BlzFrameSetVisible(frame, classic || lore);
}

function presentRules(rules: RuleFrames, game: Readonly<MatchState>, clears: LoreClears, fighter: number, tutorial: TutorialMenuFrames): void {
  presentMatchRules(rules, game);
  presentModeRules(rules, game, clears, fighter, tutorial);
  presentRuleVisibility(rules, game);
}

export class SelectionPanel {
  private readonly tiles: framehandle[][] = [];
  private readonly tilePortraits: framehandle[] = [];
  private shownTilePalette: number | undefined;
  private readonly tileButtons: framehandle[] = [];
  private readonly root: framehandle;
  private readonly backdrop: framehandle;
  private readonly confirm: framehandle;
  private readonly settingsLabel: framehandle;
  private readonly movesLabel: framehandle;
  private readonly cards: readonly CardFrames[];
  private readonly clicks: ButtonClicks<SelectionButton>;
  private readonly syncTriggers: readonly trigger[];
  private readonly drag = selectionDrag();
  private readonly hand: framehandle;
  private cursorEnabled: boolean | undefined;
  private menuCursorAllowed = true;

  private readonly chips: RosterChip[] = PARTICIPANT_SLOTS.map(() => ({ choice: 0, placed: false }));
  private readonly roster: Roster = { grid: rosterGrid(ROSTER_TILES), selectable: 0, chips: this.chips };

  private game: Readonly<MatchState> | undefined;
  private settingsOpen = false;
  private hovered: SelectionButton | undefined;

  private movesOpen = false;
  private movesCharacter: number = Character.rifleman;
  private shownMoves = -1;
  private readonly movesFrames: readonly framehandle[];
  private readonly movesTitle: framehandle;
  private readonly movesBody: framehandle;
  private readonly delay: DelayFrames;
  private net: LobbyNet = { delayText: "", hostControl: false, echoes: PARTICIPANT_SLOTS.map(() => "") };

  private readonly modeLabel: framehandle;
  private readonly rules: RuleFrames;

  private shownRules: string | undefined;
  private readonly help: framehandle;
  private readonly helpText: framehandle;
  private shownHelp: string | undefined;
  private cpuSlot: number | undefined;
  private cpuFocus: 0 | 1 | 2 = 0;
  private menuFocus: MenuFocus | undefined;
  private readonly cpu: CpuSettingsFrames;
  private readonly menuPrompt = createMenuPrompt();
  private readonly tutorial: TutorialMenuFrames;
  readonly credits: CreditsMenu;
  readonly community: CommunityMenu;

  private tutorialOpen = false;
  private tutorialOffered = false;

  private seen: boolean | undefined;

  constructor(
    private actions: SelectionActions,
    readonly participantId: number,
    private readonly controls: MenuControls,
    version: string,
  ) {
    const suffix = I2S(participantId);
    const height = BlzGetLocalClientHeight();
    const titleBox = selectionTitleBox(height <= 0 ? f32(4.0 / 3.0) : I2R(BlzGetLocalClientWidth()) / I2R(height));
    const headerBoxLeft = f32(0.05);
    const headerInset = f32(0.022);
    const headerLeft = f32(headerBoxLeft + headerInset);
    this.clicks = new ButtonClicks(`ui.selection.${suffix}.click`, (button, clicker) => this.click(button, clicker), button => this.highlight(button));
    this.backdrop = createWindowBackdrop(`MeleeSelectBackdrop${suffix}`, MENU_STYLE.panelTexture, 400 + participantId);
    const root = BlzCreateFrameByType("FRAME", `MeleeSelectRoot${suffix}`, gameUi(), "", 0);
    this.root = root;
    const grid = this.roster.grid;
    const scale = f32(grid.scale);
    for (let choice = 0; choice < grid.count; choice++) {
      const { left, top } = cellRect(grid, choice);
      const x = f32(left);
      const y = f32(top);
      const name = `${suffix}_${I2S(choice)}`;
      const tileFrame = art(root, `MeleeTile${name}`, MENU_STYLE.borderTexture, x, y, f32(grid.cellWidth), f32(grid.cellHeight));
      const portrait = tilePortrait(scale);
      const inset = (TILE_PORTRAIT_SLOT * scale - portrait) / 2;
      const tilePortraitFrame = art(root, `MeleeTilePortrait${name}`, portraitTexture(characterOfTile(choice), true), x + f32(0.0125) * scale + inset, y - f32(0.013) * scale - inset, portrait, portrait);
      const text = tileLabel(choice);
      const tileName = label(root, `MeleeTileName${name}`, x + TILE_NAME_INSET * scale, y - f32(0.106) * scale, f32(grid.cellWidth) - 2 * TILE_NAME_INSET * scale, f32(0.023) * scale, TILE_NAME_SIZE);
      setFrameText(tileName, text);
      this.tiles.push([tileFrame, tilePortraitFrame, tileName]);
      this.tilePortraits.push(tilePortraitFrame);
      const button = BlzCreateFrameByType("BUTTON", `MeleeTileButton${name}`, root, "", 0);
      placeTopLeft(button, x, y);
      BlzFrameSetSize(button, f32(grid.cellWidth), f32(grid.cellHeight));
      this.tileButtons.push(this.clicks.add(button, { kind: "tile", tile: choice }, undefined, "native"));
    }
    this.cards = PARTICIPANT_SLOTS.map(slot => createCard(root, suffix, slot, (frame, target) => this.clicks.add(frame, target, undefined, "native")));
    this.hand = art(root, `MeleeHand${suffix}`, "war3mapImported\\SelectionHandPinch.tga", 0.0, 0.0, HAND_WIDTH, HAND_HEIGHT);
    BlzFrameSetLevel(this.hand, SELECT_LEVELS.hand);
    BlzFrameSetVisible(this.hand, false);
    const headerButton = (box: typeof START_BUTTON, text: string, target: SelectionButton) => {
      const frame = panelButton(root, box.x, box.y, box.width, box.height, "");
      setFrameText(frame, text);
      return this.clicks.add(frame, target, undefined, "native");
    };
    this.confirm = headerButton(START_BUTTON, "", { kind: "start" });
    this.settingsLabel = headerButton(SETTINGS_BOX, "Controls (F1)", { kind: "settings" });
    this.movesLabel = headerButton(MOVES_BOX, "Moves", { kind: "moves" });
    const page = (frame: framehandle, x: number, y: number, width: number, height: number) => {
      placeTopLeft(frame, x, y);
      BlzFrameSetSize(frame, width, height);
      BlzFrameSetVisible(frame, false);
      return frame;
    };
    const at = (frame: framehandle, box: TextBox) => page(frame, box.left, box.top, box.width, box.height);
    this.movesTitle = at(createText(`MeleeMovesTitle${suffix}`, gameUi(), 470 + participantId), MOVES_TITLE_BOX);
    BlzFrameSetFont(this.movesTitle, MENU_FONT, f32(0.016), 0);
    BlzFrameSetTextAlignment(this.movesTitle, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
    this.movesBody = at(createText(`MeleeMovesBody${suffix}`, gameUi(), 474 + participantId), MOVES_BODY_BOX);
    BlzFrameSetFont(this.movesBody, MENU_FONT, f32(0.012), 0);
    BlzFrameSetTextAlignment(this.movesBody, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_LEFT);
    const pageButton = (name: string, x: number, width: number, text: string, target: SelectionButton) => {
      const frame = page(BlzCreateFrameByType("GLUETEXTBUTTON", name, gameUi(), "ScriptDialogButton", 0), x, MOVES_BUTTON_TOP, width, MOVES_BUTTON_HEIGHT);
      setFrameText(frame, text);
      return this.clicks.add(frame, target, undefined, "native");
    };
    this.modeLabel = page(createText(`MeleeModeLabel${suffix}`, gameUi(), 478 + participantId), titleBox.left, titleBox.top, titleBox.width, titleBox.height);
    sizeText(this.modeLabel, MENU_STYLE.headerSize, f32(f32(0.295) - 2 * headerInset), RULE_HEIGHT);
    placeTopLeft(this.modeLabel, headerLeft, RULE_ROWS[1]);
    BlzFrameSetTextAlignment(this.modeLabel, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_LEFT);
    BlzFrameSetEnable(this.modeLabel, false);
    setFrameText(this.modeLabel, `${MENU_STYLE.gold}${MOVES_HEADER}|r`);
    this.movesFrames = [
      this.movesTitle, this.movesBody,
      pageButton(`MeleeMovesPrevious${suffix}`, f32(0.2), f32(0.1), "<", { kind: "movesStep", direction: -1 }),
      pageButton(`MeleeMovesBack${suffix}`, f32(0.33), f32(0.14), "Back", { kind: "movesBack" }),
      pageButton(`MeleeMovesNext${suffix}`, f32(0.5), f32(0.1), ">", { kind: "movesStep", direction: 1 }),
    ];

    this.cpu = createCpuSettings(participantId, (frame, target, text) => this.clicks.add(frame, target, text, "native"));
    const ruleClick = (frame: framehandle, target: RuleButton) => this.clicks.add(frame, target, undefined, "native");
    const matchRules = createMatchRules(root, suffix, ruleClick);
    this.delay = createDelayControls(root, ruleClick, DELAY_TEXT_SIZE);
    presentDelayControls(this.delay, false);
    this.tutorial = createTutorialMenu(gameUi(), root, suffix, (frame, target) => this.clicks.add(frame, target,
      target.kind === "tutorialOpen" ? "Tutorial" : target.kind === "tutorialStart" ? "Start tutorial" : target.kind === "tutorialClose" ? "Not now" : target.direction < 0 ? "−" : "+", "native"));
    this.credits = new CreditsMenu(gameUi(), root, suffix, version, participantId);
    this.community = new CommunityMenu(gameUi(), root, suffix, participantId);
    this.credits.onOpen = () => this.community.close();
    this.community.onOpen = () => this.credits.close();
    this.rules = createClassicRules(root, suffix, ruleClick, matchRules);
    this.help = createBackdrop(`MeleeRuleHelp${suffix}`, root, 0);
    BlzFrameSetTexture(this.help, PANEL_TEXTURE, 0, true);
    BlzFrameSetSize(this.help, RULE_HELP_WIDTH, RULE_HELP_HEIGHT);
    BlzFrameSetLevel(this.help, SELECT_LEVELS.ruleHelp);
    BlzFrameSetEnable(this.help, false);
    this.helpText = createText(`MeleeRuleHelpText${suffix}`, this.help, 0);
    BlzFrameSetPoint(this.helpText, FRAMEPOINT_TOPLEFT, this.help, FRAMEPOINT_TOPLEFT, f32(0.008), f32(-0.006));
    BlzFrameSetPoint(this.helpText, FRAMEPOINT_BOTTOMRIGHT, this.help, FRAMEPOINT_BOTTOMRIGHT, f32(-0.008), f32(0.006));
    BlzFrameSetFont(this.helpText, MENU_FONT, f32(0.0095), 0);
    BlzFrameSetTextAlignment(this.helpText, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_LEFT);
    BlzFrameSetEnable(this.helpText, false);
    BlzFrameSetVisible(this.help, false);
    const owner = [participantId];
    this.syncTriggers = [
      createSyncTrigger(`ui.selection.${suffix}.drop`, "fighter-drop", owner, (_, data) => this.acceptDrop(data)),
      createSyncTrigger(`ui.selection.${suffix}.cpuDrop`, "cpu-fighter-drop", owner, (_, data) => this.acceptCpuDrop(data)),
      createSyncTrigger(`ui.selection.${suffix}.recall`, "fighter-recall", owner, (_, data) => this.acceptRecall(data)),
    ];
    BlzFrameSetVisible(root, false);
    BlzFrameSetVisible(this.backdrop, false);
  }

  bindActions(actions: SelectionActions): void {
    this.actions = actions;
    bindPrototype(this.clicks, ButtonClicks.prototype);
    this.clicks.bindHandler((button, clicker) => this.click(button, clicker), button => this.highlight(button));
    this.credits.bindActions();
    this.community.bindActions();
    const suffix = I2S(this.participantId);
    bindSyncHandler(`ui.selection.${suffix}.drop`, (_, data) => this.acceptDrop(data));
    bindSyncHandler(`ui.selection.${suffix}.cpuDrop`, (_, data) => this.acceptCpuDrop(data));
    bindSyncHandler(`ui.selection.${suffix}.recall`, (_, data) => this.acceptRecall(data));
  }

  destroy(): void {
    if (this.ownsLocalClient()) this.showHand(false, 0.0, 0.0);
    this.clicks.destroy();
    for (const trigger of this.syncTriggers) DestroyTrigger(trigger);
    for (const frame of this.movesFrames) BlzDestroyFrame(frame);
    BlzDestroyFrame(this.modeLabel);
    BlzDestroyFrame(this.tutorial.root);
    this.credits.destroy();
    this.community.destroy();
    BlzDestroyFrame(this.hand);
    if (this.cpu.root !== undefined) BlzDestroyFrame(this.cpu.root);
    BlzDestroyFrame(this.root);
    BlzDestroyFrame(this.backdrop);
  }

  private click(button: SelectionButton, clicker: player): void {
    if (clicker !== Player(this.participantId)) return;
    if (this.cpuSlot !== undefined && button.kind !== "cpuStep" && button.kind !== "cpuClose") return;
    if (button.kind === "tile") {
      const game = this.choosing();
      if (game === undefined || !tileOffered(game, button.tile)) return;
      if (this.ownsLocalClient()) this.sendPlacement({ slot: this.drag.held ?? this.participantId, tile: button.tile });
    }
    else if (button.kind === "team") this.actions.changeTeam(this.participantId, button.slot, 1);
    else if (button.kind === "costume") this.actions.changeCostume(this.participantId, button.slot, 1);
    else if (button.kind === "mode") this.actions.cycleMode(this.participantId, button.slot);
    else if (button.kind === "start") this.actions.start(this.participantId);
    else if (button.kind === "settings") this.actions.openSettings(this.participantId);
    else if (button.kind === "moves") this.openMoves();
    else if (button.kind === "movesBack") this.movesOpen = false;
    else if (button.kind === "movesStep") this.movesCharacter = nextSelectableCharacter(this.movesCharacter, button.direction);
    else if (button.kind === "cpuSettings") this.openCpuSettings(button.slot);
    else if (button.kind === "cpuStep") this.stepCpu(button.row, button.direction);
    else if (button.kind === "cpuClose") this.closeCpuSettings();
    else if (button.kind === "tutorialOpen") this.tutorialOpen = true;
    else if (button.kind === "tutorialStep") this.actions.stepTutorial(this.participantId, button.direction);
    else if (button.kind === "tutorialStart" || button.kind === "tutorialClose") {
      this.tutorialOpen = false;
      if (this.ownsLocalClient()) this.markSeen();
      if (button.kind === "tutorialStart") this.actions.startTutorial(this.participantId);
      else this.actions.closeTutorial(this.participantId);
    }
    else applyRuleButton(this.actions, this.participantId, button);
  }


  private pointedDialog(game: Readonly<MatchState>, x: number, y: number): SelectionButton | undefined {
    if (boxContains(START_BUTTON, x, y)) return { kind: "start" };
    if (boxContains(MOVES_BOX, x, y)) return { kind: "moves" };
    if (boxContains(SETTINGS_BOX, x, y)) return { kind: "settings" };
    if (this.drag.hover !== undefined) return { kind: "tile", tile: this.drag.hover };
    for (const slot of PARTICIPANT_SLOTS) {
      const card = pointedCard(game, slot, x, y);
      if (card !== undefined) return card;
    }
    return undefined;
  }

  private highlight(button: SelectionButton | undefined, updateDrag = true): void {
    if (updateDrag) this.hovered = button;
    const tile = button?.kind === "tile" ? button.tile : undefined;
    for (let slot = 0; slot < this.cards.length; slot++) {
      const card = this.cards[slot];
      if (card !== undefined) highlightText(card.teamLabel, button?.kind === "team" && button.slot === slot);
      if (card !== undefined) highlightText(card.tag, button?.kind === "mode" && button.slot === slot);
      if (card !== undefined) highlightText(card.settingsLabel, button?.kind === "cpuSettings" && button.slot === slot);
    }
    highlightText(this.confirm, button?.kind === "start");
    setFrameText(this.settingsLabel, button?.kind === "settings" ? "> Controls (F1) <" : "Controls (F1)");
    highlightText(this.movesLabel, button?.kind === "moves");
    if (updateDrag) this.drag.hover = tile;
    for (let index = 0; index < this.tiles.length; index++) {
      const name = this.tiles[index]?.[2];
      if (name !== undefined) highlightText(name, index === tile);
    }
  }

  private choosing(): Readonly<MatchState> | undefined {
    const { game } = this;
    return game === undefined || game.phase !== Phase.characterMenu || this.settingsOpen || !humanActive(game, this.participantId) ? undefined : game;
  }

  private openCpuSettings(slot: number): void {
    const game = this.choosing();
    if (game === undefined || !fighterActive(game, slot) || humanFighterActive(game, slot)) return;
    this.cpuSlot = slot;
    this.cpuFocus = 0;
    this.menuFocus = { kind: "settings", slot };
    clearSelectionDrag(this.drag);
  }

  private closeCpuSettings(): void {
    this.cpuSlot = undefined;
    if (this.ownsLocalClient()) BlzFrameSetFocus(this.cpu.done, false);
  }

  private stepCpu(row: 0 | 1, direction: -1 | 1): void {
    const { game, cpuSlot } = this;
    if (game === undefined || cpuSlot === undefined || !canChooseComputer(game, this.participantId, cpuSlot)) return;
    this.cpuFocus = row;
    if (row === 0) this.actions.changeCpuOpponent(this.participantId, cpuSlot, direction);
    else this.actions.changeCpuTier(this.participantId, cpuSlot, direction);
  }


  consumeStart(): boolean {
    if (this.cpuSlot === undefined) return false;
    this.closeCpuSettings();
    return true;
  }

  cpuSettingsOpen(): boolean {
    return this.cpuSlot !== undefined;
  }


  hasCpuSettingsFrames(): boolean {
    return this.cpu.root !== undefined && this.tutorial !== undefined;
  }


  menuAction(action: Action): boolean {
    const game = this.choosing();
    if (game === undefined) return false;
    const { cpuSlot } = this;
    if (cpuSlot !== undefined) {
      this.cpuFocus = cpuMenuFocus(this.cpuFocus, action, () => this.closeCpuSettings(), (row, direction) => this.stepCpu(row, direction));
      return true;
    }
    const focus = menuFocusList(game, this.participantId);
    if (focus.length === 0) return false;
    let index = focus.findIndex(item => item.kind === this.menuFocus?.kind && item.slot === this.menuFocus.slot);
    if (index < 0) index = 0;
    if (action === Action.moveUp || action === Action.moveDown) {
      this.menuFocus = focus[floorMod(index + (action === Action.moveUp ? -1 : 1), focus.length)];
      return true;
    }
    const target = focus[index];
    if (target === undefined) return false;
    if (target.kind === "teamBattle" || target.kind === "friendlyFire" || target.kind === "team") return this.toggleFocus(target, action);
    if (target.kind === "settings") {
      if (action === Action.attack) this.openCpuSettings(target.slot);
      return action === Action.attack || action === Action.moveLeft || action === Action.moveRight;
    }
    return this.chooseFocus(game, target, action);
  }

  private toggleFocus(target: MenuFocus, action: Action): boolean {
    if (action !== Action.attack && action !== Action.moveLeft && action !== Action.moveRight) return false;
    if (target.kind === "teamBattle") this.actions.toggleTeamBattle(this.participantId);
    else if (target.kind === "friendlyFire") this.actions.toggleFriendlyFire(this.participantId);
    else this.actions.changeTeam(this.participantId, target.slot, action === Action.moveLeft ? -1 : 1);
    return true;
  }

  private chooseFocus(game: Readonly<MatchState>, target: MenuFocus, action: Action): boolean {
    if (action === Action.jump) {
      this.actions.changeCostume(this.participantId, target.slot, 1);
      return true;
    }
    if (action === Action.moveLeft || action === Action.moveRight) {
      const direction = action === Action.moveLeft ? -1 : 1;
      if (target.slot === this.participantId) this.actions.selectChoice(this.participantId, nextMatchCharacter(game, characterFor(game, target.slot), direction));
      else this.actions.selectCpuChoice(this.participantId, target.slot, nextCpuCharacter(game, target.slot, direction));
      return true;
    }
    if (action === Action.attack && this.menuFocus !== undefined) {
      const choice = characterFor(game, target.slot) ?? Character.rifleman;
      if (target.slot === this.participantId) this.actions.selectChoice(this.participantId, choice);
      else this.actions.selectCpuChoice(this.participantId, target.slot, shownFighter(game, target.slot) ?? choice);
      return true;
    }
    return false;
  }

  menuBindings(bindings: Readonly<KeyBindings>): void {
    updateMenuPrompt(this.menuPrompt, this.controls, bindings);
  }

  private acceptDrop(data: string): void {
    const tile = decodeTile(data);
    if (this.choosing() !== undefined && tile !== undefined) this.actions.selectChoice(this.participantId, characterOfTile(tile));
  }


  private acceptCpuDrop(data: string): void {
    const game = this.choosing();
    const placement = decodeCpuPlacement(data, ROSTER_TILES);
    if (game !== undefined && placement !== undefined && canChooseComputer(game, this.participantId, placement.slot)) this.actions.selectCpuChoice(this.participantId, placement.slot, characterOfTile(placement.tile));
  }

  private acceptRecall(data: string): void {
    const chip = decodeSlot(data);
    if (this.choosing() !== undefined && chip !== undefined) this.actions.recallChoice(this.participantId, chip);
  }

  private showHand(shown: boolean, x: number, y: number): void {
    BlzFrameSetVisible(this.hand, shown);
    if (shown) placeTopLeft(this.hand, handLeft(x, true), handTop(y, true));
    const enabled = !shown && this.menuCursorAllowed;
    // Warcraft shows its cursor again on its own (a frame click), so the hidden state is asserted every update; the shown state is sent once.
    if (!enabled || this.cursorEnabled !== true) BlzEnableCursor(enabled);
    this.cursorEnabled = enabled;
  }

  private ownsLocalClient(): boolean {
    return GetLocalPlayer() === Player(this.participantId);
  }

  private sendPlacement({ slot, tile }: Placement): void {
    const game = this.choosing();
    if (game === undefined) return;
    if (slot === this.participantId && humanFighterActive(game, slot)) BlzSendSyncData("fighter-drop", I2S(tile));
    else if (canChooseComputer(game, this.participantId, slot)) BlzSendSyncData("cpu-fighter-drop", `${I2S(slot)}${I2S(tile)}`);
  }


  hoveredTile(): number | undefined {
    return this.drag.hover;
  }


  placeHovered(): void {
    if (!this.ownsLocalClient()) return;
    const placement = placeHovered(this.drag);
    if (placement !== undefined) this.sendPlacement(placement);
  }


  recallHeld(): void {
    const { held } = this.drag;
    if (this.ownsLocalClient() && this.choosing() !== undefined && held !== undefined) BlzSendSyncData("fighter-recall", I2S(held));
  }

  private isSeen(): boolean {
    this.seen ??= tutorialSeen();
    return this.seen;
  }

  private markSeen(): void {
    if (this.isSeen()) return;
    this.seen = true;
    markTutorialSeen();
  }


  showDelay(net: LobbyNet): void {
    this.net = net;
    setFrameText(this.delay.line, net.delayText);
    presentDelayControls(this.delay, net.hostControl);
  }

  update(game: Readonly<MatchState>, loading: boolean, settingsOpen: boolean, menuCursorAllowed: boolean, sessionWins: Readonly<Slots<number>>): void {
    this.game = game;
    this.settingsOpen = loading || settingsOpen;
    if (this.choosing() === undefined) this.cpuSlot = undefined;
    if (!this.ownsLocalClient()) return;
    this.menuCursorAllowed = menuCursorAllowed;
    const { participantId, drag } = this;
    const visible = this.choosing() !== undefined;
    const cpuOpen = visible && this.cpuSlot !== undefined;

    this.showOverlays(game, loading, visible, cpuOpen);
    if (this.showDialog(game, visible, cpuOpen)) return;
    this.showTiles(game);
    if (drag.held === undefined && humanFighterActive(game, participantId)) drag.held = participantId;
    let x = 0.0;
    let y = 0.0;
    const width = I2R(BlzGetLocalClientWidth());
    const height = I2R(BlzGetLocalClientHeight());
    if (width > 0 && height > 0) {
      x = pointerX(I2R(BlzGetMouseScreenPosX()), width, height);
      y = pointerY(I2R(BlzGetMouseScreenPosY()), height);
      this.dragChips(game, x, y);
    }
    const pinching = this.showCards(game, sessionWins, x, y);
    this.showHand(pinching && width > 0 && height > 0 && !settingsOpen && !this.tutorialOpen, x, y);
    setFrameText(this.confirm, this.confirmText(game));
    this.showRules(game);
    this.showHelp(game, x, y);
    this.clicks.refreshHover();
    this.highlight(this.hovered ?? (width > 0 && height > 0 ? this.pointedDialog(game, x, y) : undefined), false);
  }

  private showOverlays(game: Readonly<MatchState>, loading: boolean, visible: boolean, cpuOpen: boolean): void {
    const { participantId } = this;
    if (game.phase === Phase.match) this.markSeen();
    if (visible && !this.tutorialOffered) {
      this.tutorialOffered = true;
      if (offersTutorial(game, this.isSeen())) this.tutorialOpen = true;
    }
    BlzFrameSetVisible(this.tutorial.root, visible && this.tutorialOpen && !cpuOpen && !this.movesOpen);
    this.credits.show(visible);
    this.community.show(visible);
    BlzFrameSetVisible(this.tutorial.open, tutorialAvailable(game));
    BlzFrameSetVisible(this.cpu.root, cpuOpen);
    BlzFrameSetVisible(this.root, visible);
    fitToWindow(this.backdrop);
    BlzFrameSetVisible(this.backdrop, visible || (loading && game.phase === Phase.characterMenu && humanActive(game, participantId)));
    for (const frame of this.movesFrames) BlzFrameSetVisible(frame, visible && this.movesOpen);
    BlzFrameSetVisible(this.modeLabel, visible && this.movesOpen);
    if (!visible || cpuOpen || this.movesOpen) this.hideHelp();
  }

  private showDialog(game: Readonly<MatchState>, visible: boolean, cpuOpen: boolean): boolean {
    const { drag } = this;
    if (!visible) {
      this.showHand(false, 0.0, 0.0);
      clearSelectionDrag(drag);
      return true;
    }
    if (cpuOpen && this.cpuSlot !== undefined) {
      this.showHand(false, 0.0, 0.0);
      BlzFrameSetVisible(this.root, false);
      clearSelectionDrag(drag);
      showCpuSettings(this.cpu, game, this.participantId, this.cpuSlot, this.cpuFocus, this.menuPrompt.text, CPU_DEFAULTS);
      return true;
    }
    if (this.movesOpen) {
      this.showHand(false, 0.0, 0.0);
      BlzFrameSetVisible(this.root, false);
      clearSelectionDrag(drag);
      this.showMoves();
      return true;
    }
    return false;
  }

  private showTiles(game: Readonly<MatchState>): void {
    const palette = cardPalette(game, this.participantId);
    if (palette !== this.shownTilePalette) {
      this.shownTilePalette = palette;
      this.tilePortraits.forEach((frame, tile) => BlzFrameSetTexture(frame, portraitTexture(characterOfTile(tile), true, palette), 0, true));
    }
    for (let tile = 0; tile < this.tiles.length; tile++) {
      const selectable = tileOffered(game, tile);
      for (const frame of this.tiles[tile] ?? []) BlzFrameSetVisible(frame, selectable);
      const button = this.tileButtons[tile];
      if (button !== undefined) BlzFrameSetVisible(button, selectable);
    }
  }

  private dragChips(game: Readonly<MatchState>, x: number, y: number): void {
    const { participantId, drag } = this;
    let selectable = 0;
    for (const slot of PARTICIPANT_SLOTS) {
      const chip = this.chips[slot];
      if (chip !== undefined) {
        chip.choice = tileOfCharacter(shownFighter(game, slot) ?? Character.rifleman);
        chip.placed = characterReady(game, slot);
      }
      if ((slot === participantId && humanFighterActive(game, slot)) || canChooseComputer(game, participantId, slot)) selectable |= 1 << slot;
    }
    this.roster.selectable = selectable;
    const placement = updateSelectionDrag(drag, this.roster, BlzIsMouseButtonPressed(MOUSE_BUTTON_TYPE_LEFT), x, y);
    if (placement !== undefined) this.sendPlacement(placement);
  }

  private showCards(game: Readonly<MatchState>, sessionWins: Readonly<Slots<number>>, x: number, y: number): boolean {
    const { participantId, menuFocus } = this;
    let pinching = false;
    for (const slot of PARTICIPANT_SLOTS) {
      const frames = this.cards[slot];
      if (frames === undefined) continue;
      const active = fighterActive(game, slot);
      const ready = characterReady(game, slot);
      const human = humanFighterActive(game, slot);
      const choice = shownFighter(game, slot);
      const teamsShown = game.teamBattle && active;
      const palette = cardPalette(game, slot);
      presentCardTeam(frames, game, slot, participantId, menuFocus, active, human, teamsShown, palette);
      presentCardTag(frames, game, slot, participantId, menuFocus, active, human);
      presentCardStatus(frames, game, slot, active, ready, human, choice, palette, sessionWins[slot], this.net.echoes);
      presentCardCpu(frames, game, slot, menuFocus, active, human, CPU_DEFAULTS);
      presentCardCostume(frames, game, slot, participantId, active && ready, choice);
      if (presentCardChip(frames, this.drag, this.roster.grid, slot, active, ready, human, choice, x, y)) pinching = true;
    }
    return pinching;
  }

  private showHelp(game: Readonly<MatchState>, x: number, y: number): void {
    const name = this.drag.dragging === undefined ? hoveredRule(visibleRuleGroups(game), x, y) : undefined;
    const text = name === undefined ? "" : ruleHelp(name, game);
    if (text === this.shownHelp) return;
    this.shownHelp = text;
    BlzFrameSetVisible(this.help, name !== undefined);
    if (name === undefined) return;
    const box = RULE_BUTTONS[name];
    placeTopLeft(this.help, Math.min(box.x, f32(f32(0.8) - RULE_HELP_WIDTH - f32(0.01))), f32(box.y - box.height - f32(0.003)));
    setFrameText(this.helpText, text);
  }


  private hideHelp(): void {
    if (this.shownHelp === "") return;
    this.shownHelp = "";
    BlzFrameSetVisible(this.help, false);
  }

  private openMoves(): void {
    const game = this.game;
    this.movesCharacter = (game === undefined ? undefined : characterFor(game, this.participantId)) ?? Character.rifleman;
    this.movesOpen = true;
  }

  private showMoves(): void {
    if (this.shownMoves === this.movesCharacter) return;
    this.shownMoves = this.movesCharacter;

    const { title, lines } = movesPage(this.movesCharacter, this.game?.ultimatesOff !== true);
    setFrameText(this.movesTitle, title);
    setFrameText(this.movesBody, lines.join("\n\n"));
  }

  private showRules(game: Readonly<MatchState>): void {
    const clears = loreClears();
    const fighter = characterFor(game, this.participantId) ?? Character.rifleman;
    const rules = rulesKey(game, clears, fighter);
    if (rules === this.shownRules) return;
    this.shownRules = rules;
    presentRules(this.rules, game, clears, fighter, this.tutorial);
  }

  private confirmText(game: Readonly<MatchState>): string {
    const journal = this.controls === "journal";
    if (hasUnassignedHuman(game)) return "Choose CPU or Empty";
    if (!validTeams(game)) return "Choose at least two teams";
    if (allCharactersReady(game)) return journal ? "Start / Click" : "Start (Y) / Click";
    if (fighterMask(game) === 0) return "Add a fighter";
    return journal ? "Select [A] / Click" : "Place your chip / Click";
  }
}

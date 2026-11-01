



import { SELECT_LEVELS } from "./selectLevels";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { stageInPool, stagePoolCount } from "../menu/stagePool";
import { f32 } from "wisp/src/sim/f32";
import { bindPrototype } from "../../platform/rebind";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type MatchState, Phase, humanActive } from "../lobby/lobbyState";
import { pixelX, pixelY, pointerX, pointerY } from "../menu/pointer";
import { STAGE_LIST_HEADING, STAGE_TILE, type StageChoice, clearStageDrag, stageDrag, stageTileLeft, stageTileTop, updateStageDrag } from "../menu/stageSelection";
import { RANDOM_STAGE, STAGE_CATALOG, STAGE_CHOICES, selectableStageChoice, stageInfo } from "../menu/stageCatalog";
import { orbsSetting, hazardsSetting, rulesSummary } from "../session/messages";
import { ButtonClicks, type MenuControls, bindSyncHandler, createBackdrop, createSyncTrigger, createText, createWindowBackdrop, fitToWindow, gameUi, highlightText, placeTopLeft, setMenuText, sizeText } from "./frames";
import { MENU_STYLE, PANEL_TEXTURE } from "./hudLayout";
import { STAGE_CHIP_TEXTURE, StageCard } from "./stageCard";
import { STAGE_START_BUTTON, stageStartContains } from "./selectionLayout";
import { BAR_KEYS, BAR_STRIP_TEXTURE, STAGE_BAR, barTexture } from "../core/selectBarLayout";
import { BAR_STRIP, type ScreenBox, STAGE_LIST_BOX, STAGE_PREVIEW_BOX } from "../core/selectScreenLayout";
import { BAR_COLOURS, BAR_SMALL_TEXT, BAR_TEXT, type BarControl, barControl, barText, labelControl, litControl } from "./barFrames";
import { art } from "./selectionFrames";
import { destroyEvents, Events } from "wisp/game/events";
import { createFrame, createFrameByType, destroyFrame, Frame, namedFrame, screenHeight, screenWidth, setFrameEnabled, setFrameFont, setFrameLevel, setFrameSize, setFrameTextAlignment, setFrameTexture, setFrameVisible, TextAlignment } from "wisp/game/frames";
import { MouseButton, mouseDown, pointerX as inputPointerX, pointerY as inputPointerY, setPointer } from "wisp/game/input";
import { localPlayer, playerSlot } from "wisp/game/players";
import { sendSync } from "wisp/game/sync";
import { formatInt, parseInt, toReal, truncate } from "wisp/game/text";



export interface StageActions {
  selectStage(participantId: number, choice: StageChoice): void;
  togglePoolMode(participantId: number): void;
  togglePoolStage(participantId: number, choice: number): void;
  start(participantId: number): void;
  back(participantId: number): void;
  toggleHazards(participantId: number): void;
  toggleOrbs(participantId: number): void;
}

type StageButton = { kind: "stage"; choice: StageChoice } | { kind: "hazards" } | { kind: "orbs" } | { kind: "start" } | { kind: "back" } | { kind: "poolOpen" } | { kind: "poolClose" } | { kind: "poolMode" } | { kind: "poolStage"; choice: number };

export const HAZARDS_BUTTON = STAGE_BAR.hazards;
const PANEL_PAD = f32(0.012);
const PREVIEW_HEADING = f32(0.03);
const PREVIEW_HEIGHT = f32(0.2);

type StageBarItem = "back" | "hazards" | "orbs" | "pool" | "start";
const BAR_TARGETS: Readonly<Record<StageBarItem, StageButton>> = { back: { kind: "back" }, hazards: { kind: "hazards" }, orbs: { kind: "orbs" }, pool: { kind: "poolOpen" }, start: { kind: "start" } };
const BAR_ITEMS: readonly StageBarItem[] = ["back", "hazards", "orbs", "pool", "start"];

const inside = (b: ScreenBox, top: number, height: number): ScreenBox => ({ x: f32(b.x + PANEL_PAD), y: f32(b.y - top), width: f32(b.width - f32(2 * PANEL_PAD)), height });

function framedBox(parent: Frame, name: string, b: ScreenBox): void {
  art(parent, name, barTexture("Panel", b), b.x, b.y, b.width, b.height);
}


function stageText(parent: Frame, name: string, x: number, y: number, width: number, height: number, fontSize: number, text: string): Frame {
  const label = createText(name, parent, 0);
  placeTopLeft(label, x, y);
  sizeText(label, fontSize, width, height);
  setMenuText(label, text);
  setFrameEnabled(label, false);
  setFrameTextAlignment(label, TextAlignment.middle, TextAlignment.left);
  return label;
}

function stageButton(parent: Frame, x: number, y: number, width: number, height: number, text: string): Frame {
  const control = createFrame("ScriptDialogButton", parent, 0, 0);
  placeTopLeft(control, x, y);
  setFrameSize(control, width, height);
  setMenuText(control, text);
  setFrameFont(control, MENU_STYLE.font, MENU_STYLE.headerSize, 0);
  setFrameFont(namedFrame("ScriptDialogButtonText", 0), MENU_STYLE.font, MENU_STYLE.headerSize, 0);
  return control;
}

export class StagePanel {
  private readonly root: Frame;
  private readonly backdrop: Frame;
  private readonly preview: StageCard;
  private readonly previewName: Frame;
  private readonly previewDescription: Frame;
  private readonly rules: BarControl;
  private readonly chip: Frame;
  private readonly bar: Readonly<Record<StageBarItem, BarControl>>;
  private readonly clicks: ButtonClicks<StageButton>;
  private readonly tileNames: Frame[] = [];
  private readonly sync: Events;
  private readonly poolRoot: Frame;
  private readonly poolMode: Frame;
  private readonly poolSummary: Frame;
  private readonly poolStages: readonly Frame[];
  private poolOpen = false;
  private readonly drag = stageDrag();
  private lastPhase: Phase | undefined;
  private lastChoice: number | undefined;

  constructor(
    private actions: StageActions,
    controls: MenuControls,
  ) {
    const journal = controls === "journal";
    this.clicks = new ButtonClicks("ui.stage.click", (button, clicker) => this.click(button, playerSlot(clicker)), button => this.hover(button));
    const dialogButton = (parent: Frame, x: number, y: number, width: number, height: number, text: string, target: StageButton) =>
      this.clicks.add(stageButton(parent, x, y, width, height, text), target, undefined, "native");
    this.backdrop = createWindowBackdrop("MeleeStageBackdrop", MENU_STYLE.panelTexture, 800);
    const root = createFrameByType("FRAME", "MeleeStageRoot", gameUi(), "", 0);
    this.root = root;
    art(root, "MeleeStageStrip", BAR_STRIP_TEXTURE, BAR_STRIP.x, BAR_STRIP.y, BAR_STRIP.width, BAR_STRIP.height);
    framedBox(root, "MeleeStagePreviewBox", STAGE_PREVIEW_BOX);
    framedBox(root, "MeleeStageListBox", STAGE_LIST_BOX);
    const heading = inside(STAGE_PREVIEW_BOX, PANEL_PAD, PREVIEW_HEADING);
    this.previewName = stageText(root, "MeleeStagePreviewName", heading.x, heading.y, heading.width, heading.height, f32(0.016), "");
    const card = inside(STAGE_PREVIEW_BOX, f32(f32(PANEL_PAD + PREVIEW_HEADING) + f32(0.006)), PREVIEW_HEIGHT);
    this.preview = new StageCard(root, "MeleeStagePreview", card.x, card.y, card.width, card.height, false);
    const about = inside(STAGE_PREVIEW_BOX, f32(f32(STAGE_PREVIEW_BOX.y - f32(card.y - card.height)) + f32(0.01)), f32(0.06));
    this.previewDescription = stageText(root, "MeleeStageDescription", about.x, about.y, about.width, about.height, f32(0.0095), "");
    setMenuText(barText(root, "MeleeStageGridTitle", STAGE_LIST_HEADING, BAR_SMALL_TEXT, TextAlignment.left), `${BAR_COLOURS.dim}CHOOSE A STAGE|r`);
    for (const stage of STAGE_CHOICES) {
      const choice = stage.id;
      const button = createFrameByType("BUTTON", `MeleeStageTileButton${formatInt(choice)}`, root, "", 0);
      placeTopLeft(button, stageTileLeft(choice), stageTileTop(choice));
      setFrameSize(button, STAGE_TILE.width, STAGE_TILE.height);
      this.clicks.add(button, { kind: "stage", choice });
      new StageCard(root, `MeleeStageTile${formatInt(choice)}`, stageTileLeft(choice), stageTileTop(choice), STAGE_TILE.width, STAGE_TILE.height, true).show(choice);
      this.tileNames[choice] = namedFrame(`MeleeStageTile${formatInt(choice)}Name`, 0);
      setMenuText(this.tileNames[choice], stage.name);
    }
    this.poolRoot = createFrameByType("FRAME", "MeleeStagePoolRoot", root, "", 0);
    setFrameLevel(this.poolRoot, SELECT_LEVELS.stagePool);
    const poolBackdrop = createBackdrop("MeleeStagePoolBackdrop", this.poolRoot, 0);
    setFrameTexture(poolBackdrop, PANEL_TEXTURE, 0, true);
    placeTopLeft(poolBackdrop, f32(0.1), f32(0.49));
    setFrameSize(poolBackdrop, f32(0.6), f32(0.35));
    stageText(this.poolRoot, "MeleeStagePoolTitle", f32(0.14), f32(0.47), f32(0.4), f32(0.025), f32(0.016), "Stage pool");
    dialogButton(this.poolRoot, f32(0.575), f32(0.47), f32(0.085), f32(0.027), "Done", { kind: "poolClose" });
    this.poolMode = dialogButton(this.poolRoot, f32(0.14), f32(0.425), f32(0.52), f32(0.027), "", { kind: "poolMode" });
    stageText(this.poolRoot, "MeleeStagePoolHelp", f32(0.14), f32(0.385), f32(0.52), f32(0.028), f32(0.009), "Choose stages for random matches.\nKeep at least one stage in the pool.");
    this.poolStages = STAGE_CATALOG.map((stage, index) => dialogButton(
      this.poolRoot, f32(f32(0.14) + floorMod(index, 3) * f32(0.18)), f32(f32(0.34) - floorDiv(index, 3) * f32(0.045)), f32(0.16), f32(0.032), "",
      { kind: "poolStage", choice: stage.id },
    ));
    this.poolSummary = stageText(this.poolRoot, "MeleeStagePoolSummary", f32(0.14), f32(0.2), f32(0.52), f32(0.042), f32(0.009), "");
    setFrameVisible(this.poolRoot, false);
    this.chip = createBackdrop("MeleeStageChip", root, 0);
    setFrameTexture(this.chip, STAGE_CHIP_TEXTURE, 0, true);
    setFrameSize(this.chip, f32(0.04), f32(0.04));
    setFrameEnabled(this.chip, false);
    this.bar = this.createBar(root, journal);
    this.rules = barControl(root, "MeleeStageRules", STAGE_BAR.rules, "Frame", BAR_TEXT, false);
    this.sync = createSyncTrigger("ui.stage.drop", "stage-drop", PARTICIPANT_SLOTS, (sender, data) => {
      const choice = parseInt(data);
      if (formatInt(choice) === data && selectableStageChoice(choice)) this.actions.selectStage(sender, choice);
    });
    setFrameVisible(root, false);
    setFrameVisible(this.backdrop, false);
  }

  bindActions(actions: StageActions): void {
    this.actions = actions;
    bindPrototype(this.clicks, ButtonClicks.prototype);
    bindPrototype(this.preview, StageCard.prototype);
    this.clicks.bindHandler((button, clicker) => this.click(button, playerSlot(clicker)), button => this.hover(button));
    bindSyncHandler("ui.stage.drop", (sender, data) => {
      const choice = parseInt(data);
      if (formatInt(choice) === data && selectableStageChoice(choice)) this.actions.selectStage(sender, choice);
    });
  }

  destroy(): void {
    this.clicks.destroy();
    destroyEvents(this.sync);
    destroyFrame(this.root);
    destroyFrame(this.backdrop);
  }

  private createBar(root: Frame, journal: boolean): Readonly<Record<StageBarItem, BarControl>> {
    const control = (item: StageBarItem, rest: "Frame" | "Primary", size: number, text: string): BarControl => {
      const made = barControl(root, `MeleeStageBar${item}`, STAGE_BAR[item], rest, size, true, item === "start" ? TextAlignment.left : TextAlignment.center);
      labelControl(made, text);
      if (made.button !== undefined) this.clicks.add(made.button, BAR_TARGETS[item], undefined, "native", STAGE_BAR[item]);
      return made;
    };
    const bar = {
      back: control("back", "Frame", BAR_TEXT, `${BAR_COLOURS.cream}<  BACK|r`),
      hazards: control("hazards", "Frame", BAR_TEXT, ""),
      orbs: control("orbs", "Frame", BAR_SMALL_TEXT, ""),
      pool: control("pool", "Frame", BAR_TEXT, `${BAR_COLOURS.cream}Stage pool|r`),
      start: control("start", "Primary", BAR_TEXT, `${BAR_COLOURS.cream}START|r`),
    };
    labelControl(barControl(root, "MeleeStageStartKey", BAR_KEYS.start, "Key", BAR_SMALL_TEXT, false), `${BAR_COLOURS.gold}${journal ? "A" : "Y"}|r`);
    return bar;
  }

  private hover(button: StageButton | undefined): void {
    for (const item of BAR_ITEMS) if (item !== "hazards" && item !== "orbs") litControl(this.bar[item], BAR_TARGETS[item].kind === button?.kind);
    this.highlightStage(button?.kind === "stage" ? button.choice : undefined);
  }

  private focusStart(): void {
    litControl(this.bar.start, true);
    const width = toReal(screenWidth());
    const height = toReal(screenHeight());
    if (width <= 0 || height <= 0) return;
    if (stageStartContains(pointerX(toReal(inputPointerX()), width, height), pointerY(toReal(inputPointerY()), height))) return;
    const x = STAGE_START_BUTTON.x + STAGE_START_BUTTON.width / 2;
    const y = STAGE_START_BUTTON.y - STAGE_START_BUTTON.height / 2;
    setPointer(truncate(pixelX(x, width, height)), truncate(pixelY(y, height)));
  }

  private highlightStage(choice: number | undefined): void {
    for (const stage of STAGE_CHOICES) {
      const name = this.tileNames[stage.id];
      if (name !== undefined) highlightText(name, stage.id === choice);
    }
  }

  private click(button: StageButton, actor: number): void {
    if (button.kind === "stage") this.actions.selectStage(actor, button.choice);
    else if (button.kind === "start") this.actions.start(actor);
    else if (button.kind === "hazards") this.actions.toggleHazards(actor);
    else if (button.kind === "orbs") this.actions.toggleOrbs(actor);
    else if (button.kind === "back") this.actions.back(actor);
    else if (button.kind === "poolOpen") this.poolOpen = true;
    else if (button.kind === "poolClose") this.poolOpen = false;
    else if (button.kind === "poolMode") this.actions.togglePoolMode(actor);
    else this.actions.togglePoolStage(actor, button.choice);

  }


  private showToggle(control: BarControl, text: string, on: boolean): void {
    labelControl(control, `${on ? BAR_COLOURS.gold : BAR_COLOURS.cream}${text}|r`);
    litControl(control, on);
  }

  update(game: Readonly<MatchState>): void {
    const enabled = game.phase === Phase.stageMenu && humanActive(game, playerSlot(localPlayer()));
    if (this.lastPhase !== game.phase) {
      setFrameVisible(this.root, enabled);
      setFrameVisible(this.backdrop, enabled);
      if (enabled) this.focusStart();
      this.lastPhase = game.phase;
    }
    if (!enabled) {
      clearStageDrag(this.drag);
      this.poolOpen = false;
      setFrameVisible(this.poolRoot, false);
      return;
    }
    if (this.lastChoice !== game.stageChoice) {
      const stage = stageInfo(game.stageChoice);
      this.preview.show(game.stageChoice);
      setMenuText(this.previewName, stage.name);
      setMenuText(this.previewDescription, stage.description);
      this.lastChoice = game.stageChoice;
    }
    this.showToggle(this.bar.hazards, hazardsSetting(game.hazards), game.hazards);
    this.showToggle(this.bar.orbs, orbsSetting(game.orbs.on), game.orbs.on);
    labelControl(this.rules, `${BAR_COLOURS.gold}${rulesSummary(game)}|r`);
    setFrameVisible(this.poolRoot, this.poolOpen);
    setFrameVisible(this.chip, !this.poolOpen);
    if (this.poolOpen) {
      clearStageDrag(this.drag);
      const pool = game.stagePool;
      const count = stagePoolCount(pool);
      setMenuText(this.poolMode, pool.only ? "Only these" : "All except these");
      for (let index = 0; index < STAGE_CATALOG.length; index++) {
        const stage = STAGE_CATALOG[index];
        const frame = this.poolStages[index];
        if (stage === undefined || frame === undefined) continue;
        const selected = (pool.selectedMask & (1 << stage.id)) !== 0;
        setMenuText(frame, `${selected ? "Yes" : "No"}: ${stage.name}`);
        setFrameEnabled(frame, count > 1 || !stageInPool(pool, stage.id));
      }
      setMenuText(this.poolSummary, `${formatInt(count)} ${count === 1 ? "stage" : "stages"} in the pool.\nEach plays once before the pool repeats.`);
      this.clicks.refreshHover();
      return;
    }
    fitToWindow(this.backdrop);
    let x = f32(stageTileLeft(game.stageChoice) + f32(STAGE_TILE.width / 2));
    let y = f32(stageTileTop(game.stageChoice) - f32(STAGE_TILE.height / 2));
    const width = toReal(screenWidth());
    const height = toReal(screenHeight());
    if (width > 0 && height > 0) {
      const pointerAtX = pointerX(toReal(inputPointerX()), width, height);
      const pointerAtY = pointerY(toReal(inputPointerY()), height);
      const dropped = updateStageDrag(this.drag, mouseDown(MouseButton.left), pointerAtX, pointerAtY, game.stageChoice);
      if (dropped !== undefined) sendSync("stage-drop", formatInt(dropped));
      if (this.drag.gesture?.kind === "carry") {
        x = pointerAtX;
        y = pointerAtY;
      }
    }
    placeTopLeft(this.chip, x - f32(0.02), y + f32(0.02));
    this.clicks.refreshHover();
  }
}

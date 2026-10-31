



import { SELECT_LEVELS } from "./selectLevels";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { stageInPool, stagePoolCount } from "../menu/stagePool";
import { f32 } from "wisp/src/sim/f32";
import { bindPrototype } from "../../platform/rebind";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type MatchState, Phase, humanActive } from "../lobby/lobbyState";
import { pixelX, pixelY, pointerX, pointerY } from "../menu/pointer";
import { type StageChoice, clearStageDrag, stageDrag, stageTileLeft, stageTileTop, updateStageDrag } from "../menu/stageSelection";
import { RANDOM_STAGE, STAGE_CATALOG, STAGE_CHOICES, selectableStageChoice, stageInfo } from "../menu/stageCatalog";
import { orbsSetting, hazardsSetting, rulesSummary } from "../session/messages";
import { ButtonClicks, type MenuControls, bindSyncHandler, createBackdrop, createSyncTrigger, createText, createWindowBackdrop, fitToWindow, gameUi, highlightText, placeTopLeft, setMenuText, sizeText } from "./frames";
import { MENU_STYLE, PANEL_TEXTURE } from "./hudLayout";
import { STAGE_CHIP_TEXTURE, StageCard } from "./stageCard";
import { HEADER_BUTTON_HEIGHT, HEADER_BUTTON_TOP, START_BUTTON, startButtonContains } from "./selectionLayout";
import { destroyEvents } from "wisp/game/events";
import { createFrame, createFrameByType, destroyFrame, namedFrame, screenHeight, screenWidth, setFrameEnabled, setFrameFont, setFrameLevel, setFrameSize, setFrameTextAlignment, setFrameTexture, setFrameVisible } from "wisp/game/frames";
import { mouseDown, pointerX as inputPointerX, pointerY as inputPointerY, setPointer } from "wisp/game/input";
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

export const BACK_BUTTON = { x: f32(0.265), y: HEADER_BUTTON_TOP, width: f32(0.17), height: HEADER_BUTTON_HEIGHT } as const;
export const HAZARDS_BUTTON = { x: f32(0.445), y: HEADER_BUTTON_TOP, width: f32(0.17), height: HEADER_BUTTON_HEIGHT } as const;
export const ORBS_BUTTON = { x: f32(0.625), y: HEADER_BUTTON_TOP, width: f32(0.13), height: HEADER_BUTTON_HEIGHT } as const;
export const STAGE_POOL_BUTTON = { x: f32(0.49), y: f32(0.518), width: f32(0.298), height: f32(0.027) } as const;


function stageText(parent: framehandle, name: string, x: number, y: number, width: number, height: number, fontSize: number, text: string): framehandle {
  const label = createText(name, parent, 0);
  placeTopLeft(label, x, y);
  sizeText(label, fontSize, width, height);
  setMenuText(label, text);
  setFrameEnabled(label, false);
  setFrameTextAlignment(label, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_LEFT);
  return label;
}

function stageButton(parent: framehandle, x: number, y: number, width: number, height: number, text: string): framehandle {
  const control = createFrame("ScriptDialogButton", parent, 0, 0);
  placeTopLeft(control, x, y);
  setFrameSize(control, width, height);
  setMenuText(control, text);
  setFrameFont(control, MENU_STYLE.font, MENU_STYLE.headerSize, 0);
  setFrameFont(namedFrame("ScriptDialogButtonText", 0), MENU_STYLE.font, MENU_STYLE.headerSize, 0);
  return control;
}

export class StagePanel {
  private readonly root: framehandle;
  private readonly backdrop: framehandle;
  private readonly preview: StageCard;
  private readonly previewName: framehandle;
  private readonly previewDescription: framehandle;
  private readonly ruleLabel: framehandle;
  private readonly chip: framehandle;
  private readonly hazardsToggle: framehandle;
  private readonly orbsToggle: framehandle;
  private readonly startButton: framehandle;
  private readonly clicks: ButtonClicks<StageButton>;
  private readonly tileNames: framehandle[] = [];
  private readonly sync: trigger;
  private readonly poolRoot: framehandle;
  private readonly poolMode: framehandle;
  private readonly poolSummary: framehandle;
  private readonly poolStages: readonly framehandle[];
  private poolOpen = false;
  private readonly drag = stageDrag();
  private lastPhase: Phase | undefined;
  private lastChoice: number | undefined;
  private lastRules: string | undefined;
  private lastHazards: boolean | undefined;
  private lastOrbs: boolean | undefined;

  constructor(
    private actions: StageActions,
    controls: MenuControls,
  ) {
    const journal = controls === "journal";
    this.clicks = new ButtonClicks("ui.stage.click", (button, clicker) => this.click(button, playerSlot(clicker)), button => this.hover(button));
    const dialogButton = (parent: framehandle, x: number, y: number, width: number, height: number, text: string, target: StageButton) =>
      this.clicks.add(stageButton(parent, x, y, width, height, text), target, undefined, "native");
    this.backdrop = createWindowBackdrop("MeleeStageBackdrop", MENU_STYLE.panelTexture, 800);
    const root = createFrameByType("FRAME", "MeleeStageRoot", gameUi(), "", 0);
    this.root = root;
    stageText(root, "MeleeStageTitle", f32(0.055), f32(0.558), f32(0.2), f32(0.032), MENU_STYLE.titleSize, `${MENU_STYLE.gold}STAGE SELECT|r`);
    this.ruleLabel = stageText(root, "MeleeStageRules", f32(0.265), f32(0.558), f32(0.49), f32(0.032), MENU_STYLE.headerSize, "");
    this.preview = new StageCard(root, "MeleeStagePreview", f32(0.045), f32(0.19), f32(0.19), f32(0.13), false);
    this.previewName = stageText(root, "MeleeStagePreviewName", f32(0.245), f32(0.19), f32(0.235), f32(0.03), f32(0.018), "");
    this.previewDescription = stageText(root, "MeleeStageDescription", f32(0.245), f32(0.155), f32(0.235), f32(0.06), f32(0.0095), "");
    stageText(root, "MeleeStageGridTitle", f32(0.49), f32(0.483), f32(0.298), f32(0.022), MENU_STYLE.headerSize, `${MENU_STYLE.gold}CHOOSE A STAGE|r`);
    for (const stage of STAGE_CHOICES) {
      const choice = stage.id;
      const button = createFrameByType("BUTTON", `MeleeStageTileButton${formatInt(choice)}`, root, "", 0);
      placeTopLeft(button, stageTileLeft(choice), stageTileTop(choice));
      setFrameSize(button, f32(0.094), f32(0.059));
      this.clicks.add(button, { kind: "stage", choice });
      new StageCard(root, `MeleeStageTile${formatInt(choice)}`, stageTileLeft(choice), stageTileTop(choice), f32(0.094), f32(0.059), true).show(choice);
      this.tileNames[choice] = namedFrame(`MeleeStageTile${formatInt(choice)}Name`, 0);
      setMenuText(this.tileNames[choice], stage.name);
    }
    dialogButton(root, STAGE_POOL_BUTTON.x, STAGE_POOL_BUTTON.y, STAGE_POOL_BUTTON.width, STAGE_POOL_BUTTON.height, "Stage pool", { kind: "poolOpen" });
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
    const help = journal
      ? "Click a stage or move the stick.\nAny player can choose.\nA / Click: choose · Start: start · Click BACK: back"
      : "Click a stage or use movement controls.\nAny player can choose.\nY: start · Click BACK TO FIGHTERS: back";
    stageText(root, "MeleeStageHelp", f32(0.49), f32(0.148), f32(0.298), f32(0.03), f32(0.008), help);
    this.startButton = dialogButton(root, START_BUTTON.x, START_BUTTON.y, START_BUTTON.width, START_BUTTON.height, journal ? "START MATCH [A]" : "START MATCH", { kind: "start" });
    dialogButton(root, BACK_BUTTON.x, BACK_BUTTON.y, BACK_BUTTON.width, BACK_BUTTON.height, journal ? "BACK" : "BACK TO FIGHTERS", { kind: "back" });
    this.hazardsToggle = dialogButton(root, HAZARDS_BUTTON.x, HAZARDS_BUTTON.y, HAZARDS_BUTTON.width, HAZARDS_BUTTON.height, "", { kind: "hazards" });
    this.orbsToggle = dialogButton(root, ORBS_BUTTON.x, ORBS_BUTTON.y, ORBS_BUTTON.width, ORBS_BUTTON.height, "", { kind: "orbs" });
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

  private hover(button: StageButton | undefined): void {
    if (button?.kind !== "start") highlightText(this.startButton, false);
    this.highlightStage(button?.kind === "stage" ? button.choice : undefined);
  }

  private focusStart(): void {
    highlightText(this.startButton, true);
    const width = toReal(screenWidth());
    const height = toReal(screenHeight());
    if (width <= 0 || height <= 0) return;
    if (startButtonContains(pointerX(toReal(inputPointerX()), width, height), pointerY(toReal(inputPointerY()), height))) return;
    const x = START_BUTTON.x + START_BUTTON.width / 2;
    const y = START_BUTTON.y - START_BUTTON.height / 2;
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
    if (this.lastHazards !== game.hazards) {
      setMenuText(this.hazardsToggle, hazardsSetting(game.hazards));
      this.lastHazards = game.hazards;
    }
    if (this.lastOrbs !== game.orbs.on) {
      setMenuText(this.orbsToggle, orbsSetting(game.orbs.on));
      this.lastOrbs = game.orbs.on;
    }
    const rules = rulesSummary(game);
    if (this.lastRules !== rules) {
      setMenuText(this.ruleLabel, `${MENU_STYLE.gold}${rules}|r`);
      this.lastRules = rules;
    }
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
    let x = stageTileLeft(game.stageChoice) + f32(0.047);
    let y = f32(stageTileTop(game.stageChoice) - f32(0.0295));
    const width = toReal(screenWidth());
    const height = toReal(screenHeight());
    if (width > 0 && height > 0) {
      const pointerAtX = pointerX(toReal(inputPointerX()), width, height);
      const pointerAtY = pointerY(toReal(inputPointerY()), height);
      const dropped = updateStageDrag(this.drag, mouseDown(MOUSE_BUTTON_TYPE_LEFT), pointerAtX, pointerAtY, game.stageChoice);
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

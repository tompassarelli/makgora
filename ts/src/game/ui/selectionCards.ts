import { DEFAULT_FIGHTER } from "../roster/kits";
import { SELECT_LEVELS } from "./selectLevels";
import type { CpuDefaults } from "./selectionCpuSettings";
import { type SessionWinsFrames, createSessionWinsFrames, presentSessionWinsFrames } from "./sessionWinsFrames";
import { cpuSettingsBox, teamSettingsBox } from "./ruleButtons";
import { boxContains } from "./selectionLayout";
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots } from "../input/participants";
import { type MatchState, Phase, canChooseComputer, canCycleSlotMode, costumeFor, fighterActive, humanActive, humanFighterActive, humanPresent } from "../lobby/lobbyState";
import {
  type SelectionDrag,
  cardDown,
  cardRight,
  cardSize,
  cardX,
  readyChipSize,
  carriedChipLeft,
  carriedChipSize,
  carriedChipTop,
  parkedChipLeft,
  parkedChipTop,
  chipX,
  chipY,
} from "../menu/selectionDrag";
import type { RosterGrid } from "../menu/selectionGrid";
import { CARD_HEIGHT, CARD_TOP, CARD_WIDTH } from "../core/selectScreenLayout";
import { Character } from "../sim/codes";
import { cardPortrait } from "./portraitFrames";
import { TEAM_NAMES } from "../sim/teams";
import { slotColor } from "./slotColors";
import { costumeIndex, costumesFor } from "../roster/costumes";
import { MAX_COSTUMES } from "../presentation/model/costume";
import { paintCostume } from "./costumeTint";
import { placeTopLeft, setMenuText } from "./frames";
import { presentLiveFighter } from "./liveCard";
import { fitName, placeName } from "./namePlate";
import { BAR_HEIGHT, BAR_TEXT, BOTTOM_BAR_TOP, TAG_SCALE, TAG_SIZE, art, hotspot, label, modeBox, nameText, placeBottomBar, portraitTexture, tileOfCharacter, titleCase } from "./selectionFrames";
import { createFrame, createFrameByType, Frame, setFrameAlpha, setFrameEnabled, setFrameLevel, setFrameSize, setFrameTexture, setFrameVisible } from "wisp/game/frames";
import { formatInt } from "wisp/game/text";

export const selectionCardTexture = (color: string): string => `war3mapImported\\SelectionCard${color}.tga`;
const CHIP_TEXTURES: Slots<string> = ["war3mapImported\\SelectionChipP1.tga", "war3mapImported\\SelectionChipP2.tga", "war3mapImported\\SelectionChipP3.tga", "war3mapImported\\SelectionChipP4.tga"];
const CPU_CHIP_TEXTURES: Slots<string> = ["war3mapImported\\SelectionChipCPUP1.tga", "war3mapImported\\SelectionChipCPUP2.tga", "war3mapImported\\SelectionChipCPUP3.tga", "war3mapImported\\SelectionChipCPUP4.tga"];
export const selectionChipTexture = (slot: number, human: boolean): string => at(human ? CHIP_TEXTURES : CPU_CHIP_TEXTURES, slot);

export type CardButton = { kind: "costume"; slot: number } | { kind: "team"; slot: number } | { kind: "mode"; slot: number } | { kind: "cpuSettings"; slot: number };

export const cardPalette = (game: Readonly<MatchState>, slot: number): number => game.teamBattle && fighterActive(game, slot) ? at(game.teamChoices, slot) : slot;

export type MenuFocus = { readonly kind: "fighter" | "settings" | "team" | "teamBattle" | "mainMenu" | "mode" | "rules" | "guide" | "gear"; readonly slot: number };
export function menuFocusList(game: Readonly<MatchState>, participantId: number): MenuFocus[] {
  const focus: MenuFocus[] = [];
  if (humanFighterActive(game, participantId)) focus.push({ kind: "fighter", slot: participantId });
  for (const slot of PARTICIPANT_SLOTS) if (fighterActive(game, slot) && !humanFighterActive(game, slot)) {
    focus.push({ kind: "fighter", slot }, { kind: "settings", slot });
  }
  if (game.teamBattle) {
    if (humanFighterActive(game, participantId)) focus.push({ kind: "team", slot: participantId });
    for (const slot of PARTICIPANT_SLOTS) if (canChooseComputer(game, participantId, slot)) focus.push({ kind: "team", slot });
  }
  focus.push({ kind: "mainMenu", slot: participantId }, { kind: "mode", slot: participantId });
  if (!game.training && !game.classic && !game.lore) focus.push({ kind: "teamBattle", slot: participantId });
  focus.push({ kind: "rules", slot: participantId }, { kind: "guide", slot: participantId }, { kind: "gear", slot: participantId });
  return focus;
}

function cpuCardSummary(game: Readonly<MatchState>, slot: number, defaults: CpuDefaults): string {
  return `CPU · ${titleCase(game.cpuOpponents[slot] ?? defaults.opponent)}\n${titleCase(game.cpuTiers[slot] ?? defaults.tier)}`;
}


export interface CardFrames {
  readonly card: Frame;
  readonly tag: Frame;
  readonly mode: Frame;
  readonly team: Frame;
  readonly teamLabel: Frame;
  readonly portrait: Frame;
  readonly renders: readonly Frame[];
  readonly costume: Frame;
  readonly dots: readonly Frame[];
  readonly name: Frame;
  readonly status: Frame;
  readonly wins: SessionWinsFrames;
  readonly chip: Frame;
  readonly summary: Frame;
  readonly settings: Frame;
  readonly settingsLabel: Frame;
}

/** A fighter card on the bottom row; its chip, which travels over the roster grid, belongs to `grid` so it hides with the grid on stage select. */
export function createCard(root: Frame, grid: Frame, suffix: string, slot: number, add: (frame: Frame, target: CardButton) => Frame): CardFrames {
  const x = cardX(slot);
  const name = `${suffix}_${formatInt(slot)}`;
  const card = art(root, `MeleeCard${name}`, selectionCardTexture("Gray"), x, CARD_TOP, CARD_WIDTH, CARD_HEIGHT);
  const mode = createFrameByType("BUTTON", `MeleeModeButton${name}`, root, "", 0);
  const modeArea = modeBox(slot);
  placeTopLeft(mode, modeArea.x, modeArea.y);
  setFrameSize(mode, modeArea.width, modeArea.height);
  add(mode, { kind: "mode", slot });
  const tag = label(mode, `MeleeTag${name}`, cardRight(slot, f32(0.014)), cardDown(f32(0.008)), cardSize(f32(0.132)), cardSize(f32(0.019)), TAG_SIZE);
  const teamArea = teamSettingsBox(slot);
  const team = hotspot(root, teamArea.x, teamArea.y, teamArea.width, teamArea.height);
  add(team, { kind: "team", slot });
  const teamLabel = label(root, `MeleeTeam${name}`, teamArea.x, cardDown(f32(0.008)), teamArea.width, cardSize(f32(0.019)), TAG_SIZE);
  const portrait = art(root, `MeleePortrait${name}`, portraitTexture(Character.demonHunter, false, slot), cardRight(slot, f32(0.029)), cardDown(f32(0.03)), cardSize(f32(0.102)), cardSize(f32(0.102)));
  const renders = ["", "Partner"].map((role) => {
    const render = createFrameByType("SPRITE", `MeleeRender${role}${name}`, root, "", 0);
    setFrameVisible(render, false);
    return render;
  });
  const dotArea = costumeDotsBox(slot);
  const dotSize = cardSize(COSTUME_DOT);
  const dots = Array.from({ length: MAX_COSTUMES }, (_, index) => {
    const dot = art(root, `MeleeCostumeDot${name}_${formatInt(index)}`, selectionChipTexture(slot, true), f32(dotArea.x + f32(index * f32(dotSize + cardSize(COSTUME_DOT_GAP)))), dotArea.y, dotSize, dotSize);
    setFrameVisible(dot, false);
    return dot;
  });
  const portraitArea = costumePortraitBox(slot);
  const costume = hotspot(root, portraitArea.x, portraitArea.y, portraitArea.width, portraitArea.height);
  add(costume, { kind: "costume", slot });
  const name_ = label(root, `MeleeName${name}`, cardRight(slot, f32(0.008)), cardDown(f32(0.173)), cardSize(f32(0.144)), cardSize(f32(0.019)), cardSize(f32(0.011)));
  const wins = createSessionWinsFrames(root, name, cardRight(slot, f32(0.054)), BOTTOM_BAR_TOP, BAR_TEXT);
  const status = label(root, `MeleeStatus${name}`, cardRight(slot, f32(0.014)), BOTTOM_BAR_TOP, cardSize(f32(0.132)), BAR_HEIGHT, BAR_TEXT);
  const chip = art(grid, `MeleeChip${name}`, selectionChipTexture(slot, true), cardRight(slot, f32(0.06)), cardDown(f32(0.075)), cardSize(f32(0.06)), cardSize(f32(0.06)));
  setFrameLevel(chip, SELECT_LEVELS.cardChip);
  const box = cpuSettingsBox(slot);
  const settings = createFrame("ScriptDialogButton", root, 0, 0);
  placeTopLeft(settings, box.x, box.y);
  setFrameSize(settings, box.width, box.height);
  setMenuText(settings, "");
  const settingsLabel = label(settings, `MeleeCpuSettingsLabel${name}`, box.x + f32(0.004), box.y - f32(0.002), box.width - f32(0.008), box.height - f32(0.004), f32(0.0075));
  setMenuText(settingsLabel, "Opponent settings");
  add(settings, { kind: "cpuSettings", slot });
  const summary = label(root, `MeleeCpuSummary${name}`, cardRight(slot, f32(0.004)), cardDown(f32(0.136)), cardSize(f32(0.152)), cardSize(f32(0.031)), BAR_TEXT);
  return { card, tag, mode, team, teamLabel, portrait, renders, costume, dots, name: name_, status, wins, chip, summary, settings, settingsLabel };
}

export function presentCardTeam(frames: CardFrames, game: Readonly<MatchState>, slot: ParticipantSlot, participantId: number, menuFocus: MenuFocus | undefined, active: boolean, human: boolean, teamsShown: boolean, palette: number): void {
  const color = slotColor(palette);
  setFrameTexture(frames.card, selectionCardTexture(active ? color.name : "Gray"), 0, true);
  setFrameVisible(frames.team, teamsShown);
  setFrameVisible(frames.teamLabel, teamsShown);
  setFrameEnabled(frames.team, teamsShown && (slot === participantId && human || canChooseComputer(game, participantId, slot)));
  setMenuText(frames.teamLabel, `${menuFocus?.kind === "team" && menuFocus.slot === slot ? "> " : ""}${TEAM_NAMES[game.teamChoices[slot]]}`);
}

export function presentCardTag(frames: CardFrames, game: Readonly<MatchState>, slot: number, participantId: number, menuFocus: MenuFocus | undefined, active: boolean, human: boolean): void {
  setFrameSize(frames.mode, game.teamBattle ? cardSize(f32(0.078)) : modeBox(slot).width, modeBox(slot).height);
  placeTopLeft(frames.tag, cardRight(slot, game.teamBattle ? f32(0.006) : f32(0.014)), cardDown(f32(0.008)));
  setFrameSize(frames.tag, f32(cardSize(game.teamBattle ? f32(0.068) : f32(0.132)) / TAG_SCALE), f32(cardSize(f32(0.019)) / TAG_SCALE));
  const focused = menuFocus?.kind === "fighter" && menuFocus.slot === slot;
  setMenuText(frames.tag, active ? `${focused ? "> " : ""}${human ? "Player" : "CPU"}${focused ? " <" : ""}` : "Empty");
  setFrameEnabled(frames.mode, canCycleSlotMode(game, participantId, slot));
}

export function presentCardStatus(frames: CardFrames, game: Readonly<MatchState>, slot: number, active: boolean, ready: boolean, human: boolean, choice: number | undefined, palette: number, sessionWins: number, echoes: readonly string[], now: number): void {
  const shown = active && ready;
  setFrameVisible(frames.portrait, shown);
  setFrameVisible(frames.name, shown);
  const winsShown = shown && sessionWins > 0;
  presentSessionWinsFrames(frames.wins, sessionWins, shown);
  const statusText = human && !humanPresent(game, slot) ? "No player" : active && !ready ? "Choose fighter" : active && !human ? "CPU" : `P${formatInt(slot + 1)}${at(echoes, slot)}`;
  setMenuText(frames.status, statusText);
  placeBottomBar(frames, slot, winsShown, statusText, `x${formatInt(sessionWins)}`);
  if (ready) {
    setFrameTexture(frames.portrait, portraitTexture(choice, false, palette, choice === undefined || choice < 0 ? 0 : costumeIndex(choice, game.costumeChoices[slot] ?? 0)), 0, true);
    const fitted = fitName(nameText(choice));
    setMenuText(frames.name, fitted.text);
    placeName(frames.name, slot, fitted);
  }
  presentLiveFighter(frames.renders, costumePortraitBox(slot), frames.portrait, shown, choice, game.costumeChoices[slot] ?? 0, now);
}

const COSTUME_DOT = f32(0.011);
const COSTUME_DOT_GAP = f32(0.005);

export const costumePortraitBox = (slot: number) => ({ x: cardRight(slot, f32(0.029)), y: cardDown(f32(0.03)), width: cardSize(f32(0.102)), height: cardSize(f32(0.102)) });

export function costumeDotsBox(slot: number) {
  const width = f32(MAX_COSTUMES * cardSize(f32(COSTUME_DOT + COSTUME_DOT_GAP)));
  return { x: f32(cardX(slot) + f32(f32(CARD_WIDTH - width) / 2)), y: cardDown(f32(0.145)), width, height: cardSize(COSTUME_DOT) };
}

export function pointedCard(game: Readonly<MatchState>, slot: ParticipantSlot, x: number, y: number): CardButton | undefined {
  const active = fighterActive(game, slot);
  if (game.teamBattle && active && boxContains(teamSettingsBox(slot), x, y)) return { kind: "team", slot };
  if (active && boxContains(costumePortraitBox(slot), x, y)) return { kind: "costume", slot };
  if (active && !humanFighterActive(game, slot) && boxContains(cpuSettingsBox(slot), x, y)) return { kind: "cpuSettings", slot };
  if (boxContains(modeBox(slot), x, y)) return { kind: "mode", slot };
  return undefined;
}

export function presentCardCostume(frames: CardFrames, game: Readonly<MatchState>, slot: ParticipantSlot, participantId: number, shown: boolean, choice: number | undefined): void {
  const costumes = choice === undefined || choice < 0 ? [] : costumesFor(choice);
  const chosen = costumeFor(game, slot);
  const tint = costumes[chosen]?.tint;
  paintCostume(frames.portrait, tint);
  setFrameEnabled(frames.costume, shown && costumes.length > 1 && (slot === participantId && humanFighterActive(game, slot) || canChooseComputer(game, participantId, slot)));
  setFrameVisible(frames.costume, shown && costumes.length > 1);
  for (let index = 0; index < frames.dots.length; index++) {
    const dot = frames.dots[index];
    if (dot === undefined) continue;
    setFrameVisible(dot, shown && costumes.length > 1 && index < costumes.length);
    setFrameAlpha(dot, index === chosen ? 255 : 70);
  }
}

export function presentCardCpu(frames: CardFrames, game: Readonly<MatchState>, slot: number, menuFocus: MenuFocus | undefined, active: boolean, human: boolean, defaults: CpuDefaults): void {
  const computer = active && !human;
  const preview = cardPortrait(computer);
  placeTopLeft(frames.portrait, cardX(slot) + (CARD_WIDTH - preview.size) / 2, preview.top);
  setFrameSize(frames.portrait, preview.size, preview.size);
  setFrameVisible(frames.summary, computer);
  setFrameVisible(frames.settings, computer);
  if (computer) {
    setMenuText(frames.summary, cpuCardSummary(game, slot, defaults));
    setMenuText(frames.settingsLabel, menuFocus?.kind === "settings" && menuFocus.slot === slot ? "> Opponent settings <" : "Opponent settings");
  }
}

export function presentCardChip(frames: CardFrames, drag: Readonly<SelectionDrag>, grid: RosterGrid, slot: number, active: boolean, ready: boolean, human: boolean, choice: number | undefined, x: number, y: number, remote: { readonly x: number; readonly y: number } | undefined): boolean {
  setFrameVisible(frames.chip, active);
  setFrameTexture(frames.chip, selectionChipTexture(slot, human), 0, true);
  const local = drag.dragging === slot || (!ready && drag.held === slot && drag.hover !== undefined);
  const carried = local || remote !== undefined;
  const hand = remote !== undefined && !local ? remote : { x, y };
  const chipChoice = tileOfCharacter(choice ?? DEFAULT_FIGHTER);
  const size = carried ? carriedChipSize(grid) : readyChipSize(grid);
  setFrameSize(frames.chip, size, size);
  setFrameLevel(frames.chip, carried ? SELECT_LEVELS.carriedChip : SELECT_LEVELS.cardChip);
  placeTopLeft(
    frames.chip,
    carried ? carriedChipLeft(hand.x, size) : ready ? chipX(grid, slot, chipChoice) : parkedChipLeft(slot, size),
    carried ? carriedChipTop(hand.y, size) : ready ? chipY(grid, slot, chipChoice) : parkedChipTop(size),
  );
  return local;
}

/** The chat box and the cards stay up from character select through stage select, so the two screens share one bottom row. */
export const cardRowShown = (game: Readonly<MatchState>, participantId: number, choosing: boolean): boolean =>
  choosing || (game.phase === Phase.stageMenu && humanActive(game, participantId));

/** A panel acts on its own player's clicks, and only on character select: on stage select its cards are shown for reference. */
export const acceptsClick = (game: Readonly<MatchState> | undefined, clicker: number, owner: number): boolean => clicker === owner && game?.phase === Phase.characterMenu;

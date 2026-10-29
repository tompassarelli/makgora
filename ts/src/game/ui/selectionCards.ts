import { DEFAULT_FIGHTER } from "../roster/kits";
import { SELECT_LEVELS } from "./selectLevels";
import type { CpuDefaults } from "./selectionCpuSettings";
import { type SessionWinsFrames, createSessionWinsFrames, presentSessionWinsFrames } from "./sessionWinsFrames";
import { cpuSettingsBox, teamSettingsBox } from "./ruleButtons";
import { boxContains } from "./selectionLayout";
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../input/participants";
import { type MatchState, canChooseComputer, canCycleSlotMode, costumeFor, fighterActive, humanFighterActive, humanPresent } from "../lobby/lobbyState";
import {
  type SelectionDrag,
  CARD_HEIGHT,
  CARD_TOP,
  CARD_WIDTH,
  cardDown,
  cardRight,
  cardSize,
  cardX,
  readyChipSize,
  carriedChipLeft,
  carriedChipTop,
  parkedChipLeft,
  parkedChipTop,
  chipX,
  chipY,
} from "../menu/selectionDrag";
import type { RosterGrid } from "../menu/selectionGrid";
import { Character } from "../sim/codes";
import { cardPortrait } from "./portraitFrames";
import { TEAM_NAMES } from "../sim/teams";
import { slotColor } from "./slotColors";
import { costumeIndex, costumesFor } from "../roster/costumes";
import { MAX_COSTUMES } from "../presentation/model/costume";
import { paintCostume } from "./costumeTint";
import { placeTopLeft, setFrameText } from "./frames";
import { BAR_HEIGHT, BAR_TEXT, BOTTOM_BAR_TOP, TAG_SCALE, TAG_SIZE, art, hotspot, label, modeBox, nameText, placeBottomBar, portraitTexture, tileOfCharacter, titleCase } from "./selectionFrames";

export type CardButton = { kind: "costume"; slot: number } | { kind: "team"; slot: number } | { kind: "mode"; slot: number } | { kind: "cpuSettings"; slot: number };

export const cardPalette = (game: Readonly<MatchState>, slot: number): number => game.teamBattle && fighterActive(game, slot) ? at(game.teamChoices, slot) : slot;

export type MenuFocus = { readonly kind: "fighter" | "settings" | "team" | "teamBattle" | "friendlyFire"; readonly slot: number };
export function menuFocusList(game: Readonly<MatchState>, participantId: number): MenuFocus[] {
  const focus: MenuFocus[] = [];
  if (humanFighterActive(game, participantId)) focus.push({ kind: "fighter", slot: participantId });
  for (const slot of PARTICIPANT_SLOTS) if (fighterActive(game, slot) && !humanFighterActive(game, slot)) {
    focus.push({ kind: "fighter", slot }, { kind: "settings", slot });
  }
  if (!game.training && !game.classic && !game.lore) focus.push({ kind: "teamBattle", slot: participantId });
  if (game.teamBattle) {
    if (humanFighterActive(game, participantId)) focus.push({ kind: "team", slot: participantId });
    for (const slot of PARTICIPANT_SLOTS) if (canChooseComputer(game, participantId, slot)) focus.push({ kind: "team", slot });
    focus.push({ kind: "friendlyFire", slot: participantId });
  }
  return focus;
}

function cpuCardSummary(game: Readonly<MatchState>, slot: number, defaults: CpuDefaults): string {
  return `CPU · ${titleCase(game.cpuOpponents[slot] ?? defaults.opponent)}\n${titleCase(game.cpuTiers[slot] ?? defaults.tier)}`;
}


export interface CardFrames {
  readonly card: framehandle;
  readonly tag: framehandle;
  readonly mode: framehandle;
  readonly team: framehandle;
  readonly teamLabel: framehandle;
  readonly portrait: framehandle;
  readonly costume: framehandle;
  readonly dots: readonly framehandle[];
  readonly name: framehandle;
  readonly status: framehandle;
  readonly wins: SessionWinsFrames;
  readonly chip: framehandle;
  readonly summary: framehandle;
  readonly settings: framehandle;
  readonly settingsLabel: framehandle;
}

export function createCard(root: framehandle, suffix: string, slot: number, add: (frame: framehandle, target: CardButton) => framehandle): CardFrames {
  const x = cardX(slot);
  const name = `${suffix}_${I2S(slot)}`;
  const card = art(root, `MeleeCard${name}`, "war3mapImported\\SelectionCardGray.tga", x, CARD_TOP, CARD_WIDTH, CARD_HEIGHT);
  const mode = BlzCreateFrameByType("BUTTON", `MeleeModeButton${name}`, root, "", 0);
  const modeArea = modeBox(slot);
  placeTopLeft(mode, modeArea.x, modeArea.y);
  BlzFrameSetSize(mode, modeArea.width, modeArea.height);
  add(mode, { kind: "mode", slot });
  const tag = label(mode, `MeleeTag${name}`, cardRight(slot, f32(0.014)), cardDown(f32(0.008)), cardSize(f32(0.132)), cardSize(f32(0.019)), TAG_SIZE);
  const teamArea = teamSettingsBox(slot);
  const team = hotspot(root, teamArea.x, teamArea.y, teamArea.width, teamArea.height);
  add(team, { kind: "team", slot });
  const teamLabel = label(root, `MeleeTeam${name}`, teamArea.x, cardDown(f32(0.008)), teamArea.width, cardSize(f32(0.019)), TAG_SIZE);
  const portrait = art(root, `MeleePortrait${name}`, portraitTexture(Character.demonHunter, false, slot), cardRight(slot, f32(0.029)), cardDown(f32(0.03)), cardSize(f32(0.102)), cardSize(f32(0.102)));
  const dotArea = costumeDotsBox(slot);
  const dotSize = cardSize(COSTUME_DOT);
  const dots = Array.from({ length: MAX_COSTUMES }, (_, index) => {
    const dot = art(root, `MeleeCostumeDot${name}_${I2S(index)}`, `war3mapImported\\SelectionChipP${I2S(slot + 1)}.tga`, f32(dotArea.x + f32(index * f32(dotSize + cardSize(COSTUME_DOT_GAP)))), dotArea.y, dotSize, dotSize);
    BlzFrameSetVisible(dot, false);
    return dot;
  });
  const portraitArea = costumePortraitBox(slot);
  const costume = hotspot(root, portraitArea.x, portraitArea.y, portraitArea.width, portraitArea.height);
  add(costume, { kind: "costume", slot });
  const name_ = label(root, `MeleeName${name}`, cardRight(slot, f32(0.008)), cardDown(f32(0.173)), cardSize(f32(0.144)), cardSize(f32(0.019)), cardSize(f32(0.011)));
  const wins = createSessionWinsFrames(root, name, cardRight(slot, f32(0.054)), BOTTOM_BAR_TOP, BAR_TEXT);
  const status = label(root, `MeleeStatus${name}`, cardRight(slot, f32(0.014)), BOTTOM_BAR_TOP, cardSize(f32(0.132)), BAR_HEIGHT, BAR_TEXT);
  const chip = art(root, `MeleeChip${name}`, `war3mapImported\\SelectionChipP${I2S(slot + 1)}.tga`, cardRight(slot, f32(0.06)), cardDown(f32(0.075)), cardSize(f32(0.06)), cardSize(f32(0.06)));
  BlzFrameSetLevel(chip, SELECT_LEVELS.cardChip);
  const box = cpuSettingsBox(slot);
  const settings = BlzCreateFrame("ScriptDialogButton", root, 0, 0);
  placeTopLeft(settings, box.x, box.y);
  BlzFrameSetSize(settings, box.width, box.height);
  setFrameText(settings, "");
  const settingsLabel = label(settings, `MeleeCpuSettingsLabel${name}`, box.x + f32(0.004), box.y - f32(0.002), box.width - f32(0.008), box.height - f32(0.004), f32(0.0075));
  setFrameText(settingsLabel, "Opponent settings");
  add(settings, { kind: "cpuSettings", slot });
  const summary = label(root, `MeleeCpuSummary${name}`, cardRight(slot, f32(0.004)), cardDown(f32(0.136)), cardSize(f32(0.152)), cardSize(f32(0.031)), BAR_TEXT);
  return { card, tag, mode, team, teamLabel, portrait, costume, dots, name: name_, status, wins, chip, summary, settings, settingsLabel };
}

export function presentCardTeam(frames: CardFrames, game: Readonly<MatchState>, slot: ParticipantSlot, participantId: number, menuFocus: MenuFocus | undefined, active: boolean, human: boolean, teamsShown: boolean, palette: number): void {
  const color = slotColor(palette);
  BlzFrameSetTexture(frames.card, `war3mapImported\\SelectionCard${active ? color.name : "Gray"}.tga`, 0, true);
  BlzFrameSetVisible(frames.team, teamsShown);
  BlzFrameSetVisible(frames.teamLabel, teamsShown);
  BlzFrameSetEnable(frames.team, teamsShown && (slot === participantId && human || canChooseComputer(game, participantId, slot)));
  setFrameText(frames.teamLabel, `${menuFocus?.kind === "team" && menuFocus.slot === slot ? "> " : ""}${TEAM_NAMES[game.teamChoices[slot]]}`);
}

export function presentCardTag(frames: CardFrames, game: Readonly<MatchState>, slot: number, participantId: number, menuFocus: MenuFocus | undefined, active: boolean, human: boolean): void {
  BlzFrameSetSize(frames.mode, game.teamBattle ? cardSize(f32(0.078)) : modeBox(slot).width, modeBox(slot).height);
  placeTopLeft(frames.tag, cardRight(slot, game.teamBattle ? f32(0.006) : f32(0.014)), cardDown(f32(0.008)));
  BlzFrameSetSize(frames.tag, f32(cardSize(game.teamBattle ? f32(0.068) : f32(0.132)) / TAG_SCALE), f32(cardSize(f32(0.019)) / TAG_SCALE));
  const focused = menuFocus?.kind === "fighter" && menuFocus.slot === slot;
  setFrameText(frames.tag, active ? `${focused ? "> " : ""}${human ? "Player" : "CPU"}${focused ? " <" : ""}` : "Empty");
  BlzFrameSetEnable(frames.mode, canCycleSlotMode(game, participantId, slot));
}

export function presentCardStatus(frames: CardFrames, game: Readonly<MatchState>, slot: number, active: boolean, ready: boolean, human: boolean, choice: number | undefined, palette: number, sessionWins: number, echoes: readonly string[]): void {
  BlzFrameSetVisible(frames.portrait, active && ready);
  BlzFrameSetVisible(frames.name, active && ready);
  const winsShown = active && ready && sessionWins > 0;
  presentSessionWinsFrames(frames.wins, sessionWins, active && ready);
  const statusText = human && !humanPresent(game, slot) ? "No player" : active && !ready ? "Choose fighter" : active && !human ? "CPU" : `P${I2S(slot + 1)}${at(echoes, slot)}`;
  setFrameText(frames.status, statusText);
  placeBottomBar(frames, slot, winsShown, statusText, `x${I2S(sessionWins)}`);
  if (ready) {
    BlzFrameSetTexture(frames.portrait, portraitTexture(choice, false, palette, choice === undefined || choice < 0 ? 0 : costumeIndex(choice, game.costumeChoices[slot] ?? 0)), 0, true);
    setFrameText(frames.name, nameText(choice));
  }
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
  BlzFrameSetEnable(frames.costume, shown && costumes.length > 1 && (slot === participantId && humanFighterActive(game, slot) || canChooseComputer(game, participantId, slot)));
  BlzFrameSetVisible(frames.costume, shown && costumes.length > 1);
  for (let index = 0; index < frames.dots.length; index++) {
    const dot = frames.dots[index];
    if (dot === undefined) continue;
    BlzFrameSetVisible(dot, shown && costumes.length > 1 && index < costumes.length);
    BlzFrameSetAlpha(dot, index === chosen ? 255 : 70);
  }
}

export function presentCardCpu(frames: CardFrames, game: Readonly<MatchState>, slot: number, menuFocus: MenuFocus | undefined, active: boolean, human: boolean, defaults: CpuDefaults): void {
  const computer = active && !human;
  const preview = cardPortrait(computer);
  placeTopLeft(frames.portrait, cardX(slot) + (CARD_WIDTH - preview.size) / 2, preview.top);
  BlzFrameSetSize(frames.portrait, preview.size, preview.size);
  BlzFrameSetVisible(frames.summary, computer);
  BlzFrameSetVisible(frames.settings, computer);
  if (computer) {
    setFrameText(frames.summary, cpuCardSummary(game, slot, defaults));
    setFrameText(frames.settingsLabel, menuFocus?.kind === "settings" && menuFocus.slot === slot ? "> Opponent settings <" : "Opponent settings");
  }
}

export function presentCardChip(frames: CardFrames, drag: Readonly<SelectionDrag>, grid: RosterGrid, slot: number, active: boolean, ready: boolean, human: boolean, choice: number | undefined, x: number, y: number): boolean {
  BlzFrameSetVisible(frames.chip, active);
  BlzFrameSetTexture(frames.chip, `war3mapImported\\SelectionChip${human ? "" : "CPU"}P${I2S(slot + 1)}.tga`, 0, true);
  const carried = drag.dragging === slot || (!ready && drag.held === slot && drag.hover !== undefined);
  const chipChoice = tileOfCharacter(choice ?? DEFAULT_FIGHTER);
  const size = readyChipSize(grid);
  BlzFrameSetSize(frames.chip, size, size);
  BlzFrameSetLevel(frames.chip, carried ? SELECT_LEVELS.carriedChip : SELECT_LEVELS.cardChip);
  placeTopLeft(
    frames.chip,
    carried ? carriedChipLeft(x, size) : ready ? chipX(grid, slot, chipChoice) : parkedChipLeft(slot, size),
    carried ? carriedChipTop(y, size) : ready ? chipY(grid, slot, chipChoice) : parkedChipTop(size),
  );
  return carried;
}

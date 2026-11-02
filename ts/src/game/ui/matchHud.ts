

import { f32 } from "wisp/src/sim/f32";
import { Character } from "../sim/codes";
import { hudTitle } from "./duoTitle";
import { DEFAULT_FIGHTER } from "../roster/kits";
import { fighterPortrait } from "../roster/looks";
import {
  DOOM_MARK_TEXTURE, NAME_FONT, PING_FONT, STOCK_FADE_FRAMES, STOCK_ICONS_SHOWN, type NumberJolt, type PanelLayout, type PlateBox, type PlateRow, plateRow, boxLeft, boxTop, damageOutlineText, damageText, numberJolt,
  panelLayout, percentOutlineText, percentText, pingBars, plateLeft, stepJolt, stockFadeAlpha,
} from "./plateLayout";
import { RACES, type Race, fighterRace } from "../roster/races";
import { STOCK_SHADOW_TEXTURE, namePlateTexture, pingSignalTexture } from "./raceFrame";
import { type RaceFrameFrames, createRaceFrame } from "./raceFrameFrames";
import { attachOutline, createOutline, createTemplateOutline, destroyOutline, setOutlineText, showOutline } from "./textOutline";
import { unitsForPixels } from "./portraitFrames";
import { createBackdrop, createText, gameUi, placeTopLeft } from "./frames";
import { MENU_FONT } from "./hudLayout";
import {
  CLOCK_DIGIT_SIZE, CLOCK_HUNDREDTHS_BOX, CLOCK_HUNDREDTHS_LEFT, CLOCK_HUNDREDTHS_SIZE, CLOCK_HUNDREDTHS_TOP, CLOCK_MAIN_BOX, CLOCK_MAIN_LEFT, CLOCK_TOP,
} from "./clockLayout";
import { clockHundredths, clockMain, clockSeconds, hundredthsLabel } from "./clockReadout";
import { createFrame, destroyFrame, Frame, setFrameAlpha, setFrameEnabled, setFrameFont, setFrameLevel, setFrameScale, setFrameSize, setFrameText, setFrameTextAlignment, setFrameTexture, setFrameVisible, TextAlignment } from "wisp/game/frames";
import { formatInt } from "wisp/game/text";


const CLOCK_LEVEL = 21;
const CLOCK_OUTLINE_PX = 4;
const CLOCK_TEMPLATE_SIZE = f32(0.036);
const CLOCK_FILL = "|cffffffff";
const CLOCK_RIM = "|cff0a0608";

interface ClockBox {
  readonly width: number;
  readonly height: number;
}

class ClockDigits {
  private readonly label: Frame;
  private readonly rim: readonly Frame[];

  constructor(context: number, size: number, box: ClockBox, left: number, top: number, horizontal: TextAlignment) {
    const scale = f32(size / CLOCK_TEMPLATE_SIZE);
    this.rim = createTemplateOutline("SmashcraftDamageOutline", gameUi(), context, CLOCK_LEVEL, scale);
    this.label = createFrame("SmashcraftDamage", gameUi(), 0, context);
    setFrameScale(this.label, scale);
    setFrameSize(this.label, f32(box.width / scale), f32(box.height / scale));
    placeTopLeft(this.label, left, top);
    setFrameTextAlignment(this.label, TextAlignment.bottom, horizontal);
    setFrameLevel(this.label, CLOCK_LEVEL);
    setFrameEnabled(this.label, false);
    attachOutline(this.rim, this.label, f32(CLOCK_OUTLINE_PX / scale), TextAlignment.bottom, horizontal);
    this.show(false);
  }

  show(visible: boolean): void {
    setFrameVisible(this.label, visible);
    showOutline(this.rim, visible);
  }

  setText(text: string): void {
    setFrameText(this.label, `${CLOCK_FILL}${text}|r`);
    setOutlineText(this.rim, `${CLOCK_RIM}${text}|r`);
  }

  destroy(): void {
    destroyFrame(this.label);
    destroyOutline(this.rim);
  }
}

export class MatchClock {
  private readonly main = new ClockDigits(890, CLOCK_DIGIT_SIZE, CLOCK_MAIN_BOX, CLOCK_MAIN_LEFT, CLOCK_TOP, TextAlignment.right);
  private readonly hundredths = new ClockDigits(891, CLOCK_HUNDREDTHS_SIZE, CLOCK_HUNDREDTHS_BOX, CLOCK_HUNDREDTHS_LEFT, CLOCK_HUNDREDTHS_TOP, TextAlignment.left);
  private shownVisible = false;
  private shownSeconds: number | undefined;
  private shownHundredths: number | undefined;

  destroy(): void {
    this.main.destroy();
    this.hundredths.destroy();
  }

  update(visible: boolean, frames: number): void {
    if (this.shownVisible !== visible) {
      this.shownVisible = visible;
      this.main.show(visible);
      this.hundredths.show(visible);
    }
    const seconds = clockSeconds(frames);
    if (this.shownSeconds !== seconds) {
      this.shownSeconds = seconds;
      this.main.setText(clockMain(seconds));
    }
    const hundredths = clockHundredths(frames);
    if (this.shownHundredths !== hundredths) {
      this.shownHundredths = hundredths;
      this.hundredths.setText(hundredthsLabel(hundredths));
    }
  }
}



const OUTLINE_PX = 2;
const PERCENT_FONT = f32(0.016);
const HUD_LEVEL = 21;
const NAME_COLOUR = "|cfff4ead2";
const PING_COLOUR = "|cff9fb4c2";

export class FighterHud {
  private readonly raceFrames: readonly RaceFrameFrames[];
  private readonly namePlate: Frame;
  private readonly damage: Frame;
  private readonly percent: Frame;
  private readonly name: Frame;
  private readonly stockShadows: readonly Frame[];
  private readonly stocks: readonly Frame[];
  private readonly pingSignal: Frame;
  private readonly pingNumber: Frame;

  private readonly stockCount: Frame;
  private readonly doomMark: Frame;
  private shownCursed: boolean | undefined;

  private readonly body: readonly Frame[];
  private shownCharacter: number | undefined;
  private shownRace: Race | undefined;
  private shownColor: number | undefined;
  private shownCostume: number | undefined;
  private shownMirrored: boolean | undefined;
  private shownTitleCharacter: number | undefined;
  private shownDuoTitle: boolean | undefined;

  private shownVisible: boolean | undefined;
  private shownDamage: string | undefined;
  private shownPercent: string | undefined;
  private shownDamageValue: number | undefined;
  private shownStocks: number | undefined;
  private fadingStock = -1;
  private fadeFrame = STOCK_FADE_FRAMES;
  private shownPing: number | undefined;

  private left = 0.0;
  private panel: PanelLayout = panelLayout(0, plateRow(1));
  private readonly jolt: NumberJolt = numberJolt();
  private readonly damageOutline: readonly Frame[];
  private readonly percentOutline: readonly Frame[];


  constructor(private readonly slot: number, count: number) {
    const suffix = formatInt(slot);
    const context = 800 + slot * 20;
    const parent = gameUi();
    this.raceFrames = RACES.map((race, index) => createRaceFrame(race, 1600 + slot * 8 + index));
    this.namePlate = createBackdrop(`FighterHUDNamePlate${suffix}`, parent, context);
    this.damageOutline = createTemplateOutline("SmashcraftDamageOutline", parent, context + 2, HUD_LEVEL, 1.0);
    this.percentOutline = createOutline(`FighterHUDPercent${suffix}`, parent, context + 7 + STOCK_ICONS_SHOWN, MENU_FONT, PERCENT_FONT, HUD_LEVEL);
    this.damage = createFrame("SmashcraftDamage", parent, 0, context + 2);
    this.percent = createText(`FighterHUDPercent${suffix}`, parent, context + 7 + STOCK_ICONS_SHOWN);
    setFrameFont(this.percent, MENU_FONT, PERCENT_FONT, 1);
    setFrameTextAlignment(this.percent, TextAlignment.bottom, TextAlignment.left);
    this.name = createText(`FighterHUDName${suffix}`, parent, context + 3);
    setFrameFont(this.name, MENU_FONT, NAME_FONT, 1);
    const shadows: Frame[] = [];
    const stocks: Frame[] = [];
    for (let index = 0; index < STOCK_ICONS_SHOWN; index++) {
      const shadow = createBackdrop(`FighterHUDStockShadow${suffix}_${formatInt(index)}`, parent, context + 5 + index);
      setFrameTexture(shadow, STOCK_SHADOW_TEXTURE, 0, true);
      shadows.push(shadow);
      stocks.push(createBackdrop(`FighterHUDStock${suffix}_${formatInt(index)}`, parent, context + 5 + index));
    }
    this.stockShadows = shadows;
    this.stocks = stocks;
    this.stockCount = createText(`FighterHUDStockCount${suffix}`, parent, context + 6 + STOCK_ICONS_SHOWN);
    setFrameFont(this.stockCount, MENU_FONT, NAME_FONT, 1);
    this.doomMark = createBackdrop(`FighterHUDDoom${suffix}`, parent, context + 8 + STOCK_ICONS_SHOWN);
    setFrameTexture(this.doomMark, DOOM_MARK_TEXTURE, 0, true);
    this.pingSignal = createBackdrop(`FighterHUDPingSignal${suffix}`, parent, context + 9 + STOCK_ICONS_SHOWN);
    this.pingNumber = createText(`FighterHUDPing${suffix}`, parent, context + 10 + STOCK_ICONS_SHOWN);
    setFrameFont(this.pingNumber, MENU_FONT, PING_FONT, 0);
    this.body = [this.namePlate, this.damage, this.percent, this.name];
    const stockLayer = [...this.stockShadows, ...this.stocks, this.stockCount];
    for (const frame of [...this.body, ...stockLayer, this.doomMark, this.pingSignal, this.pingNumber]) {
      setFrameLevel(frame, HUD_LEVEL);
      setFrameEnabled(frame, false);
    }
    for (const frame of [...this.stocks, this.stockCount]) setFrameLevel(frame, HUD_LEVEL + 1);
    attachOutline(this.damageOutline, this.damage, OUTLINE_PX, TextAlignment.middle, TextAlignment.right);
    attachOutline(this.percentOutline, this.percent, OUTLINE_PX, TextAlignment.bottom, TextAlignment.left);
    this.layout(slot, plateRow(count));
    this.update(false, DEFAULT_FIGHTER, slot, 0.0, 0);
  }

  destroy(): void {
    for (const frame of this.raceFrames) destroyFrame(frame.root);
    for (const frame of this.body) destroyFrame(frame);
    destroyOutline(this.damageOutline);
    destroyOutline(this.percentOutline);
    for (const icon of [...this.stockShadows, ...this.stocks, this.pingSignal]) destroyFrame(icon);
    destroyFrame(this.stockCount);
    destroyFrame(this.doomMark);
    destroyFrame(this.pingNumber);
  }


  layout(position: number, row: PlateRow): void {
    const left = plateLeft(position, row);
    const panel = panelLayout(position, row);
    this.left = left;
    this.panel = panel;
    const inner = panel.mirrored ? TextAlignment.right : TextAlignment.left;
    const scale = row.scale;
    for (const frame of this.raceFrames) {
      setFrameScale(frame.root, scale);
      placeBox(frame.root, left, panel.frame, scale);
    }
    placeBox(this.namePlate, left, panel.namePlate);
    setFrameScale(this.damage, scale);
    for (const copy of this.damageOutline) setFrameScale(copy, scale);
    placeBox(this.damage, left, panel.damage, scale);
    setFrameTextAlignment(this.damage, TextAlignment.middle, TextAlignment.right);
    setFrameFont(this.percent, MENU_FONT, f32(PERCENT_FONT * scale), 1);
    for (const copy of this.percentOutline) setFrameFont(copy, MENU_FONT, f32(PERCENT_FONT * scale), 0);
    placeBox(this.percent, left, panel.percent);
    placeBox(this.doomMark, left, panel.doom);
    setFrameFont(this.name, MENU_FONT, f32(NAME_FONT * scale), 1);
    setFrameFont(this.stockCount, MENU_FONT, f32(NAME_FONT * scale), 1);
    setFrameFont(this.pingNumber, MENU_FONT, f32(PING_FONT * scale), 0);
    placeBox(this.name, left, panel.name);
    setFrameTextAlignment(this.name, TextAlignment.middle, inner);
    placeEach(this.stockShadows, left, panel.stockShadows);
    placeEach(this.stocks, left, panel.stocks);
    placeBox(this.stockCount, left, panel.stockCount);
    setFrameTextAlignment(this.stockCount, TextAlignment.middle, inner);
    placeBox(this.pingSignal, left, panel.pingSignal);
    placeBox(this.pingNumber, left, panel.pingNumber);
    setFrameTextAlignment(this.pingNumber, TextAlignment.middle, panel.mirrored ? TextAlignment.left : TextAlignment.right);
    this.shownRace = undefined;
    this.placeNumber(0.0, 0.0);
  }


  update(visible: boolean, character: Character, color: number, damage: number, stocks: number, cursed = false, costume = 0, duo = false): void {
    if (this.shownVisible !== visible) {
      this.shownVisible = visible;
      for (const frame of this.body) setFrameVisible(frame, visible);
      showOutline(this.damageOutline, visible);
      showOutline(this.percentOutline, visible);
      this.shownRace = undefined;
    }
    const race = fighterRace(character);
    if (this.shownRace !== race) {
      this.shownRace = race;
      this.raceFrames.forEach((frame, index) => setFrameVisible(frame.root, visible && RACES[index] === race));
      setFrameTexture(this.namePlate, namePlateTexture(race, this.panel.mirrored), 0, true);
      this.shownCharacter = undefined;
    }
    if (this.shownCharacter !== character || this.shownCostume !== costume || this.shownColor !== color || this.shownMirrored !== this.panel.mirrored) {
      this.shownCharacter = character;
      this.shownCostume = costume;
      this.shownColor = color;
      this.shownMirrored = this.panel.mirrored;
      const bust = fighterPortrait(character, "Bust", color, costume);
      for (const frame of this.raceFrames) setFrameTexture(frame.portrait, bust, 0, true);
      for (const icon of this.stocks) setFrameTexture(icon, fighterPortrait(character, "Stock", color, costume), 0, true);
    }
    this.showTitle(character, duo);
    if (stepJolt(this.jolt, visible, damage)) this.placeNumber(unitsForPixels(this.jolt.dx), unitsForPixels(this.jolt.dy));
    this.showDamage(damage);
    this.showStocks(visible ? stocks : 0, visible);
    this.showCursed(visible && cursed);
    if (!visible) this.showPing(-1);
  }

  /** The round trip to this player as the netcode measures it, or -1 to hide the readout (offline, computer or the local player). */
  showPing(roundTripMs: number): void {
    const shown = this.shownVisible === true ? roundTripMs : -1;
    if (this.shownPing === shown) return;
    this.shownPing = shown;
    const bars = pingBars(shown);
    setFrameVisible(this.pingSignal, bars > 0);
    if (bars > 0) setFrameTexture(this.pingSignal, pingSignalTexture(bars), 0, true);
    setFrameVisible(this.pingNumber, bars > 0);
    setFrameText(this.pingNumber, `${PING_COLOUR}${formatInt(Math.max(0, shown))}|r`);
  }


  private showTitle(character: Character, duoTitle: boolean): void {
    if (this.shownTitleCharacter === character && this.shownDuoTitle === duoTitle) return;
    this.shownTitleCharacter = character;
    this.shownDuoTitle = duoTitle;
    setFrameText(this.name, `${NAME_COLOUR}${hudTitle(character, duoTitle)}|r`);
  }

  private showDamage(damage: number): void {
    if (this.shownDamageValue === damage) return;
    this.shownDamageValue = damage;
    const shownDamage = damageText(damage);
    if (this.shownDamage !== shownDamage) {
      this.shownDamage = shownDamage;
      setFrameText(this.damage, shownDamage);
      setOutlineText(this.damageOutline, damageOutlineText(damage));
    }
    const shownPercent = percentText(damage);
    if (this.shownPercent !== shownPercent) {
      this.shownPercent = shownPercent;
      setFrameText(this.percent, shownPercent);
      setOutlineText(this.percentOutline, percentOutlineText(damage));
    }
  }

  private showCursed(cursed: boolean): void {
    if (this.shownCursed === cursed) return;
    this.shownCursed = cursed;
    setFrameVisible(this.doomMark, cursed);
  }

  private showStocks(shownStocks: number, visible: boolean): void {
    const previous = this.shownStocks;
    if (previous !== shownStocks) {
      this.shownStocks = shownStocks;
      const lost = visible && previous !== undefined && shownStocks === previous - 1 && previous <= STOCK_ICONS_SHOWN;
      this.fadingStock = lost ? shownStocks : -1;
      this.fadeFrame = lost ? 0 : STOCK_FADE_FRAMES;
      const counted = shownStocks > STOCK_ICONS_SHOWN;
      const icons = counted ? 1 : shownStocks;
      for (let index = 0; index < STOCK_ICONS_SHOWN; index++) {
        const on = index < icons || index === this.fadingStock;
        const icon = this.stocks[index], shadow = this.stockShadows[index];
        if (icon !== undefined) { setFrameVisible(icon, on); setFrameAlpha(icon, 255); }
        if (shadow !== undefined) { setFrameVisible(shadow, on); setFrameAlpha(shadow, 255); }
      }
      setFrameVisible(this.stockCount, counted);
      setFrameText(this.stockCount, `${NAME_COLOUR}x ${formatInt(shownStocks)}|r`);
    }
    if (this.fadingStock < 0) return;
    this.fadeFrame++;
    const alpha = stockFadeAlpha(this.fadeFrame);
    const icon = this.stocks[this.fadingStock], shadow = this.stockShadows[this.fadingStock];
    if (icon !== undefined) { setFrameAlpha(icon, alpha); setFrameVisible(icon, alpha > 0); }
    if (shadow !== undefined) { setFrameAlpha(shadow, alpha); setFrameVisible(shadow, alpha > 0); }
    if (alpha === 0) this.fadingStock = -1;
  }

  private placeNumber(dx: number, dy: number): void {
    placeTopLeft(this.damage, boxLeft(this.left, this.panel.damage) + dx, boxTop(this.panel.damage) - dy);
    placeTopLeft(this.percent, boxLeft(this.left, this.panel.percent) + dx, boxTop(this.panel.percent) - dy);
  }
}

function placeBox(frame: Frame, left: number, box: PlateBox, scale = 1.0): void {
  setFrameSize(frame, f32(unitsForPixels(box.width) / scale), f32(unitsForPixels(box.height) / scale));
  placeTopLeft(frame, boxLeft(left, box), boxTop(box));
}

function placeEach(frames: readonly Frame[], left: number, boxes: readonly PlateBox[]): void {
  frames.forEach((frame, index) => {
    const box = boxes[index];
    if (box !== undefined) placeBox(frame, left, box);
  });
}

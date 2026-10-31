

import { f32 } from "wisp/src/sim/f32";
import { Character } from "../sim/codes";
import type { CostumeTint } from "../presentation/model/costume";
import { paintCostume } from "./costumeTint";
import { DUO_TITLE } from "./duoTitle";
import { fighterName, DEFAULT_FIGHTER } from "../roster/kits";
import { fighterPortrait } from "../roster/looks";
import {
  DOOM_MARK_TEXTURE, PLATE_HEIGHT_PX, PLATE_TOP, PLATE_WIDTH_PX, STOCK_ICONS_SHOWN, type NumberJolt, type PanelLayout, type PlateBox, boxLeft, boxTop, damageOutlineText, damageText, numberJolt,
  panelLayout, percentOutlineText, percentText, plateLeft, stepJolt,
} from "./plateLayout";
import { attachOutline, createOutline, createTemplateOutline, destroyOutline, setOutlineText, showOutline } from "./textOutline";
import { unitsForPixels } from "./portraitFrames";
import { createBackdrop, createText, gameUi, placeTopLeft } from "./frames";
import { MENU_FONT, hudPlateTexture } from "./hudLayout";
import { clockHundredths, clockMain, clockSeconds, hundredthsLabel } from "./clockReadout";
import { createFrame, destroyFrame, setFrameEnabled, setFrameFont, setFrameLevel, setFrameScale, setFrameSize, setFrameText, setFrameTextAlignment, setFrameTexture, setFrameVisible } from "wisp/game/frames";


const CLOCK_LEVEL = 21;
const CLOCK_OUTLINE_PX = 4;
const CLOCK_BASELINE_LIFT = f32(0.0047);
const CLOCK_TEMPLATE_SIZE = f32(0.036);
const CLOCK_DIGIT_SIZE = f32(0.05);
const CLOCK_HUNDREDTHS_SIZE = f32(0.0275);
const CLOCK_TOP = f32(0.59);
const CLOCK_SPLIT_X = f32(0.452);
const CLOCK_GAP = f32(0.004);
const CLOCK_MAIN_BOX = { width: f32(0.2), height: f32(0.06) } as const;
const CLOCK_HUNDREDTHS_BOX = { width: f32(0.06), height: f32(0.04) } as const;
const CLOCK_FILL = "|cffffffff";
const CLOCK_RIM = "|cff0a0608";

interface ClockBox {
  readonly width: number;
  readonly height: number;
}

class ClockDigits {
  private readonly label: framehandle;
  private readonly rim: readonly framehandle[];

  constructor(context: number, size: number, box: ClockBox, left: number, top: number, horizontal: textaligntype) {
    const scale = f32(size / CLOCK_TEMPLATE_SIZE);
    this.rim = createTemplateOutline("SmashcraftDamageOutline", gameUi(), context, CLOCK_LEVEL, scale);
    this.label = createFrame("SmashcraftDamage", gameUi(), 0, context);
    setFrameScale(this.label, scale);
    setFrameSize(this.label, f32(box.width / scale), f32(box.height / scale));
    placeTopLeft(this.label, left, top);
    setFrameTextAlignment(this.label, TEXT_JUSTIFY_BOTTOM, horizontal);
    setFrameLevel(this.label, CLOCK_LEVEL);
    setFrameEnabled(this.label, false);
    attachOutline(this.rim, this.label, f32(CLOCK_OUTLINE_PX / scale), TEXT_JUSTIFY_BOTTOM, horizontal);
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
  private readonly main = new ClockDigits(890, CLOCK_DIGIT_SIZE, CLOCK_MAIN_BOX, f32(CLOCK_SPLIT_X - CLOCK_MAIN_BOX.width), CLOCK_TOP, TEXT_JUSTIFY_RIGHT);
  private readonly hundredths = new ClockDigits(891, CLOCK_HUNDREDTHS_SIZE, CLOCK_HUNDREDTHS_BOX, f32(CLOCK_SPLIT_X + CLOCK_GAP), f32(CLOCK_TOP - CLOCK_MAIN_BOX.height + CLOCK_HUNDREDTHS_BOX.height + CLOCK_BASELINE_LIFT), TEXT_JUSTIFY_LEFT);
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

export class FighterHud {
  private readonly plate: framehandle;
  private readonly portrait: framehandle;
  private readonly damage: framehandle;
  private readonly percent: framehandle;
  private readonly name: framehandle;
  private readonly stocks: readonly framehandle[];

  private readonly stockCount: framehandle;
  private readonly doomMark: framehandle;
  private shownCursed: boolean | undefined;

  private readonly body: readonly framehandle[];
  private shownCharacter: number | undefined;
  private shownColor: number | undefined;
  private shownTint: CostumeTint | undefined;
  private shownCostume: number | undefined;
  private shownMirrored: boolean | undefined;
  private shownTitleCharacter: number | undefined;
  private shownDuoTitle: boolean | undefined;

  private shownVisible: boolean | undefined;
  private shownDamage: string | undefined;
  private shownPercent: string | undefined;
  private shownDamageValue: number | undefined;
  private shownStocks: number | undefined;

  private left = 0.0;
  private panel: PanelLayout = panelLayout(0, 1);
  private readonly jolt: NumberJolt = numberJolt();
  private readonly damageOutline: readonly framehandle[];
  private readonly percentOutline: readonly framehandle[];


  constructor(private readonly slot: number, count: number) {
    const suffix = I2S(slot);
    const context = 800 + slot * 20;
    const parent = gameUi();
    this.plate = createBackdrop(`FighterHUDPlate${suffix}`, parent, context);
    setFrameSize(this.plate, unitsForPixels(PLATE_WIDTH_PX), unitsForPixels(PLATE_HEIGHT_PX));
    setFrameEnabled(this.plate, false);
    this.portrait = createBackdrop(`FighterHUDPortrait${suffix}`, parent, context + 1);
    setFrameEnabled(this.portrait, false);
    this.damageOutline = createTemplateOutline("SmashcraftDamageOutline", parent, context + 2, 21, 1.0);
    this.percentOutline = createOutline(`FighterHUDPercent${suffix}`, parent, context + 7 + STOCK_ICONS_SHOWN, MENU_FONT, f32(0.016), 21);
    this.damage = createFrame("SmashcraftDamage", parent, 0, context + 2);
    setFrameEnabled(this.damage, false);
    this.percent = createText(`FighterHUDPercent${suffix}`, parent, context + 7 + STOCK_ICONS_SHOWN);
    setFrameFont(this.percent, MENU_FONT, f32(0.016), 1);
    setFrameTextAlignment(this.percent, TEXT_JUSTIFY_BOTTOM, TEXT_JUSTIFY_LEFT);
    setFrameEnabled(this.percent, false);
    this.name = createText(`FighterHUDName${suffix}`, parent, context + 3);
    setFrameFont(this.name, MENU_FONT, f32(0.0072), 1);
    setFrameEnabled(this.name, false);
    const stocks: framehandle[] = [];
    for (let index = 0; index < STOCK_ICONS_SHOWN; index++) {
      const icon = createBackdrop(`FighterHUDStock${suffix}_${I2S(index)}`, parent, context + 5 + index);
      setFrameEnabled(icon, false);
      stocks.push(icon);
    }
    this.stocks = stocks;
    this.stockCount = createText(`FighterHUDStockCount${suffix}`, parent, context + 6 + STOCK_ICONS_SHOWN);
    setFrameFont(this.stockCount, MENU_FONT, f32(0.011), 1);
    setFrameEnabled(this.stockCount, false);
    this.doomMark = createBackdrop(`FighterHUDDoom${suffix}`, parent, context + 8 + STOCK_ICONS_SHOWN);
    setFrameTexture(this.doomMark, DOOM_MARK_TEXTURE, 0, true);
    setFrameEnabled(this.doomMark, false);
    this.body = [this.plate, this.portrait, this.damage, this.percent, this.name];
    for (const frame of [...this.body, ...this.stocks, this.stockCount, this.doomMark]) setFrameLevel(frame, 21);
    attachOutline(this.damageOutline, this.damage, OUTLINE_PX, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_RIGHT);
    attachOutline(this.percentOutline, this.percent, OUTLINE_PX, TEXT_JUSTIFY_BOTTOM, TEXT_JUSTIFY_LEFT);
    this.layout(slot, count);
    this.update(false, DEFAULT_FIGHTER, slot, 0.0, 0);
  }

  destroy(): void {
    for (const frame of this.body) destroyFrame(frame);
    destroyOutline(this.damageOutline);
    destroyOutline(this.percentOutline);
    for (const icon of this.stocks) destroyFrame(icon);
    destroyFrame(this.stockCount);
    destroyFrame(this.doomMark);
  }


  layout(position: number, count: number, hints = false): void {
    const left = plateLeft(position, count, hints);
    const panel = panelLayout(position, count);
    this.left = left;
    this.panel = panel;
    const inner = panel.mirrored ? TEXT_JUSTIFY_RIGHT : TEXT_JUSTIFY_LEFT;
    placeTopLeft(this.plate, left, PLATE_TOP);
    placeBox(this.portrait, left, panel.bust);
    placeBox(this.damage, left, panel.damage);
    setFrameTextAlignment(this.damage, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_RIGHT);
    placeBox(this.percent, left, panel.percent);
    placeBox(this.doomMark, left, panel.doom);
    placeBox(this.name, left, panel.name);
    setFrameTextAlignment(this.name, TEXT_JUSTIFY_MIDDLE, inner);
    this.stocks.forEach((icon, index) => {
      const box = panel.stocks[index];
      if (box !== undefined) placeBox(icon, left, box);
    });
    placeBox(this.stockCount, left, panel.stockCount);
    setFrameTextAlignment(this.stockCount, TEXT_JUSTIFY_MIDDLE, inner);
    this.placeNumber(0.0, 0.0);
  }


  update(visible: boolean, character: Character, color: number, damage: number, stocks: number, cursed = false, tint?: CostumeTint, costume = 0, duo = false): void {
    if (this.shownVisible !== visible) {
      this.shownVisible = visible;
      for (const frame of this.body) setFrameVisible(frame, visible);
      showOutline(this.damageOutline, visible);
      showOutline(this.percentOutline, visible);
    }
    if (this.shownCharacter !== character || this.shownCostume !== costume || this.shownColor !== color || this.shownMirrored !== this.panel.mirrored) {
      this.shownCharacter = character;
      this.shownCostume = costume;
      this.shownColor = color;
      this.shownMirrored = this.panel.mirrored;
      setFrameTexture(this.plate, hudPlateTexture(color, this.panel.mirrored), 0, true);
      setFrameTexture(this.portrait, fighterPortrait(character, "Bust", color, costume), 0, true);
      for (const icon of this.stocks) setFrameTexture(icon, fighterPortrait(character, "Stock", color, costume), 0, true);
    }
    this.showTitle(character, duo);
    if (this.shownTint !== tint) {
      this.shownTint = tint;
      paintCostume(this.portrait, tint);
    }
    if (stepJolt(this.jolt, visible, damage)) this.placeNumber(unitsForPixels(this.jolt.dx), unitsForPixels(this.jolt.dy));
    this.showDamage(damage);
    this.showStocks(visible ? stocks : 0);
    this.showCursed(visible && cursed);
  }


  private showTitle(character: Character, duoTitle: boolean): void {
    if (this.shownTitleCharacter === character && this.shownDuoTitle === duoTitle) return;
    this.shownTitleCharacter = character;
    this.shownDuoTitle = duoTitle;
    setFrameText(this.name, duoTitle ? DUO_TITLE : fighterName(character).toUpperCase());
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

  private showStocks(shownStocks: number): void {
    if (this.shownStocks === shownStocks) return;
    this.shownStocks = shownStocks;
    const counted = shownStocks > STOCK_ICONS_SHOWN;
    const icons = counted ? 1 : shownStocks;
    for (let index = 0; index < this.stocks.length; index++) {
      const icon = this.stocks[index];
      if (icon !== undefined) setFrameVisible(icon, index < icons);
    }
    setFrameVisible(this.stockCount, counted);
    setFrameText(this.stockCount, `x${I2S(shownStocks)}`);
  }

  private placeNumber(dx: number, dy: number): void {
    placeTopLeft(this.damage, boxLeft(this.left, this.panel.damage) + dx, boxTop(this.panel.damage) - dy);
    placeTopLeft(this.percent, boxLeft(this.left, this.panel.percent) + dx, boxTop(this.panel.percent) - dy);
  }
}

function placeBox(frame: framehandle, left: number, box: PlateBox): void {
  setFrameSize(frame, unitsForPixels(box.width), unitsForPixels(box.height));
  placeTopLeft(frame, boxLeft(left, box), boxTop(box));
}

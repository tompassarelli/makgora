

import { f32 } from "wisp/src/sim/f32";
import { idiv, imod } from "wisp/src/sim/intMath";
import { Character } from "../sim/codes";
import type { CostumeTint } from "../presentation/model/costume";
import { paintCostume } from "./costumeTint";
import { fighterName, DEFAULT_FIGHTER } from "../roster/kits";
import { fighterPortrait } from "../roster/looks";
import {
  DOOM_MARK_TEXTURE, PLATE_HEIGHT_PX, PLATE_TOP, PLATE_WIDTH_PX, STOCK_ICONS_SHOWN, type NumberJolt, type PanelLayout, type PlateBox, boxLeft, boxTop, damageOutlineText, damageText, numberJolt,
  panelLayout, percentOutlineText, percentText, plateLeft, stepJolt,
} from "./plateLayout";
import { attachOutline, createOutline, createTemplateOutline, destroyOutline, setOutlineText, showOutline } from "./textOutline";
import { unitsForPixels } from "./portraitFrames";
import { createBackdrop, createText, gameUi, placeTopLeft } from "./frames";
import { MENU_FONT } from "./hudLayout";


export class MatchClock {
  private readonly label: framehandle;
  private shownVisible = false;
  private shownSeconds: number | undefined;

  constructor() {
    this.label = createText("MatchClock", gameUi(), 890);
    placeTopLeft(this.label, f32(0.65), f32(0.568));
    BlzFrameSetSize(this.label, f32(0.12), f32(0.032));
    BlzFrameSetFont(this.label, MENU_FONT, f32(0.02), 1);
    BlzFrameSetTextAlignment(this.label, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_RIGHT);
    BlzFrameSetEnable(this.label, false);
    BlzFrameSetVisible(this.label, false);
  }

  destroy(): void {
    BlzDestroyFrame(this.label);
  }

  update(visible: boolean, seconds: number): void {
    if (this.shownVisible !== visible) {
      this.shownVisible = visible;
      BlzFrameSetVisible(this.label, visible);
    }
    if (this.shownSeconds === seconds) return;
    this.shownSeconds = seconds;
    const remainder = imod(seconds, 60);
    BlzFrameSetText(this.label, `${I2S(idiv(seconds, 60))}:${remainder < 10 ? "0" : ""}${I2S(remainder)}`);
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
    BlzFrameSetSize(this.plate, unitsForPixels(PLATE_WIDTH_PX), unitsForPixels(PLATE_HEIGHT_PX));
    BlzFrameSetEnable(this.plate, false);
    this.portrait = createBackdrop(`FighterHUDPortrait${suffix}`, parent, context + 1);
    BlzFrameSetEnable(this.portrait, false);
    this.damageOutline = createTemplateOutline("SmashcraftDamageOutline", parent, context + 2, 21, 1.0);
    this.percentOutline = createOutline(`FighterHUDPercent${suffix}`, parent, context + 7 + STOCK_ICONS_SHOWN, MENU_FONT, f32(0.016), 21);
    this.damage = BlzCreateFrame("SmashcraftDamage", parent, 0, context + 2);
    BlzFrameSetEnable(this.damage, false);
    this.percent = createText(`FighterHUDPercent${suffix}`, parent, context + 7 + STOCK_ICONS_SHOWN);
    BlzFrameSetFont(this.percent, MENU_FONT, f32(0.016), 1);
    BlzFrameSetTextAlignment(this.percent, TEXT_JUSTIFY_BOTTOM, TEXT_JUSTIFY_LEFT);
    BlzFrameSetEnable(this.percent, false);
    this.name = createText(`FighterHUDName${suffix}`, parent, context + 3);
    BlzFrameSetFont(this.name, MENU_FONT, f32(0.0072), 1);
    BlzFrameSetEnable(this.name, false);
    const stocks: framehandle[] = [];
    for (let index = 0; index < STOCK_ICONS_SHOWN; index++) {
      const icon = createBackdrop(`FighterHUDStock${suffix}_${I2S(index)}`, parent, context + 5 + index);
      BlzFrameSetEnable(icon, false);
      stocks.push(icon);
    }
    this.stocks = stocks;
    this.stockCount = createText(`FighterHUDStockCount${suffix}`, parent, context + 6 + STOCK_ICONS_SHOWN);
    BlzFrameSetFont(this.stockCount, MENU_FONT, f32(0.011), 1);
    BlzFrameSetEnable(this.stockCount, false);
    this.doomMark = createBackdrop(`FighterHUDDoom${suffix}`, parent, context + 8 + STOCK_ICONS_SHOWN);
    BlzFrameSetTexture(this.doomMark, DOOM_MARK_TEXTURE, 0, true);
    BlzFrameSetEnable(this.doomMark, false);
    this.body = [this.plate, this.portrait, this.damage, this.percent, this.name];
    for (const frame of [...this.body, ...this.stocks, this.stockCount, this.doomMark]) BlzFrameSetLevel(frame, 21);
    attachOutline(this.damageOutline, this.damage, OUTLINE_PX, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_RIGHT);
    attachOutline(this.percentOutline, this.percent, OUTLINE_PX, TEXT_JUSTIFY_BOTTOM, TEXT_JUSTIFY_LEFT);
    this.layout(slot, count);
    this.update(false, DEFAULT_FIGHTER, slot, 0.0, 0);
  }

  destroy(): void {
    for (const frame of this.body) BlzDestroyFrame(frame);
    destroyOutline(this.damageOutline);
    destroyOutline(this.percentOutline);
    for (const icon of this.stocks) BlzDestroyFrame(icon);
    BlzDestroyFrame(this.stockCount);
    BlzDestroyFrame(this.doomMark);
  }


  layout(position: number, count: number): void {
    const left = plateLeft(position, count);
    const panel = panelLayout(position, count);
    this.left = left;
    this.panel = panel;
    const inner = panel.mirrored ? TEXT_JUSTIFY_RIGHT : TEXT_JUSTIFY_LEFT;
    placeTopLeft(this.plate, left, PLATE_TOP);
    placeBox(this.portrait, left, panel.bust);
    placeBox(this.damage, left, panel.damage);
    BlzFrameSetTextAlignment(this.damage, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_RIGHT);
    placeBox(this.percent, left, panel.percent);
    placeBox(this.doomMark, left, panel.doom);
    placeBox(this.name, left, panel.name);
    BlzFrameSetTextAlignment(this.name, TEXT_JUSTIFY_MIDDLE, inner);
    this.stocks.forEach((icon, index) => {
      const box = panel.stocks[index];
      if (box !== undefined) placeBox(icon, left, box);
    });
    placeBox(this.stockCount, left, panel.stockCount);
    BlzFrameSetTextAlignment(this.stockCount, TEXT_JUSTIFY_MIDDLE, inner);
    this.placeNumber(0.0, 0.0);
  }


  update(visible: boolean, character: Character, color: number, damage: number, stocks: number, cursed = false, tint?: CostumeTint, costume = 0): void {
    if (this.shownVisible !== visible) {
      this.shownVisible = visible;
      for (const frame of this.body) BlzFrameSetVisible(frame, visible);
      showOutline(this.damageOutline, visible);
      showOutline(this.percentOutline, visible);
    }
    if (this.shownCharacter !== character || this.shownColor !== color || this.shownMirrored !== this.panel.mirrored) {
      this.shownCharacter = character;
      this.shownColor = color;
      this.shownMirrored = this.panel.mirrored;
      BlzFrameSetTexture(this.plate, `war3mapImported\\HudPlate${this.panel.mirrored ? "Mirror" : ""}${I2S(color)}.tga`, 0, true);
      BlzFrameSetTexture(this.portrait, fighterPortrait(character, "Bust", color, costume), 0, true);
      BlzFrameSetText(this.name, fighterName(character).toUpperCase());
      for (const icon of this.stocks) BlzFrameSetTexture(icon, fighterPortrait(character, "Stock", color, costume), 0, true);
    }
    if (this.shownTint !== tint) {
      this.shownTint = tint;
      paintCostume(this.portrait, tint);
    }
    if (stepJolt(this.jolt, visible, damage)) this.placeNumber(unitsForPixels(this.jolt.dx), unitsForPixels(this.jolt.dy));
    this.showDamage(damage);
    this.showStocks(visible ? stocks : 0);
    this.showCursed(visible && cursed);
  }


  private showDamage(damage: number): void {
    if (this.shownDamageValue === damage) return;
    this.shownDamageValue = damage;
    const shownDamage = damageText(damage);
    if (this.shownDamage !== shownDamage) {
      this.shownDamage = shownDamage;
      BlzFrameSetText(this.damage, shownDamage);
      setOutlineText(this.damageOutline, damageOutlineText(damage));
    }
    const shownPercent = percentText(damage);
    if (this.shownPercent !== shownPercent) {
      this.shownPercent = shownPercent;
      BlzFrameSetText(this.percent, shownPercent);
      setOutlineText(this.percentOutline, percentOutlineText(damage));
    }
  }

  private showCursed(cursed: boolean): void {
    if (this.shownCursed === cursed) return;
    this.shownCursed = cursed;
    BlzFrameSetVisible(this.doomMark, cursed);
  }

  private showStocks(shownStocks: number): void {
    if (this.shownStocks === shownStocks) return;
    this.shownStocks = shownStocks;
    const counted = shownStocks > STOCK_ICONS_SHOWN;
    const icons = counted ? 1 : shownStocks;
    for (let index = 0; index < this.stocks.length; index++) {
      const icon = this.stocks[index];
      if (icon !== undefined) BlzFrameSetVisible(icon, index < icons);
    }
    BlzFrameSetVisible(this.stockCount, counted);
    BlzFrameSetText(this.stockCount, `x${I2S(shownStocks)}`);
  }

  private placeNumber(dx: number, dy: number): void {
    placeTopLeft(this.damage, boxLeft(this.left, this.panel.damage) + dx, boxTop(this.panel.damage) - dy);
    placeTopLeft(this.percent, boxLeft(this.left, this.panel.percent) + dx, boxTop(this.panel.percent) - dy);
  }
}

function placeBox(frame: framehandle, left: number, box: PlateBox): void {
  BlzFrameSetSize(frame, unitsForPixels(box.width), unitsForPixels(box.height));
  placeTopLeft(frame, boxLeft(left, box), boxTop(box));
}

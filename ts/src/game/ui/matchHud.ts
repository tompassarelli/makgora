

import { f32 } from "wisp/src/sim/f32";
import { idiv, imod } from "wisp/src/sim/intMath";
import { Character } from "../sim/codes";
import { fighterName } from "../roster/kits";
import { fighterPortrait } from "../roster/looks";
import {
  PLATE_HEIGHT_PX, PLATE_TOP, PLATE_WIDTH_PX, SHAKE_FRAMES, STOCK_ICONS_SHOWN, type PanelLayout, type PlateBox, boxLeft, boxTop, damageText, panelLayout, percentText, plateLeft,
  shakeStrength, shakeX, shakeY, trembleStrength, trembleX, trembleY,
} from "./plateLayout";
import { unitsForPixels } from "./portraitFrames";
import { createBackdrop, createText, gameUi, placeTopLeft } from "./frames";
import { MENU_FONT } from "./hudLayout";


export function plateManaSlot(position: number, count: number): { readonly left: number; readonly centerY: number; readonly width: number } {
  const { mana } = panelLayout(position, count);
  return { left: boxLeft(plateLeft(position, count), mana), centerY: boxTop(mana) - unitsForPixels(mana.height) / 2, width: unitsForPixels(mana.width) };
}

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



export class FighterHud {
  private readonly plate: framehandle;
  private readonly portrait: framehandle;
  private readonly damage: framehandle;
  private readonly percent: framehandle;
  private readonly name: framehandle;
  private readonly slotLabel: framehandle;
  private readonly stocks: readonly framehandle[];

  private readonly stockCount: framehandle;

  private readonly body: readonly framehandle[];
  private shownCharacter: number | undefined;
  private shownColor: number | undefined;
  private shownMirrored: boolean | undefined;

  private shownVisible: boolean | undefined;
  private shownDamage: string | undefined;
  private shownPercent: string | undefined;
  private shownDamageValue: number | undefined;
  private shownStocks: number | undefined;

  private left = 0.0;
  private panel: PanelLayout = panelLayout(0, 1);
  private damageValue = 0.0;

  private shakeFrame = SHAKE_FRAMES;
  private shakeStrength = 0.0;
  private trembleFrame = 0;


  constructor(private readonly slot: number, count: number) {
    const suffix = I2S(slot);
    const context = 800 + slot * 20;
    const parent = gameUi();
    this.plate = createBackdrop(`FighterHUDPlate${suffix}`, parent, context);
    BlzFrameSetSize(this.plate, unitsForPixels(PLATE_WIDTH_PX), unitsForPixels(PLATE_HEIGHT_PX));
    BlzFrameSetEnable(this.plate, false);
    this.portrait = createBackdrop(`FighterHUDPortrait${suffix}`, parent, context + 1);
    BlzFrameSetEnable(this.portrait, false);
    this.damage = BlzCreateFrame("SmashcraftDamage", parent, 0, context + 2);
    BlzFrameSetEnable(this.damage, false);
    this.percent = createText(`FighterHUDPercent${suffix}`, parent, context + 7 + STOCK_ICONS_SHOWN);
    BlzFrameSetFont(this.percent, MENU_FONT, f32(0.016), 1);
    BlzFrameSetTextAlignment(this.percent, TEXT_JUSTIFY_BOTTOM, TEXT_JUSTIFY_LEFT);
    BlzFrameSetEnable(this.percent, false);
    this.name = createText(`FighterHUDName${suffix}`, parent, context + 3);
    BlzFrameSetFont(this.name, MENU_FONT, f32(0.0072), 1);
    BlzFrameSetEnable(this.name, false);
    this.slotLabel = createText(`FighterHUDSlot${suffix}`, parent, context + 4);
    BlzFrameSetFont(this.slotLabel, MENU_FONT, f32(0.0085), 1);
    BlzFrameSetText(this.slotLabel, `P${I2S(slot + 1)}`);
    BlzFrameSetEnable(this.slotLabel, false);
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
    this.body = [this.plate, this.portrait, this.damage, this.percent, this.name, this.slotLabel];
    for (const frame of [...this.body, ...this.stocks, this.stockCount]) BlzFrameSetLevel(frame, 21);
    this.layout(slot, count);
    this.update(false, Character.rifleman, slot, 0.0, 0);
  }

  destroy(): void {
    for (const frame of this.body) BlzDestroyFrame(frame);
    for (const icon of this.stocks) BlzDestroyFrame(icon);
    BlzDestroyFrame(this.stockCount);
  }


  layout(position: number, count: number): void {
    const left = plateLeft(position, count);
    const panel = panelLayout(position, count);
    this.left = left;
    this.panel = panel;
    const inner = panel.mirrored ? TEXT_JUSTIFY_RIGHT : TEXT_JUSTIFY_LEFT;
    const outer = panel.mirrored ? TEXT_JUSTIFY_LEFT : TEXT_JUSTIFY_RIGHT;
    placeTopLeft(this.plate, left, PLATE_TOP);
    placeBox(this.portrait, left, panel.bust);
    placeBox(this.damage, left, panel.damage);
    BlzFrameSetTextAlignment(this.damage, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_RIGHT);
    placeBox(this.percent, left, panel.percent);
    placeBox(this.name, left, panel.name);
    BlzFrameSetTextAlignment(this.name, TEXT_JUSTIFY_MIDDLE, inner);
    placeBox(this.slotLabel, left, panel.slot);
    BlzFrameSetTextAlignment(this.slotLabel, TEXT_JUSTIFY_MIDDLE, outer);
    this.stocks.forEach((icon, index) => {
      const box = panel.stocks[index];
      if (box !== undefined) placeBox(icon, left, box);
    });
    placeBox(this.stockCount, left, panel.stockCount);
    BlzFrameSetTextAlignment(this.stockCount, TEXT_JUSTIFY_MIDDLE, inner);
    this.placeNumber(0.0, 0.0);
  }


  update(visible: boolean, character: Character, color: number, damage: number, stocks: number): void {
    if (this.shownVisible !== visible) {
      this.shownVisible = visible;
      for (const frame of this.body) BlzFrameSetVisible(frame, visible);
    }
    if (this.shownCharacter !== character || this.shownColor !== color || this.shownMirrored !== this.panel.mirrored) {
      this.shownCharacter = character;
      this.shownColor = color;
      this.shownMirrored = this.panel.mirrored;
      BlzFrameSetTexture(this.plate, `war3mapImported\\HudPlate${this.panel.mirrored ? "Mirror" : ""}${I2S(color)}.tga`, 0, true);
      BlzFrameSetTexture(this.portrait, fighterPortrait(character, "Bust", color), 0, true);
      BlzFrameSetText(this.name, fighterName(character).toUpperCase());
      for (const icon of this.stocks) BlzFrameSetTexture(icon, fighterPortrait(character, "Stock", color), 0, true);
    }
    this.shake(visible, damage);
    if (this.shownDamageValue !== damage) {
      this.shownDamageValue = damage;
      const shownDamage = damageText(damage);
      if (this.shownDamage !== shownDamage) {
        this.shownDamage = shownDamage;
        BlzFrameSetText(this.damage, shownDamage);
      }
      const shownPercent = percentText(damage);
      if (this.shownPercent !== shownPercent) {
        this.shownPercent = shownPercent;
        BlzFrameSetText(this.percent, shownPercent);
      }
    }
    const shownStocks = visible ? stocks : 0;
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


  private shake(visible: boolean, damage: number): void {
    const added = damage - this.damageValue;
    this.damageValue = damage;
    const trembling = visible ? trembleStrength(damage) : 0.0;
    if (visible && added > 0.0) {
      this.shakeFrame = 0;
      this.shakeStrength = shakeStrength(added);
    } else if (this.shakeFrame >= SHAKE_FRAMES && trembling === 0.0) return;
    else if (this.shakeFrame < SHAKE_FRAMES) this.shakeFrame++;
    this.trembleFrame = trembling === 0.0 ? 0 : this.trembleFrame + 1;
    const dx = shakeX(this.shakeStrength, this.shakeFrame) + trembleX(trembling, this.trembleFrame);
    const dy = shakeY(this.shakeStrength, this.shakeFrame) + trembleY(trembling, this.trembleFrame);
    this.placeNumber(unitsForPixels(dx), unitsForPixels(dy));
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

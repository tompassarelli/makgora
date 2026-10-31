import { f32 } from "wisp/src/sim/f32";
import { type NumberJolt, colourCode, damageOutlineText, damageText, numberJolt, percentOutlineText, percentText, stepJolt } from "./plateLayout";
import { unitsForPixels } from "./portraitFrames";
import { slotColor } from "./slotColors";
import { createBackdrop, createText, consoleUi } from "./frames";
import { MENU_FONT, markerArrowTexture } from "./hudLayout";
import { attachOutline, createOutline, createTemplateOutline, setOutlineText } from "./textOutline";
import { createFrame, createFrameByType, destroyFrame, setFrameAbsPoint, setFrameEnabled, setFrameFont, setFrameLevel, setFramePoint, setFrameScale, setFrameSize, setFrameText, setFrameTextAlignment, setFrameTexture, setFrameVisible } from "wisp/game/frames";
import { player, playerName as playerNameOf } from "wisp/game/players";

export const MARKER_WIDTH = unitsForPixels(220);
export const MARKER_HEIGHT = unitsForPixels(170);
export const MARKER_CLEARANCE = unitsForPixels(16);
export const MARKER_NAME_LENGTH = 12;

const ARROW_WIDTH_PX = 40;
const ARROW_HEIGHT_PX = 40;
const NAME_HEIGHT_PX = 40;
const NUMBER_WIDTH_PX = 170;
const NUMBER_HEIGHT_PX = 80;
const PERCENT_WIDTH_PX = 40;
const PERCENT_HEIGHT_PX = 44;
const NUMBER_RIGHT_PX = 14;
const NUMBER_SCALE = f32(0.6);
const PERCENT_FONT = f32(0.012);
const NAME_FONT = f32(0.009);
const OUTLINE_PX = 2;
const LEVEL = 9;


const markerContext = (slot: number): number => 1200 + slot * 20;

export const markerNumberContext = (slot: number): number => markerContext(slot) + 3;

export const markerName = (human: boolean, playerName: string): string => human ? (playerName.split("#")[0] ?? "").substring(0, MARKER_NAME_LENGTH) : "CPU";

export const markerNumberRisePx = (partner: boolean): number => ARROW_HEIGHT_PX + (partner ? 0 : NAME_HEIGHT_PX);

export const markerNameText = (partner: boolean, human: boolean, playerName: string, rgb: number): string => partner ? "" : `${colourCode(rgb)}${markerName(human, playerName)}|r`;


export function spreadMarkers(x: number[], y: readonly number[], shown: readonly boolean[]): void {
  for (let pass = 0; pass < x.length; pass++) {
    for (let left = 0; left < x.length; left++) {
      for (let right = left + 1; right < x.length; right++) {
        if (shown[left] !== true || shown[right] !== true) continue;
        const a = x[left] ?? 0.0, b = x[right] ?? 0.0;
        const gap = Math.abs(b - a);
        if (gap >= MARKER_WIDTH || Math.abs((y[right] ?? 0.0) - (y[left] ?? 0.0)) >= MARKER_HEIGHT) continue;
        const push = (MARKER_WIDTH - gap) / 2.0;
        const sign = b >= a ? 1.0 : -1.0;
        x[left] = a - push * sign;
        x[right] = b + push * sign;
      }
    }
  }
}


export class FighterMarker {
  private readonly root: framehandle;
  private readonly damageOutline: readonly framehandle[];
  private readonly percentOutline: readonly framehandle[];
  private readonly damage: framehandle;
  private readonly percent: framehandle;
  private readonly name: framehandle;
  private readonly arrow: framehandle;
  private readonly jolt: NumberJolt = numberJolt();
  private shown = false;
  private shownColor: number | undefined;
  private shownHuman: boolean | undefined;
  private shownPartner: boolean | undefined;
  private playerName = "";
  private shownDamage: string | undefined;
  private shownPercent: string | undefined;
  private shownDamageValue: number | undefined;
  private shownX = -1.0;
  private shownY = -1.0;

  constructor(private readonly slot: number) {
    const suffix = I2S(slot);
    const context = markerContext(slot);
    this.root = createFrameByType("FRAME", `FighterMarker${suffix}`, consoleUi(), "", context);
    setFrameSize(this.root, MARKER_WIDTH, MARKER_HEIGHT);
    setFrameLevel(this.root, LEVEL);
    this.damageOutline = createTemplateOutline("SmashcraftDamageOutline", this.root, context + 1, LEVEL, NUMBER_SCALE);
    this.percentOutline = createOutline(`FighterMarkerPercent${suffix}`, this.root, context + 2, MENU_FONT, PERCENT_FONT, LEVEL);
    this.damage = this.number(markerNumberContext(slot));
    this.percent = this.text(`FighterMarkerPercent${suffix}`, context + 4, PERCENT_FONT, PERCENT_WIDTH_PX, PERCENT_HEIGHT_PX);
    this.name = this.text(`FighterMarkerName${suffix}`, context + 5, NAME_FONT, 220, NAME_HEIGHT_PX);
    this.arrow = createBackdrop(`FighterMarkerArrow${suffix}`, this.root, context + 6);
    setFrameSize(this.arrow, unitsForPixels(ARROW_WIDTH_PX), unitsForPixels(ARROW_HEIGHT_PX));
    setFrameEnabled(this.arrow, false);
    setFrameLevel(this.arrow, LEVEL);
    setFramePoint(this.arrow, FRAMEPOINT_BOTTOM, this.root, FRAMEPOINT_BOTTOM, 0.0, 0.0);
    setFramePoint(this.name, FRAMEPOINT_BOTTOM, this.root, FRAMEPOINT_BOTTOM, 0.0, unitsForPixels(ARROW_HEIGHT_PX));
    setFrameTextAlignment(this.name, TEXT_JUSTIFY_BOTTOM, TEXT_JUSTIFY_CENTER);
    setFrameTextAlignment(this.damage, TEXT_JUSTIFY_BOTTOM, TEXT_JUSTIFY_RIGHT);
    setFrameTextAlignment(this.percent, TEXT_JUSTIFY_BOTTOM, TEXT_JUSTIFY_LEFT);
    setFramePoint(this.percent, FRAMEPOINT_BOTTOMLEFT, this.damage, FRAMEPOINT_BOTTOMRIGHT, 0.0, unitsForPixels(10));
    this.placeNumber();
    attachOutline(this.damageOutline, this.damage, OUTLINE_PX / NUMBER_SCALE, TEXT_JUSTIFY_BOTTOM, TEXT_JUSTIFY_RIGHT);
    attachOutline(this.percentOutline, this.percent, OUTLINE_PX, TEXT_JUSTIFY_BOTTOM, TEXT_JUSTIFY_LEFT);
    setFrameVisible(this.root, false);
  }

  destroy(): void {
    destroyFrame(this.root);
  }


  update(shown: boolean, color: number, human: boolean, partner: boolean, damage: number, x: number, y: number): void {
    if (this.shownHuman !== human || this.shownPartner !== partner) {
      this.shownHuman = human;
      this.shownPartner = partner;
      this.placeNumber();
      this.playerName = playerNameOf(player(this.slot));
      this.shownColor = undefined;
    }
    if (shown !== this.shown) {
      this.shown = shown;
      setFrameVisible(this.root, shown);
    }
    const jolted = stepJolt(this.jolt, shown, damage);
    if (!shown) return;
    if (this.shownColor !== color) {
      this.shownColor = color;
      setFrameTexture(this.arrow, markerArrowTexture(color), 0, true);
      setFrameText(this.name, markerNameText(partner, human, this.playerName, slotColor(color).rgb));
    }
    this.showDamage(damage);
    const moved = x !== this.shownX || y !== this.shownY;
    if (moved) {
      this.shownX = x;
      this.shownY = y;
      setFrameAbsPoint(this.root, FRAMEPOINT_BOTTOM, x, y);
    }
    if (moved || jolted) this.placeNumber();
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

  private placeNumber(): void {
    const right = this.shownX + unitsForPixels(NUMBER_RIGHT_PX + this.jolt.dx);
    const bottom = this.shownY + unitsForPixels(markerNumberRisePx(this.shownPartner === true) - this.jolt.dy);
    setFrameAbsPoint(this.damage, FRAMEPOINT_BOTTOMRIGHT, right, bottom);
  }

  private text(name: string, context: number, size: number, width: number, height: number): framehandle {
    const frame = createText(name, this.root, context);
    setFrameFont(frame, MENU_FONT, size, 1);
    setFrameSize(frame, unitsForPixels(width), unitsForPixels(height));
    setFrameEnabled(frame, false);
    setFrameLevel(frame, LEVEL);
    return frame;
  }

  private number(context: number): framehandle {
    const frame = createFrame("SmashcraftDamage", this.root, 0, context);
    setFrameScale(frame, NUMBER_SCALE);
    setFrameSize(frame, unitsForPixels(NUMBER_WIDTH_PX) / NUMBER_SCALE, unitsForPixels(NUMBER_HEIGHT_PX) / NUMBER_SCALE);
    setFrameEnabled(frame, false);
    setFrameLevel(frame, LEVEL);
    return frame;
  }
}

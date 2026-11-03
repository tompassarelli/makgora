import { f32 } from "wisp/src/sim/f32";
import { formatInt } from "wisp/game/text";
import { createBackdrop, createText, gameUi, placeTopLeft } from "./frames";
import { MENU_FONT, MENU_STYLE, PANEL_TEXTURE } from "./hudLayout";
import { createOutline, attachOutline, destroyOutline, setOutlineText, showOutline } from "./textOutline";
import { unitsForPixels } from "./portraitFrames";
import { SHAKE_FRAMES, shakeX, shakeY } from "./plateLayout";
import { destroyFrame, Frame, setFrameAlpha, setFrameEnabled, setFrameFont, setFrameLevel, setFrameSize, setFrameText, setFrameTextAlignment, setFrameTexture, setFrameVisible, TextAlignment } from "wisp/game/frames";

export interface PlateRectangle { readonly left: number; readonly top: number; readonly width: number; readonly height: number }

export const BOSS_PLATE: PlateRectangle = { left: f32(0.012), top: f32(0.588), width: f32(0.3), height: f32(0.068) };
const INSET = f32(0.006);
const PORTRAIT = f32(BOSS_PLATE.height - 2 * INSET);
const TEXT_LEFT = f32(BOSS_PLATE.left + INSET + PORTRAIT + INSET);
const TEXT_WIDTH = f32(BOSS_PLATE.left + BOSS_PLATE.width - INSET - TEXT_LEFT);
const NAME_SIZE = f32(0.014);
const HEALTH_SIZE = f32(0.024);
const ROW_HEIGHT = f32(0.03);
const BAR_HEIGHT = f32(0.016);
export const BOSS_BAR: PlateRectangle = { left: TEXT_LEFT, top: f32(BOSS_PLATE.top - BOSS_PLATE.height + INSET + BAR_HEIGHT), width: TEXT_WIDTH, height: BAR_HEIGHT };
const BAR_FILL = "ReplaceableTextures\\TeamColor\\TeamColor00.blp";
const BAR_TRAIL = "ReplaceableTextures\\TeamColor\\TeamColor04.blp";
const PANEL_ALPHA = 230;
const SHAKE_PX = 10;
const TRAIL_HOLD_FRAMES = 24;
const TRAIL_STEP = f32(0.02);
const LEVEL = 21;
const BAR_LEAST = f32(0.0005);
const OUTLINE_PX = 2;
const HIT_COLOUR = "|cffff5030";
const HEALTH_COLOUR = "|cffffffff";

export interface BossPlateReadout { readonly health: string; readonly fill: number }

export function bossPlateReadout(health: number, maxHealth: number): BossPlateReadout {
  const left = Math.max(0, Math.floor(health));
  return { health: formatInt(left), fill: maxHealth > 0 ? Math.min(1.0, f32(left / maxHealth)) : 0.0 };
}

export class BossPlate {
  private readonly panel: Frame;
  private readonly portrait: Frame;
  private readonly name: Frame;
  private readonly health: Frame;
  private readonly healthOutline: readonly Frame[];
  private readonly barBack: Frame;
  private readonly trail: Frame;
  private readonly fill: Frame;
  private shown = false;
  private shownName = "";
  private shownHealth = -1;
  private trailFill = 1.0;
  private trailHold = 0;
  private shakeFrame = SHAKE_FRAMES;

  constructor() {
    const parent = gameUi();
    this.panel = this.backdrop("BossPlatePanel", parent, 0, PANEL_TEXTURE);
    setFrameAlpha(this.panel, PANEL_ALPHA);
    this.portrait = this.backdrop("BossPlatePortrait", parent, 1, PANEL_TEXTURE);
    this.barBack = this.backdrop("BossPlateBarBack", parent, 1, PANEL_TEXTURE);
    this.trail = this.backdrop("BossPlateBarTrail", parent, 2, BAR_TRAIL);
    this.fill = this.backdrop("BossPlateBarFill", parent, 3, BAR_FILL);
    this.name = this.text("BossPlateName", parent, NAME_SIZE, TextAlignment.left);
    this.healthOutline = createOutline("BossPlateHealth", parent, 0, MENU_FONT, HEALTH_SIZE, LEVEL + 3);
    this.health = this.text("BossPlateHealth", parent, HEALTH_SIZE, TextAlignment.right);
    placeTopLeft(this.panel, BOSS_PLATE.left, BOSS_PLATE.top);
    setFrameSize(this.panel, BOSS_PLATE.width, BOSS_PLATE.height);
    placeTopLeft(this.portrait, BOSS_PLATE.left + INSET, BOSS_PLATE.top - INSET);
    setFrameSize(this.portrait, PORTRAIT, PORTRAIT);
    placeTopLeft(this.name, TEXT_LEFT, BOSS_PLATE.top - INSET);
    setFrameSize(this.name, TEXT_WIDTH, ROW_HEIGHT);
    this.placeHealth(0.0, 0.0);
    attachOutline(this.healthOutline, this.health, OUTLINE_PX, TextAlignment.middle, TextAlignment.right);
    placeTopLeft(this.barBack, BOSS_BAR.left, BOSS_BAR.top);
    setFrameSize(this.barBack, BOSS_BAR.width, BOSS_BAR.height);
    placeTopLeft(this.trail, BOSS_BAR.left, BOSS_BAR.top);
    placeTopLeft(this.fill, BOSS_BAR.left, BOSS_BAR.top);
    this.setShown(false);
  }

  update(visible: boolean, name: string, portrait: string, health: number, maxHealth: number): void {
    this.setShown(visible);
    if (!visible) {
      this.shownHealth = -1;
      return;
    }
    if (name !== this.shownName) {
      this.shownName = name;
      setFrameText(this.name, `${MENU_STYLE.gold}${name}|r`);
      setFrameTexture(this.portrait, portrait, 0, true);
    }
    const readout = bossPlateReadout(health, maxHealth);
    const left = Math.max(0, Math.floor(health));
    if (left !== this.shownHealth) {
      const hit = this.shownHealth >= 0 && left < this.shownHealth;
      if (this.shownHealth < 0 || left > this.shownHealth) this.trailFill = readout.fill;
      if (hit) {
        this.shakeFrame = 0;
        this.trailHold = TRAIL_HOLD_FRAMES;
      }
      this.shownHealth = left;
      setFrameText(this.health, `${HEALTH_COLOUR}${readout.health}|r`);
      setOutlineText(this.healthOutline, `|cff000000${readout.health}|r`);
      this.setBar(this.fill, readout.fill);
    }
    if (this.trailHold > 0) this.trailHold--;
    else if (this.trailFill > readout.fill) this.trailFill = Math.max(readout.fill, f32(this.trailFill - TRAIL_STEP));
    this.setBar(this.trail, this.trailFill);
    if (this.shakeFrame < SHAKE_FRAMES) {
      this.placeHealth(shakeX(SHAKE_PX, this.shakeFrame), shakeY(SHAKE_PX, this.shakeFrame));
      setFrameText(this.health, `${this.shakeFrame < SHAKE_FRAMES / 2 ? HIT_COLOUR : HEALTH_COLOUR}${readout.health}|r`);
      this.shakeFrame++;
      if (this.shakeFrame >= SHAKE_FRAMES) this.placeHealth(0.0, 0.0);
    }
  }

  destroy(): void {
    for (const frame of [this.panel, this.portrait, this.name, this.health, this.barBack, this.trail, this.fill]) destroyFrame(frame);
    destroyOutline(this.healthOutline);
  }

  private setBar(frame: Frame, fill: number): void {
    const width = f32(BOSS_BAR.width * fill);
    setFrameVisible(frame, this.shown && width > BAR_LEAST);
    setFrameSize(frame, Math.max(BAR_LEAST, width), BOSS_BAR.height);
  }

  private placeHealth(dxPx: number, dyPx: number): void {
    placeTopLeft(this.health, f32(TEXT_LEFT + unitsForPixels(dxPx)), f32(BOSS_PLATE.top - INSET + f32(0.002) - unitsForPixels(dyPx)));
    setFrameSize(this.health, TEXT_WIDTH, ROW_HEIGHT);
  }

  private setShown(visible: boolean): void {
    if (visible === this.shown) return;
    this.shown = visible;
    for (const frame of [this.panel, this.portrait, this.name, this.health, this.barBack, this.trail, this.fill]) setFrameVisible(frame, visible);
    showOutline(this.healthOutline, visible);
  }

  private backdrop(name: string, parent: Frame, level: number, texture: string): Frame {
    const frame = createBackdrop(name, parent, 0);
    setFrameTexture(frame, texture, 0, true);
    setFrameEnabled(frame, false);
    setFrameLevel(frame, LEVEL + level);
    return frame;
  }

  private text(name: string, parent: Frame, size: number, horizontal: TextAlignment): Frame {
    const frame = createText(name, parent, 0);
    setFrameFont(frame, MENU_FONT, size, 0);
    setFrameTextAlignment(frame, TextAlignment.middle, horizontal);
    setFrameEnabled(frame, false);
    setFrameLevel(frame, LEVEL + 4);
    return frame;
  }
}


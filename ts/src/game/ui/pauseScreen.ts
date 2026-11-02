import { f32 } from "wisp/src/sim/f32";
import { imod } from "wisp/src/sim/intMath";
import { ButtonClicks, consoleUi, createBackdrop, createText, placeTopLeft, sizeText } from "./frames";
import { MENU_STYLE } from "./hudLayout";
import type { ChordLabels } from "../input/pauseChord";
import { createFrameByType, Frame, screenHeight, screenWidth, setFrameAlpha, setFrameEnabled, setFrameLevel, setFrameSize, setFrameText, setFrameTextAlignment, setFrameTexture, setFrameVisible, TextAlignment } from "wisp/game/frames";
import { formatInt } from "wisp/game/text";
import type { Player } from "wisp/game/players";

const PLATE = "war3mapImported\\SelectionAction.tga";
const FRAME = "war3mapImported\\SelectionTileFrame.tga";
const RING = "war3mapImported\\SelectionBullseye.tga";
const solid = (index: string): string => `ReplaceableTextures\\TeamColor\\TeamColor${index}.blp`;
const STEEL = solid("08");
const GOLD = solid("05");
const TEAL = solid("14");
const MARGIN = f32(0.024);
const CORNER_REACH = f32(0.07);
const ETCH = f32(0.0022);
const GOLD_THICK = f32(0.0036);
const CAP_HEIGHT = f32(0.03);
const GLYPH_WIDTH = f32(0.0105);

export interface Edges {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface PauseView {
  readonly player: number | undefined;
  readonly clock: string | undefined;
  readonly pad: boolean;
  readonly chord: ChordLabels;
  readonly camera: string;
  readonly pauseKey: string;
  readonly keyboard?: boolean | undefined;
}

type Place = (edges: Edges) => readonly [number, number, number, number];

interface Part {
  readonly frame: Frame;
  readonly place: Place;
}

const NAME = "SmashcraftPauseScreen";
const RESET_WIDTH = f32(0.33);
const RESET_HEIGHT = f32(0.092);
const NAME_WIDTH = f32(0.27);
const NAME_HEIGHT = f32(0.044);

export function windowEdges(pixelWidth: number, pixelHeight: number): Edges {
  const aspect = pixelHeight <= 0 ? f32(4.0 / 3.0) : f32(pixelWidth / pixelHeight);
  const halfWidth = Math.max(f32(0.4), f32(aspect * f32(0.3)));
  const halfHeight = Math.max(f32(0.3), f32(f32(0.4) / aspect));
  return { left: f32(f32(0.4) - halfWidth), right: f32(f32(0.4) + halfWidth), top: f32(f32(0.3) + halfHeight), bottom: f32(f32(0.3) - halfHeight) };
}

export const resetPlateBox = (edges: Edges): readonly [number, number, number, number] =>
  [f32(edges.right - MARGIN - RESET_WIDTH), f32(edges.bottom + MARGIN + RESET_HEIGHT), RESET_WIDTH, RESET_HEIGHT];

export class PauseScreen {
  private readonly root: Frame;
  private readonly parts: Part[] = [];
  private readonly nameText: Frame;
  private readonly clockText: Frame;
  private readonly menuText: Frame;
  private readonly cameraText: Frame;
  private readonly resetText: Frame;
  private readonly scales = new Map<Frame, number>();
  private readonly caps: Frame[] = [];
  private readonly capText: Frame[] = [];
  private readonly joins: Frame[] = [];
  private readonly button: Frame;
  private readonly clicks: ButtonClicks<number>;
  private edges: Edges = windowEdges(0, 0);
  private size = -1;
  private shown = false;
  private labels = "";
  private context = 1820;

  constructor(select: (choice: number, clicker: Player) => void) {
    this.clicks = new ButtonClicks("ui.pauseScreen.click", select);
    this.root = createBackdrop(NAME, consoleUi(), 1810);
    setFrameLevel(this.root, 20);
    setFrameSize(this.root, f32(0.001), f32(0.001));
    placeTopLeft(this.root, f32(0.0), f32(0.6));
    for (const corner of [0, 1, 2, 3]) this.bracket(corner);
    this.ornament(0);
    this.ornament(3);
    this.plate("Name", PLATE, edges => [f32(edges.right - MARGIN - NAME_WIDTH), f32(edges.top - f32(MARGIN + f32(0.05))), NAME_WIDTH, NAME_HEIGHT]);
    for (const side of [0, 1]) {
      this.fixed(`Pip${formatInt(side)}`, GOLD, edges => {
        const left = f32(edges.right - MARGIN - NAME_WIDTH);
        return [side === 0 ? f32(left + f32(0.018)) : f32(left + NAME_WIDTH - f32(0.026)), f32(edges.top - f32(MARGIN + f32(0.05)) - f32(0.0165)), f32(0.008), f32(0.008)];
      });
    }
    this.nameText = this.label("NameText", f32(MENU_STYLE.headerSize * 1.5), edges => [f32(edges.right - MARGIN - NAME_WIDTH), f32(edges.top - f32(MARGIN + f32(0.05)) - f32(0.008)), NAME_WIDTH, f32(0.03)], TextAlignment.center);
    this.clockText = this.label("Clock", MENU_STYLE.bodySize, edges => [f32(edges.right - MARGIN - NAME_WIDTH), f32(edges.top - f32(MARGIN + f32(0.022))), NAME_WIDTH, f32(0.02)], TextAlignment.right);
    this.menuText = this.label("Menu", MENU_STYLE.bodySize, edges => [f32(edges.right - MARGIN - NAME_WIDTH), f32(edges.top - f32(MARGIN + f32(0.1))), NAME_WIDTH, f32(0.034)], TextAlignment.right);
    this.emblem();
    this.cameraText = this.label("Camera", MENU_STYLE.bodySize, edges => [f32(edges.left + MARGIN + f32(0.1)), f32(edges.bottom + MARGIN + f32(0.062)), f32(0.3), f32(0.04)], TextAlignment.left);
    this.plate("Reset", PLATE, edges => resetPlateBox(edges));
    this.fixed("ResetBar", PLATE, edges => resetBarBox(edges));
    this.resetText = this.label("ResetText", f32(MENU_STYLE.headerSize * 1.25), edges => resetBarBox(edges), TextAlignment.center);
    for (let index = 0; index < 4; index++) {
      this.caps.push(this.cap(index));
      this.capText.push(this.label(`Cap${formatInt(index)}`, MENU_STYLE.headerSize, () => [0, 0, 0, 0], TextAlignment.center));
      if (index < 3) this.joins.push(this.label(`Join${formatInt(index)}`, MENU_STYLE.headerSize, () => [0, 0, 0, 0], TextAlignment.center));
    }
    this.button = createFrameByType("BUTTON", `${NAME}Button`, this.root, "", 1811);
    this.parts.push({ frame: this.button, place: edges => resetPlateBox(edges) });
    this.clicks.add(this.button, 0);
    setFrameVisible(this.root, false);
  }

  bindActions(select: (choice: number, clicker: Player) => void): void {
    this.clicks.bindHandler(select);
  }

  over(x: number, y: number): boolean {
    if (!this.shown) return false;
    const [left, top, width, height] = resetPlateBox(this.edges);
    return x >= left && x <= f32(left + width) && y <= top && y >= f32(top - height);
  }

  update(paused: boolean, view: PauseView): void {
    if (paused !== this.shown) setFrameVisible(this.root, paused);
    this.shown = paused;
    if (!paused) return;
    const key = screenWidth() * 65536 + screenHeight();
    const chord = view.chord;
    const caps = view.pad ? ["L", "R", "A", "START/BACK"] : [chord.left, chord.right, chord.attack, view.pauseKey];
    const signature = `${caps.join("|")}`;
    if (key !== this.size || signature !== this.labels) {
      this.size = key;
      this.labels = signature;
      this.edges = windowEdges(screenWidth(), screenHeight());
      for (const part of this.parts) this.set(part.frame, part.place(this.edges));
      this.layoutCaps(caps, view.pad);
    }
    setFrameText(this.nameText, `${MENU_STYLE.gold}${view.player === undefined ? "PAUSE" : `PLAYER ${formatInt(view.player)} PAUSE`}|r`);
    setFrameText(this.clockText, view.clock === undefined ? "" : `${MENU_STYLE.text}${view.clock}|r`);
    const keyboard = view.keyboard === undefined ? "" : `\nShow keyboard in game: ${view.keyboard ? "on" : "off"} (F2)`;
    setFrameText(this.menuText, `${MENU_STYLE.text}F10: leave the game  ·  G: hide HUD${keyboard}|r`);
    setFrameText(this.cameraText, `${MENU_STYLE.text}${view.camera}|r`);
    setFrameText(this.resetText, `${MENU_STYLE.gold}RESET MATCH|r`);
  }

  private layoutCaps(labels: readonly string[], pad: boolean): void {
    const [plateLeft, plateTop, plateWidth] = resetPlateBox(this.edges);
    const widths = labels.map((text, index) => pad && index < 3 ? CAP_HEIGHT : f32(Math.max(CAP_HEIGHT, f32(text.length * GLYPH_WIDTH + f32(0.014)))));
    const join = f32(0.016);
    const total = widths.reduce((sum, width) => sum + width, 0) + join * (labels.length - 1);
    let x = f32(plateLeft + (plateWidth - total) / 2);
    const top = f32(plateTop - f32(0.01));
    for (let index = 0; index < labels.length; index++) {
      const width = widths[index] ?? CAP_HEIGHT;
      const cap = this.caps[index];
      const text = this.capText[index];
      if (cap !== undefined) this.set(cap, [x, top, width, CAP_HEIGHT]);
      if (text !== undefined) {
        this.set(text, [x, f32(top - f32(0.0075)), width, f32(0.02)]);
        setFrameText(text, `${MENU_STYLE.gold}${labels[index] ?? ""}|r`);
      }
      x = f32(x + width);
      const plus = this.joins[index];
      if (plus !== undefined) {
        this.set(plus, [x, f32(top - f32(0.0075)), join, f32(0.02)]);
        setFrameText(plus, `${MENU_STYLE.text}+|r`);
        x = f32(x + join);
      }
    }
  }

  private set(frame: Frame, [left, top, width, height]: readonly [number, number, number, number]): void {
    const scale = this.scales.get(frame) ?? 1.0;
    placeTopLeft(frame, left, top);
    setFrameSize(frame, f32(width / scale), f32(height / scale));
  }

  private next(name: string): { name: string; context: number } {
    return { name: `${NAME}${name}`, context: this.context++ };
  }

  private fixed(name: string, texture: string, place: Place, alpha = 255): Frame {
    const { name: full, context } = this.next(name);
    const frame = createBackdrop(full, this.root, context);
    setFrameTexture(frame, texture, 0, true);
    setFrameAlpha(frame, alpha);
    setFrameEnabled(frame, false);
    this.parts.push({ frame, place });
    return frame;
  }

  private plate(name: string, texture: string, place: Place): void {
    this.fixed(name, texture, place);
  }

  private cap(index: number): Frame {
    return this.fixed(`CapFace${formatInt(index)}`, FRAME, () => [0, 0, 0, 0]);
  }

  private label(name: string, size: number, place: Place, justify: TextAlignment, parent = this.root): Frame {
    const { name: full, context } = this.next(name);
    const frame = createText(full, parent, context);
    this.scales.set(frame, sizeText(frame, size, f32(0.2), f32(0.02)));
    setFrameTextAlignment(frame, TextAlignment.middle, justify);
    setFrameEnabled(frame, false);
    this.parts.push({ frame, place });
    return frame;
  }

  private bracket(corner: number): void {
    const right = imod(corner, 2) === 1;
    const low = corner >= 2;
    const originX = (e: Edges): number => right ? f32(e.right - MARGIN) : f32(e.left + MARGIN);
    const originY = (e: Edges): number => low ? f32(e.bottom + MARGIN) : f32(e.top - MARGIN);
    this.fixed(`EtchAcross${formatInt(corner)}`, STEEL, e => [right ? f32(originX(e) - CORNER_REACH) : originX(e), low ? f32(originY(e) + ETCH) : originY(e), CORNER_REACH, ETCH], 210);
    this.fixed(`EtchDown${formatInt(corner)}`, STEEL, e => [right ? f32(originX(e) - ETCH) : originX(e), low ? f32(originY(e) + CORNER_REACH) : originY(e), ETCH, CORNER_REACH], 210);
  }

  private ornament(corner: number): void {
    const right = imod(corner, 2) === 1;
    const low = corner >= 2;
    const inset = f32(MARGIN + f32(0.014));
    const reach = f32(0.062);
    const originX = (e: Edges): number => right ? f32(e.right - inset) : f32(e.left + inset);
    const originY = (e: Edges): number => low ? f32(e.bottom + inset) : f32(e.top - inset);
    this.fixed(`GoldAcross${formatInt(corner)}`, GOLD, e => [right ? f32(originX(e) - reach) : originX(e), low ? f32(originY(e) + GOLD_THICK) : originY(e), reach, GOLD_THICK]);
    this.fixed(`GoldDown${formatInt(corner)}`, GOLD, e => [right ? f32(originX(e) - GOLD_THICK) : originX(e), low ? f32(originY(e) + reach) : originY(e), GOLD_THICK, reach]);
    this.fixed(`TealAcross${formatInt(corner)}`, TEAL, e => [right ? f32(originX(e) - reach - f32(0.022)) : f32(originX(e) + reach), low ? f32(originY(e) + GOLD_THICK) : originY(e), f32(0.022), GOLD_THICK]);
    this.fixed(`TealDown${formatInt(corner)}`, TEAL, e => [right ? f32(originX(e) - GOLD_THICK) : originX(e), low ? f32(originY(e) + reach + f32(0.022)) : f32(originY(e) - reach), GOLD_THICK, f32(0.022)]);
  }

  private emblem(): void {
    const size = f32(0.082);
    const anchor = (e: Edges): readonly [number, number] => [f32(e.left + MARGIN + f32(0.012)), f32(e.bottom + MARGIN + f32(0.012) + size)];
    this.fixed("StickBase", FRAME, e => [anchor(e)[0], anchor(e)[1], size, size]);
    this.fixed("StickRing", RING, e => [f32(anchor(e)[0] - f32(0.014)), f32(anchor(e)[1] + f32(0.014)), f32(size + f32(0.028)), f32(size + f32(0.028))]);
    this.fixed("StickKnob", STEEL, e => [f32(anchor(e)[0] + size / 2 - f32(0.011)), f32(anchor(e)[1] - size / 2 + f32(0.011)), f32(0.022), f32(0.022)]);
    const tick = f32(0.007);
    this.fixed("TickUp", GOLD, e => [f32(anchor(e)[0] + size / 2 - tick / 2), f32(anchor(e)[1] + f32(0.004)), tick, f32(0.012)]);
    this.fixed("TickDown", GOLD, e => [f32(anchor(e)[0] + size / 2 - tick / 2), f32(anchor(e)[1] - size + f32(0.016)), tick, f32(0.012)]);
    this.fixed("TickLeft", GOLD, e => [f32(anchor(e)[0] - f32(0.004)), f32(anchor(e)[1] - size / 2 + tick / 2), f32(0.012), tick]);
    this.fixed("TickRight", GOLD, e => [f32(anchor(e)[0] + size - f32(0.008)), f32(anchor(e)[1] - size / 2 + tick / 2), f32(0.012), tick]);
  }
}

const resetBarBox = (edges: Edges): readonly [number, number, number, number] => {
  const [left, top, width, height] = resetPlateBox(edges);
  return [f32(left + f32(0.018)), f32(top - height + f32(0.044)), f32(width - f32(0.036)), f32(0.032)];
};

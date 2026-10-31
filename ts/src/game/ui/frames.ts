



import { on, trampoline } from "wisp/src/platform/dispatch";
import { f32 } from "wisp/src/sim/f32";
import { MENU_STYLE, NATIVE_TEXT_BASE } from "./hudLayout";
import { createEvents, destroyEvents, Events, onEvents } from "wisp/game/events";
import { addFrameEvent, createFrameByType, eventFrame, eventFrameEvent, Frame, frameEnabled, FrameEvent, FramePoint, frameVisible, namedFrame, originFrame, OriginFrame, screenHeight, screenWidth, setFrameAbsPoint, setFrameAlpha, setFrameEnabled, setFrameFocus, setFrameFont, setFramePoint, setFrameScale, setFrameSize, setFrameText, setFrameTexture } from "wisp/game/frames";
import { eventPlayer, localPlayer, Player, player as playerOf, playerSlot } from "wisp/game/players";
import { addSyncEvent, syncData } from "wisp/game/sync";
import { toReal } from "wisp/game/text";

declare global {
  function GetHandleId(handle: Frame): number;
}


export type MenuControls = "journal" | "keyboard";

const plainFrameText = new Map<Frame, string>();

export function gameUi(): Frame {
  return originFrame(OriginFrame.gameUi, 0);
}

export function consoleUi(): Frame {
  return namedFrame("ConsoleUIBackdrop", 0);
}

export function createBackdrop(name: string, owner: Frame, context: number): Frame {
  return createFrameByType("BACKDROP", name, owner, "", context);
}

export function createText(name: string, owner: Frame, context: number): Frame {
  return createFrameByType("TEXT", name, owner, "", context);
}

// Warcraft scales relative point offsets too; divide them by the returned scale.
export function sizeText(frame: Frame, size: number, width: number, height: number): number {
  const scale = f32(size / NATIVE_TEXT_BASE);
  setFrameScale(frame, scale);
  setFrameSize(frame, f32(width / scale), f32(height / scale));
  setFrameFont(frame, MENU_STYLE.font, size, 0);
  return scale;
}

export function styleMenuPanel(frame: Frame, name: string): Frame {
  setFrameTexture(frame, MENU_STYLE.borderTexture, 0, true);
  setFrameAlpha(frame, 255);
  const backing = createBackdrop(`${name}Backing`, frame, 0);
  setFrameTexture(backing, MENU_STYLE.panelTexture, 0, true);
  setFrameAlpha(backing, 255);
  setFramePoint(backing, FramePoint.topLeft, frame, FramePoint.topLeft, f32(0.012), f32(-0.012));
  setFramePoint(backing, FramePoint.bottomRight, frame, FramePoint.bottomRight, f32(-0.012), f32(0.012));
  setFrameEnabled(backing, false);
  return backing;
}

export function placeTopLeft(frame: Frame, x: number, y: number): void {
  setFrameAbsPoint(frame, FramePoint.topLeft, x, y);
}


const fittedSize = new Map<Frame, number>();

// Engine: Warcraft draws no child of the game UI outside the centred 4:3 area, so a full-window backdrop hangs off ConsoleUIBackdrop.
export function createWindowBackdrop(name: string, texture: string, context: number): Frame {
  const frame = createBackdrop(name, consoleUi(), context);
  setFrameTexture(frame, texture, 0, false);
  fitToWindow(frame);
  return frame;
}

export function fitToWindow(frame: Frame): void {
  const pixelWidth = screenWidth();
  const pixelHeight = screenHeight();
  const key = pixelWidth * 65536 + pixelHeight;
  if (fittedSize.get(frame) === key) return;
  fittedSize.set(frame, key);
  const aspect = pixelHeight <= 0 ? f32(4.0 / 3.0) : toReal(pixelWidth) / toReal(pixelHeight);
  setFrameSize(frame, f32(Math.max(f32(0.8), aspect * f32(0.6)) + f32(0.02)), f32(Math.max(f32(0.6), f32(0.8) / aspect) + f32(0.02)));
  setFrameAbsPoint(frame, FramePoint.center, f32(0.4), f32(0.3));
}


function releaseFocus(frame: Frame, clicker: Player): void {
  if (localPlayer() !== clicker) return;
  const enabled = frameEnabled(frame);
  setFrameEnabled(frame, !enabled);
  setFrameEnabled(frame, enabled);
  setFrameFocus(frame, false);
}

export function setMenuText(frame: Frame, text: string): void {
  plainFrameText.set(frame, text);
  setFrameText(frame, text);
}

export function highlightText(frame: Frame, highlighted: boolean): void {
  const plain = plainFrameText.get(frame) ?? "";
  const colored = highlighted && plain !== "" ? `|cffffcc00${plain}|r` : plain;
  setFrameText(frame, colored);
}

export interface ClickBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface Button<T> {
  readonly id: number;
  readonly frame: Frame;
  readonly target: T;
  readonly box: ClickBox | undefined;
}





export class ButtonClicks<T> {
  private readonly trigger = createEvents();
  private readonly buttons: Button<T>[] = [];
  private hovered: Button<T> | undefined;
  private hover: ((target: T | undefined, clicker: Player) => void) | undefined;

  constructor(private readonly name: string, handle: (target: T, clicker: Player) => void, hover?: (target: T | undefined, clicker: Player) => void) {
    this.hover = hover;
    onEvents(this.trigger, trampoline(name));
    this.bindHandler(handle);
  }

  bindHandler(handle: (target: T, clicker: Player) => void, hover = this.hover): void {
    this.hover = hover;
    on(this.name, () => {
      const id = GetHandleId(eventFrame());
      const clicker = eventPlayer();
      for (const button of this.buttons) {
        if (button.id !== id) continue;
        const event = eventFrameEvent();
        if (event !== FrameEvent.controlClick) {
          if (localPlayer() !== clicker) return;
          if (this.hovered !== undefined) highlightText(this.hovered.frame, false);
          this.hovered = event === FrameEvent.mouseEnter ? button : undefined;
          this.refreshHover();
          this.hover?.(this.hovered?.target, clicker);
          return;
        }
        releaseFocus(button.frame, clicker);
        handle(button.target, clicker);
        return;
      }
    });
  }

  add(frame: Frame, target: T, text?: string, hover: "events" | "native" = "events", box?: ClickBox): Frame {
    if (text !== undefined) setMenuText(frame, text);
    addFrameEvent(this.trigger, frame, FrameEvent.controlClick);
    // Warcraft dialog-button hover events displace the cursor and loop; use the built-in hover on those frames.
    if (hover === "events") {
      addFrameEvent(this.trigger, frame, FrameEvent.mouseEnter);
      addFrameEvent(this.trigger, frame, FrameEvent.mouseLeave);
    }
    this.buttons.push({ id: GetHandleId(frame), frame, target, box });
    return frame;
  }

  // Whether a shown button registered with a box lies under the pointer, for the menu hand to open over it; every button is asked about its visibility whatever the pointer, so clients with different mice make the same native calls.
  over(x: number, y: number): boolean {
    let over = false;
    for (const { frame, box } of this.buttons) {
      if (box === undefined) continue;
      const shown = frameVisible(frame);
      if (shown && x >= box.x && x <= f32(box.x + box.width) && y <= box.y && y >= f32(box.y - box.height)) over = true;
    }
    return over;
  }

  refreshHover(): void {
    if (this.hovered !== undefined) highlightText(this.hovered.frame, true);
  }

  destroy(): void {
    destroyEvents(this.trigger);
  }
}


export function createSyncTrigger(name: string, prefix: string, senders: readonly number[], handle: (sender: number, data: string) => void): Events {
  const trigger = createEvents();
  for (const sender of senders) addSyncEvent(trigger, playerOf(sender), prefix);
  onEvents(trigger, trampoline(name));
  bindSyncHandler(name, handle);
  return trigger;
}


export function bindSyncHandler(name: string, handle: (sender: number, data: string) => void): void {
  on(name, () => handle(playerSlot(eventPlayer()), syncData()));
}

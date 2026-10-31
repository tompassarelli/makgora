



import { on, trampoline } from "wisp/src/platform/dispatch";
import { f32 } from "wisp/src/sim/f32";
import { MENU_STYLE, NATIVE_TEXT_BASE } from "./hudLayout";
import { createEvents, destroyEvents, onEvents } from "wisp/game/events";
import { addFrameEvent, createFrameByType, eventFrame, eventFrameEvent, frameEnabled, frameVisible, namedFrame, originFrame, screenHeight, screenWidth, setFrameAbsPoint, setFrameAlpha, setFrameEnabled, setFrameFocus, setFrameFont, setFramePoint, setFrameScale, setFrameSize, setFrameText, setFrameTexture } from "wisp/game/frames";


export type MenuControls = "journal" | "keyboard";

const plainFrameText = new Map<framehandle, string>();

export function gameUi(): framehandle {
  return originFrame(ORIGIN_FRAME_GAME_UI, 0);
}

export function consoleUi(): framehandle {
  return namedFrame("ConsoleUIBackdrop", 0);
}

export function createBackdrop(name: string, owner: framehandle, context: number): framehandle {
  return createFrameByType("BACKDROP", name, owner, "", context);
}

export function createText(name: string, owner: framehandle, context: number): framehandle {
  return createFrameByType("TEXT", name, owner, "", context);
}

// Warcraft scales relative point offsets too; divide them by the returned scale.
export function sizeText(frame: framehandle, size: number, width: number, height: number): number {
  const scale = f32(size / NATIVE_TEXT_BASE);
  setFrameScale(frame, scale);
  setFrameSize(frame, f32(width / scale), f32(height / scale));
  setFrameFont(frame, MENU_STYLE.font, size, 0);
  return scale;
}

export function styleMenuPanel(frame: framehandle, name: string): framehandle {
  setFrameTexture(frame, MENU_STYLE.borderTexture, 0, true);
  setFrameAlpha(frame, 255);
  const backing = createBackdrop(`${name}Backing`, frame, 0);
  setFrameTexture(backing, MENU_STYLE.panelTexture, 0, true);
  setFrameAlpha(backing, 255);
  setFramePoint(backing, FRAMEPOINT_TOPLEFT, frame, FRAMEPOINT_TOPLEFT, f32(0.012), f32(-0.012));
  setFramePoint(backing, FRAMEPOINT_BOTTOMRIGHT, frame, FRAMEPOINT_BOTTOMRIGHT, f32(-0.012), f32(0.012));
  setFrameEnabled(backing, false);
  return backing;
}

export function placeTopLeft(frame: framehandle, x: number, y: number): void {
  setFrameAbsPoint(frame, FRAMEPOINT_TOPLEFT, x, y);
}


const fittedSize = new Map<framehandle, number>();

// Engine: Warcraft draws no child of the game UI outside the centred 4:3 area, so a full-window backdrop hangs off ConsoleUIBackdrop.
export function createWindowBackdrop(name: string, texture: string, context: number): framehandle {
  const frame = createBackdrop(name, consoleUi(), context);
  setFrameTexture(frame, texture, 0, false);
  fitToWindow(frame);
  return frame;
}

export function fitToWindow(frame: framehandle): void {
  const pixelWidth = screenWidth();
  const pixelHeight = screenHeight();
  const key = pixelWidth * 65536 + pixelHeight;
  if (fittedSize.get(frame) === key) return;
  fittedSize.set(frame, key);
  const aspect = pixelHeight <= 0 ? f32(4.0 / 3.0) : I2R(pixelWidth) / I2R(pixelHeight);
  setFrameSize(frame, f32(Math.max(f32(0.8), aspect * f32(0.6)) + f32(0.02)), f32(Math.max(f32(0.6), f32(0.8) / aspect) + f32(0.02)));
  setFrameAbsPoint(frame, FRAMEPOINT_CENTER, f32(0.4), f32(0.3));
}


function releaseFocus(frame: framehandle, clicker: player): void {
  if (GetLocalPlayer() !== clicker) return;
  const enabled = frameEnabled(frame);
  setFrameEnabled(frame, !enabled);
  setFrameEnabled(frame, enabled);
  setFrameFocus(frame, false);
}

export function setMenuText(frame: framehandle, text: string): void {
  plainFrameText.set(frame, text);
  setFrameText(frame, text);
}

export function highlightText(frame: framehandle, highlighted: boolean): void {
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
  readonly frame: framehandle;
  readonly target: T;
  readonly box: ClickBox | undefined;
}





export class ButtonClicks<T> {
  private readonly trigger = createEvents();
  private readonly buttons: Button<T>[] = [];
  private hovered: Button<T> | undefined;
  private hover: ((target: T | undefined, clicker: player) => void) | undefined;

  constructor(private readonly name: string, handle: (target: T, clicker: player) => void, hover?: (target: T | undefined, clicker: player) => void) {
    this.hover = hover;
    onEvents(this.trigger, trampoline(name));
    this.bindHandler(handle);
  }

  bindHandler(handle: (target: T, clicker: player) => void, hover = this.hover): void {
    this.hover = hover;
    on(this.name, () => {
      const id = GetHandleId(eventFrame());
      const clicker = GetTriggerPlayer();
      for (const button of this.buttons) {
        if (button.id !== id) continue;
        const event = eventFrameEvent();
        if (event !== FRAMEEVENT_CONTROL_CLICK) {
          if (GetLocalPlayer() !== clicker) return;
          if (this.hovered !== undefined) highlightText(this.hovered.frame, false);
          this.hovered = event === FRAMEEVENT_MOUSE_ENTER ? button : undefined;
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

  add(frame: framehandle, target: T, text?: string, hover: "events" | "native" = "events", box?: ClickBox): framehandle {
    if (text !== undefined) setMenuText(frame, text);
    addFrameEvent(this.trigger, frame, FRAMEEVENT_CONTROL_CLICK);
    // Warcraft dialog-button hover events displace the cursor and loop; use the built-in hover on those frames.
    if (hover === "events") {
      addFrameEvent(this.trigger, frame, FRAMEEVENT_MOUSE_ENTER);
      addFrameEvent(this.trigger, frame, FRAMEEVENT_MOUSE_LEAVE);
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


export function createSyncTrigger(name: string, prefix: string, senders: readonly number[], handle: (sender: number, data: string) => void): trigger {
  const trigger = createEvents();
  for (const sender of senders) BlzTriggerRegisterPlayerSyncEvent(trigger, Player(sender), prefix, false);
  onEvents(trigger, trampoline(name));
  bindSyncHandler(name, handle);
  return trigger;
}


export function bindSyncHandler(name: string, handle: (sender: number, data: string) => void): void {
  on(name, () => handle(GetPlayerId(GetTriggerPlayer()), BlzGetTriggerSyncData()));
}

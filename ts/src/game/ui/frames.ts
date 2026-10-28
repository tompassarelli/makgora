



import { on, trampoline } from "wisp/src/platform/dispatch";
import { f32 } from "wisp/src/sim/f32";
import { MENU_STYLE, NATIVE_TEXT_BASE } from "./hudLayout";


export type MenuControls = "journal" | "keyboard";

const plainFrameText = new Map<framehandle, string>();

export function gameUi(): framehandle {
  return BlzGetOriginFrame(ORIGIN_FRAME_GAME_UI, 0);
}

export function consoleUi(): framehandle {
  return BlzGetFrameByName("ConsoleUIBackdrop", 0);
}

// Engine: a ConsoleUIBackdrop child draws over chat, and raising the chat frame's level instead crashes Warcraft when the game ends.
export function screenLayer(): framehandle {
  return BlzFrameGetParent(consoleUi());
}

export function createBackdrop(name: string, owner: framehandle, context: number): framehandle {
  return BlzCreateFrameByType("BACKDROP", name, owner, "", context);
}

export function createText(name: string, owner: framehandle, context: number): framehandle {
  return BlzCreateFrameByType("TEXT", name, owner, "", context);
}

// Warcraft scales relative point offsets too; divide them by the returned scale.
export function sizeText(frame: framehandle, size: number, width: number, height: number): number {
  const scale = f32(size / NATIVE_TEXT_BASE);
  BlzFrameSetScale(frame, scale);
  BlzFrameSetSize(frame, f32(width / scale), f32(height / scale));
  BlzFrameSetFont(frame, MENU_STYLE.font, size, 0);
  return scale;
}

export function styleMenuPanel(frame: framehandle, name: string): framehandle {
  BlzFrameSetTexture(frame, MENU_STYLE.borderTexture, 0, true);
  BlzFrameSetAlpha(frame, 255);
  const backing = createBackdrop(`${name}Backing`, frame, 0);
  BlzFrameSetTexture(backing, MENU_STYLE.panelTexture, 0, true);
  BlzFrameSetAlpha(backing, 255);
  BlzFrameSetPoint(backing, FRAMEPOINT_TOPLEFT, frame, FRAMEPOINT_TOPLEFT, f32(0.012), f32(-0.012));
  BlzFrameSetPoint(backing, FRAMEPOINT_BOTTOMRIGHT, frame, FRAMEPOINT_BOTTOMRIGHT, f32(-0.012), f32(0.012));
  BlzFrameSetEnable(backing, false);
  return backing;
}

export function placeTopLeft(frame: framehandle, x: number, y: number): void {
  BlzFrameSetAbsPoint(frame, FRAMEPOINT_TOPLEFT, x, y);
}


export function coverScreen(frame: framehandle): void {
  const height = BlzGetLocalClientHeight();
  const width = height <= 0 ? f32(0.8) : (I2R(BlzGetLocalClientWidth()) / I2R(height)) * f32(0.6);
  BlzFrameSetSize(frame, width, f32(0.6));
  BlzFrameSetAbsPoint(frame, FRAMEPOINT_BOTTOM, f32(0.4), 0.0);
}


function releaseFocus(frame: framehandle, clicker: player): void {
  if (GetLocalPlayer() !== clicker) return;
  const enabled = BlzFrameGetEnable(frame);
  BlzFrameSetEnable(frame, !enabled);
  BlzFrameSetEnable(frame, enabled);
  BlzFrameSetFocus(frame, false);
}

export function setFrameText(frame: framehandle, text: string): void {
  plainFrameText.set(frame, text);
  BlzFrameSetText(frame, text);
}

export function highlightText(frame: framehandle, highlighted: boolean): void {
  const plain = plainFrameText.get(frame) ?? "";
  const colored = highlighted && plain !== "" ? `|cffffcc00${plain}|r` : plain;
  BlzFrameSetText(frame, colored);
}

interface Button<T> {
  readonly id: number;
  readonly frame: framehandle;
  readonly target: T;
}





export class ButtonClicks<T> {
  private readonly trigger = CreateTrigger();
  private readonly buttons: Button<T>[] = [];
  private hovered: Button<T> | undefined;
  private hover: ((target: T | undefined, clicker: player) => void) | undefined;

  constructor(private readonly name: string, handle: (target: T, clicker: player) => void, hover?: (target: T | undefined, clicker: player) => void) {
    this.hover = hover;
    TriggerAddAction(this.trigger, trampoline(name));
    this.bindHandler(handle);
  }

  bindHandler(handle: (target: T, clicker: player) => void, hover = this.hover): void {
    this.hover = hover;
    on(this.name, () => {
      const id = GetHandleId(BlzGetTriggerFrame());
      const clicker = GetTriggerPlayer();
      for (const button of this.buttons) {
        if (button.id !== id) continue;
        const event = BlzGetTriggerFrameEvent();
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

  add(frame: framehandle, target: T, text?: string, hover: "events" | "native" = "events"): framehandle {
    if (text !== undefined) setFrameText(frame, text);
    BlzTriggerRegisterFrameEvent(this.trigger, frame, FRAMEEVENT_CONTROL_CLICK);
    // Warcraft dialog-button hover events displace the cursor and loop; use the built-in hover on those frames.
    if (hover === "events") {
      BlzTriggerRegisterFrameEvent(this.trigger, frame, FRAMEEVENT_MOUSE_ENTER);
      BlzTriggerRegisterFrameEvent(this.trigger, frame, FRAMEEVENT_MOUSE_LEAVE);
    }
    this.buttons.push({ id: GetHandleId(frame), frame, target });
    return frame;
  }

  refreshHover(): void {
    if (this.hovered !== undefined) highlightText(this.hovered.frame, true);
  }

  destroy(): void {
    DestroyTrigger(this.trigger);
  }
}


export function createSyncTrigger(name: string, prefix: string, senders: readonly number[], handle: (sender: number, data: string) => void): trigger {
  const trigger = CreateTrigger();
  for (const sender of senders) BlzTriggerRegisterPlayerSyncEvent(trigger, Player(sender), prefix, false);
  TriggerAddAction(trigger, trampoline(name));
  bindSyncHandler(name, handle);
  return trigger;
}


export function bindSyncHandler(name: string, handle: (sender: number, data: string) => void): void {
  on(name, () => handle(GetPlayerId(GetTriggerPlayer()), BlzGetTriggerSyncData()));
}

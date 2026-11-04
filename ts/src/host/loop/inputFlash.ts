import { f32 } from "wisp/src/sim/f32";
import { createBackdrop, gameUi, placeTopLeft } from "../../game/ui/frames";
import { Frame, setFrameLevel, setFrameSize, setFrameTexture, setFrameVisible } from "wisp/game/frames";

const FLASH_TEXTURE = "ReplaceableTextures\\TeamColor\\TeamColor00.blp";
const FLASH_SIZE = f32(0.05);
const FLASH_LEFT = f32(0.0);
const FLASH_TOP = f32(0.6);
const FLASH_LEVEL = 9;
const FLASH_FRAMES = 8;

interface InputFlash {
  readonly frame: Frame;
  visible: boolean;
  litUntil: number;
}

declare global { var __makgoraInputFlash: InputFlash | undefined; }

function inputFlash(): InputFlash {
  const existing = globalThis.__makgoraInputFlash;
  if (existing !== undefined) return existing;
  const frame = createBackdrop("MakgoraInputFlash", gameUi(), 0);
  setFrameSize(frame, FLASH_SIZE, FLASH_SIZE);
  placeTopLeft(frame, FLASH_LEFT, FLASH_TOP);
  setFrameLevel(frame, FLASH_LEVEL);
  setFrameTexture(frame, FLASH_TEXTURE, 0, true);
  setFrameVisible(frame, false);
  const created: InputFlash = { frame, visible: false, litUntil: -1 };
  globalThis.__makgoraInputFlash = created;
  return created;
}

export function flashPress(frame: number, pressed: number, enabled: boolean): void {
  if (!enabled && globalThis.__makgoraInputFlash === undefined) return;
  const flash = inputFlash();
  if (enabled && pressed !== 0) flash.litUntil = frame + FLASH_FRAMES;
  const lit = enabled && frame < flash.litUntil;
  if (lit === flash.visible) return;
  flash.visible = lit;
  setFrameVisible(flash.frame, lit);
}

import { SELECT_LEVELS } from "./chatLayer";
import { f32 } from "wisp/src/sim/f32";
import { CREDITS_TITLE, CreditsPanelState, creditsBody } from "./credits";
import { MENU_FONT, PANEL_TEXTURE } from "./hudLayout";
import { ButtonClicks, createBackdrop, createText, placeTopLeft } from "./frames";
import { CREDITS_BOX } from "./selectionLayout";

export type CreditsButton = { kind: "creditsOpen" } | { kind: "creditsClose" };

function text(parent: framehandle, name: string, x: number, y: number, width: number, height: number, size: number, vertical: textaligntype, horizontal: textaligntype): framehandle {
  const frame = createText(name, parent, 0);
  placeTopLeft(frame, x, y);
  BlzFrameSetSize(frame, width, height);
  BlzFrameSetFont(frame, MENU_FONT, size, 0);
  BlzFrameSetTextAlignment(frame, vertical, horizontal);
  BlzFrameSetEnable(frame, false);
  return frame;
}

function button(parent: framehandle, x: number, y: number, width: number, height: number, label: string): framehandle {
  const frame = BlzCreateFrame("ScriptDialogButton", parent, 0, 0);
  placeTopLeft(frame, x, y);
  BlzFrameSetSize(frame, width, height);
  BlzFrameSetText(frame, label);
  return frame;
}

export class CreditsMenu {
  readonly root: framehandle;
  private readonly state = new CreditsPanelState();
  private readonly clicks: ButtonClicks<CreditsButton>;

  constructor(owner: framehandle, rules: framehandle, suffix: string, version: string, private readonly participantId: number) {
    this.clicks = new ButtonClicks(`ui.credits.${suffix}.click`, (target, clicker) => this.click(target, clicker));
    this.root = createBackdrop(`MeleeCreditsMenu${suffix}`, owner, 0);
    BlzFrameSetTexture(this.root, PANEL_TEXTURE, 0, true);
    placeTopLeft(this.root, f32(0.1), f32(0.53));
    BlzFrameSetSize(this.root, f32(0.6), f32(0.46));
    BlzFrameSetLevel(this.root, SELECT_LEVELS.credits);
    BlzFrameSetText(text(this.root, `MeleeCreditsTitle${suffix}`, f32(0.11), f32(0.52), f32(0.58), f32(0.03), f32(0.018), TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER), CREDITS_TITLE);
    BlzFrameSetText(text(this.root, `MeleeCreditsBody${suffix}`, f32(0.12), f32(0.485), f32(0.56), f32(0.34), f32(0.0105), TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_LEFT), creditsBody(version));
    this.clicks.add(button(this.root, f32(0.32), f32(0.115), f32(0.16), f32(0.035), "Close"), { kind: "creditsClose" }, "Close", "native");
    BlzFrameSetVisible(this.root, false);
    this.clicks.add(button(rules, CREDITS_BOX.x, CREDITS_BOX.y, CREDITS_BOX.width, CREDITS_BOX.height, CREDITS_TITLE), { kind: "creditsOpen" }, CREDITS_TITLE, "native");
  }

  bindActions(): void {
    this.clicks.bindHandler((target, clicker) => this.click(target, clicker));
  }

  private click(button: CreditsButton, clicker: player): void {
    if (clicker !== Player(this.participantId)) return;
    if (button.kind === "creditsOpen") this.state.open();
    else this.state.close();
  }

  close(): boolean {
    return this.state.close();
  }

  show(visible: boolean): void {
    BlzFrameSetVisible(this.root, visible && this.state.isOpen);
  }

  destroy(): void {
    this.clicks.destroy();
    BlzDestroyFrame(this.root);
  }
}

import { SELECT_LEVELS } from "./selectLevels";
import { f32 } from "wisp/src/sim/f32";
import { CREDITS_TITLE, creditsBody } from "./credits";
import { ButtonClicks, createBackdrop, placeTopLeft, styleMenuPanel } from "./frames";
import { InfoPanelState } from "./infoPanelState";
import { panelButton, panelText } from "./infoPanel";
import { destroyFrame, Frame, setFrameLevel, setFrameSize, setFrameText, setFrameVisible, TextAlignment } from "wisp/game/frames";
import { Player, player as playerOf } from "wisp/game/players";

const CLOSE_BOX = { x: f32(0.32), y: f32(0.115), width: f32(0.16), height: f32(0.035) } as const;

export type CreditsButton = { kind: "creditsOpen" } | { kind: "creditsClose" };

export class CreditsMenu {
  readonly root: Frame;
  onOpen: () => void = () => {};
  private readonly state = new InfoPanelState();
  private readonly clicks: ButtonClicks<CreditsButton>;

  constructor(owner: Frame, opener: Frame, suffix: string, version: string, private readonly participantId: number) {
    this.clicks = new ButtonClicks(`ui.credits.${suffix}.click`, (target, clicker) => this.click(target, clicker));
    this.root = createBackdrop(`MeleeCreditsMenu${suffix}`, owner, 0);
    styleMenuPanel(this.root, `MeleeCreditsPanel${suffix}`);
    placeTopLeft(this.root, f32(0.1), f32(0.53));
    setFrameSize(this.root, f32(0.6), f32(0.46));
    setFrameLevel(this.root, SELECT_LEVELS.credits);
    setFrameText(panelText(this.root, `MeleeCreditsTitle${suffix}`, f32(0.11), f32(0.52), f32(0.58), f32(0.03), f32(0.018), TextAlignment.middle, TextAlignment.center), CREDITS_TITLE);
    setFrameText(panelText(this.root, `MeleeCreditsBody${suffix}`, f32(0.12), f32(0.485), f32(0.56), f32(0.34), f32(0.0105), TextAlignment.top, TextAlignment.left), creditsBody(version));
    this.clicks.add(panelButton(this.root, CLOSE_BOX.x, CLOSE_BOX.y, CLOSE_BOX.width, CLOSE_BOX.height, "Close"), { kind: "creditsClose" }, "Close", "native", CLOSE_BOX);
    setFrameVisible(this.root, false);
    this.clicks.add(opener, { kind: "creditsOpen" }, undefined, "native");
  }

  bindActions(): void {
    this.clicks.bindHandler((target, clicker) => this.click(target, clicker));
  }

  private click(button: CreditsButton, clicker: Player): void {
    if (clicker !== playerOf(this.participantId)) return;
    if (button.kind === "creditsOpen") this.open();
    else this.state.close();
  }

  open(): void {
    this.state.open();
    this.onOpen();
  }

  opened(): boolean {
    return this.state.isOpen;
  }

  over(x: number, y: number): boolean {
    return this.clicks.over(x, y);
  }

  close(): boolean {
    return this.state.close();
  }

  show(visible: boolean): void {
    setFrameVisible(this.root, visible && this.state.isOpen);
  }

  destroy(): void {
    this.clicks.destroy();
    destroyFrame(this.root);
  }
}

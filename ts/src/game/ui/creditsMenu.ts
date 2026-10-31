import { SELECT_LEVELS } from "./selectLevels";
import { f32 } from "wisp/src/sim/f32";
import { CREDITS_TITLE, creditsBody } from "./credits";
import { ButtonClicks, createBackdrop, placeTopLeft, styleMenuPanel } from "./frames";
import { InfoPanelState } from "./infoPanelState";
import { panelButton, panelText } from "./infoPanel";
import { CREDITS_BOX } from "./selectionLayout";

const CLOSE_BOX = { x: f32(0.32), y: f32(0.115), width: f32(0.16), height: f32(0.035) } as const;

export type CreditsButton = { kind: "creditsOpen" } | { kind: "creditsClose" };

export class CreditsMenu {
  readonly root: framehandle;
  onOpen: () => void = () => {};
  private readonly state = new InfoPanelState();
  private readonly clicks: ButtonClicks<CreditsButton>;

  constructor(owner: framehandle, rules: framehandle, suffix: string, version: string, private readonly participantId: number) {
    this.clicks = new ButtonClicks(`ui.credits.${suffix}.click`, (target, clicker) => this.click(target, clicker));
    this.root = createBackdrop(`MeleeCreditsMenu${suffix}`, owner, 0);
    styleMenuPanel(this.root, `MeleeCreditsPanel${suffix}`);
    placeTopLeft(this.root, f32(0.1), f32(0.53));
    BlzFrameSetSize(this.root, f32(0.6), f32(0.46));
    BlzFrameSetLevel(this.root, SELECT_LEVELS.credits);
    BlzFrameSetText(panelText(this.root, `MeleeCreditsTitle${suffix}`, f32(0.11), f32(0.52), f32(0.58), f32(0.03), f32(0.018), TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER), CREDITS_TITLE);
    BlzFrameSetText(panelText(this.root, `MeleeCreditsBody${suffix}`, f32(0.12), f32(0.485), f32(0.56), f32(0.34), f32(0.0105), TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_LEFT), creditsBody(version));
    this.clicks.add(panelButton(this.root, CLOSE_BOX.x, CLOSE_BOX.y, CLOSE_BOX.width, CLOSE_BOX.height, "Close"), { kind: "creditsClose" }, "Close", "native", CLOSE_BOX);
    BlzFrameSetVisible(this.root, false);
    this.clicks.add(panelButton(rules, CREDITS_BOX.x, CREDITS_BOX.y, CREDITS_BOX.width, CREDITS_BOX.height, CREDITS_TITLE), { kind: "creditsOpen" }, CREDITS_TITLE, "native", CREDITS_BOX);
  }

  bindActions(): void {
    this.clicks.bindHandler((target, clicker) => this.click(target, clicker));
  }

  private click(button: CreditsButton, clicker: player): void {
    if (clicker !== Player(this.participantId)) return;
    if (button.kind === "creditsOpen") {
      this.state.open();
      this.onOpen();
    } else this.state.close();
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
    BlzFrameSetVisible(this.root, visible && this.state.isOpen);
  }

  destroy(): void {
    this.clicks.destroy();
    BlzDestroyFrame(this.root);
  }
}

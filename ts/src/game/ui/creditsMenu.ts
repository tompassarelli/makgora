import { CREDITS_TITLE, creditsParagraphs } from "./credits";
import { ButtonClicks } from "./frames";
import { InfoPanelState } from "./infoPanelState";
import { type InfoPopupBody, infoPopup } from "./infoPanel";
import { CREDITS_PANEL, INFO_POPUP_SIZE, type InfoPopupLayout, infoPopupLayout } from "./infoPopupLayout";
import { destroyFrame, Frame, setFrameVisible } from "wisp/game/frames";
import { Player, player as playerOf } from "wisp/game/players";

export const creditsLayout = (version: string): InfoPopupLayout => infoPopupLayout(CREDITS_PANEL, creditsParagraphs(version), INFO_POPUP_SIZE, false);

export type CreditsButton = { kind: "creditsOpen" } | { kind: "creditsClose" };

export class CreditsMenu {
  readonly root: Frame;
  onOpen: () => void = () => {};
  private readonly state: InfoPanelState;
  private readonly body: InfoPopupBody;
  private readonly clicks: ButtonClicks<CreditsButton>;

  constructor(owner: Frame, opener: Frame, suffix: string, version: string, private readonly participantId: number) {
    this.clicks = new ButtonClicks(`ui.credits.${suffix}.click`, (target, clicker) => this.click(target, clicker));
    const layout = creditsLayout(version);
    const popup = infoPopup(owner, `MeleeCreditsMenu${suffix}`, layout, CREDITS_TITLE, false);
    this.root = popup.root;
    this.body = popup.body;
    this.state = new InfoPanelState(layout.maxFirst);
    this.clicks.add(popup.close, { kind: "creditsClose" }, "Close", "native", layout.close);
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
    this.body.showFrom(0);
    this.onOpen();
  }

  scroll(delta: number): boolean {
    if (!this.state.scroll(delta)) return false;
    this.body.showFrom(this.state.first);
    return true;
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

import { COMMUNITY_TITLE, communityParagraphs } from "./community";
import { ButtonClicks } from "./frames";
import { InfoPanelState } from "./infoPanelState";
import { type InfoPopupBody, infoPopup } from "./infoPanel";
import { PopupWheel } from "./infoPopupWheel";
import { recordWheel } from "./wheelLog";
import { COMMUNITY_PANEL, INFO_POPUP_SIZE, type InfoPopupLayout, infoPopupLayout } from "./infoPopupLayout";
import { destroyFrame, Frame, setFrameVisible } from "wisp/game/frames";
import { Player, player as playerOf } from "wisp/game/players";

export const communityLayout = (): InfoPopupLayout => infoPopupLayout(COMMUNITY_PANEL, communityParagraphs(), INFO_POPUP_SIZE, true);

export type CommunityButton = { kind: "communityOpen" } | { kind: "communityClose" };

export class CommunityMenu {
  readonly root: Frame;
  onOpen: () => void = () => {};
  private readonly state: InfoPanelState;
  private readonly body: InfoPopupBody;
  private readonly clicks: ButtonClicks<CommunityButton>;
  private readonly wheel: PopupWheel;

  constructor(owner: Frame, opener: Frame, suffix: string, private readonly participantId: number) {
    this.clicks = new ButtonClicks(`ui.community.${suffix}.click`, (target, clicker) => this.click(target, clicker));
    const layout = communityLayout();
    const popup = infoPopup(owner, `MeleeCommunityMenu${suffix}`, layout, COMMUNITY_TITLE, true);
    this.root = popup.root;
    this.wheel = new PopupWheel(`ui.community.${suffix}.wheel`, [popup.wheel, popup.close], (delta, turner) => this.turn(delta, turner));
    this.body = popup.body;
    this.state = new InfoPanelState(layout.maxFirst);
    this.clicks.add(popup.close, { kind: "communityClose" }, "Close", "native", layout.close);
    setFrameVisible(this.root, false);
    this.clicks.add(opener, { kind: "communityOpen" }, undefined, "native");
  }

  bindActions(): void {
    this.clicks.bindHandler((target, clicker) => this.click(target, clicker));
    this.wheel.bindHandler((delta, turner) => this.turn(delta, turner));
  }

  private click(button: CommunityButton, clicker: Player): void {
    if (clicker !== playerOf(this.participantId)) return;
    if (button.kind === "communityOpen") this.open();
    else this.shut();
  }

  private turn(delta: number, turner: Player): void {
    if (turner !== playerOf(this.participantId) || !this.state.isOpen) return;
    this.scroll(delta);
    recordWheel("community", delta, this.state.first);
  }

  private shut(): boolean {
    this.wheel.disarm();
    return this.state.close();
  }

  open(): void {
    this.state.open();
    this.wheel.arm();
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
    return this.shut();
  }

  show(visible: boolean): void {
    setFrameVisible(this.root, visible && this.state.isOpen);
  }

  destroy(): void {
    this.wheel.disarm();
    this.clicks.destroy();
    destroyFrame(this.root);
  }
}

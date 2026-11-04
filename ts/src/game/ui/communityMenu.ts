import { f32 } from "wisp/src/sim/f32";
import { COMMUNITY_TITLE, communityParagraphs } from "./community";
import { ButtonClicks } from "./frames";
import { InfoPanelState } from "./infoPanelState";
import { infoPopup } from "./infoPanel";
import { COMMUNITY_PANEL, type InfoPopupLayout, infoPopupLayout } from "./infoPopupLayout";
import { destroyFrame, Frame, setFrameVisible } from "wisp/game/frames";
import { Player, player as playerOf } from "wisp/game/players";

export const COMMUNITY_SIZE = f32(0.0135);
export const communityLayout = (): InfoPopupLayout => infoPopupLayout(COMMUNITY_PANEL, communityParagraphs(), COMMUNITY_SIZE, true);

export type CommunityButton = { kind: "communityOpen" } | { kind: "communityClose" };

export class CommunityMenu {
  readonly root: Frame;
  onOpen: () => void = () => {};
  private readonly state = new InfoPanelState();
  private readonly clicks: ButtonClicks<CommunityButton>;

  constructor(owner: Frame, opener: Frame, suffix: string, private readonly participantId: number) {
    this.clicks = new ButtonClicks(`ui.community.${suffix}.click`, (target, clicker) => this.click(target, clicker));
    const layout = communityLayout();
    const popup = infoPopup(owner, `MeleeCommunityMenu${suffix}`, layout, COMMUNITY_TITLE, true);
    this.root = popup.root;
    this.clicks.add(popup.close, { kind: "communityClose" }, "Close", "native", layout.close);
    setFrameVisible(this.root, false);
    this.clicks.add(opener, { kind: "communityOpen" }, undefined, "native");
  }

  bindActions(): void {
    this.clicks.bindHandler((target, clicker) => this.click(target, clicker));
  }

  private click(button: CommunityButton, clicker: Player): void {
    if (clicker !== playerOf(this.participantId)) return;
    if (button.kind === "communityOpen") this.open();
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

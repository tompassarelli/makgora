import { SELECT_LEVELS } from "./selectLevels";
import { f32 } from "wisp/src/sim/f32";
import { COMMUNITY_TITLE, communityBody } from "./community";
import { ButtonClicks, createBackdrop, placeTopLeft, styleMenuPanel } from "./frames";
import { InfoPanelState } from "./infoPanelState";
import { panelButton, panelText } from "./infoPanel";
import { COMMUNITY_BOX } from "./selectionLayout";
import { destroyFrame, Frame, setFrameLevel, setFrameSize, setFrameText, setFrameVisible, TextAlignment } from "wisp/game/frames";
import { Player, player as playerOf } from "wisp/game/players";

const CLOSE_BOX = { x: f32(0.32), y: f32(0.305), width: f32(0.16), height: f32(0.03) } as const;

export type CommunityButton = { kind: "communityOpen" } | { kind: "communityClose" };

export class CommunityMenu {
  readonly root: Frame;
  onOpen: () => void = () => {};
  private readonly state = new InfoPanelState();
  private readonly clicks: ButtonClicks<CommunityButton>;

  constructor(owner: Frame, rules: Frame, suffix: string, private readonly participantId: number) {
    this.clicks = new ButtonClicks(`ui.community.${suffix}.click`, (target, clicker) => this.click(target, clicker));
    this.root = createBackdrop(`MeleeCommunityMenu${suffix}`, owner, 0);
    styleMenuPanel(this.root, `MeleeCommunityPanel${suffix}`);
    placeTopLeft(this.root, f32(0.2), f32(0.47));
    setFrameSize(this.root, f32(0.4), f32(0.2));
    setFrameLevel(this.root, SELECT_LEVELS.community);
    setFrameText(panelText(this.root, `MeleeCommunityTitle${suffix}`, f32(0.21), f32(0.46), f32(0.38), f32(0.03), f32(0.018), TextAlignment.middle, TextAlignment.center), COMMUNITY_TITLE);
    setFrameText(panelText(this.root, `MeleeCommunityBody${suffix}`, f32(0.215), f32(0.428), f32(0.37), f32(0.1), f32(0.0135), TextAlignment.top, TextAlignment.center), communityBody());
    this.clicks.add(panelButton(this.root, CLOSE_BOX.x, CLOSE_BOX.y, CLOSE_BOX.width, CLOSE_BOX.height, "Close"), { kind: "communityClose" }, "Close", "native", CLOSE_BOX);
    setFrameVisible(this.root, false);
    this.clicks.add(panelButton(rules, COMMUNITY_BOX.x, COMMUNITY_BOX.y, COMMUNITY_BOX.width, COMMUNITY_BOX.height, COMMUNITY_TITLE), { kind: "communityOpen" }, COMMUNITY_TITLE, "native", COMMUNITY_BOX);
  }

  bindActions(): void {
    this.clicks.bindHandler((target, clicker) => this.click(target, clicker));
  }

  private click(button: CommunityButton, clicker: Player): void {
    if (clicker !== playerOf(this.participantId)) return;
    if (button.kind === "communityOpen") {
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
    setFrameVisible(this.root, visible && this.state.isOpen);
  }

  destroy(): void {
    this.clicks.destroy();
    destroyFrame(this.root);
  }
}

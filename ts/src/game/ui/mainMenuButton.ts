import { ButtonClicks } from "./frames";
import { panelButton } from "./infoPanel";
import { MAIN_MENU_BOX } from "./selectionLayout";

export const MAIN_MENU_PREFIX = "SC_MM";
const LABEL = "Main menu";

export class MainMenuButton {
  private readonly clicks: ButtonClicks<number>;
  private readonly frame: framehandle;
  private focused = false;

  constructor(rules: framehandle, suffix: string, private readonly participantId: number) {
    this.clicks = new ButtonClicks(`ui.mainMenu.${suffix}.click`, (_, clicker) => this.click(clicker));
    this.frame = panelButton(rules, MAIN_MENU_BOX.x, MAIN_MENU_BOX.y, MAIN_MENU_BOX.width, MAIN_MENU_BOX.height, LABEL);
    this.clicks.add(this.frame, 0, LABEL, "native", MAIN_MENU_BOX);
  }

  bindActions(): void {
    this.clicks.bindHandler((_, clicker) => this.click(clicker));
  }

  // Engine: every client must open the title screen together, so the click is sent as sync data instead of set locally.
  private click(clicker: player): void {
    if (clicker === Player(this.participantId) && GetLocalPlayer() === clicker) BlzSendSyncData(MAIN_MENU_PREFIX, "");
  }

  focus(focused: boolean): void {
    if (focused === this.focused) return;
    this.focused = focused;
    BlzFrameSetText(this.frame, focused ? `> ${LABEL} <` : LABEL);
  }

  over(x: number, y: number): boolean {
    return this.clicks.over(x, y);
  }

  destroy(): void {
    this.clicks.destroy();
  }
}

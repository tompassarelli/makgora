import { ButtonClicks } from "./frames";
import { Frame } from "wisp/game/frames";
import { localPlayer, Player, player as playerOf } from "wisp/game/players";
import { sendSync } from "wisp/game/sync";

export const MAIN_MENU_PREFIX = "SC_MM";

export class MainMenuButton {
  private readonly clicks: ButtonClicks<number>;

  constructor(opener: Frame, suffix: string, private readonly participantId: number) {
    this.clicks = new ButtonClicks(`ui.mainMenu.${suffix}.click`, (_, clicker) => this.click(clicker));
    this.clicks.add(opener, 0, undefined, "native");
  }

  bindActions(): void {
    this.clicks.bindHandler((_, clicker) => this.click(clicker));
  }

  // Engine: every client must open the title screen together, so the click is sent as sync data instead of set locally.
  private click(clicker: Player): void {
    if (clicker === playerOf(this.participantId) && localPlayer() === clicker) sendSync(MAIN_MENU_PREFIX, "");
  }

  destroy(): void {
    this.clicks.destroy();
  }
}

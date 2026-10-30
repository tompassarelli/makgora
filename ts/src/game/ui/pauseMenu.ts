import { f32 } from "wisp/src/sim/f32";
import { bindPrototype } from "../../platform/rebind";
import { ButtonClicks, consoleUi, createBackdrop, createText, placeTopLeft, sizeText, styleMenuPanel } from "./frames";
import { MENU_STYLE } from "./hudLayout";
import { boxContains } from "./selectionLayout";

const ROW_LEFT = f32(f32(0.092) + MENU_STYLE.bodyInset);
const ROW_WIDTH = f32(f32(0.616) - 2 * MENU_STYLE.bodyInset);
const ROW_HEIGHT = f32(0.036);
const ROW_TOP = f32(0.323);

export class PauseMenu {
  private readonly root: framehandle;
  private readonly option: framehandle;
  private readonly clicks: ButtonClicks<number>;
  private hovered = false;
  private shown = false;

  constructor(select: (choice: number, clicker: player) => void) {
    this.clicks = new ButtonClicks("ui.pause.click", select, choice => this.highlight(choice !== undefined));
    this.root = createBackdrop("SmashcraftPause", consoleUi(), 1800);
    placeTopLeft(this.root, f32(0.08), f32(0.53));
    BlzFrameSetSize(this.root, f32(0.64), f32(0.53));
    BlzFrameSetLevel(this.root, 20);
    styleMenuPanel(this.root, "SmashcraftPause");
    const label = (name: string, y: number, height: number, size: number, parent = this.root) => {
      const frame = createText(name, parent, 1801);
      placeTopLeft(frame, ROW_LEFT, y);
      sizeText(frame, size, ROW_WIDTH, height);
      BlzFrameSetTextAlignment(frame, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
      BlzFrameSetEnable(frame, false);
      if (parent === this.root) BlzFrameSetLevel(frame, 21);
      return frame;
    };
    BlzFrameSetText(label("SmashcraftPauseHeading", f32(0.42), f32(0.04), MENU_STYLE.titleSize), `${MENU_STYLE.gold}Smashcraft|r`);
    const button = BlzCreateFrameByType("BUTTON", "SmashcraftPauseOption0", this.root, "", 1801);
    placeTopLeft(button, ROW_LEFT, ROW_TOP);
    BlzFrameSetSize(button, ROW_WIDTH, ROW_HEIGHT);
    this.clicks.add(button, 0);
    this.option = label("SmashcraftPauseOptions0", ROW_TOP, ROW_HEIGHT, MENU_STYLE.headerSize, button);
    BlzFrameSetText(label("SmashcraftPauseHelp", f32(0.245), f32(0.045), MENU_STYLE.bodySize), `${MENU_STYLE.text}A / Start / Click: Play|r`);
    this.highlight(false);
    BlzFrameSetVisible(this.root, false);
  }

  over(x: number, y: number): boolean {
    return this.shown && boxContains({ x: ROW_LEFT, y: ROW_TOP, width: ROW_WIDTH, height: ROW_HEIGHT }, x, y);
  }

  bindActions(select: (choice: number, clicker: player) => void): void {
    bindPrototype(this.clicks, ButtonClicks.prototype);
    this.clicks.bindHandler(select, choice => this.highlight(choice !== undefined));
  }

  private highlight(hovered: boolean): void {
    this.hovered = hovered;
    BlzFrameSetText(this.option, hovered ? `${MENU_STYLE.gold}> Play <|r` : `${MENU_STYLE.text}Play|r`);
  }

  update(title: boolean): void {
    BlzFrameSetVisible(this.root, title);
    this.shown = title;
    if (!title && this.hovered) this.highlight(false);
  }
}

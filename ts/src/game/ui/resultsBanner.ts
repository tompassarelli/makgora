import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import type { ResultRow } from "../presentation/matchCues";
import { ButtonClicks, createBackdrop, createText, gameUi, highlightText, placeTopLeft, setFrameText, sizeText, styleMenuPanel } from "./frames";
import { MENU_STYLE } from "./hudLayout";

export const RESULT_CHOICE_NAMES = ["Rematch", "New stage", "Character select"] as const;

export const BANNER = { left: f32(0.03), top: f32(0.59), width: f32(0.74), height: f32(0.15) } as const;
const INNER_LEFT = f32(BANNER.left + f32(0.025));
const INNER_WIDTH = f32(BANNER.width - f32(0.05));
export const BUTTON_WIDTH = f32(0.15);
const BUTTON_GAP = f32(0.012);
export const CHOICE_TOP = f32(0.504);
export const CHOICE_HEIGHT = f32(0.03);

export const choiceLeft = (choice: number): number =>
  f32(f32(0.4) - f32(f32(RESULT_CHOICE_NAMES.length * BUTTON_WIDTH + (RESULT_CHOICE_NAMES.length - 1) * BUTTON_GAP) / 2) + choice * f32(BUTTON_WIDTH + BUTTON_GAP));

export class ResultsBanner {
  private readonly root: framehandle;
  private readonly heading: framehandle;
  private readonly columns: framehandle[] = [];
  private readonly buttons: framehandle[] = [];
  private readonly help: framehandle;
  readonly clicks: ButtonClicks<number>;

  constructor() {
    this.clicks = new ButtonClicks("ui.results.click", () => undefined);
    const parent = gameUi();
    this.root = createBackdrop("MatchResultsPanel", parent, 0);
    placeTopLeft(this.root, BANNER.left, BANNER.top);
    BlzFrameSetSize(this.root, BANNER.width, BANNER.height);
    BlzFrameSetEnable(this.root, false);
    styleMenuPanel(this.root, "MatchResultsPanel");
    const text = (name: string, x: number, y: number, width: number, height: number, size: number, owner = this.root) => {
      const frame = createText(name, owner, 0);
      placeTopLeft(frame, x, y);
      sizeText(frame, size, width, height);
      BlzFrameSetTextAlignment(frame, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_CENTER);
      BlzFrameSetEnable(frame, false);
      return frame;
    };
    this.heading = text("MatchResultsTitle", INNER_LEFT, f32(0.578), INNER_WIDTH, f32(0.022), MENU_STYLE.headerSize);
    for (let index = 0; index < PARTICIPANT_CAPACITY; index++) {
      this.columns.push(text(`MatchResultsLine${I2S(index)}`, INNER_LEFT, f32(0.553), INNER_WIDTH, f32(0.045), MENU_STYLE.bodySize));
    }
    for (let choice = 0; choice < RESULT_CHOICE_NAMES.length; choice++) {
      const button = BlzCreateFrame("ScriptDialogButton", this.root, 0, 0);
      placeTopLeft(button, choiceLeft(choice), CHOICE_TOP);
      BlzFrameSetSize(button, BUTTON_WIDTH, CHOICE_HEIGHT);
      this.buttons.push(this.clicks.add(button, choice, at(RESULT_CHOICE_NAMES, choice), "native"));
    }
    this.help = text("MatchResultsHelp", INNER_LEFT, f32(0.47), INNER_WIDTH, f32(0.018), MENU_STYLE.bodySize);
    BlzFrameSetVisible(this.root, false);
  }

  bindActions(select: (choice: number, clicker: player) => void): void {
    this.clicks.bindHandler(select);
  }

  show(rows: readonly ResultRow[]): void {
    const width = f32(INNER_WIDTH / Math.max(1, rows.length));
    for (let index = 0; index < this.columns.length; index++) {
      const column = at(this.columns, index);
      const row = rows[index];
      BlzFrameSetVisible(column, row !== undefined);
      if (row === undefined) continue;
      placeTopLeft(column, f32(INNER_LEFT + index * width), f32(0.553));
      sizeText(column, MENU_STYLE.bodySize, width, f32(0.045));
      BlzFrameSetText(column, `${row.winner ? MENU_STYLE.gold : MENU_STYLE.text}${row.text}|r`);
    }
    BlzFrameSetVisible(this.root, true);
  }

  hide(): void {
    BlzFrameSetVisible(this.root, false);
  }

  update(heading: string, help: string, focus: number | undefined): void {
    BlzFrameSetText(this.heading, `${MENU_STYLE.gold}${heading}|r`);
    BlzFrameSetText(this.help, `${MENU_STYLE.text}${help}|r`);
    for (let choice = 0; choice < this.buttons.length; choice++) {
      const button = at(this.buttons, choice);
      BlzFrameSetVisible(button, focus !== undefined);
      setFrameText(button, focus === choice ? `> ${at(RESULT_CHOICE_NAMES, choice)} <` : at(RESULT_CHOICE_NAMES, choice));
      highlightText(button, focus === choice);
    }
  }
}

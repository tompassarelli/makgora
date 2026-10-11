import { f32 } from "wisp/src/sim/f32";
import { bindPrototype } from "../../platform/rebind";
import { ButtonClicks, consoleUi, createBackdrop, createText, placeTopLeft, styleMenuPanel } from "./frames";
import { MENU_STYLE } from "./hudLayout";

export class PauseMenu {
  private readonly root: framehandle;
  private readonly heading: framehandle;
  private readonly options: framehandle[] = [];
  private readonly help: framehandle;
  private readonly controls: framehandle;
  private readonly controlsTitle: framehandle;

  private readonly buttons: framehandle[] = [];
  private readonly clicks: ButtonClicks<number>;
  private hovered: number | undefined;
  private title = false;
  private choice = 0;

  constructor(select: (choice: number, clicker: player) => void) {
    this.clicks = new ButtonClicks("ui.pause.click", select, choice => this.highlight(choice));
    this.root = createBackdrop("SmashcraftPause", consoleUi(), 1800);
    placeTopLeft(this.root, f32(0.08), f32(0.53));
    BlzFrameSetSize(this.root, f32(0.64), f32(0.53));
    BlzFrameSetLevel(this.root, 20);
    styleMenuPanel(this.root, "SmashcraftPause");
    const label = (name: string, y: number, height: number, size: number, parent = this.root) => {
      const frame = createText(name, parent, 1801);
      placeTopLeft(frame, f32(0.26), y);
      BlzFrameSetSize(frame, f32(0.28), height);
      BlzFrameSetFont(frame, MENU_STYLE.font, size, 0);
      BlzFrameSetTextAlignment(frame, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
      BlzFrameSetEnable(frame, false);
      if (parent === this.root) BlzFrameSetLevel(frame, 21);
      return frame;
    };
    this.heading = label("SmashcraftPauseHeading", f32(0.42), f32(0.04), MENU_STYLE.titleSize);
    for (let row = 0; row < 3; row++) {
      const y = f32(f32(0.359) - f32(row * f32(0.036)));
      const button = BlzCreateFrameByType("BUTTON", `SmashcraftPauseOption${I2S(row)}`, this.root, "", 1801);
      placeTopLeft(button, f32(0.26), y);
      BlzFrameSetSize(button, f32(0.28), f32(0.036));
      this.buttons.push(this.clicks.add(button, row));
      this.options.push(label(`SmashcraftPauseOptions${I2S(row)}`, y, f32(0.036), f32(0.018), button));
    }
    this.help = label("SmashcraftPauseHelp", f32(0.245), f32(0.045), MENU_STYLE.bodySize);
    this.controlsTitle = label("SmashcraftPauseControlsTitle", f32(0.20), f32(0.023), MENU_STYLE.headerSize);
    BlzFrameSetText(this.controlsTitle, `${MENU_STYLE.gold}Controls|r`);
    this.controls = label("SmashcraftPauseControls", f32(0.174), f32(0.13), MENU_STYLE.bodySize);
    placeTopLeft(this.controls, f32(f32(0.08) + MENU_STYLE.bodyInset), f32(0.174));
    BlzFrameSetSize(this.controls, f32(f32(0.64) - 2 * MENU_STYLE.bodyInset), f32(0.13));
    BlzFrameSetVisible(this.root, false);
  }

  bindActions(select: (choice: number, clicker: player) => void): void {
    bindPrototype(this.clicks, ButtonClicks.prototype);
    this.clicks.bindHandler(select, choice => this.highlight(choice));
  }

  private highlight(choice: number | undefined): void {
    this.hovered = choice;
    const selected = choice ?? this.choice;
    for (let row = 0; row < this.options.length; row++) {
      const frame = this.options[row];
      if (frame === undefined) continue;
      const text = this.title ? "> Play <" : ["Resume", "Character select", "Main menu"][row] ?? "";
      BlzFrameSetText(frame, (this.title ? choice !== undefined : row === selected) ? `${MENU_STYLE.gold}${this.title ? text : `> ${text} <`}|r` : `${MENU_STYLE.text}${text}|r`);
    }
  }

  update(paused: boolean, choice: number, title: boolean, training = false, hints = false): void {
    BlzFrameSetVisible(this.root, paused || title);
    if (!paused && !title) return;
    BlzFrameSetText(this.heading, `${MENU_STYLE.gold}${title ? "Smashcraft" : "Paused"}|r`);
    const titleChanged = this.title !== title;
    if (titleChanged || this.choice !== choice) this.hovered = undefined;
    this.title = title;
    this.choice = choice;
    this.highlight(this.hovered);
    for (let row = 0; row < this.buttons.length; row++) {
      const button = this.buttons[row];
      const option = this.options[row];
      if (button === undefined || option === undefined) continue;
      BlzFrameSetVisible(button, !title || row === 0);
      if (titleChanged) BlzFrameSetEnable(button, !title || row === 0);
      BlzFrameSetVisible(option, !title || row === 0);
      const y = title ? f32(0.323) : f32(f32(0.359) - f32(row * f32(0.036)));
      placeTopLeft(button, f32(0.26), y);
      placeTopLeft(option, f32(0.26), y);
    }
    BlzFrameSetText(this.help, `${MENU_STYLE.text}${title ? "A / Start / Click: Play" : "Stick / arrows: choose · A: select · Click: select\nStart / Y: resume · Escape: character select"}|r`);
    BlzFrameSetVisible(this.controlsTitle, !title);
    BlzFrameSetVisible(this.controls, !title);
    BlzFrameSetText(this.controls, MENU_STYLE.text + "Q: full shield · T: light shield · P: tilt · Z: short hop · X: meter\n"
      + "Shield just before landing: tech (hold left/right to roll)\n"
      + "Shield + Special: EX (one bar) · Attack + Special: Ultimate (full bar)\n"
      + "Shield + left/right: roll · Shield + down: dodge\n"
      + "Downed: Attack/Special: strike · Up/Jump/Shield: stand · left/right: roll\n"
      + "Ledge: Up/toward: climb · Jump: leap · Shield: roll · Attack: strike · Down/away: let go"
      + (training ? `\nF2: training hints ${hints ? "On" : "Off"}` : "") + "|r");
  }
}

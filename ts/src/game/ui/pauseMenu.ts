import { f32 } from "wisp/src/sim/f32";
import { bindPrototype } from "../../platform/rebind";
import { ButtonClicks, consoleUi, createBackdrop, createText, placeTopLeft, sizeText, styleMenuPanel } from "./frames";
import { MENU_STYLE } from "./hudLayout";
import { Action } from "../input/actions";
import { type KeyBindings, keyNames } from "../input/keyBindings";

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
    const backing = styleMenuPanel(this.root, "SmashcraftPause");
    const rowLeft = f32(f32(0.092) + MENU_STYLE.bodyInset);
    const rowWidth = f32(f32(0.616) - 2 * MENU_STYLE.bodyInset);
    const label = (name: string, y: number, height: number, size: number, parent = this.root) => {
      const frame = createText(name, parent, 1801);
      placeTopLeft(frame, rowLeft, y);
      sizeText(frame, size, rowWidth, height);
      BlzFrameSetTextAlignment(frame, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
      BlzFrameSetEnable(frame, false);
      if (parent === this.root) BlzFrameSetLevel(frame, 21);
      return frame;
    };
    this.heading = label("SmashcraftPauseHeading", f32(0.42), f32(0.04), MENU_STYLE.titleSize);
    for (let row = 0; row < 3; row++) {
      const y = f32(f32(0.359) - f32(row * f32(0.036)));
      const button = BlzCreateFrameByType("BUTTON", `SmashcraftPauseOption${I2S(row)}`, this.root, "", 1801);
      placeTopLeft(button, rowLeft, y);
      BlzFrameSetSize(button, rowWidth, f32(0.036));
      this.buttons.push(this.clicks.add(button, row));
      this.options.push(label(`SmashcraftPauseOptions${I2S(row)}`, y, f32(0.036), MENU_STYLE.headerSize, button));
    }
    this.help = label("SmashcraftPauseHelp", f32(0.245), f32(0.045), MENU_STYLE.bodySize);
    this.controlsTitle = label("SmashcraftPauseControlsTitle", f32(0.20), f32(0.023), MENU_STYLE.headerSize);
    BlzFrameSetText(this.controlsTitle, `${MENU_STYLE.gold}Controls|r`);
    this.controls = label("SmashcraftPauseControls", f32(0.174), f32(0.13), MENU_STYLE.bodySize);
    const controlsScale = sizeText(this.controls, MENU_STYLE.bodySize, rowWidth, f32(0.13));
    BlzFrameSetTextAlignment(this.controls, TEXT_JUSTIFY_TOP, TEXT_JUSTIFY_CENTER);
    BlzFrameSetPoint(this.controls, FRAMEPOINT_TOPLEFT, backing, FRAMEPOINT_TOPLEFT, f32(MENU_STYLE.bodyInset / controlsScale), f32(f32(-0.344) / controlsScale));
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

  update(paused: boolean, choice: number, title: boolean, bindings: Readonly<KeyBindings>, training = false, hints = false): void {
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
      placeTopLeft(button, f32(f32(0.092) + MENU_STYLE.bodyInset), y);
      placeTopLeft(option, f32(f32(0.092) + MENU_STYLE.bodyInset), y);
    }
    BlzFrameSetText(this.help, `${MENU_STYLE.text}${title ? "A / Start / Click: Play" : "Stick / arrows: choose · A: select · Click: select\nStart / Y: resume · Escape: character select"}|r`);
    BlzFrameSetVisible(this.controlsTitle, !title);
    BlzFrameSetVisible(this.controls, !title);
    const [shield, special, attack, jump, up, down, strong] = [Action.leftTrigger, Action.special, Action.attack, Action.jump, Action.moveUp, Action.moveDown, Action.strong].map((action) => keyNames(bindings, action));
    const sides = `${keyNames(bindings, Action.moveLeft)}/${keyNames(bindings, Action.moveRight)}`;
    BlzFrameSetText(this.controls, MENU_STYLE.text + `${keyNames(bindings, Action.leftTrigger)}: full shield · ${keyNames(bindings, Action.lightShield)}: light shield · ${keyNames(bindings, Action.walk)}: tilt · ${keyNames(bindings, Action.shortHop)}: short hop · ${keyNames(bindings, Action.strong)}: strong\n`
      + `${shield} just before landing: tech (hold ${sides} to roll)\n`
      + `${strong} + direction: smash · ${strong} + ${special}: EX (one bar) · ${attack} + ${special}: Ultimate (full bar)\n`
      + `${shield} + ${sides}: roll · ${shield} + ${down}: dodge\n`
      + `Downed: ${attack}/${special}: strike · ${up}/${jump}/${shield}: stand · ${sides}: roll\n`
      + `Ledge: ${up}/toward: climb · ${jump}: leap · ${shield}: roll · ${attack}: strike · ${down}/away: let go`
      + (training ? `\nF2: training hints ${hints ? "On" : "Off"}` : "") + "|r");
  }
}

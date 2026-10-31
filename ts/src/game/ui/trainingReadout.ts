


import { f32 } from "wisp/src/sim/f32";
import { type TrainingState, copyTrainingState, createTrainingState } from "../match/trainingState";
import { trainingReadout } from "../session/messages";
import { tutorialOn, tutorialText } from "../match/tutorial";
import type { KeyBindings } from "../input/keyBindings";
import { createBackdrop, createText, gameUi, placeTopLeft } from "./frames";
import { MENU_FONT, PANEL_TEXTURE } from "./hudLayout";
import { TRAINING_READOUT_BOX, TRAINING_READOUT_PANEL, TRAINING_READOUT_PANEL_ALPHA } from "./hudLayout";
import { destroyFrame, Frame, setFrameAlpha, setFrameEnabled, setFrameFont, setFrameSize, setFrameText, setFrameTextAlignment, setFrameTexture, setFrameVisible, TextAlignment } from "wisp/game/frames";



export class TrainingReadout {
  private readonly panel: Frame;
  private readonly label: Frame;

  private readonly shown = createTrainingState();
  private built = false;

  private empty = true;
  private panelShown = false;

  constructor() {
    this.panel = createBackdrop("TrainingReadoutPanel", gameUi(), 892);
    setFrameTexture(this.panel, PANEL_TEXTURE, 0, true);
    setFrameAlpha(this.panel, TRAINING_READOUT_PANEL_ALPHA);
    placeTopLeft(this.panel, TRAINING_READOUT_PANEL.left, TRAINING_READOUT_PANEL.top);
    setFrameSize(this.panel, TRAINING_READOUT_PANEL.width, TRAINING_READOUT_PANEL.height);
    setFrameEnabled(this.panel, false);
    setFrameVisible(this.panel, false);
    this.label = createText("TrainingReadout", this.panel, 891);
    placeTopLeft(this.label, TRAINING_READOUT_BOX.left, TRAINING_READOUT_BOX.top);
    setFrameSize(this.label, TRAINING_READOUT_BOX.width, TRAINING_READOUT_BOX.height);
    setFrameFont(this.label, MENU_FONT, f32(0.011), 1);
    setFrameTextAlignment(this.label, TextAlignment.top, TextAlignment.left);
    setFrameEnabled(this.label, false);
  }

  destroy(): void {
    destroyFrame(this.label);
    destroyFrame(this.panel);
  }

  update(visible: boolean, state: Readonly<TrainingState>, bindings: Readonly<KeyBindings>): void {
    if (!visible) {
      this.showPanel(false);
      return;
    }
    const last = this.shown;
    if (!(this.built && last.moveStyle === state.moveStyle && last.moveSpecial === state.moveSpecial && last.moveForm === state.moveForm
      && last.moveCharacter === state.moveCharacter && last.moveStartup === state.moveStartup && last.moveActive === state.moveActive
      && last.moveTotal === state.moveTotal && last.advantageKind === state.advantageKind && last.advantage === state.advantage
      && last.comboHits === state.comboHits && last.comboDamage === state.comboDamage
      && last.lesson === state.lesson && last.lessonCount === state.lessonCount && (last.lessonCheer > 0) === (state.lessonCheer > 0))) {
      copyTrainingState(last, state);
      this.built = true;

      const text = tutorialOn(state) ? tutorialText(state, bindings) : trainingReadout(state);
      this.empty = text === "";
      setFrameText(this.label, text);
    }
    this.showPanel(!this.empty);
  }

  private showPanel(shown: boolean): void {
    if (shown === this.panelShown) return;
    this.panelShown = shown;
    setFrameVisible(this.panel, shown);
  }
}

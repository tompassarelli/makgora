




import { SELECT_LEVELS } from "./selectLevels";
import { f32 } from "wisp/src/sim/f32";
import { Action } from "../input/actions";
import { readChunks, writeChunks } from "wisp/src/platform/fileio";
import { type MatchState, humanCount } from "../lobby/lobbyState";
import { LESSONS, lessonChoiceText } from "../match/tutorial";
import { MENU_FONT } from "./hudLayout";
import { type ClickBox, createBackdrop, createText, placeTopLeft, styleMenuPanel } from "./frames";
import { TUTORIAL_BOX } from "./selectionLayout";
import type { SelectionActions } from "./selectionActions";
import { createFrame, setFrameEnabled, setFrameFont, setFrameLevel, setFrameSize, setFrameText, setFrameTextAlignment, setFrameVisible } from "wisp/game/frames";

export type TutorialButton = { kind: "tutorialOpen" } | { kind: "tutorialStep"; direction: -1 | 1 } | { kind: "tutorialStart" } | { kind: "tutorialClose" };

const SEEN_FILE = "SmashcraftTutorial.pld";
const SEEN = "seen";
export const NOT_NOW_LABEL = "Not now";
export const NOT_NOW_BOX = { x: f32(0.41), y: f32(0.315), width: f32(0.16), height: f32(0.035) } as const;

export interface TutorialMenuFrames {
  readonly root: framehandle;
  readonly lesson: framehandle;

  readonly open: framehandle;
}

function text(parent: framehandle, name: string, x: number, y: number, width: number, height: number, size: number): framehandle {
  const frame = createText(name, parent, 0);
  placeTopLeft(frame, x, y);
  setFrameSize(frame, width, height);
  setFrameFont(frame, MENU_FONT, size, 0);
  setFrameTextAlignment(frame, TEXT_JUSTIFY_MIDDLE, TEXT_JUSTIFY_CENTER);
  setFrameEnabled(frame, false);
  return frame;
}

function button(parent: framehandle, x: number, y: number, width: number, height: number, label: string, target: TutorialButton, add: (frame: framehandle, target: TutorialButton, box: ClickBox) => framehandle): framehandle {
  const frame = createFrame("ScriptDialogButton", parent, 0, 0);
  placeTopLeft(frame, x, y);
  setFrameSize(frame, width, height);
  setFrameText(frame, label);
  return add(frame, target, { x, y, width, height });
}


export function createTutorialMenu(owner: framehandle, rules: framehandle, suffix: string, add: (frame: framehandle, target: TutorialButton, box: ClickBox) => framehandle): TutorialMenuFrames {
  const root = createBackdrop(`MeleeTutorialMenu${suffix}`, owner, 0);
  styleMenuPanel(root, `MeleeTutorialPanel${suffix}`);
  placeTopLeft(root, f32(0.2), f32(0.47));
  setFrameSize(root, f32(0.4), f32(0.2));
  setFrameLevel(root, SELECT_LEVELS.tutorial);
  setFrameText(text(root, `MeleeTutorialTitle${suffix}`, f32(0.21), f32(0.46), f32(0.38), f32(0.03), f32(0.018)), "Tutorial");
  setFrameText(text(root, `MeleeTutorialBody${suffix}`, f32(0.215), f32(0.43), f32(0.37), f32(0.05), f32(0.011)),
    `New to Smashcraft? Learn the basics in ${LESSONS.length} short lessons with a training partner. Pick any lesson to play it again.`);
  button(root, f32(0.23), f32(0.37), f32(0.03), f32(0.03), "−", { kind: "tutorialStep", direction: -1 }, add);
  const lesson = text(root, `MeleeTutorialLesson${suffix}`, f32(0.26), f32(0.37), f32(0.28), f32(0.03), f32(0.012));
  button(root, f32(0.54), f32(0.37), f32(0.03), f32(0.03), "+", { kind: "tutorialStep", direction: 1 }, add);
  button(root, f32(0.23), f32(0.315), f32(0.16), f32(0.035), "Start tutorial", { kind: "tutorialStart" }, add);
  button(root, NOT_NOW_BOX.x, NOT_NOW_BOX.y, NOT_NOW_BOX.width, NOT_NOW_BOX.height, NOT_NOW_LABEL, { kind: "tutorialClose" }, add);
  setFrameVisible(root, false);
  const open = button(rules, TUTORIAL_BOX.x, TUTORIAL_BOX.y, TUTORIAL_BOX.width, TUTORIAL_BOX.height, "Tutorial", { kind: "tutorialOpen" }, add);
  return { root, lesson, open };
}

export function tutorialKeyButton(action: Action): TutorialButton | undefined {
  if (action === Action.attack) return { kind: "tutorialStart" };
  if (action === Action.special) return { kind: "tutorialClose" };
  if (action === Action.moveLeft || action === Action.moveRight) return { kind: "tutorialStep", direction: action === Action.moveLeft ? -1 : 1 };
  return undefined;
}

// Whether the prompt is still open after the button.
export function pressTutorialButton(button: TutorialButton, actions: SelectionActions, participantId: number, markSeen: () => void): boolean {
  if (button.kind === "tutorialOpen") return true;
  if (button.kind === "tutorialStep") {
    actions.stepTutorial(participantId, button.direction);
    return true;
  }
  markSeen();
  if (button.kind === "tutorialStart") actions.startTutorial(participantId);
  else actions.closeTutorial(participantId);
  return false;
}

export function showTutorialLesson(frames: TutorialMenuFrames, lesson: number): void {
  setFrameText(frames.lesson, lessonChoiceText(lesson));
}


export function tutorialSeen(): boolean {
  return readChunks(SEEN_FILE).join("") === SEEN;
}


export function markTutorialSeen(): void {
  writeChunks(SEEN_FILE, [SEEN]);
}


export const tutorialAvailable = (game: Readonly<MatchState>): boolean => humanCount(game) > 0;

/** Whether a first-time player is offered the tutorial on opening character select; the standalone session turns it off to open at a clean menu. */
export const tutorialOffers = { enabled: true };

export const offersTutorial = (game: Readonly<MatchState>, seen: boolean): boolean => tutorialOffers.enabled && !seen && tutorialAvailable(game);

export const TUTORIAL_OFFER = "tutorial-offer";

// Keys answer an open prompt on every client, and only this client knows its seen file, so the prompt opens through a sync event.
export function offerTutorial(game: Readonly<MatchState>, seen: boolean): void {
  if (offersTutorial(game, seen)) BlzSendSyncData(TUTORIAL_OFFER, "1");
}

export const acceptsTutorialOffer = (open: boolean, choosing: Readonly<MatchState> | undefined): boolean => open || choosing !== undefined;

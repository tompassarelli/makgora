




import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS, type Slots, participantActive } from "../input/participants";
import { Action } from "../input/actions";
import { type KeyBindings, keyNames } from "../input/keyBindings";
import { GroundAction, SpecialAction } from "../sim/codes";
import { traitMove } from "../sim/identityTraits";
import { ultimateCharged } from "../sim/meter";
import { ORB_INTERVAL_FRAMES } from "../sim/orbs";
import type { MatchOrbs } from "../sim/orbState";
import { spawnOrb } from "./orbs";
import { type Roster, fighterAt, isContender } from "../sim/roster";
import { PartnerBehaviour, PartnerEscape, PartnerTech, type TrainingState } from "./trainingState";
import {
  MATCH_TICKS_PER_SECOND, type MatchState, Phase, characterFor, computerActive, cycleSlotMode, firstHumanSlot, humanCount, humanFighterActive, humanPresent, requestStageSelect, selectCharacter, selectCpuCharacter, selectStage,
  setTraining, setTutorialLesson, setUltimatesOn,
} from "../lobby/lobbyState";


export const LessonAction = { dash: 0, doubleJump: 1, hit: 2, special: 3, dodge: 4, throw: 5, ledge: 6, knockout: 7, orb: 8, ultimate: 9 } as const;
export type LessonAction = (typeof LessonAction)[keyof typeof LessonAction];

export interface Lesson {
  readonly name: string;
  readonly instruction: (key: (action: Action) => string) => string;

  readonly counted: string;
  readonly action: LessonAction;
  readonly goal: number;

  readonly partnerDamage: number;
}

const SPECIAL_SLOTS = ["neutral", "side", "up", "down"] as const;

const ORB_SECONDS = floorDiv(ORB_INTERVAL_FRAMES, MATCH_TICKS_PER_SECOND);

const ULTIMATE_LANDING_FRAMES = 4 * MATCH_TICKS_PER_SECOND;

export const LESSONS: readonly Lesson[] = [
  { name: "Move and dash", instruction: key => `Push left or right (${key(Action.moveLeft)} or ${key(Action.moveRight)}) to walk. Tap it quickly to dash.`, counted: "Dashes", action: LessonAction.dash, goal: 3, partnerDamage: 0 },
  { name: "Jump and double jump", instruction: key => `Press jump (${key(Action.jump)}), then press it again in the air to jump a second time. ${key(Action.shortHop)}, or LB in the tom pad layout, always short hops, even held.`, counted: "Double jumps", action: LessonAction.doubleJump, goal: 3, partnerDamage: 0 },
  { name: "Attacks", instruction: key => `Walk up to your partner and press attack (${key(Action.attack)}). Hold a direction to change the attack; hold strong (${key(Action.strong)}) as well for a smash.`, counted: "Hits", action: LessonAction.hit, goal: 5, partnerDamage: 0 },
  { name: "Specials", instruction: key => `Every fighter has four specials, and they are free. Press special (${key(Action.special)}) alone for the neutral special, or with ${key(Action.moveLeft)} or ${key(Action.moveRight)} for the side special, ${key(Action.moveUp)} for the up special and ${key(Action.moveDown)} for the down special. Try all four.`, counted: "Specials tried", action: LessonAction.special, goal: SPECIAL_SLOTS.length, partnerDamage: 0 },
  { name: "Ultimate orbs", instruction: () => `The thin bar under your damage is your ultimate meter. By default it fills on the match clock, one full bar every 60 seconds; with the Orbs rule on, only orbs fill it, one appearing above centre stage every ${ORB_SECONDS} seconds. Here an orb hangs there now, and each fills half the bar. Touch the orb, or hit it with a normal attack, to take it. Specials, air dodges and ultimates pass through it. Take two.`, counted: "Orbs collected", action: LessonAction.orb, goal: 2, partnerDamage: 0 },
  { name: "Ultimate", instruction: key => `With a full meter your fighter glows gold. Hold attack (${key(Action.attack)}) and press special (${key(Action.special)}) to fire your ultimate, and hit your partner with it. Take orbs until the bar is full.`, counted: "Ultimates landed", action: LessonAction.ultimate, goal: 1, partnerDamage: 0 },
  { name: "Shield and dodge", instruction: key => `${key(Action.leftTrigger)}: full shield; ${key(Action.lightShield)}: light shield. ${key(Action.leftTrigger)} + ${key(Action.moveLeft)} or ${key(Action.moveRight)} rolls; ${key(Action.leftTrigger)} + ${key(Action.moveDown)} dodges. Tap ${key(Action.leftTrigger)} before landing to tech; hold ${key(Action.moveLeft)} or ${key(Action.moveRight)} to tech roll.`, counted: "Dodges", action: LessonAction.dodge, goal: 3, partnerDamage: 0 },
  { name: "Grab and throw", instruction: key => `Stand next to your partner and press grab (${key(Action.grab)}). Then push a direction to throw.`, counted: "Throws", action: LessonAction.throw, goal: 2, partnerDamage: 0 },
  { name: "Get back to the ledge", instruction: key => `Jump off, then double jump (${key(Action.jump)}) and up special (${key(Action.moveUp)} + ${key(Action.special)}) to the ledge. ${key(Action.moveUp)} or toward the stage climbs; ${key(Action.jump)} leaps; ${key(Action.leftTrigger)} rolls; ${key(Action.attack)} strikes; ${key(Action.moveDown)} or away lets go.`, counted: "Ledge grabs", action: LessonAction.ledge, goal: 2, partnerDamage: 0 },
  { name: "Knock out your partner", instruction: () => "Your partner is badly hurt. Hit it hard to knock it off the screen.", counted: "Knockouts", action: LessonAction.knockout, goal: 1, partnerDamage: 150 },
];


export const NO_LESSON = -1;

export const LESSON_CHEER_FRAMES = 120;

export const tutorialOn = (state: Readonly<TrainingState>): boolean => state.lesson !== NO_LESSON;

export const tutorialFinished = (state: Readonly<TrainingState>): boolean => state.lesson >= LESSONS.length;

export function leaveTutorial(game: MatchState): void {
  if (!tutorialFinished(game.trainer) && !(tutorialOn(game.trainer) && humanCount(game) > 1)) return;
  game.trainer.lesson = NO_LESSON;
  game.training = false;
}


export function beginLesson(state: TrainingState, world: Roster, playerMask: number, computerMask: number, lesson: number): void {
  state.lesson = lesson;
  state.lessonCount = 0;
  state.lessonCheer = 0;
  state.lessonMoves = 0;
  state.lessonWindow = 0;
  state.behaviour = PartnerBehaviour.stand;
  state.escape = PartnerEscape.none;
  state.tech = PartnerTech.none;
  const info = LESSONS[lesson];
  if (info === undefined) return;
  state.damage = info.partnerDamage;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isContender(world, slot)) continue;
    const f = fighterAt(world, slot);
    if (participantActive(computerMask, slot)) f.status.damage = f32(info.partnerDamage);
  }
}


const beforeGround: Slots<number> = [0, 0, 0, 0];
const beforeJump: Slots<number> = [0, 0, 0, 0];
const beforeHit: Slots<number> = [0, 0, 0, 0];
const beforeSpecial: Slots<number> = [0, 0, 0, 0];
const beforeGroundDodge: Slots<number> = [0, 0, 0, 0];
const beforeAirDodge: Slots<boolean> = [false, false, false, false];
const beforeThrow: Slots<number> = [0, 0, 0, 0];
const beforeLedge: Slots<number> = [0, 0, 0, 0];
const beforeOut: Slots<boolean> = [false, false, false, false];
let beforePickup = 0;

export function captureTutorialBefore(world: Roster, orbs: Readonly<MatchOrbs>): void {
  beforePickup = orbs.pickupSerial;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isContender(world, slot)) continue;
    const f = fighterAt(world, slot);
    beforeGround[slot] = f.ground.action;
    beforeJump[slot] = f.jump.serial;
    beforeHit[slot] = f.visuals.hit;
    beforeSpecial[slot] = f.special.action;
    beforeGroundDodge[slot] = f.dodge.groundFrame;
    beforeAirDodge[slot] = f.dodge.airDodging;
    beforeThrow[slot] = f.visuals.throw;
    beforeLedge[slot] = f.ledge.serial;
    beforeOut[slot] = f.status.out;
  }
}


function playersOtherwiseAttacking(world: Roster, playerMask: number): boolean {
  return PARTICIPANT_SLOTS.some(slot => {
    if (!isContender(world, slot) || !participantActive(playerMask, slot)) return false;
    const f = fighterAt(world, slot);
    return f.attack.style !== undefined || (f.special.action !== SpecialAction.none && f.special.action !== SpecialAction.heroUltimate);
  });
}

function newSpecial(state: TrainingState, special: SpecialAction): number {
  const move = traitMove(special);
  const bit = 1 << SPECIAL_SLOTS.findIndex(slot => slot === move);
  if (bit < 1 || (state.lessonMoves & bit) !== 0) return 0;
  state.lessonMoves |= bit;
  return 1;
}

function countAction(state: TrainingState, action: LessonAction, world: Roster, playerMask: number, computerMask: number, orbs: Readonly<MatchOrbs>): number {
  let count = action === LessonAction.orb && orbs.pickupSerial !== beforePickup && orbs.lastTaker >= 0 && participantActive(playerMask, orbs.lastTaker) ? 1 : 0;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isContender(world, slot)) continue;
    const f = fighterAt(world, slot);
    const player = participantActive(playerMask, slot);
    const partner = participantActive(computerMask === 0 ? playerMask : computerMask, slot);
    const attacker = f.hits.lastAttacker;
    const byPlayer = attacker !== undefined && attacker !== slot && participantActive(playerMask, attacker);
    const started = f.special.action !== SpecialAction.none && beforeSpecial[slot] === SpecialAction.none;
    if (player && action === LessonAction.dash && f.ground.action === GroundAction.dash && beforeGround[slot] !== GroundAction.dash) count++;
    else if (player && action === LessonAction.doubleJump && f.jump.serial !== beforeJump[slot] && f.jump.isDouble) count++;
    else if (player && action === LessonAction.special && started) count += newSpecial(state, f.special.action);
    else if (player && action === LessonAction.ultimate && started && f.special.action === SpecialAction.heroUltimate) state.lessonWindow = ULTIMATE_LANDING_FRAMES;
    else if (partner && action === LessonAction.ultimate && f.visuals.hit !== beforeHit[slot] && state.lessonWindow > 0 && !playersOtherwiseAttacking(world, playerMask)) count++;
    else if (player && action === LessonAction.dodge && ((f.dodge.groundFrame > 0 && beforeGroundDodge[slot] === 0) || (f.dodge.airDodging && !beforeAirDodge[slot]))) count++;
    else if (player && action === LessonAction.ledge && f.ledge.serial !== beforeLedge[slot]) count++;
    else if (partner && byPlayer && action === LessonAction.hit && f.visuals.hit !== beforeHit[slot]) count++;
    else if (partner && byPlayer && action === LessonAction.throw && f.visuals.throw !== beforeThrow[slot]) count++;
    else if (partner && action === LessonAction.knockout && f.status.out && !beforeOut[slot]) count++;
  }
  return count;
}


function wantsOrb(lesson: Readonly<Lesson>, world: Roster, playerMask: number): boolean {
  if (lesson.action === LessonAction.orb) return true;
  if (lesson.action !== LessonAction.ultimate) return false;
  return PARTICIPANT_SLOTS.some(slot => isContender(world, slot) && participantActive(playerMask, slot) && !ultimateCharged(fighterAt(world, slot)) && fighterAt(world, slot).special.action !== SpecialAction.heroUltimate);
}


export function advanceTutorial(state: TrainingState, world: Roster, playerMask: number, computerMask: number, orbs: MatchOrbs): void {
  if (state.lessonCheer > 0) {
    state.lessonCheer--;
    if (state.lessonCheer === 0) beginLesson(state, world, playerMask, computerMask, state.lesson + 1);
    return;
  }
  const lesson = LESSONS[state.lesson];
  if (lesson === undefined) return;
  state.lessonCount = Math.min(lesson.goal, state.lessonCount + countAction(state, lesson.action, world, playerMask, computerMask, orbs));
  if (state.lessonCount >= lesson.goal) state.lessonCheer = LESSON_CHEER_FRAMES;
  if (state.lessonWindow > 0) state.lessonWindow--;
  if (state.lessonCount < lesson.goal && !orbs.live && wantsOrb(lesson, world, playerMask)) spawnOrb(orbs);
}


export function tutorialText(state: Readonly<TrainingState>, bindings: Readonly<KeyBindings>): string {
  if (tutorialFinished(state)) return "Tutorial complete!\nYou know the basics. Pause and press Escape to go back to fighter selection.";
  const lesson = LESSONS[state.lesson];
  if (lesson === undefined) return "";
  const heading = `Lesson ${state.lesson + 1} of ${LESSONS.length}: ${lesson.name}`;
  if (state.lessonCheer > 0) return `${heading}\nWell done!${state.lesson + 1 < LESSONS.length ? " Next lesson coming up." : ""}`;
  return `${heading}\n${lesson.instruction(action => keyNames(bindings, action))}\n${lesson.counted}: ${state.lessonCount} / ${lesson.goal}`;
}


export const lessonChoiceText = (lesson: number): string => {
  const info = LESSONS[lesson < 0 ? 0 : lesson];
  return info === undefined ? "" : `${(lesson < 0 ? 0 : lesson) + 1}. ${info.name}`;
};


export const TUTORIAL_STAGE = 0;








function addTutorialPartner(game: MatchState, first: number): void {
  if (!PARTICIPANT_SLOTS.some(other => computerActive(game, other))) {
    const partner = PARTICIPANT_SLOTS.find(other => !humanFighterActive(game, other) && !computerActive(game, other));

    if (partner !== undefined) for (let step = 0; step < 2; step++) cycleSlotMode(game, first, partner);
  }
  if (humanCount(game) > 1) for (const other of PARTICIPANT_SLOTS) if (computerActive(game, other) && !game.characterReadiness[other]) selectCpuCharacter(game, first, other, characterFor(game, other) ?? game.characterChoices[other]);
}


export function prepareTutorial(game: MatchState, slot: number): boolean {
  const first = firstHumanSlot(game);
  if (first === undefined || game.phase !== Phase.characterMenu || !humanPresent(game, slot)) return false;
  addTutorialPartner(game, first);
  setTraining(game, slot, true);
  setUltimatesOn(game, slot, true);
  setTutorialLesson(game, slot, game.trainer.lesson < 0 || game.trainer.lesson >= LESSONS.length ? 0 : game.trainer.lesson, LESSONS.length);
  for (const other of PARTICIPANT_SLOTS) if (humanFighterActive(game, other) && humanPresent(game, other)) selectCharacter(game, other, characterFor(game, other) ?? game.characterChoices[other]);
  if (!requestStageSelect(game, slot)) return false;
  selectStage(game, slot, TUTORIAL_STAGE);
  return true;
}


export function stepTutorialLesson(game: MatchState, slot: number, direction: number): void {
  const current = game.trainer.lesson < 0 || game.trainer.lesson >= LESSONS.length ? 0 : game.trainer.lesson;
  setTutorialLesson(game, slot, floorMod(current + direction, LESSONS.length), LESSONS.length);
}

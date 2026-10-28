import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../input/actions";
import { type RowFields, inputRow } from "../input/inputRow";
import { Phase, setParticipants } from "../lobby/lobbyState";
import { copyFighterState } from "../../generated/state/fighterState";
import { type ReplayState, createReplaySnapshot } from "../replay/snapshot";
import { SELECTABLE_CHARACTERS } from "../roster/kits";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { exCharged, ultimateCharged } from "../sim/meter";
import { fighterAt } from "../sim/roster";
import { adaptInput } from "./inputAdapter";
import { LESSONS, LessonAction } from "./tutorial";
import { stepMatch } from "./step";

const A = maskOf(Action.attack), S = maskOf(Action.special), Y = maskOf(Action.strong);
const SETTLE = 90;

const lessonOf = (action: LessonAction): number => LESSONS.findIndex(lesson => lesson.action === action);

interface Lesson { readonly state: ReplayState; tick: number }

function lesson(action: LessonAction, character: Character, gap: number): Lesson {
  const state = createReplaySnapshot();
  copyFighterState(fighterAt(state.world, 0), createFighter(character, 0.0, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.peon, f32(gap), -1), 3);
  const { match } = state;
  setParticipants(match, 1, 2);
  match.phase = Phase.match;
  match.stageChoice = 0;
  match.hazards = false;
  match.items.on = false;
  match.orbs.on = false;
  match.timeLimitMinutes = 0;
  match.startHold = 0;
  match.training = true;
  match.trainer.lesson = lessonOf(action);
  return { state, tick: 0 };
}

function play(l: Lesson, rows: readonly RowFields[]): void {
  for (const fields of rows) {
    l.tick++;
    const row = inputRow(fields);
    if (row === undefined) throw new Error("tutorial row");
    adaptInput(row, fighterAt(l.state.world, 0), l.tick, l.state.controls.inputs[0], l.state.controls.commands[0]);
    stepMatch(l.state.match, l.state.world, l.state.controls, l.tick);
  }
}
const idle = (frames: number): RowFields[] => Array.from({ length: frames }, () => ({}));
const special = (held: number, aim: RowFields = {}): RowFields[] => [{ held, pressed: held, ...aim }, ...idle(SETTLE)];
const ULTIMATE: readonly RowFields[] = [{ held: A, pressed: A }, { held: A | S, pressed: S }];

test("the Specials lesson counts each of the four specials once, neutral, side, up and down, and not an EX special [k1 scenario]", () => {
  const l = lesson(LessonAction.special, Character.rifleman, 900);
  play(l, idle(5));
  play(l, special(S));
  play(l, special(S));
  assertEquals(l.state.match.trainer.lessonCount, 1);
  play(l, special(Y | S));
  assertEquals(l.state.match.trainer.lessonCount, 1);
  play(l, special(S, { specialX: 1 }));
  play(l, special(S, { specialZ: 1 }));
  play(l, idle(SETTLE));
  play(l, special(S, { specialZ: -1 }));
  assertEquals(l.state.match.trainer.lessonCount, 4);
  assertTrue(l.state.match.trainer.lessonCheer > 0);
});

test("the EX specials lesson starts with a full EX charge and counts Strong + special, never a plain special [k1 scenario]", () => {
  const l = lesson(LessonAction.exSpecial, Character.rifleman, 900);
  play(l, idle(2));
  assertTrue(exCharged(fighterAt(l.state.world, 0)));
  play(l, special(S));
  assertEquals(l.state.match.trainer.lessonCount, 0);
  play(l, special(Y | S));
  assertEquals(l.state.match.trainer.lessonCount, 1);
});

test("the Ultimate lesson fills the meter, refills it after a miss, and passes on an ultimate that hits the partner, during the cast or from a summon after it [k1 scenario]", () => {
  const away = lesson(LessonAction.ultimate, Character.rifleman, 3000);
  play(away, idle(2));
  assertTrue(ultimateCharged(fighterAt(away.state.world, 0)));
  play(away, [...ULTIMATE, ...idle(300)]);
  assertEquals(away.state.match.trainer.lessonCount, 0);
  assertTrue(ultimateCharged(fighterAt(away.state.world, 0)));
  for (const character of [Character.rifleman, Character.dreadlord, Character.chen]) {
    const near = lesson(LessonAction.ultimate, character, 250);
    play(near, [...idle(2), ...ULTIMATE]);
    for (let frame = 0; frame < 200 && near.state.match.trainer.lessonCheer === 0; frame++) play(near, idle(1));
    assertEquals(near.state.match.trainer.lessonCount, 1);
  }
});

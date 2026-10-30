import { f32 } from "wisp/src/sim/f32";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../../input/actions";
import { attackBuffer, queueAttack } from "../../input/attackBuffer";
import { type RowFields, inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { adaptInput } from "../../match/inputAdapter";
import { WORDS_PER_FRAME, packFrame, unpackFrame } from "../../match/partnerDrive";
import { initializeMatchFighters, stepMatch } from "../../match/step";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { AttackStyle, Character } from "../../sim/codes";
import { createFighter } from "../../sim/fighter";
import { CONTROL_FIELDS, type Controls, createRoster, fighterAt, neutralControls, sameControls } from "../../sim/roster";

const LEADER = 0;
const FOE = 1;
const PARTNER = 2;
const FLAT_STAGE = 0;
const COPY_DELAY = 5;

const A = maskOf(Action.attack), G = maskOf(Action.grab), J = maskOf(Action.jump), R = maskOf(Action.moveRight);
const SHIELD = maskOf(Action.leftTrigger);

const idle = (frames: number): RowFields[] => Array.from({ length: frames }, () => ({}));
const press = (held: number, fields: RowFields = {}): RowFields => ({ held, pressed: held, ...fields });
const hold = (frames: number, held: number, fields: RowFields = {}): RowFields[] =>
  Array.from({ length: frames }, (_, index) => ({ held, pressed: index === 0 ? held : 0, ...fields }));

function duel(foeX: number): ReplayState {
  const state = createReplaySnapshot();
  const world = createRoster(3, [createFighter(Character.murloc, 0.0, 1), createFighter(Character.peon, foeX, -1)]);
  const match = state.match;
  match.phase = Phase.match;
  match.stageChoice = FLAT_STAGE;
  match.startHold = 0;
  match.hazards = false;
  match.items.on = false;
  match.timeLimitMinutes = 0;
  match.ultimatesOff = true;
  initializeMatchFighters(match, world);
  return { ...state, world };
}

function step(state: ReplayState, fields: RowFields, tick: number): void {
  const row = inputRow(fields);
  if (row === undefined) throw new Error("duoCopy row");
  adaptInput(row, fighterAt(state.world, LEADER), tick, state.controls.inputs[LEADER], state.controls.commands[LEADER]);
  stepMatch(state.match, state.world, state.controls, tick);
}

interface Actions { readonly serial: number; readonly squat: number; readonly dash: number; readonly shield: boolean; readonly grounded: boolean }

function actionsOf(state: ReplayState, slot: number): Actions {
  const f = fighterAt(state.world, slot);
  return { serial: f.attack.serial, squat: f.jump.squat, dash: f.ground.dashFrame, shield: f.shield.raised, grounded: f.motion.grounded };
}

const sameActions = (a: Actions, b: Actions): boolean =>
  a.serial === b.serial && a.squat === b.squat && a.dash === b.dash && a.shield === b.shield && a.grounded === b.grounded;

function firstChange(trace: readonly Actions[], differs: (a: Actions, b: Actions) => boolean): number {
  for (let tick = 1; tick < trace.length; tick++) {
    const before = trace[tick - 1];
    const after = trace[tick];
    if (before !== undefined && after !== undefined && differs(before, after)) return tick;
  }
  return -1;
}

test("A scripted jab, jump, dash and shield by Mrgl reaches Grgl exactly five frames later [k3 measure docs/design/murloc.md]", () => {
  const rows = [...idle(20), press(A), ...idle(40), press(J), ...idle(70), ...hold(8, R, { axisX: 127 }), ...idle(40), ...hold(20, SHIELD, { triggerLeft: 255 }), ...idle(20)];
  const state = duel(900.0);
  const leader: Actions[] = [];
  const partner: Actions[] = [];
  rows.forEach((fields, index) => {
    step(state, fields, index + 1);
    leader.push(actionsOf(state, LEADER));
    partner.push(actionsOf(state, PARTNER));
  });
  const moments: readonly ((a: Actions, b: Actions) => boolean)[] = [
    (a, b) => b.serial !== a.serial,
    (a, b) => b.squat > 0 && a.squat === 0,
    (a, b) => b.dash > 0 && a.dash === 0,
    (a, b) => b.shield && !a.shield,
  ];
  for (const moment of moments) {
    const led = firstChange(leader, moment);
    assertTrue(led > 0);
    assertEquals(firstChange(partner, moment), led + COPY_DELAY, "Grgl repeats the action five frames after Mrgl");
  }
  for (let tick = 0; tick + COPY_DELAY < rows.length; tick++) {
    const mine = leader[tick];
    const copy = partner[tick + COPY_DELAY];
    assertTrue(mine !== undefined && copy !== undefined && sameActions(mine, copy));
  }
});

function everyField(): Controls {
  const c = neutralControls();
  c.direction = -1;
  c.verticalDirection = 1;
  c.driftStickX = f32(-64 / 127);
  c.diStickValid = true;
  c.diStickX = f32(-64 / 127);
  c.diStickZ = 1.0;
  c.sdiPulse = true;
  c.sdiX = 1;
  c.sdiZ = -1;
  c.cStickX = -1;
  c.cStickZ = 1;
  c.specialPressed = true;
  c.ultimatePressed = true;
  c.specialX = -1;
  c.specialZ = 1;
  c.down = true;
  c.shield = true;
  c.shieldPressed = true;
  c.shieldTriggerActive = true;
  c.shieldStrength = f32(40 / 127);
  c.jumpPressed = true;
  c.shortHopPressed = true;
  c.airDodgePressed = true;
  c.techPressed = true;
  c.mashPressed = true;
  c.attackPressed = true;
  c.grabMashPressed = true;
  c.grabThrowX = -1;
  c.grabThrowZ = 1;
  c.groundDodgePressed = true;
  c.groundDodgeDirection = -1;
  c.getupAttackPressed = true;
  c.ledgeVerticalPressed = -1;
  c.getupStandPressed = true;
  c.getupDirectionPressed = true;
  c.getupDirection = 1;
  c.cStickUpFlick = true;
  c.cStickSideFlick = -1;
  c.dodgeX = 1;
  c.dodgeZ = -1;
  c.jumpHeld = true;
  c.walking = true;
  c.attackHeld = true;
  c.specialHeld = true;
  return c;
}

test("Pack and unpack round-trip every field Grgl reads and the command it copies [k3 measure docs/design/murloc.md]", () => {
  const ring: number[] = Array.from({ length: WORDS_PER_FRAME * 2 }, () => 0);
  const sent = everyField();
  const sentCommands = attackBuffer(0);
  queueAttack(sentCommands, { style: AttackStyle.upTilt, facing: -1, frame: 7, mayCharge: true, cStick: true });
  packFrame(ring, WORDS_PER_FRAME, sent, sentCommands, 7);
  const received = neutralControls();
  const receivedCommands = attackBuffer(6);
  unpackFrame(ring, WORDS_PER_FRAME, received, receivedCommands, 12);
  for (const field of CONTROL_FIELDS) {
    if (field === "attackRequested" || field === "resetPressed") assertEquals(received[field], false, field);
    else assertEquals(received[field], sent[field], field);
  }
  const command = receivedCommands.pending;
  assertTrue(command !== undefined);
  assertEquals(command?.style, AttackStyle.upTilt, "style");
  assertEquals(command?.facing, -1, "facing");
  assertEquals(command?.mayCharge, true, "mayCharge");
  assertEquals(command?.cStick, true, "cStick");
  assertEquals(command?.frame, 12, "the copy is stamped with the frame it is read on");
  const empty = neutralControls();
  unpackFrame([0, 0, 0, 0], 0, empty, attackBuffer(6), 3);
  assertTrue(sameControls(empty, neutralControls()));
  const analog = neutralControls();
  analog.diStickX = 0.5;
  packFrame(ring, 0, analog, attackBuffer(0), 1);
  unpackFrame(ring, 0, received, receivedCommands, 2);
  assertEquals(received.diStickX, f32(64 / 127), "real stick values land on steps of 1/127");
  assertEquals(received.driftStickX, undefined, "an undefined drift stick stays undefined");
});

test("Grgl stands neutral through Mrgl's grab hold, and the pummels do not reach him afterward [k3 measure docs/design/murloc.md]", () => {
  const state = duel(40.0);
  let tick = 0;
  const next = (fields: RowFields): void => step(state, fields, ++tick);
  for (const fields of idle(10)) next(fields);
  next(press(G));
  let held = 0;
  while (fighterAt(state.world, LEADER).grab.target === undefined && held++ < 40) next({});
  assertTrue(fighterAt(state.world, LEADER).grab.target !== undefined);
  const serial = fighterAt(state.world, PARTNER).attack.serial;
  const neutral = neutralControls();
  for (let frame = 0; frame < 12; frame++) {
    next(press(A));
    assertTrue(fighterAt(state.world, LEADER).grab.target !== undefined);
    assertTrue(sameControls(state.controls.inputs[PARTNER], neutral));
    assertEquals(fighterAt(state.world, PARTNER).attack.serial, serial, "Grgl starts no move while Mrgl holds");
  }
  next(press(R, { axisX: 127 }));
  for (let frame = 0; fighterAt(state.world, LEADER).grab.target !== undefined && frame < 90; frame++) {
    assertTrue(sameControls(state.controls.inputs[PARTNER], neutral));
    next({});
  }
  assertEquals(fighterAt(state.world, LEADER).grab.target, undefined, "the throw has let go");
  for (let frame = 0; frame < COPY_DELAY + 1; frame++) {
    next({});
    const copied = state.controls.inputs[PARTNER];
    assertTrue(!copied.attackPressed && !copied.mashPressed && !copied.jumpPressed && !copied.specialPressed);
    assertEquals(fighterAt(state.world, PARTNER).attack.serial, serial, "no pummel is replayed after the throw");
  }
});

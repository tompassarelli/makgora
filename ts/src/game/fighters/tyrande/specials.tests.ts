import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, ProjectileKind } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { fighterAt } from "../../sim/roster";
import { EMPOWERED_SHOTS, MOON_ARROW_MODEL, SEARING_ARROW_MODEL } from "./specials";
import { fighterEmpoweredAura, empoweredAuraScale } from "../../presentation/empoweredAuraLook";
import { captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "../../presentation/impactEvents";

type Press = "arrow" | "aura" | "grace" | "none";
type Script = (tick: number) => readonly [Press, Press];

interface Duel {
  readonly state: ReplayState;
  readonly tyrande: Fighter;
  readonly foe: Fighter;
  tick: number;
}

const ROWS: Readonly<Record<Press, Parameters<typeof inputRow>[0]>> = {
  arrow: { held: maskOf(Action.special), pressed: maskOf(Action.special) },
  aura: { held: maskOf(Action.moveRight, Action.special), pressed: maskOf(Action.special), axisX: 127, specialX: 1 },
  grace: { held: maskOf(Action.moveDown, Action.special), pressed: maskOf(Action.special), axisZ: -127, specialZ: -1 },
  none: {},
};

function duel(foe: Character, foeAhead: number): Duel {
  const state = createReplaySnapshot();
  const tyrande = fighterAt(state.world, 0);
  const other = fighterAt(state.world, 1);
  copyFighterState(tyrande, createFighter(Character.tyrande, 0.0, 1), 3);
  copyFighterState(other, createFighter(foe, foeAhead, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 1;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, tyrande, foe: other, tick: 0 };
}

function step(d: Duel, [own, other]: readonly [Press, Press]): void {
  d.tick++;
  const first = inputRow(ROWS[own]);
  const second = inputRow(ROWS[other]);
  if (first === undefined || second === undefined) throw new Error("Tyrande input row");
  adaptInput(first, d.tyrande, d.tick, d.state.controls.inputs[0], d.state.controls.commands[0]);
  adaptInput(second, d.foe, d.tick, d.state.controls.inputs[1], d.state.controls.commands[1]);
  stepMatch(d.state.match, d.state.world, d.state.controls, d.tick);
}

const liveArrow = (f: Readonly<Fighter>) => f.projectiles.find((projectile) => projectile.life > 0 && projectile.kind === ProjectileKind.hero);

const VOLLEY_END = 260;
const VOLLEY_SHOTS = [40, 80, 120, 160, 200] as const;
const volleyScript: Script = (tick) => [tick === 3 ? "aura" : (VOLLEY_SHOTS as readonly number[]).includes(tick) ? "arrow" : "none", "none"];

function replayFrom(foe: Character, foeAhead: number, script: Script, end: number, saveTick: number): { readonly expected: string; readonly replayed: string } {
  const run = duel(foe, foeAhead);
  const snapshot = createReplaySnapshot();
  for (let tick = 1; tick <= end; tick++) {
    if (tick === saveTick) copyReplayState(snapshot, run.state);
    step(run, script(tick));
  }
  const expected = canonicalState(run.state);
  copyReplayState(run.state, snapshot);
  run.tick = saveTick - 1;
  for (let tick = saveTick; tick <= end; tick++) step(run, script(tick));
  return { expected, replayed: canonicalState(run.state) };
}

test("Trueshot Aura turns her next three Searing Arrows into moonlit arrows that deal 6% and fly on through the foe, then her arrows deal 3% again [k3 measure docs/design/tyrande.md]", () => {
  const d = duel(Character.medivh, 160.0);
  const dealt: number[] = [];
  const models: string[] = [];
  let lastModel = "";
  let pierced = 0;
  let held = 0;
  for (let tick = 1; tick <= VOLLEY_END; tick++) {
    const before = d.foe.status.damage;
    lastModel = liveArrow(d.tyrande)?.spec?.model ?? lastModel;
    step(d, volleyScript(tick));
    held = Math.max(held, d.tyrande.special.empoweredShots);
    const arrow = liveArrow(d.tyrande);
    if (d.foe.status.damage > before) {
      dealt.push(Math.round((d.foe.status.damage - before) * 10) / 10);
      models.push(lastModel);
      if (arrow?.lastStruck === 1) pierced++;
    }
  }
  assertEquals(held, EMPOWERED_SHOTS);
  const expected = [6.0, 6.0, 6.0, 3.0, 3.0];
  assertEquals(dealt.length, expected.length);
  for (let index = 0; index < expected.length; index++) assertEquals(dealt[index], expected[index]);
  assertEquals(pierced, 3);
  assertEquals(models.join(","), [MOON_ARROW_MODEL, MOON_ARROW_MODEL, MOON_ARROW_MODEL, SEARING_ARROW_MODEL, SEARING_ARROW_MODEL].join(","));
  assertEquals(d.tyrande.special.empoweredShots, 0);
  assertEquals(d.tyrande.special.empoweredFrames, 0);
});

test("Empowered arrows lapse 300 frames after Trueshot Aura when she fires none [k3 measure docs/design/tyrande.md]", () => {
  const d = duel(Character.medivh, 160.0);
  let lapsed = 0;
  for (let tick = 1; tick <= 360; tick++) {
    step(d, [tick === 3 ? "aura" : "none", "none"]);
    if (lapsed === 0 && tick > 20 && d.tyrande.special.empoweredShots === 0) lapsed = tick;
  }
  assertGreaterThan(lapsed, 300);
  assertTrue(lapsed < 330);
});

function graceTick(): number {
  const d = duel(Character.sylvanas, 260.0);
  for (let tick = 1; tick <= 60; tick++) {
    const arrow = liveArrow(d.foe);
    if (arrow !== undefined && arrow.x - d.tyrande.motion.x < 150.0) return tick;
    step(d, ["none", tick === 3 ? "arrow" : "none"]);
  }
  return 60;
}

test("Elune's Grace turns Sylvanas's Black Arrow back into her while Tyrande takes nothing [k3 measure docs/design/tyrande.md]", () => {
  const press = graceTick();
  const d = duel(Character.sylvanas, 260.0);
  for (let tick = 1; tick <= 90; tick++) step(d, [tick === press ? "grace" : "none", tick === 3 ? "arrow" : "none"]);
  assertEquals(d.tyrande.status.damage, 0.0);
  assertGreaterThan(d.foe.status.damage, 0.0);
  const unguarded = duel(Character.sylvanas, 260.0);
  for (let tick = 1; tick <= 90; tick++) step(unguarded, ["none", tick === 3 ? "arrow" : "none"]);
  assertGreaterThan(unguarded.tyrande.status.damage, 0.0);
  assertEquals(unguarded.foe.status.damage, 0.0);
});

test("A rollback replays Trueshot Aura through three moonlit arrows and their lapse to the live checksum [k1 scenario]", () => {
  for (const save of [2, 10, 45, 85, 125, 170, 230]) {
    const replay = replayFrom(Character.medivh, 160.0, volleyScript, VOLLEY_END, save);
    assertEquals(replay.replayed, replay.expected);
  }
});

test("Her Trueshot ring is drawn exactly while empowered arrows remain, shrinks with each arrow and is gone once the last is spent [k3 measure docs/design/tyrande.md]", () => {
  const look = fighterEmpoweredAura(Character.tyrande);
  if (look === undefined) throw new Error("Tyrande keeps no Trueshot ring");
  const d = duel(Character.medivh, 160.0);
  const scaleByShots: number[] = [];
  for (let tick = 1; tick <= VOLLEY_END; tick++) {
    step(d, volleyScript(tick));
    const scale = empoweredAuraScale(d.tyrande, look);
    assertEquals(scale > 0.0, d.tyrande.special.empoweredShots > 0);
    if (scale > 0.0) scaleByShots[d.tyrande.special.empoweredShots] = scale;
  }
  assertEquals(scaleByShots.length, EMPOWERED_SHOTS + 1);
  assertTrue((scaleByShots[1] ?? 0.0) < (scaleByShots[2] ?? 0.0) && (scaleByShots[2] ?? 0.0) < (scaleByShots[3] ?? 0.0));
  assertEquals(empoweredAuraScale(d.tyrande, look), 0.0);
});

test("Her Trueshot ring lapses with the 300-frame window when she fires none [k3 measure docs/design/tyrande.md]", () => {
  const look = fighterEmpoweredAura(Character.tyrande);
  if (look === undefined) throw new Error("Tyrande keeps no Trueshot ring");
  const d = duel(Character.medivh, 160.0);
  let shownFrames = 0;
  for (let tick = 1; tick <= 360; tick++) {
    step(d, [tick === 3 ? "aura" : "none", "none"]);
    if (empoweredAuraScale(d.tyrande, look) > 0.0) shownFrames++;
  }
  assertGreaterThan(shownFrames, 280);
  assertTrue(shownFrames < 330);
  assertEquals(empoweredAuraScale(d.tyrande, look), 0.0);
});

function reflectFlashes(guardAt: number): number {
  const d = duel(Character.sylvanas, 260.0);
  const events = createImpactEvents();
  let flashes = 0;
  for (let tick = 1; tick <= 90; tick++) {
    captureImpactEventsBefore(events, d.tyrande);
    step(d, [tick === guardAt ? "grace" : "none", tick === 3 ? "arrow" : "none"]);
    finishImpactEventsAfter(events, d.tyrande, d.state.world);
    if (events.reflector) flashes++;
  }
  return flashes;
}

test("Elune's Grace flashes once on the frame it turns a projectile back and not when nothing reaches her [k3 measure docs/design/tyrande.md]", () => {
  assertEquals(reflectFlashes(graceTick()), 1);
  assertEquals(reflectFlashes(0), 0);
});

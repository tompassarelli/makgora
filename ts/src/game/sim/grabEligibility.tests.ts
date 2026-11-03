import { assertEquals, test } from "wisp/src/runtime/testing";
import { sweep } from "../core/sweep";
import { Action } from "../input/actions";
import { type Scene, fighter, frame, scene } from "../match/padScene";
import { captureReplaySnapshot, createReplaySnapshot, restoreReplaySnapshot } from "../replay/snapshot";
import { SELECTABLE_CHARACTERS, fighterName } from "../roster/kits";
import { AttackStyle, Character, DownState, HeroStatusGroup, HeroStatusKind, LedgeState } from "./codes";
import { isDownDamageState, isIntangible } from "./conditions";
import type { Fighter } from "./fighter";
import { applyHeroStatus, isEthereal } from "./heroStatus";
import { applyAttackHit } from "./hits";
import { hitEffect } from "./testWorld";

const ATTACKER = 0;
const VICTIM = 1;
const VICTIM_DAMAGE = 40.0;
const CLOSE_GAP = 70.0;
const FAR_GAP = 250.0;
const CONTACT_LIMIT = 70;
const WATCHED_FRAMES = 40;
const AERIAL_DELAY = 6;
const GRAB_HIT = hitEffect(0.0, 0.0, 0.0, 0.0, 0.0);
const WALK = [Action.modX, Action.modY];

interface Starter {
  readonly name: string;
  readonly press: readonly Action[];
  readonly gaps: readonly number[];
  readonly aerial?: boolean;
  readonly throw?: Action;
}

const close = [CLOSE_GAP];
const both = [CLOSE_GAP, FAR_GAP];
const STARTERS: readonly Starter[] = [
  { name: "jab", press: [Action.attack], gaps: close },
  { name: "forward tilt", press: [Action.attack, ...WALK, Action.moveRight], gaps: close },
  { name: "up tilt", press: [Action.attack, ...WALK, Action.moveUp], gaps: close },
  { name: "down tilt", press: [Action.attack, ...WALK, Action.moveDown], gaps: close },
  { name: "forward smash", press: [Action.attack, Action.moveRight], gaps: close },
  { name: "up smash", press: [Action.attack, Action.moveUp], gaps: close },
  { name: "down smash", press: [Action.attack, Action.moveDown], gaps: close },
  { name: "neutral air", press: [Action.attack], gaps: close, aerial: true },
  { name: "forward air", press: [Action.attack, Action.moveRight], gaps: close, aerial: true },
  { name: "up air", press: [Action.attack, Action.moveUp], gaps: close, aerial: true },
  { name: "down air", press: [Action.attack, Action.moveDown], gaps: close, aerial: true },
  { name: "neutral special", press: [Action.special], gaps: both },
  { name: "side special", press: [Action.special, Action.moveRight], gaps: both },
  { name: "up special", press: [Action.special, Action.moveUp], gaps: both },
  { name: "down special", press: [Action.special, Action.moveDown], gaps: both },
  { name: "forward throw", press: [Action.grab], gaps: close, throw: Action.moveRight },
  { name: "back throw", press: [Action.grab], gaps: close, throw: Action.moveLeft },
  { name: "up throw", press: [Action.grab], gaps: close, throw: Action.moveUp },
  { name: "down throw", press: [Action.grab], gaps: close, throw: Action.moveDown },
];

function knockedDown(f: Fighter): boolean {
  return isDownDamageState(f);
}

function exempt(f: Fighter): boolean {
  return f.status.out || f.grab.owner !== undefined || f.grab.grabbedFrames > 0 || isIntangible(f) || isEthereal(f) || f.ledge.state === LedgeState.hang;
}

const snapshot = createReplaySnapshot();

function grabConnects(s: Scene): boolean {
  captureReplaySnapshot(snapshot, s.world, s.game, s.controls, s.runtime);
  applyAttackHit(s.world, ATTACKER, VICTIM, AttackStyle.grab, 1, GRAB_HIT, true, false);
  const caught = fighter(s, VICTIM).grab.owner === ATTACKER;
  restoreReplaySnapshot(snapshot, s.world, s.game, s.controls, s.runtime);
  return caught;
}

function stateOf(f: Readonly<Fighter>): string {
  return `hitstun ${f.launch.hitstun}${f.launch.throwHitstun ? " from a throw" : ""}, condition ${f.status.condition}, frozen ${f.status.frozenFrames}, down ${f.down.state}`;
}

function attackerHeld(starter: Starter, owner: Readonly<Fighter>, tick: number): readonly Action[] {
  if (starter.throw !== undefined && owner.grab.target === VICTIM) return [starter.throw];
  if (starter.aerial === true) return tick === 1 ? [Action.jump] : tick === 1 + AERIAL_DELAY ? starter.press : [];
  return tick === 1 ? starter.press : [];
}

function checkStarter(character: Character, starter: Starter, gap: number, failures: string[]): void {
  const s = scene(0, [{ character, x: 0.0, facing: 1 }, { character: Character.rifleman, x: gap, facing: -1 }]);
  const owner = fighter(s, ATTACKER);
  const victim = fighter(s, VICTIM);
  victim.status.damage = VICTIM_DAMAGE;
  frame(s, [], []);
  let hits = victim.visuals.hit;
  let wasHeld = false;
  let contactAt = 0;
  for (let tick = 1; tick <= CONTACT_LIMIT + WATCHED_FRAMES; tick++) {
    frame(s, attackerHeld(starter, owner, tick), []);
    wasHeld ||= victim.grab.owner === ATTACKER;
    const touched = starter.throw !== undefined ? wasHeld && victim.grab.owner === undefined : victim.visuals.hit !== hits || victim.status.condition !== HeroStatusKind.none || victim.status.frozenFrames > 0;
    hits = victim.visuals.hit;
    if (contactAt === 0 && touched) contactAt = tick;
    if (contactAt === 0) {
      if (tick >= CONTACT_LIMIT) return;
      continue;
    }
    if (tick > contactAt + WATCHED_FRAMES) return;
    if (exempt(victim)) continue;
    const expected = !knockedDown(victim);
    if (grabConnects(s) !== expected) {
      failures.push(`${fighterName(character)} ${starter.name} at ${gap}: frame ${tick - contactAt} after contact (${stateOf(victim)}) the grab ${expected ? "passed through" : "caught a knocked-down foe"}`);
    }
  }
}

function checkFighter(character: Character): void {
  const failures: string[] = [];
  for (const starter of STARTERS) for (const gap of starter.gaps) checkStarter(character, starter, gap, failures);
  assertEquals(failures.join("\n"), "");
}

for (const character of SELECTABLE_CHARACTERS) {
  sweep(`After any of ${fighterName(character)}'s attacks, specials and throws, a grab that reaches the foe connects unless the foe is knocked down [k1 scenario]`, () => checkFighter(character));
}

const STATUS_FRAMES = 60;

test("A grab that reaches a foe connects under every status, a freeze, petrify and a throw's hitstun, and never on a knocked-down foe [k1 scenario]", () => {
  const failures: string[] = [];
  const setups: readonly (readonly [string, (f: Fighter) => void])[] = [
    ...Object.entries(HeroStatusKind).filter(([, kind]) => kind !== HeroStatusKind.none).sort(([, a], [, b]) => a - b).map(([name, kind]) => [
      `status ${name}`, (f: Fighter) => applyHeroStatus(f, { kind, frames: STATUS_FRAMES, group: HeroStatusGroup.sleep, immunityFrames: 0 }),
    ] as const),
    ["freeze", (f: Fighter) => { f.status.frozenFrames = STATUS_FRAMES; }],
    ["petrify", (f: Fighter) => { f.status.petrified = true; f.status.frozenFrames = STATUS_FRAMES; }],
    ["throw hitstun", (f: Fighter) => { f.launch.hitstun = STATUS_FRAMES; f.launch.throwHitstun = true; }],
  ];
  for (const [name, setup] of setups) {
    const s = scene(0, [{ character: Character.dreadlord, x: 0.0, facing: 1 }, { character: Character.rifleman, x: CLOSE_GAP, facing: -1 }]);
    frame(s, [], []);
    const victim = fighter(s, VICTIM);
    setup(victim);
    if (exempt(victim)) continue;
    if (!grabConnects(s)) failures.push(`${name}: the grab passed through (${stateOf(victim)})`);
  }
  const s = scene(0, [{ character: Character.dreadlord, x: 0.0, facing: 1 }, { character: Character.rifleman, x: CLOSE_GAP, facing: -1 }]);
  frame(s, [], []);
  fighter(s, VICTIM).down.state = DownState.wait;
  if (grabConnects(s)) failures.push("a lying foe was grabbed");
  assertEquals(failures.join("\n"), "");
});

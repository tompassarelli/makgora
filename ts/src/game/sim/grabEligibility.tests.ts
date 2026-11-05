import { assertEquals, test } from "wisp/src/runtime/testing";
import { type Scene, fighter, frame, scene } from "../match/padScene";
import { captureReplaySnapshot, createReplaySnapshot, restoreReplaySnapshot } from "../replay/snapshot";
import { AttackStyle, Character, DownState, HeroStatusGroup, HeroStatusKind, LedgeState } from "./codes";
import { isIntangible } from "./conditions";
import type { Fighter } from "./fighter";
import { applyHeroStatus, isEthereal } from "./heroStatus";
import { applyAttackHit } from "./hits";
import { hitEffect } from "./testWorld";

const ATTACKER = 0;
const VICTIM = 1;
const CLOSE_GAP = 70.0;
const GRAB_HIT = hitEffect(0.0, 0.0, 0.0, 0.0, 0.0);
const STATUS_FRAMES = 60;

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

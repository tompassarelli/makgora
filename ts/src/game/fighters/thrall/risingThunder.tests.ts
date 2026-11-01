import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { firstFighterDifference } from "../../../generated/state/fighterDifference";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Action } from "../../input/actions";
import { Phase } from "../../lobby/lobbyState";
import { RECOVERY_BANDS, upSpecialRoute } from "../../match/recoveryEnvelope";
import { fighter, frame, scene } from "../../match/padScene";
import { stepMatch } from "../../match/step";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character, SpecialAction } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { type Controls, copyControls, fighterAt } from "../../sim/roster";
import { FOLLOW_UP_FORM } from "../../sim/specials/schema";
import { controls } from "../../sim/testWorld";
import { RISING_THUNDER_LANDING_LAG } from "./risingThunder";

const FOE_X = 40.0;
const WATCH = 160;
const VERTICAL_BAND = 1;
const R = Action.moveRight;
const D = Action.moveDown;
const U = Action.moveUp;
const A = Action.attack;

interface Rise {
  readonly hits: number;
  readonly damage: number;
  readonly knockbackX: number;
  readonly knockbackZ: number;
  readonly hitstun: number;
  readonly actionable: number;
  readonly foeFree: number;
  readonly followUpHit: boolean;
  readonly secondUpSpecial: boolean;
}

function rise(percent: number, followUp: (k: number) => readonly Action[] = () => [], retryUp = false): Rise {
  const s = scene(0, [{ character: Character.thrall, x: 0.0, facing: 1 }, { character: Character.rifleman, x: FOE_X, facing: -1 }]);
  const thrall = fighter(s, 0);
  const foe = fighter(s, 1);
  foe.status.damage = percent;
  for (let n = 0; n < 10; n++) frame(s, [], []);
  let hits = 0;
  let lastDamage = percent;
  let knockbackX = 0.0;
  let knockbackZ = 0.0;
  let hitstun = 0;
  let actionable = -1;
  let foeFree = -1;
  let afterStrike = -1.0;
  let followUpHit = false;
  let secondUpSpecial = false;
  let struck = false;
  for (let n = 1; n <= WATCH; n++) {
    const free = actionable > 0;
    const stunned = foe.launch.hitstun > 0 || foe.launch.hitlag > 0;
    const held = n === 1 ? [U, Action.special] : free ? (retryUp && n === actionable + 1 ? [U, Action.special] : followUp(n - actionable)) : [];
    frame(s, held, []);
    if (foe.status.damage > lastDamage) {
      if (!free) hits++;
      else if (stunned) followUpHit = true;
      lastDamage = foe.status.damage;
    }
    if (!struck && thrall.special.form >= FOLLOW_UP_FORM) {
      struck = true;
      afterStrike = foe.status.damage;
      knockbackX = foe.launch.knockbackX;
      knockbackZ = foe.launch.knockbackZ;
      hitstun = foe.launch.hitstun;
    }
    if (struck && actionable < 0 && thrall.special.action === SpecialAction.none) actionable = n;
    if (struck && foeFree < 0 && foe.launch.hitstun === 0 && foe.launch.hitlag === 0) foeFree = n;
    if (free && n > actionable + 1 && thrall.special.action === SpecialAction.heroUp) secondUpSpecial = true;
  }
  return { hits, damage: afterStrike - percent, knockbackX, knockbackZ, hitstun, actionable, foeFree, followUpHit, secondUpSpecial };
}

test("Rising Thunder rises 400-560 and steers 320-600 across, inside the vertical recovery band [k1 scenario]", () => {
  const band = RECOVERY_BANDS[VERTICAL_BAND];
  const route = upSpecialRoute(Character.thrall, 100);
  assertEquals(band?.name, "vertical");
  const inside = (value: number, low: number, high: number) => value >= low && value <= high;
  assertEquals(`rise ${route.rise} ${inside(route.rise, band?.riseMin ?? 0, band?.riseMax ?? 0)}, reach ${route.reach} ${inside(route.reach, band?.reachMin ?? 0, band?.reachMax ?? 0)}`, "rise 527 true, reach 346 true");
});

test("Rising Thunder strikes seven times on a standing foe, eruption, five rising hammer hits and the apex, for 18.5 damage [k1 scenario]", () => {
  const hit = rise(0.0);
  assertEquals(`${hit.hits} hits, ${hit.damage}`, "7 hits, 18.5");
});

test("Rising Thunder's apex launch and hitstun are the same at 0, 60 and 150 percent [k1 scenario]", () => {
  const low = rise(0.0);
  for (const percent of [60.0, 150.0]) {
    const high = rise(percent);
    assertEquals(`${high.knockbackX} ${high.knockbackZ} ${high.hitstun}`, `${low.knockbackX} ${low.knockbackZ} ${low.hitstun}`, `${percent}%`);
  }
  assertGreaterThan(low.hitstun, 0);
});

test("After a Rising Thunder hit Thrall acts at frame 45 with at least 20 frames before the foe can act [k1 scenario]", () => {
  const hit = rise(0.0);
  assertEquals(hit.actionable, 45);
  assertGreaterThan(hit.foeFree - hit.actionable, 19);
});

const followUpHits = (plan: (k: number) => readonly Action[]) => [0, 60, 150].map((percent) => `${percent}% ${rise(percent * 1.0, plan).followUpHit}`).join(", ");
const EVERY_PERCENT = "0% true, 60% true, 150% true";

test("After a Rising Thunder hit, down air strikes the foe inside its hitstun at 0, 60 and 150 percent [k1 scenario]", () => {
  assertEquals(followUpHits((k) => k === 4 ? [D, A] : [R]), EVERY_PERCENT);
});

test("After a Rising Thunder hit, forward air strikes the foe inside its hitstun at 0, 60 and 150 percent [k1 scenario]", () => {
  assertEquals(followUpHits((k) => k === 2 ? [R, A] : [R]), EVERY_PERCENT);
});

test("After a Rising Thunder hit, a fast-fall into up air strikes the foe inside its hitstun at 0, 60 and 150 percent [k1 scenario]", () => {
  assertEquals(followUpHits((k) => k === 1 ? [D] : k === 3 ? [U, A] : k < 3 ? [R] : []), EVERY_PERCENT);
});

test("A Rising Thunder hit leaves no second Up B in the same airtime [k1 scenario]", () => {
  assertEquals(rise(0.0, () => [], true).secondUpSpecial, false);
});

test("A Rising Thunder whiff falls helpless until it lands, then takes 30 frames of special-fall landing lag [k1 scenario]", () => {
  const s = scene(0, [{ character: Character.thrall, x: 0.0, facing: 1 }, { character: Character.rifleman, x: -600.0, facing: 1 }]);
  const thrall = fighter(s, 0);
  for (let n = 0; n < 10; n++) frame(s, [], []);
  frame(s, [U, Action.special], []);
  let ended = false;
  let helplessEveryFrame = true;
  let landingLag = -1;
  for (let n = 2; n <= WATCH && landingLag < 0; n++) {
    frame(s, [], []);
    if (thrall.special.action === SpecialAction.none && !thrall.motion.grounded) {
      ended = true;
      helplessEveryFrame &&= thrall.special.fall;
    }
    if (ended && thrall.motion.grounded) landingLag = thrall.landing.lag;
  }
  assertEquals(RISING_THUNDER_LANDING_LAG, 30);
  assertEquals(`helpless ${ended && helplessEveryFrame}, landing lag ${landingLag}`, "helpless true, landing lag 30");
});

interface Bout {
  readonly state: ReplayState;
  readonly thrall: Fighter;
  readonly foe: Fighter;
  tick: number;
}

function bout(): Bout {
  const state = createReplaySnapshot();
  copyFighterState(fighterAt(state.world, 0), createFighter(Character.thrall, 0.0, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.rifleman, FOE_X, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 412;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const b: Bout = { state, thrall: fighterAt(state.world, 0), foe: fighterAt(state.world, 1), tick: 0 };
  for (let n = 0; n < 3; n++) step(b);
  return b;
}

function step(b: Bout, first: Readonly<Controls> = controls()): void {
  b.tick++;
  copyControls(b.state.controls.inputs[0], first);
  copyControls(b.state.controls.inputs[1], controls());
  stepMatch(b.state.match, b.state.world, b.state.controls, b.tick);
}

test("A rollback in the middle of Rising Thunder's rise replays its hits, apex and follow-up state exactly [k1 scenario]", () => {
  const b = bout();
  step(b, controls({ specialPressed: true, specialZ: 1, specialHeld: true, verticalDirection: 1 }));
  for (let n = 0; n < 14; n++) step(b);
  const saved = createReplaySnapshot();
  copyReplayState(saved, b.state);
  const savedTick = b.tick;
  for (let n = 0; n < 50; n++) step(b);
  const expected = createReplaySnapshot();
  copyReplayState(expected, b.state);
  copyReplayState(b.state, saved);
  b.tick = savedTick;
  for (let n = 0; n < 50; n++) step(b);
  const mask = b.state.world.mask;
  assertGreaterThan(b.foe.status.damage, 18.0);
  assertEquals(firstFighterDifference(fighterAt(expected.world, 0), b.thrall, mask, mask), undefined);
  assertEquals(firstFighterDifference(fighterAt(expected.world, 1), b.foe, mask, mask), undefined);
});

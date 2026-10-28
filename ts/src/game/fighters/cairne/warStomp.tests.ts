import { assertEquals, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../../../generated/state/fighterState";
import { ATTACK_BUFFER_FRAMES, attackBuffer, queueAttack } from "../../input/attackBuffer";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { firstStateDifference } from "../../replay/difference";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { beginFighterAttack } from "../../sim/attacks";
import { AttackStyle, Character, SpecialAction } from "../../sim/codes";
import { canAttack, canShieldGrab } from "../../sim/conditions";
import { type Fighter, createFighter } from "../../sim/fighter";
import { HITSTUN_FRAMES_PER_KNOCKBACK } from "../../sim/knockback";
import { type Controls, copyControls, fighterAt } from "../../sim/roster";
import { controls } from "../../sim/testWorld";

const STOMP = controls({ specialPressed: true, specialZ: -1, verticalDirection: -1 });
const SHIELD = controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0 });
const DASH_IN = controls({ direction: -1, driftStickX: -1.0 });
const IN_REACH = 150.0;
const OUT_OF_REACH = 170.0;
const ARMOR_KNOCKBACK = 100.0;
const ON_SHIELD_ADVANTAGE = -36;
const LAST_WHIFF_DASH_FRAME = 54;
const STOMP_DAMAGE_TOLERANCE = f32(0.001);

interface Bout {
  readonly state: ReplayState;
  readonly cairne: Fighter;
  readonly foe: Fighter;
  tick: number;
}

function bout(foeX: number, cairnePercent = 0.0): Bout {
  const state = createReplaySnapshot();
  state.controls.commands[1] = attackBuffer(ATTACK_BUFFER_FRAMES);
  copyFighterState(fighterAt(state.world, 0), createFighter(Character.cairne, 0.0, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.warden, foeX, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 360;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const b: Bout = { state, cairne: fighterAt(state.world, 0), foe: fighterAt(state.world, 1), tick: 0 };
  for (let frame = 0; frame < 8; frame++) step(b);
  b.cairne.status.damage = cairnePercent;
  return b;
}

function step(b: Bout, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls(), queued?: AttackStyle): void {
  b.tick++;
  copyControls(b.state.controls.inputs[0], first);
  copyControls(b.state.controls.inputs[1], second);
  if (queued !== undefined) queueAttack(b.state.controls.commands[1], { style: queued, facing: -1, frame: b.tick, mayCharge: false, cStick: false });
  stepMatch(b.state.match, b.state.world, b.state.controls, b.tick);
}

interface Struck {
  readonly frames: number[];
  readonly hitstun: number;
}

/** Stomps, starts the foe's attack on stomp frame `at`, and records the stomp frame of each hit on Cairne until the move ends or he is knocked out of it. */
function stompStruck(b: Bout, at: number, style: AttackStyle): Struck {
  step(b, STOMP);
  const frames: number[] = [];
  let hitstun = 0;
  let hits = b.cairne.visuals.hit;
  for (let n = 0; n < 70; n++) {
    if (b.cairne.special.frame === at && b.foe.attack.style === undefined && frames.length === 0) beginFighterAttack(b.state.world, 1, style, false);
    step(b);
    if (b.cairne.visuals.hit === hits) continue;
    hits = b.cairne.visuals.hit;
    frames.push(b.cairne.special.frame);
    hitstun = Math.max(hitstun, b.cairne.launch.hitstun);
  }
  return { frames, hitstun };
}

test("War Stomp armor absorbs a jab and a forward tilt at 0%: Cairne takes the damage with no knockback or hitstun, flashes, and the stomp still launches the foe [k1 scenario]", () => {
  for (const style of [AttackStyle.jab, AttackStyle.forwardTilt]) {
    const b = bout(IN_REACH);
    const struck = stompStruck(b, 4, style);
    assertEquals(struck.frames.length, 1);
    assertGreaterThan(b.cairne.status.damage, 0.0);
    assertEquals(struck.hitstun, 0);
    assertEquals(b.cairne.visuals.armorAbsorbs, 1);
    assertEquals(b.cairne.launch.knockbackX, 0.0);
    assertEquals(b.cairne.launch.knockbackZ, 0.0);
    assertNear(b.foe.status.damage, 9.75, STOMP_DAMAGE_TOLERANCE);
  }
});

test("A forward smash on Cairne at 80% breaks War Stomp's armor and launches him with 100 less knockback, cancelling the stomp [k1 scenario]", () => {
  const idle = bout(OUT_OF_REACH, 80.0);
  beginFighterAttack(idle.state.world, 1, AttackStyle.forwardSmash, false);
  let idleHitstun = 0;
  for (let n = 0; n < 30 && idleHitstun === 0; n++) {
    step(idle);
    idleHitstun = idle.cairne.launch.hitstun;
  }
  const b = bout(OUT_OF_REACH, 80.0);
  const struck = stompStruck(b, 4, AttackStyle.forwardSmash);
  assertEquals(struck.frames.length, 1);
  assertEquals(b.cairne.visuals.armorAbsorbs, 0);
  assertEquals(b.cairne.special.action, SpecialAction.none);
  assertGreaterThan(struck.hitstun, 0);
  assertNear(idleHitstun - struck.hitstun, f32(ARMOR_KNOCKBACK * HITSTUN_FRAMES_PER_KNOCKBACK), 1.0);
});

test("Each hit of a multi-hit down air meets War Stomp's armor on its own: all four are absorbed and the stomp still comes out [k1 scenario]", () => {
  const b = bout(40.0);
  b.foe.motion.z = 230.0;
  b.foe.motion.grounded = false;
  const struck = stompStruck(b, 2, AttackStyle.downAir);
  assertEquals(struck.frames.length, 4);
  assertEquals(struck.hitstun, 0);
  assertGreaterThan(b.foe.status.damage, 0.0);
});

test("A grab beats War Stomp's armor and takes him out of the stomp [k1 scenario]", () => {
  const b = bout(80.0);
  step(b, STOMP);
  let grabbed = false;
  for (let n = 0; n < 20 && !grabbed; n++) {
    if (b.cairne.special.frame === 6 && b.foe.attack.style === undefined) beginFighterAttack(b.state.world, 1, AttackStyle.grab, false);
    step(b);
    grabbed = b.cairne.grab.owner !== undefined;
  }
  assertTrue(grabbed);
  assertEquals(b.cairne.special.action, SpecialAction.none);
  assertEquals(b.cairne.visuals.armorAbsorbs, 0);
});

test("War Stomp's armor holds on frame 19 and is gone on frame 20, where the jab and the stomp trade [k1 scenario]", () => {
  const last = bout(IN_REACH);
  const held = stompStruck(last, 18, AttackStyle.jab);
  assertEquals(held.frames.length, 1);
  assertEquals(held.frames[0], 19);
  assertEquals(held.hitstun, 0);
  const after = bout(IN_REACH);
  const broken = stompStruck(after, 19, AttackStyle.jab);
  assertEquals(broken.frames.length, 1);
  assertGreaterThan(broken.hitstun, 0);
  assertNear(after.foe.status.damage, 9.75, STOMP_DAMAGE_TOLERANCE);
});

function shieldedStomp(foeX: number): Bout {
  const b = bout(foeX);
  step(b, controls(), { ...SHIELD, shieldPressed: true });
  step(b, STOMP, SHIELD);
  return b;
}

function onShieldAdvantage(foeX: number): number {
  const b = shieldedStomp(foeX);
  const shields = b.foe.visuals.shield;
  let cairneFree: number | undefined;
  let foeFree: number | undefined;
  for (let n = 1; n < 90 && (cairneFree === undefined || foeFree === undefined); n++) {
    step(b, controls(), SHIELD);
    if (b.foe.visuals.shield === shields) continue;
    cairneFree ??= canAttack(b.cairne) ? n : undefined;
    foeFree ??= canShieldGrab(b.foe) ? n : undefined;
  }
  return (foeFree ?? 0) - (cairneFree ?? 0);
}

function grabbedBeforeHeActs(b: Bout, input: (n: number, contact: number | undefined) => readonly [Readonly<Controls>, AttackStyle | undefined]): boolean {
  const shields = b.foe.visuals.shield;
  let contact: number | undefined;
  for (let n = 1; n < 90; n++) {
    const [second, queued] = input(n, contact);
    step(b, controls(), second, queued);
    if (b.cairne.grab.owner !== undefined) return true;
    if (canAttack(b.cairne)) return false;
    if (contact === undefined && b.foe.visuals.shield !== shields) contact = n;
  }
  return false;
}

test("War Stomp ends on frame 62 and stays punishable: -36 on shield, where a mid-weight shielding close shield-grabs him and one at the stomp's edge drops shield and dash-grabs him before he can act, and on whiff a dash attack from outside its reach started as late as stomp frame 54 lands [k3 measure docs/design/cairne.md]", () => {
  assertEquals(onShieldAdvantage(50.0), ON_SHIELD_ADVANTAGE);
  assertEquals(onShieldAdvantage(140.0), ON_SHIELD_ADVANTAGE);
  assertTrue(grabbedBeforeHeActs(shieldedStomp(50.0), (_, contact) => [SHIELD, contact === undefined ? undefined : AttackStyle.grab]));
  const edge = shieldedStomp(140.0);
  let dashFrom: number | undefined;
  assertTrue(grabbedBeforeHeActs(edge, (n, contact) => {
    if (contact === undefined || (edge.foe.shield.raised && !canShieldGrab(edge.foe))) return [SHIELD, undefined];
    dashFrom ??= canAttack(edge.foe) ? n : undefined;
    if (dashFrom === undefined) return [controls(), undefined];
    return [n <= dashFrom + 4 ? DASH_IN : controls(), n === dashFrom + 4 ? AttackStyle.grab : undefined];
  }));
  for (const [start, lands] of [[LAST_WHIFF_DASH_FRAME, true], [LAST_WHIFF_DASH_FRAME + 2, false]] as const) {
    const b = bout(OUT_OF_REACH);
    step(b, STOMP);
    let dashFrom: number | undefined;
    let landedFirst = false;
    for (let n = 0; n < 90; n++) {
      if (dashFrom === undefined && b.cairne.special.frame >= start) dashFrom = n;
      const k = dashFrom === undefined ? -1 : n - dashFrom;
      step(b, controls(), k >= 0 && k <= 4 ? DASH_IN : controls(), k === 4 ? AttackStyle.jab : undefined);
      if (b.cairne.status.damage > 0.0) {
        landedFirst = true;
        break;
      }
      if (canAttack(b.cairne)) break;
    }
    assertEquals(b.foe.status.damage, 0.0);
    assertEquals(landedFirst, lands);
  }
});

test("War Stomp's armor rolls back: a snapshot mid-stomp, restored after a jab was absorbed on the abandoned branch, replays to the same state as the straight run [k1 scenario]", () => {
  const straight = bout(IN_REACH);
  const replayed = bout(IN_REACH);
  step(straight, STOMP);
  step(replayed, STOMP);
  for (let n = 0; n < 4; n++) {
    step(straight);
    step(replayed);
  }
  assertGreaterThan(replayed.cairne.status.armorKnockback, 0.0);
  const saved = createReplaySnapshot();
  copyReplayState(saved, replayed.state);
  const savedTick = replayed.tick;
  beginFighterAttack(replayed.state.world, 1, AttackStyle.jab, false);
  for (let n = 0; n < 8; n++) step(replayed);
  assertGreaterThan(replayed.cairne.status.damage, 0.0);
  assertEquals(replayed.cairne.launch.hitstun, 0);
  copyReplayState(replayed.state, saved);
  replayed.tick = savedTick;
  for (let n = 0; n < 30; n++) {
    step(straight);
    step(replayed);
  }
  assertEquals(firstStateDifference(straight.state, replayed.state), undefined);
});

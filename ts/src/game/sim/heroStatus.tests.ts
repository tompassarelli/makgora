import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { queueAttack } from "../input/attackBuffer";
import { Phase, createMatchState } from "../lobby/lobbyState";
import { createBufferedFrameControls } from "../match/controls";
import { stepMatch } from "../match/step";
import { AttackStyle, Character, GrabAction, HeroStatusKind, SpecialAction } from "./codes";
import { BANISH_SPELL_DAMAGE } from "./contacts";
import { type Fighter, createFighter } from "./fighter";
import { HERO_REFERENCE_HEIGHT } from "./heroMoves";
import { BANISH } from "./heroes/kaelthasSpecials";
import { HEX } from "./heroes/shadowHunterSpecials";
import { applyHeroStatus } from "./heroStatus";
import { traitMove } from "./identityTraits";
import { type Controls, copyControls, createRoster } from "./roster";
import { mainDeckLeft, mainDeckRight, mainDeckZ } from "./stage";
import { lift } from "./testDuel";
import { controls } from "./testWorld";

const H = HERO_REFERENCE_HEIGHT;
const FAR = f32(H * f32(6.0));
const CLOSE = f32(H * f32(0.4));

interface Bout {
  readonly first: Fighter;
  readonly second: Fighter;
  readonly step: (this: void, first?: Readonly<Controls>, attack?: AttackStyle, second?: Readonly<Controls>) => void;
}

function bout(first: Character, second: Character, gap: number): Bout {
  const game = createMatchState();
  game.phase = Phase.match;
  const a = createFighter(first, 0.0, 1);
  const b = createFighter(second, gap, -1);
  const world = createRoster(3, [a, b]);
  const frameControls = createBufferedFrameControls();
  let frame = 0;
  const step = (one: Readonly<Controls> = controls(), attack?: AttackStyle, two: Readonly<Controls> = controls()): void => {
    frame++;
    copyControls(frameControls.inputs[0], one);
    copyControls(frameControls.inputs[1], two);
    if (attack !== undefined) queueAttack(frameControls.commands[0], { style: attack, facing: 1, frame, mayCharge: false });
    stepMatch(game, world, frameControls, frame);
  };
  for (let settle = 0; settle < 3; settle++) step();
  return { first: a, second: b, step };
}

function run(b: Bout, frames: number, input?: Readonly<Controls>, attack?: AttackStyle, watch: () => void = () => {}): void {
  b.step(input, attack);
  watch();
  for (let frame = 1; frame < frames; frame++) {
    b.step(input);
    watch();
  }
}

function moved(banished: boolean, setUp: (b: Bout) => void, act: (b: Bout) => boolean): boolean {
  const b = bout(Character.blademaster, Character.rifleman, FAR);
  setUp(b);
  if (banished) applyHeroStatus(b.first, BANISH);
  return act(b);
}

const SHIELD = controls({ shield: true, shieldPressed: true, shieldTriggerActive: true, shieldStrength: 1.0 });

const startsAttack = (style: AttackStyle) => (b: Bout): boolean => {
  let started = false;
  run(b, 6, undefined, style, () => { started ||= b.first.attack.style !== undefined || b.first.grab.action !== GrabAction.none; });
  return started;
};
const raisesShield = (b: Bout): boolean => {
  let raised = false;
  run(b, 6, SHIELD, undefined, () => { raised ||= b.first.shield.raised; });
  return raised;
};
const neutralSpecial = (b: Bout): boolean => {
  run(b, 2, controls({ specialPressed: true }));
  return b.first.special.action !== SpecialAction.none;
};
function walked(banished: boolean): number {
  const b = bout(Character.blademaster, Character.rifleman, FAR);
  if (banished) applyHeroStatus(b.first, BANISH);
  const x = b.first.motion.x;
  run(b, 12, controls({ direction: 1 }));
  return f32(b.first.motion.x - x);
}
const jumps = (b: Bout): boolean => {
  let left = false;
  run(b, 10, controls({ jumpPressed: true }), undefined, () => { left ||= !b.first.motion.grounded; });
  return left;
};
const airDodges = (b: Bout): boolean => {
  let dodged = false;
  run(b, 3, controls({ airDodgePressed: true, dodgeX: 1, dodgeZ: 0 }), undefined, () => { dodged ||= b.first.dodge.airDodging; });
  return dodged;
};
const aloft = (b: Bout): void => lift(b.first, f32(H * f32(2.0)));
const none = (): void => {};

test("A Banished fighter's jab, grab and shield inputs do nothing, a raised shield drops, and their specials, jumping, air dodging and full-speed walking still act [k1 scenario]", () => {
  for (const style of [AttackStyle.jab, AttackStyle.forwardSmash, AttackStyle.grab]) {
    assertTrue(moved(false, none, startsAttack(style)));
    assertTrue(!moved(true, none, startsAttack(style)));
  }
  assertTrue(moved(false, none, raisesShield));
  assertTrue(!moved(true, none, raisesShield));
  const shielding = bout(Character.blademaster, Character.rifleman, FAR);
  run(shielding, 8, SHIELD);
  assertTrue(shielding.first.shield.raised);
  applyHeroStatus(shielding.first, BANISH);
  run(shielding, 30, SHIELD);
  assertTrue(!shielding.first.shield.raised);
  for (const [setUp, act] of [[none, neutralSpecial], [none, jumps], [aloft, airDodges]] as const) {
    assertTrue(moved(true, setUp, act));
  }
  assertGreaterThan(walked(true), 0.0);
  assertEquals(walked(true), walked(false));
});

function struck(attacker: Character, banished: boolean, gap: number, act: (b: Bout) => void): { damage: number; hitlag: boolean; held: boolean; touched: boolean } {
  const b = bout(attacker, Character.rifleman, gap);
  b.first.mana.points = 100;
  if (banished) applyHeroStatus(b.second, BANISH);
  let damage = 0.0;
  let hitlag = false;
  let held = false;
  let touched = false;
  const watch = (): void => {
    if (damage === 0.0) damage = b.second.status.damage;
    hitlag ||= b.first.launch.hitlag > 0 || b.second.launch.hitlag > 0;
    held ||= b.second.grab.owner !== undefined;
    touched ||= b.first.attack.hit;
  };
  act(b);
  watch();
  for (let frame = 0; frame < 40; frame++) {
    b.step();
    watch();
  }
  return { damage, hitlag, held, touched };
}

const normal = (style: AttackStyle) => (b: Bout): void => b.step(undefined, style);

test("Every fighter's normals and grab, Kael's own included, pass through a Banished fighter with no damage, hitlag or catch, and a throw of a fighter Banished while held deals nothing [k1 scenario]", () => {
  for (const attacker of [Character.blademaster, Character.kaelthas, Character.mountainKing]) {
    for (const style of [AttackStyle.jab, AttackStyle.forwardSmash, AttackStyle.grab]) {
      const plain = struck(attacker, false, CLOSE, normal(style));
      assertTrue(plain.damage > 0.0 || plain.held);
      const ghost = struck(attacker, true, CLOSE, normal(style));
      assertEquals(ghost.damage, 0.0);
      assertTrue(!ghost.hitlag);
      assertTrue(!ghost.held);
      assertTrue(!ghost.touched);
    }
  }
  assertGreaterThan(thrown(false), 0.0);
  assertEquals(thrown(true), 0.0);
});

function thrown(banished: boolean): number {
  const b = bout(Character.blademaster, Character.rifleman, CLOSE);
  b.step(undefined, AttackStyle.grab);
  for (let frame = 0; frame < 20 && b.second.grab.owner === undefined; frame++) b.step();
  assertTrue(b.second.grab.owner !== undefined);
  if (banished) applyHeroStatus(b.second, BANISH);
  const before = b.second.status.damage;
  run(b, 40, controls({ grabThrowX: 1, direction: 1 }));
  return f32(b.second.status.damage - before);
}

test("Another fighter's special, projectile and command grab land on a Banished fighter for BANISH_SPELL_DAMAGE times their damage [k3 measure #360]", () => {
  const cases: readonly (readonly [Character, number, Readonly<Controls>])[] = [
    [Character.warden, f32(H * f32(0.9)), controls({ specialPressed: true, specialX: 1 })],
    [Character.rifleman, f32(H * f32(2.0)), controls({ specialPressed: true })],
    [Character.cairne, f32(H * f32(1.2)), controls({ specialPressed: true, specialX: 1 })],
  ];
  for (const [attacker, gap, input] of cases) {
    const plain = struck(attacker, false, gap, (b) => b.step(input));
    const ghost = struck(attacker, true, gap, (b) => b.step(input));
    assertGreaterThan(plain.damage, 0.0);
    assertEquals(ghost.damage, f32(plain.damage * BANISH_SPELL_DAMAGE));
  }
});

test("A Banished fighter offstage can still start their up special [k1 scenario]", () => {
  for (const character of [Character.kaelthas, Character.rifleman, Character.blademaster, Character.demonHunter]) {
    const b = bout(character, Character.rifleman, FAR);
    lift(b.first, f32(mainDeckZ(0) - f32(H * f32(0.5))));
    b.first.motion.x = f32(mainDeckRight(0) + f32(H * f32(1.5)));
    applyHeroStatus(b.first, BANISH);
    run(b, 2, controls({ specialPressed: true, specialZ: 1, verticalDirection: 1 }));
    assertEquals(traitMove(b.first.special.action), "up");
  }
});

interface HexTrace {
  readonly frames: number;
  readonly path: string;
  readonly acted: boolean;
  readonly hops: readonly number[];
  readonly offDeck: boolean;
}

/** Hexes the first fighter at `x` (aloft if `z` is set) and plays `input` each frame (`first` on the first) until the hex ends. */
function hexed(input: Readonly<Controls>, attack?: AttackStyle, first: Readonly<Controls> = input, x = 0.0, z?: number): HexTrace {
  const b = bout(Character.blademaster, Character.rifleman, FAR);
  b.first.motion.x = x;
  if (z !== undefined) lift(b.first, z);
  applyHeroStatus(b.first, HEX);
  let frames = 0;
  let path = "";
  let acted = false;
  let offDeck = false;
  const hops: number[] = [];
  for (let frame = 0; frame < 2 * HEX.frames && b.first.status.condition === HeroStatusKind.hex; frame++) {
    const grounded = b.first.motion.grounded;
    b.step(frame === 0 ? first : input, frame === 0 ? attack : undefined);
    frames++;
    const { motion } = b.first;
    path += `${motion.x},${motion.z},${b.first.facing};`;
    acted ||= b.first.attack.style !== undefined || b.first.grab.action !== GrabAction.none || b.first.special.action !== SpecialAction.none
      || b.first.shield.raised || b.first.jump.squat > 0 || b.first.dodge.airDodging || b.first.dodge.groundFrame > 0;
    if (grounded && !motion.grounded && motion.vz > 0.0) hops.push(motion.vx > 0.0 ? 1 : motion.vx < 0.0 ? -1 : 0);
    offDeck ||= motion.x > mainDeckRight(0) || motion.x < mainDeckLeft(0);
  }
  return { frames, path, acted, hops, offDeck };
}

const ONE_MASH = controls({ grabMashPressed: true });

test("A hexed fighter ignores attack, grab, every special, shield, jump and dodge inputs and hops the same seeded path for HEX.frames frames; a held stick only mashes [k3 measure #521]", () => {
  const still = hexed(controls());
  assertEquals(still.frames, HEX.frames);
  assertTrue(!still.acted);
  assertEquals(hexed(controls()).path, still.path);
  const ignored: readonly (readonly [Readonly<Controls>, AttackStyle | undefined])[] = [
    [controls(), AttackStyle.jab], [controls(), AttackStyle.forwardSmash], [controls(), AttackStyle.grab],
    [controls({ specialPressed: true }), undefined], [controls({ specialPressed: true, specialX: 1 }), undefined],
    [controls({ specialPressed: true, specialZ: -1 }), undefined], [controls({ specialPressed: true, specialZ: 1 }), undefined],
    [SHIELD, undefined], [controls({ jumpPressed: true, jumpHeld: true }), undefined], [controls({ shortHopPressed: true }), undefined],
    [controls({ groundDodgePressed: true, groundDodgeDirection: 1 }), undefined], [controls({ airDodgePressed: true, dodgeX: 1 }), undefined],
  ];
  for (const [input, attack] of ignored) {
    const trace = hexed(input, attack);
    assertTrue(!trace.acted);
    assertEquals(trace.path, still.path);
  }
  const mashedOnce = hexed(controls(), undefined, ONE_MASH);
  for (const stick of [controls({ direction: 1 }), controls({ direction: -1, walking: true }), controls({ verticalDirection: 1 }), controls({ verticalDirection: -1, down: true })]) {
    const held = hexed(stick);
    assertTrue(!held.acted);
    assertEquals(held.path, mashedOnce.path);
  }
});

test("Hex hops go both ways on the seeded draw and turn back at either edge of the deck instead of hopping off [k1 scenario]", () => {
  const middle = hexed(controls());
  assertTrue(middle.hops.includes(1) && middle.hops.includes(-1));
  for (const side of [1, -1]) {
    const edge = side > 0 ? mainDeckRight(0) : mainDeckLeft(0);
    const trace = hexed(controls(), undefined, controls(), f32(edge - f32(side * f32(H * f32(0.1)))));
    assertEquals(trace.hops[0], -side);
    assertTrue(!trace.offDeck);
  }
});

test("A fighter hexed in the air falls with a held stick steering nothing, and mashing ends Hex sooner but never before its mash minimum [k1 scenario]", () => {
  const z = f32(mainDeckZ(0) + f32(H * f32(2.0)));
  const falling = hexed(controls(), undefined, ONE_MASH, 0.0, z);
  const steered = hexed(controls({ direction: 1 }), undefined, controls({ direction: 1 }), 0.0, z);
  assertEquals(steered.path, falling.path);
  assertTrue(!steered.acted);
  const mashed = hexed(controls({ grabMashPressed: true }));
  assertTrue(mashed.frames < HEX.frames);
  assertGreaterThan(mashed.frames, 35);
});

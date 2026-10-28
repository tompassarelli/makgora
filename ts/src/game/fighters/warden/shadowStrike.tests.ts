import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { copyFighterState, sameFighterState } from "../../../generated/state/fighterState";
import { Character, SpecialAction } from "../../sim/codes";
import { type Fighter, createFighter } from "../../sim/fighter";
import { applyHeroStatus } from "../../sim/heroStatus";
import { type Controls } from "../../sim/roster";
import { duelPair, lift, stepDuel } from "../../sim/testDuel";
import { controls } from "../../sim/testWorld";
import { SHADOW_POISON, SHADOW_POISON_CAP, SHADOW_POISON_FRAMES } from "./specials";

const GAP = 90.0;
const WATCH_FRAMES = 40;
const THROW = controls({ specialPressed: true });
const DAGGER_DAMAGE = 2.0;
const SECOND_THROW_TICK = 40;
const ATTACK_TICK = 3;
const AIR_HEIGHT = 400.0;

interface Victim {
  readonly name: string;
  readonly character: Character;
  readonly airborne: boolean;
  readonly input: (tick: number) => Controls;
  readonly busy: (f: Fighter) => boolean;
}

const VICTIMS: readonly Victim[] = [
  { name: "mid-attack", character: Character.warden, airborne: false,
    input: (tick) => tick === ATTACK_TICK ? controls({ specialPressed: true }) : controls(), busy: (f) => f.special.action !== SpecialAction.none },
  { name: "mid-dash", character: Character.rifleman, airborne: false,
    input: () => controls({ direction: -1 }), busy: (f) => f.motion.grounded && Math.abs(f.motion.vx) > 0.0 },
  { name: "in the air", character: Character.rifleman, airborne: true,
    input: () => controls(), busy: (f) => !f.motion.grounded },
];

function trace(f: Fighter): string {
  const { motion, attack, launch, ground, special } = f;
  return [motion.x, motion.z, motion.vx, motion.vz, motion.grounded, attack.style, attack.frame, launch.hitstun, launch.hitlag, ground.action, special.action, f.facing].join(",");
}

interface Run {
  readonly traces: string[];
  readonly victim: Fighter;
  readonly busyAtHit: boolean;
  readonly hitFrame: number | undefined;
}

function play(victim: Victim, throwTicks: readonly number[], shielding = false, frames = WATCH_FRAMES): Run {
  const maiev = createFighter(Character.warden, 0.0, 1);
  const target = createFighter(victim.character, GAP, -1);
  if (victim.airborne) {
    lift(maiev, AIR_HEIGHT);
    lift(target, AIR_HEIGHT);
  }
  const { world } = duelPair(maiev, target);
  const traces: string[] = [];
  let hitFrame: number | undefined;
  let busyAtHit = false;
  for (let tick = 1; tick <= frames; tick++) {
    const before = target.status.damage;
    const wasBusy = victim.busy(target);
    const press = throwTicks.includes(tick) ? THROW : controls();
    stepDuel(world, press, shielding ? controls({ shield: true }) : victim.input(tick));
    traces.push(trace(target));
    if (hitFrame === undefined && target.status.damage > before) {
      hitFrame = tick;
      busyAtHit = wasBusy;
    }
  }
  return { traces, victim: target, busyAtHit, hitFrame };
}

function stacked(stacks: number): { world: ReturnType<typeof duelPair>["world"]; maiev: Fighter; target: Fighter } {
  const maiev = createFighter(Character.warden, 0.0, 1);
  const target = createFighter(Character.rifleman, GAP, -1);
  const { world } = duelPair(maiev, target);
  for (let stack = 0; stack < stacks; stack++) applyHeroStatus(target, SHADOW_POISON);
  return { world, maiev, target };
}

test("Shadow Strike is flinchless: its dagger hits a foe mid-attack, mid-dash or in the air without changing its action, velocity or position, adding 2 damage and one poison stack [k1 scenario]", () => {
  for (const victim of VICTIMS) {
    const control = play(victim, []);
    const struck = play(victim, [1]);
    assertEquals(struck.hitFrame !== undefined, true, `${victim.name}: the dagger lands`);
    assertEquals(struck.busyAtHit, true, `${victim.name}: busy at the hit`);
    assertEquals(struck.traces.join("|"), control.traces.join("|"), `${victim.name}: action, velocity and position follow the undisturbed run`);
    assertEquals(struck.victim.launch.hitstun, 0, `${victim.name}: no hitstun`);
    assertEquals(struck.victim.launch.hitlag, 0, `${victim.name}: no hitlag`);
    assertEquals(struck.victim.status.damage, DAGGER_DAMAGE, `${victim.name}: dagger damage`);
    assertEquals(struck.victim.status.poisonStacks, 1, `${victim.name}: one stack`);
    assertGreaterThan(struck.victim.status.poisonStackFrames, 0);
  }
});

test("Shadow Strike's poison stacks with each dagger hit and refreshes the 120-frame timer [k3 measure docs/design/maiev.md]", () => {
  const standing: Victim = { name: "standing", character: Character.rifleman, airborne: false, input: () => controls(), busy: () => false };
  const run = play(standing, [1, SECOND_THROW_TICK], false, 90);
  assertEquals(run.victim.status.poisonStacks, 2);
  assertEquals(run.victim.status.damage, DAGGER_DAMAGE * 2);
  assertGreaterThan(run.victim.status.poisonStackFrames, SHADOW_POISON_FRAMES - 60);
  assertEquals(run.victim.visuals.poisonBursts, 0);
});

test("The poison stops at five stacks and every further hit only refreshes its timer [k3 measure docs/design/maiev.md]", () => {
  const { target } = stacked(SHADOW_POISON_CAP + 3);
  assertEquals(SHADOW_POISON_CAP, 5);
  assertEquals(target.status.poisonStacks, SHADOW_POISON_CAP);
  assertEquals(target.status.poisonStackFrames, SHADOW_POISON_FRAMES);
});

test("A fresh dagger hit puts the poison timer back to 120 frames without losing stacks [k3 measure docs/design/maiev.md]", () => {
  const { world, target } = stacked(2);
  for (let frame = 0; frame < 100; frame++) stepDuel(world);
  assertEquals(target.status.poisonStackFrames, SHADOW_POISON_FRAMES - 100);
  assertEquals(target.status.poisonStacks, 2);
  applyHeroStatus(target, SHADOW_POISON);
  assertEquals(target.status.poisonStackFrames, SHADOW_POISON_FRAMES);
  assertEquals(target.status.poisonStacks, 3);
  for (let frame = 0; frame < SHADOW_POISON_FRAMES - 1; frame++) stepDuel(world);
  assertEquals(target.status.poisonStacks, 3);
  assertEquals(target.status.damage, 0.0);
});

test("When the timer runs out the poison bursts for 1 damage a stack and clears, with no hitstun, hitlag, knockback or change of action [k3 measure docs/design/maiev.md]", () => {
  for (const victim of VICTIMS) {
    for (const stacks of [1, SHADOW_POISON_CAP]) {
      const control = stacked(0);
      const popped = stacked(0);
      if (victim.airborne) {
        lift(control.target, 40.0);
        lift(popped.target, 40.0);
      }
      for (let stack = 0; stack < stacks; stack++) applyHeroStatus(popped.target, SHADOW_POISON);
      const traces = { control: [] as string[], popped: [] as string[] };
      for (let tick = 1; tick <= SHADOW_POISON_FRAMES + 20; tick++) {
        stepDuel(control.world, controls(), victim.input(tick));
        stepDuel(popped.world, controls(), victim.input(tick));
        traces.control.push(trace(control.target));
        traces.popped.push(trace(popped.target));
        if (tick < SHADOW_POISON_FRAMES) assertEquals(popped.target.status.damage, 0.0, `${victim.name}, ${stacks} stacks: no damage before the timer ends`);
      }
      assertEquals(popped.target.status.damage, stacks, `${victim.name}, ${stacks} stacks: burst damage is one a stack`);
      assertEquals(popped.target.status.poisonStacks, 0);
      assertEquals(popped.target.status.poisonStackFrames, 0);
      assertEquals(popped.target.visuals.poisonBursts, 1);
      assertEquals(traces.popped.join("|"), traces.control.join("|"), `${victim.name}, ${stacks} stacks: the burst does not disturb the victim`);
    }
  }
});

test("The poison stacks roll back: restoring a saved fighter replays the same stacks, timer, burst damage and burst count [k1 scenario]", () => {
  const { world, target } = stacked(3);
  for (let frame = 0; frame < 50; frame++) stepDuel(world);
  const saved = createFighter(Character.rifleman, GAP, -1);
  copyFighterState(saved, target, 3);
  for (let frame = 0; frame < 80; frame++) stepDuel(world);
  const after = createFighter(Character.rifleman, GAP, -1);
  copyFighterState(after, target, 3);
  assertEquals(after.status.damage, 3.0);
  assertEquals(after.visuals.poisonBursts, 1);
  copyFighterState(target, saved, 3);
  assertTrue(sameFighterState(target, saved));
  assertEquals(target.status.poisonStacks, 3);
  assertEquals(target.status.poisonStackFrames, SHADOW_POISON_FRAMES - 50);
  assertEquals(target.visuals.poisonBursts, 0);
  for (let frame = 0; frame < 80; frame++) stepDuel(world);
  assertEquals(target.status.damage, after.status.damage);
  assertEquals(target.status.poisonStacks, after.status.poisonStacks);
  assertEquals(target.status.poisonStackFrames, after.status.poisonStackFrames);
  assertEquals(target.visuals.poisonBursts, after.visuals.poisonBursts);
});

test("Shadow Strike on a raised shield is blocked as any projectile is: no damage and no poison [k1 scenario]", () => {
  const run = play(VICTIMS[1]!, [1], true);
  assertEquals(run.victim.status.damage, 0.0);
  assertEquals(run.victim.status.poisonStacks, 0);
  assertEquals(run.hitFrame, undefined);
});

import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { Action } from "../../input/actions";
import { type Scene, fighter, frame, scene } from "../../match/padScene";
import { Character, HeroStatusKind, SpecialAction } from "../../sim/codes";
import { fillMeter } from "../../sim/meter";

const FOE_PRESS = 1;
const STORM_PRESS = 5;
const WATCH = 90;
const BLADESTORM_LAST_FRAME = 78;

interface Exchange {
  readonly damage: number;
  readonly registered: boolean;
  readonly hitstun: boolean;
  readonly status: boolean;
  readonly grabbed: boolean;
  readonly stormed: boolean;
  readonly passed: boolean;
  readonly cue: boolean;
}

function exchange(foe: Character, foeX: number, press: readonly Action[], stormy: boolean): Exchange {
  const s: Scene = scene(0, [{ character: Character.blademaster, x: 0.0, facing: 1 }, { character: foe, x: foeX, facing: -1 }]);
  const target = fighter(s, 0);
  const attacker = fighter(s, 1);
  fillMeter(target);
  let registered = false;
  let hitstun = false;
  let status = false;
  let grabbed = false;
  let stormed = false;
  let passed = false;
  for (let n = 1; n <= WATCH; n++) {
    frame(s, stormy && n === STORM_PRESS ? [Action.attack, Action.special] : [], n === FOE_PRESS ? press : []);
    const covered = target.special.action === SpecialAction.heroUltimate && target.special.frame <= BLADESTORM_LAST_FRAME;
    stormed ||= covered;
    registered ||= attacker.special.hit;
    hitstun ||= target.launch.hitstun > 0;
    status ||= target.status.condition !== HeroStatusKind.none || target.status.poisonStacks > 0 || target.status.curseFrames > 0;
    grabbed ||= target.grab.owner !== undefined;
    passed ||= attacker.projectiles.some((p) => p.life > 0 && p.x < target.motion.x - 40.0);
    if (stormy && n > STORM_PRESS && !covered) break;
  }
  return { damage: target.status.damage, registered, hitstun, status, grabbed, stormed, passed, cue: target.visuals.spellPass > 0 };
}

const NEUTRAL = [Action.special] as const;
const DOWN = [Action.special, Action.moveDown] as const;

const SPECIALS: readonly (readonly [string, Character, number, readonly Action[]])[] = [
  ["Warden Shadow Strike (projectile, poison)", Character.warden, 320.0, NEUTRAL],
  ["Dreadlord Sleep (projectile, sleep)", Character.dreadlord, 320.0, DOWN],
  ["Malfurion Entangling Roots (roots)", Character.malfurion, 160.0, NEUTRAL],
  ["Thrall Doomhammer Slam (melee)", Character.thrall, 70.0, DOWN],
  ["Cairne War Stomp (melee)", Character.cairne, 70.0, DOWN],
  ["Kael Banish (status)", Character.kaelthas, 100.0, DOWN],
];

for (const [name, character, x, press] of SPECIALS) {
  test(`${name} hits Blademaster outside Bladestorm [k1 scenario]`, () => {
    const out = exchange(character, x, press, false);
    assertTrue(out.damage > 0.0 || out.status);
  });

  test(`${name} passes through Blademaster during Bladestorm [k1 scenario]`, () => {
    const out = exchange(character, x, press, true);
    assertTrue(out.stormed);
    assertEquals(out.damage, 0.0);
    assertFalse(out.registered);
    assertFalse(out.hitstun);
    assertFalse(out.status);
  });
}

test("A projectile special flies on through Bladestorm instead of being spent on him [k1 scenario]", () => {
  assertTrue(exchange(Character.warden, 320.0, NEUTRAL, true).passed);
});

test("A special passing through Bladestorm leaves the spell-immune cue [k1 scenario]", () => {
  assertTrue(exchange(Character.warden, 320.0, NEUTRAL, true).cue);
  assertFalse(exchange(Character.warden, 320.0, NEUTRAL, false).cue);
});

test("A forward smash still connects with Blademaster during Bladestorm [k1 scenario]", () => {
  const out = exchange(Character.warden, 70.0, [Action.strong, Action.moveLeft], true);
  assertTrue(out.stormed);
  assertGreaterThan(out.damage, 0.0);
});

test("A grab still connects with Blademaster during Bladestorm [k1 scenario]", () => {
  const out = exchange(Character.warden, 70.0, [Action.grab], true);
  assertTrue(out.stormed);
  assertTrue(out.grabbed);
});

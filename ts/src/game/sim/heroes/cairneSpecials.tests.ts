import { assertDefined, assertEquals, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { imod } from "wisp/src/sim/intMath";
import { AttackStyle, Character, SpecialAction } from "../codes";
import { type Fighter, createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { SpecialForm, specialForm } from "../specials/schema";
import { ROSTER_MANA } from "../mana";
import { attackStartupFrames } from "../moves";
import { beginFighterAttack } from "../attacks";
import { type Roster } from "../roster";
import { controls } from "../testWorld";
import { duelPair, stepDuel } from "../testDuel";
import { copyFighterState } from "../../../generated/state/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { projectedProjectile } from "../../presentation/projectilePose";
import { PROJECTILE_DRAW_CUES } from "../../presentation/projectileArt";
import { CAIRNE_SPECIALS } from "./cairneSpecials";

const H = HERO_REFERENCE_HEIGHT;
const GORE = assertDefined(CAIRNE_SPECIALS.side.ground.commandGrab);
const STOMP = CAIRNE_SPECIALS.down.ground;
const STOMP_ARMOR = assertDefined(STOMP.armor);
// WarStompCaster.mdx ring geoset half-width at scale 1 (ts/scripts/wisp/model-facts).
const WAR_STOMP_RING_HALF_WIDTH = 340.0;
const SIDE = controls({ specialPressed: true, specialX: 1, direction: 1 });
const DOWN = controls({ specialPressed: true, specialZ: -1, verticalDirection: -1 });
const SHIELD = controls({ shield: true, shieldPressed: true });

const runningAction = (fighter: Readonly<Fighter>): SpecialAction => fighter.special.action;

function cairneVersus(gap: number, character: Character): { world: Roster; owner: Fighter; target: Fighter } {
  return duelPair(createFighter(Character.cairne, 0.0, 1), createFighter(character, gap, -1));
}

test("Bloodhoof Gore catches a shielding foe, holds 20 frames and launches forward with 10.8 damage [k1 scenario]", () => {
  const { world, owner, target } = cairneVersus(H, Character.rifleman);
  for (let tick = 0; tick < 10; tick++) stepDuel(world, controls(), SHIELD);
  assertTrue(target.shield.raised);
  stepDuel(world, SIDE, SHIELD);
  let caught = 0;
  let thrownAt = 0;
  for (let tick = 0; tick < 80 && thrownAt === 0; tick++) {
    stepDuel(world, controls(), controls({ shield: true }));
    if (caught === 0 && owner.special.grabFrame > 0) {
      caught = owner.special.grabFrame;
      assertEquals(target.shield.raised, false);
      assertEquals(target.grab.owner, 0);
    }
    if (caught > 0 && target.status.damage === 0.0) assertEquals(target.grab.owner, 0, `held on frame ${owner.special.frame}`);
    if (target.status.damage > 0.0) thrownAt = owner.special.frame;
  }
  assertTrue(target.launch.knockbackX > 0.0 && target.launch.knockbackZ > 0.0);
  assertTrue(caught >= GORE.first && caught <= GORE.last);
  assertEquals(GORE.holdFrames, 20);
  assertEquals(thrownAt, caught + GORE.holdFrames);
  assertEquals(target.status.damage, 10.763999938964844);
  for (let tick = 0; tick < 40; tick++) stepDuel(world);
  assertTrue(target.motion.x > owner.motion.x + H);
});

test("Bloodhoof Gore never catches a foe who spot dodges on frame 10 [k1 scenario]", () => {
  const { world, owner, target } = cairneVersus(H, Character.rifleman);
  for (let tick = 0; tick < 10; tick++) stepDuel(world, controls(), SHIELD);
  stepDuel(world, SIDE, SHIELD);
  while (owner.special.action === SpecialAction.heroSide) {
    const dodge = owner.special.frame + 1 === 10 ? controls({ ...SHIELD, groundDodgePressed: true, groundDodgeDirection: 0 }) : controls({ shield: true });
    stepDuel(world, controls(), dodge);
    assertEquals(owner.special.grabFrame, 0, `caught on frame ${owner.special.frame}`);
  }
  assertEquals(target.status.damage, 0.0);
});

test("replaying Bloodhoof Gore and War Stomp from a restored snapshot reproduces both fighters [k1 scenario]", () => {
  const { world, owner, target } = cairneVersus(H, Character.rifleman);
  const savedOwner = createFighter(Character.cairne, 0.0, 1);
  const savedTarget = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  const run = (each: (tick: number) => void) => {
    for (let tick = 0; tick < 162; tick++) {
      stepDuel(world, tick === 0 ? SIDE : tick === 91 ? DOWN : controls());
      if (imod(tick, 6) === 0) each(tick);
    }
  };
  const owners: Fighter[] = [];
  const targets: Fighter[] = [];
  run(() => {
    const ownerAt = createFighter(Character.cairne, 0.0, 1);
    const targetAt = createFighter(Character.rifleman, 0.0, 1);
    copyFighterState(ownerAt, owner, 3);
    copyFighterState(targetAt, target, 3);
    owners.push(ownerAt);
    targets.push(targetAt);
  });
  assertTrue(target.status.damage > GORE.effect.damage);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(target, savedTarget, 3);
  run((tick) => {
    const index = tick / 6;
    assertEquals(firstFighterDifference(assertDefined(owners[index]), owner, 3, 3), undefined, `owner tick ${tick}`);
    assertEquals(firstFighterDifference(assertDefined(targets[index]), target, 3, 3), undefined, `target tick ${tick}`);
  });
});

function stompAgainst(style: AttackStyle): { owner: Fighter; attacker: Fighter; struckOn: number; stompedOn: number } {
  const { world, owner, target: attacker } = cairneVersus(70.0, Character.cairne);
  const stompTick = 30;
  const attackTick = stompTick + 9 - attackStartupFrames(style, attacker.tuning.moves);
  let struckOn = 0;
  let stompedOn = 0;
  for (let tick = 0; tick < stompTick + STOMP.endFrame; tick++) {
    if (tick === attackTick) beginFighterAttack(world, 1, style, false);
    const before = owner.status.damage;
    const hitBefore = attacker.status.damage;
    stepDuel(world, tick === stompTick ? DOWN : controls());
    if (struckOn === 0 && (owner.status.damage > before || owner.grab.owner === 1)) struckOn = owner.special.action === SpecialAction.heroDown ? owner.special.frame : -1;
    if (stompedOn === 0 && attacker.status.damage > hitBefore) stompedOn = owner.special.frame;
  }
  return { owner, attacker, struckOn, stompedOn };
}

test("War Stomp's armor absorbs one hit of 8 or less in f6-19 and still stomps; a 9+ hit or a grab interrupts it [k1 scenario]", () => {
  assertEquals(STOMP_ARMOR.first, 6);
  assertEquals(STOMP_ARMOR.last, 19);
  assertEquals(STOMP_ARMOR.maxDamage, 8.0);
  const light = stompAgainst(AttackStyle.jab);
  assertTrue(light.struckOn >= STOMP_ARMOR.first && light.struckOn <= STOMP_ARMOR.last);
  assertEquals(light.stompedOn, 20);
  assertEquals(light.attacker.status.damage, assertDefined(STOMP.regions?.[0]).hit.effect.damage);
  const heavy = stompAgainst(AttackStyle.forwardTilt);
  assertTrue(heavy.owner.status.damage > STOMP_ARMOR.maxDamage);
  assertEquals(heavy.stompedOn, 0);
  assertEquals(heavy.attacker.status.damage, 0.0);
  const grab = stompAgainst(AttackStyle.grab);
  assertEquals(grab.stompedOn, 0);
  assertEquals(grab.attacker.status.damage, 0.0);
});

test("War Stomp's ring spawns on f20, never hits, and draws at the regions' reach (130, EX 156) within 5% [k3 measure docs/design/cairne.md]", () => {
  for (const ex of [false, true]) {
    const form = specialForm(CAIRNE_SPECIALS.down, SpecialForm.ground, ex);
    const ring = assertDefined(form.projectiles?.[0]);
    const front = assertDefined(form.regions?.[0]?.hit.strike);
    const reach = f32(front.x2 + front.radius);
    assertNear(reach, ex ? 156.0 : 130.0, f32(0.01));
    const { world, owner, target } = cairneVersus(-600.0, Character.rifleman);
    owner.mana.points = ROSTER_MANA.max;
    stepDuel(world, controls({ specialPressed: true, specialX: 0, direction: 0 }));
    while (runningAction(owner) !== SpecialAction.none) stepDuel(world);
    const wave = owner.projectiles.findIndex((shot) => shot.life > 0);
    assertTrue(wave >= 0);
    stepDuel(world, ex ? controls({ ...DOWN, exPressed: true }) : DOWN);
    assertEquals(owner.special.action, SpecialAction.heroDown);
    assertEquals(owner.special.ex, ex);
    let drawn = 0;
    while (runningAction(owner) === SpecialAction.heroDown) {
      const rings = owner.projectiles.map((shot, index) => ({ shot, index })).filter(({ shot }) => shot.life > 0 && shot.spec === ring);
      assertEquals(rings.length, owner.special.frame >= ring.spawnFrame && owner.special.frame < ring.spawnFrame + ring.life - 1 ? 1 : 0, `frame ${owner.special.frame}`);
      for (const { index } of rings) {
        const pose = projectedProjectile(owner, index, true);
        assertEquals(pose.armed, false);
        assertEquals(pose.pitch, 0.0);
        const halfWidth = f32(pose.modelScale * assertDefined(PROJECTILE_DRAW_CUES[ring.model ?? ""]).scale * WAR_STOMP_RING_HALF_WIDTH);
        assertNear(halfWidth, reach, f32(reach * f32(0.05)));
        drawn++;
      }
      stepDuel(world);
    }
    assertEquals(drawn, ring.life - 1);
    assertEquals(target.status.damage, 0.0);
  }
});

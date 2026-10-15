import { assertDefined, assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { heroRegion } from "./heroMoves";
import { enterHeroSpecial, runningHeroSpecial, specialVariant } from "./heroSpecialRules";
import { withExKit } from "./exSpecialAuthoring";
import { ROSTER_MANA } from "./mana";
import { type AuthoredSpecial, type FighterSpecials, SpecialForm, SpecialSlot, frames } from "./heroSpecials";
import { type Roster, fighterAt } from "./roster";
import { controls } from "./testWorld";
import { copyFighterState } from "../replay/fighterState";
import { firstFighterDifference, firstStateDifference } from "../replay/difference";
import { copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { Action, maskOf } from "../input/actions";
import { adaptInput } from "../input/adapter";
import { inputRow } from "../input/inputRow";
import { Phase } from "../match/rules";
import { stepMatch } from "../match/step";
import { setWorldMotionValue } from "./motion";
import { duelPair, stepDuel } from "./testDuel";

const hit = (damage: number) => ({ damage, growth: 80.0, base: 20.0, launchX: f32(0.8), launchZ: f32(0.6), electric: false });

const NEUTRAL: AuthoredSpecial = {
  endFrame: 20,
  projectiles: [{ spawnFrame: 5, offsetX: 40.0, offsetZ: 60.0, velocityX: 12.0, velocityZ: 0.0, life: 40, radius: 15.0, effect: hit(6.0), reflectable: true, limit: 1 }],
};
const SIDE: AuthoredSpecial = {
  endFrame: 30,
  regions: [heroRegion(10, 12, { x1: 10.0, z1: 50.0, x2: 90.0, z2: 50.0, radius: 12.0 }, hit(10.0))],
};
const UP: AuthoredSpecial = { endFrame: 25, helpless: true, oncePerAirtime: true, motion: [{ ...frames(5, 20), velocityX: 0.0, velocityZ: 12.0 }] };
const DOWN: AuthoredSpecial = { endFrame: 30, groundOnly: true, intangible: frames(5, 8), armor: { ...frames(10, 20), maxDamage: 6.0 } };

const KIT: FighterSpecials = {
  neutral: { name: "Test Bolt", description: "", ground: NEUTRAL },
  side: { name: "Test Dash", description: "", ground: SIDE },
  up: { name: "Test Rise", description: "", ground: UP },
  down: { name: "Test Guard", description: "", ground: DOWN },
};

function hero(x: number, facing: number): Fighter {
  const f = createFighter(Character.blademaster, x, facing);
  f.tuning = { ...f.tuning, specials: KIT };
  f.mana.points = ROSTER_MANA.max;
  return f;
}


function pair(gap = 300.0): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = hero(-gap * 0.5, 1);
  const target = createFighter(Character.rifleman, gap * 0.5, -1);
  return duelPair(owner, target);
}

const side = controls({ specialPressed: true, specialX: 1 });
const up = controls({ specialPressed: true, specialZ: 1 });
const neutral = controls({ specialPressed: true });

test("a regular hero special spends no meter and the fighter acts again the frame after its end [k3 measure #335]", () => {
  const { world, owner } = pair(600.0);
  stepDuel(world, side);
  assertEquals(owner.special.action, SpecialAction.heroSide);
  assertEquals(owner.mana.points, 100);
  for (let f = 2; f <= 29; f++) stepDuel(world, side);
  assertEquals(owner.special.action, SpecialAction.heroSide);
  assertEquals(owner.mana.points, 100);
  stepDuel(world);
  assertEquals(owner.special.action, SpecialAction.none);
  stepDuel(world, neutral);
  assertEquals(owner.special.action, SpecialAction.heroNeutral);
});

test("a hero special keeps the variant latched at entry while the live variant differs, and its EX is that variant's EX [k2 property]", () => {
  const strike = { x1: 10.0, z1: 50.0, x2: 90.0, z2: 50.0, radius: 12.0 };
  const kit = withExKit({ name: "Test Dash", description: "", ground: { ...SIDE, variants: [
    { ...SIDE, regions: [heroRegion(10, 12, strike, hit(12.0))] },
    { ...SIDE, regions: [heroRegion(8, 14, strike, hit(14.0))] },
  ] } }, { damage: 1.25 });
  const variants = kit.ground.variants ?? [];
  for (const ex of [false, true]) {
    for (let variant = 0; variant <= variants.length; variant++) {
      const { world, owner } = pair(600.0);
      owner.tuning = { ...owner.tuning, specials: { ...KIT, side: kit } };
      const input = controls({ specialPressed: true, specialX: 1, shield: ex });
      stepDuel(world, input);
      assertEquals(owner.special.ex, ex);
      enterHeroSpecial(owner, { slot: SpecialSlot.side, form: SpecialForm.ground, variant }, input);
      const base = variant === 0 ? kit.ground : at(variants, variant - 1);
      const expected = ex ? base.ex : base;
      assertDefined(expected);
      for (let f = 0; f < 20; f++) {
        assertEquals(owner.special.action, SpecialAction.heroSide);
        assertEquals(owner.special.variant, variant);
        assertEquals(specialVariant(owner), 0);
        assertTrue(runningHeroSpecial(owner) === expected);
        stepDuel(world);
      }
    }
  }
});

test("replaying a hero special from a restored snapshot reproduces every fighter field [k1 scenario]", () => {
  const { world, owner, target } = pair(200.0);
  const savedOwner = createFighter(Character.blademaster, 0.0, 1);
  const savedTarget = createFighter(Character.rifleman, 0.0, 1);
  stepDuel(world, neutral);
  stepDuel(world);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  const run = () => {
    stepDuel(world, side);
    for (let f = 0; f < 50; f++) stepDuel(world, f === 30 ? up : controls());
  };
  run();
  const endOwner = createFighter(Character.blademaster, 0.0, 1);
  const endTarget = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(endOwner, owner, 3);
  copyFighterState(endTarget, target, 3);
  assertGreaterThan(target.status.damage, 0.0);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(target, savedTarget, 3);
  run();
  assertEquals(firstFighterDifference(endOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(endTarget, target, 3, 3), undefined);
});

test("seed 448's early down-special landings, first-window Grom landing, 11 offstage casts and falling trap replay every frame [k1 scenario]", () => {
  const characters = [Character.blademaster, Character.mountainKing, Character.lich, Character.dreadlord,
    Character.shadowHunter, Character.pitLord, Character.chen, Character.peon, Character.tinker,
    Character.kaelthas, Character.grom, Character.kobold, Character.rifleman, Character.forsakenPaladin,
    Character.beastmaster, Character.lichKing, Character.thrall, Character.jaina, Character.sylvanas,
    Character.cairne, Character.murloc, Character.anubarak, Character.malfurion];
  let scenarios = 0;
  for (const character of characters) {
    const aerial = character === Character.rifleman || character === Character.forsakenPaladin || character === Character.beastmaster
      || character === Character.lichKing || character === Character.thrall || character === Character.jaina || character === Character.sylvanas
      || character === Character.cairne || character === Character.murloc || character === Character.anubarak || character === Character.malfurion;
    const falls = character === Character.mountainKing || character === Character.lich || character === Character.dreadlord
      || character === Character.shadowHunter || character === Character.pitLord || character === Character.grom;
    for (let setup = 0; setup < (character === Character.grom ? 3 : falls || character === Character.rifleman ? 2 : 1); setup++) {
      const fallingTrap = character === Character.rifleman && setup === 1;
      const offstage = aerial && !fallingTrap;
      const live = createReplaySnapshot();
      const replay = createReplaySnapshot();
      const owner = fighterAt(live.world, 0);
      copyFighterState(owner, createFighter(character, offstage ? 900.0 : 100.0, 1), 3);
      copyFighterState(fighterAt(live.world, 1), createFighter(Character.rifleman, -480.0, 1), 3);
      owner.motion.z = fallingTrap ? 600.0 : setup === 2 ? 310.0 : setup === 0 && !offstage ? 40.0 : 240.0;
      owner.motion.vz = fallingTrap ? 0.0 : setup === 0 && !offstage ? -1.0 : -4.0;
      owner.motion.grounded = false;
      owner.motion.surface = undefined;
      setWorldMotionValue(owner.motion.meleeX, owner.motion.x);
      setWorldMotionValue(owner.motion.meleeZ, owner.motion.z);
      setWorldMotionValue(owner.motion.meleeVelocityZ, owner.motion.vz);
      live.match.phase = Phase.match;
      live.match.stageChoice = 0;
      live.match.matchSeed = 448;
      live.match.hazards = false;
      live.match.items.on = false;
      live.match.timeLimitMinutes = 0;
      live.match.ultimatesOff = true;
      copyReplayState(replay, live);
      let landed = false;
      let effect = false;
      for (let tick = 1; tick <= 80; tick++) {
        const row = assertDefined(inputRow({ held: tick === 1 ? maskOf(Action.moveDown, Action.special) : maskOf(Action.moveDown),
          pressed: tick === 1 ? maskOf(Action.special) : 0, axisZ: -127, specialZ: tick === 1 ? -1 : 0 }));
        for (const state of [live, replay]) {
          adaptInput(row, fighterAt(state.world, 0), tick, state.controls.inputs[0], state.controls.commands[0]);
          stepMatch(state.match, state.world, state.controls, tick);
        }
        const difference = firstStateDifference(live, replay);
        if (difference !== undefined) throw new Error(`seed 448 character ${character} setup ${setup} frame ${tick}: ${difference}`);
        if (!offstage && !landed && owner.motion.grounded) {
          landed = true;
          assertEquals(owner.special.action, fallingTrap ? SpecialAction.riflemanTrap : SpecialAction.heroDown);
          assertEquals(owner.special.form, 0);
          assertEquals(owner.special.frame, tick);
          if (setup === 2) assertEquals(tick, 19);
        }
        const move = runningHeroSpecial(owner);
        if (owner.freezeTrap.life > 0 && owner.freezeTrap.surface === undefined) assertGreaterThan(owner.freezeTrap.arming, 0);
        effect = effect || move?.regions?.some(region => owner.special.frame >= region.firstFrame && owner.special.frame <= region.lastFrame) === true
          || (move?.commandGrab !== undefined && owner.special.frame >= move.commandGrab.first && owner.special.frame <= move.commandGrab.last)
          || owner.projectiles.some(projectile => projectile.life > 0) || owner.placed.life > 0 || owner.freezeTrap.life > 0
          || owner.status.armorFrames > 0 || (move?.guard !== undefined && owner.special.frame >= move.guard.first && owner.special.frame <= move.guard.last);
      }
      assertEquals(landed, !offstage);
      assertEquals(effect, true);
      if (fallingTrap) {
        assertEquals(owner.freezeTrap.surface, 0);
        assertEquals(owner.freezeTrap.arming, 0);
        assertEquals(owner.freezeTrap.z, 0.0);
      }
      fighterAt(replay.world, 0).special.form = 99;
      assertDefined(firstStateDifference(live, replay));
      scenarios++;
    }
  }
  assertEquals(scenarios, 31);
});


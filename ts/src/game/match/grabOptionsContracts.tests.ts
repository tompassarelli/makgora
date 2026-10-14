import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { sweep } from "../../runtime/sweep";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { queueAttack } from "../input/attackBuffer";
import { beginFighterAttack, resolveAttacks } from "../sim/attacks";
import { AttackStyle, Character, DASH_GRAB_REQUEST, GroundAction } from "../sim/codes";
import { attackActive, attackStartup, canAttack } from "../sim/conditions";
import { createFighter } from "../sim/fighter";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { authoredHitRegion, emptyHitRegion } from "../sim/hitRegions";
import { attackStartupFrames, characterAttackActiveFrames } from "../sim/moves";
import { copyControls, createRoster, fighterAt } from "../sim/roster";
import { SHIELD_MIN_HOLD_FRAMES } from "../sim/shield";
import { controls } from "../sim/testWorld";
import { createBufferedFrameControls } from "./controls";
import { Phase, createMatchState } from "./rules";
import { stepMatch } from "./step";

function duel(character: Character) {
  const game = createMatchState();
  game.phase = Phase.match;
  const world = createRoster(3, [createFighter(character, -40.0, 1), createFighter(character, 40.0, -1)]);
  return { game, world, inputs: createBufferedFrameControls() };
}

test("standing grabs across the roster meet scaled Melee reach, height and active frames within ten percent [k4 reference references/melee-frame-data/libmelee.jsonl]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const fighter = createFighter(character, 0.0, 1);
    const hit = emptyHitRegion();
    authoredHitRegion(hit, character, AttackStyle.grab, attackStartupFrames(AttackStyle.grab, fighter.tuning.moves), 0, 0, fighter.tuning.moves);
    assertTrue(Math.abs(hit.maxX - 96.0) <= f32(9.6));
    assertTrue(Math.abs(f32(hit.maxZ - hit.minZ) - 50.0) <= 5.0);
    assertEquals(characterAttackActiveFrames(character, AttackStyle.grab, fighter.tuning.moves), 3, fighterName(character));
  }
});

test("grab on every jump squat frame starts a grounded standing grab without takeoff [k4 reference docs/design/melee/techniques.md#shield-drop-jump-cancelled-grab-and-up-smash]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const count = createFighter(character, 0.0, 1).tuning.physics.jumpSquatFrames;
    for (let squatFrame = 0; squatFrame < count; squatFrame++) {
      const d = duel(character);
      const f = fighterAt(d.world, 0);
      for (let frame = 0; frame <= squatFrame; frame++) {
        copyControls(d.inputs.inputs[0], controls({ jumpPressed: frame === 0, jumpHeld: true, direction: 1 }));
        if (frame === squatFrame) queueAttack(d.inputs.commands[0], { style: AttackStyle.grab, facing: 0, frame: frame + 1, mayCharge: false });
        stepMatch(d.game, d.world, d.inputs, frame + 1);
      }
      const name = `${fighterName(character)} squat frame ${squatFrame}`;
      assertEquals(f.attack.style, AttackStyle.grab, name);
      assertEquals(f.attack.dashGrab, false, name);
      assertEquals(f.jump.squat, 0, name);
      assertEquals(f.jump.serial, 0, name);
      assertTrue(f.motion.grounded);
    }
  }
});

test("up smash on every jump squat frame starts a grounded up smash without takeoff [k4 reference docs/design/melee/techniques.md#shield-drop-jump-cancelled-grab-and-up-smash]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const count = createFighter(character, 0.0, 1).tuning.physics.jumpSquatFrames;
    for (let squatFrame = 0; squatFrame < count; squatFrame++) {
      const d = duel(character);
      const f = fighterAt(d.world, 0);
      for (let frame = 0; frame <= squatFrame; frame++) {
        copyControls(d.inputs.inputs[0], controls({ jumpPressed: frame === 0, jumpHeld: true, verticalDirection: 1 }));
        if (frame === squatFrame) queueAttack(d.inputs.commands[0], { style: AttackStyle.upSmash, facing: 0, frame: frame + 1, mayCharge: false });
        stepMatch(d.game, d.world, d.inputs, frame + 1);
      }
      const name = `${fighterName(character)} squat frame ${squatFrame}`;
      assertEquals(f.attack.style, AttackStyle.upSmash, name);
      assertEquals(f.jump.squat, 0, name);
      assertEquals(f.jump.serial, 0, name);
      assertTrue(f.motion.grounded);
    }
  }
});

test("shield, jump, up smash charges a grounded up smash out of shield [k3 measure #550]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const d = duel(character);
    const f = fighterAt(d.world, 0);
    f.shield.raised = true;
    f.shield.heldFrames = SHIELD_MIN_HOLD_FRAMES;
    let frame = 1;
    copyControls(d.inputs.inputs[0], controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0, jumpPressed: true, jumpHeld: true }));
    stepMatch(d.game, d.world, d.inputs, frame);
    const name = fighterName(character);
    assertTrue(f.jump.squat > 0);
    frame++;
    queueAttack(d.inputs.commands[0], { style: AttackStyle.upSmash, facing: 0, frame, mayCharge: true });
    copyControls(d.inputs.inputs[0], controls({ jumpHeld: true, attackHeld: true }));
    stepMatch(d.game, d.world, d.inputs, frame);
    assertEquals(f.attack.style, AttackStyle.upSmash, name);
    assertFalse(f.shield.raised);
    for (let held = 0; held < 30; held++) stepMatch(d.game, d.world, d.inputs, ++frame);
    assertTrue(f.attack.smashChargeFrames > 0);
    assertEquals(f.jump.serial, 0, name);
    assertTrue(f.motion.grounded);
  }
});

test("standing dash and pivot grabs catch Rifleman at their scaled limit for three frames and miss beyond it [k4 reference references/melee-frame-data/libmelee.jsonl]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    for (const kind of [0, 1, 2]) {
      const reach = kind === 0 ? 96.0 : kind === 1 ? 120.0 : 144.0;
      for (const facing of [-1, 1]) {
        for (const caught of [false, true]) {
          for (let active = 0; active < 3; active++) {
            const d = duel(character);
            d.world.fighters[1] = createFighter(Character.rifleman, 0.0, -facing);
            const owner = fighterAt(d.world, 0);
            const target = fighterAt(d.world, 1);
            owner.motion.x = 0.0;
            owner.facing = facing;
            target.motion.x = f32((caught ? reach : f32(reach + 1.0)) * facing);
            if (kind === 1) owner.ground.dashFrame = 1;
            if (kind === 2) owner.ground.action = GroundAction.turnRun;
            beginFighterAttack(d.world, 0, kind === 1 ? DASH_GRAB_REQUEST : AttackStyle.grab, false);
            assertEquals(owner.attack.pivotGrab, kind === 2);
            assertEquals(attackActive(owner, AttackStyle.grab), 3);
            owner.attack.frame = attackStartup(owner, AttackStyle.grab) + active;
            resolveAttacks(d.world);
            assertEquals(owner.grab.target !== undefined, caught, `${fighterName(character)} kind ${kind} active ${active}`);
          }
        }
      }
    }
  }
});

function grabbedAndReleased(grabber: Character, percent: number, mash: boolean, pummel: boolean) {
  const d = duel(grabber);
  d.world.fighters[1] = createFighter(Character.rifleman, 40.0, -1);
  const owner = fighterAt(d.world, 0);
  const victim = fighterAt(d.world, 1);
  victim.status.damage = percent;
  queueAttack(d.inputs.commands[0], { style: AttackStyle.grab, facing: 0, frame: 1, mayCharge: false });
  let frame = 0;
  let caught = false;
  while (frame < 400 && !(caught && victim.grab.owner === undefined)) {
    frame++;
    copyControls(d.inputs.inputs[0], controls({ attackPressed: pummel && caught && owner.grab.pummels === 0 }));
    copyControls(d.inputs.inputs[1], controls({ grabMashPressed: mash && floorMod(frame, 2) === 1, direction: mash ? (floorMod(frame, 2) === 1 ? 1 : -1) : 0 }));
    stepMatch(d.game, d.world, d.inputs, frame);
    caught = caught || victim.grab.owner === 0;
  }
  assertTrue(caught);
  assertEquals(victim.grab.owner, undefined);
  return { d, owner, victim, frame };
}

sweep("every grab release leaves the victim actionable before its grabber [k3 measure #550]", () => {
  for (const grabber of SELECTABLE_CHARACTERS) {
    for (const percent of [0.0, 50.0, 100.0, 150.0]) {
      for (const [mash, pummel] of [[false, false], [true, false], [false, true]] as const) {
        const { d, owner, victim, frame } = grabbedAndReleased(grabber, percent, mash, pummel);
        let victimFree: number | undefined;
        let ownerFree: number | undefined;
        for (let after = 1; after <= 30 && ownerFree === undefined; after++) {
          copyControls(d.inputs.inputs[0], controls());
          copyControls(d.inputs.inputs[1], controls());
          stepMatch(d.game, d.world, d.inputs, frame + after);
          if (victimFree === undefined && canAttack(victim)) victimFree = after;
          if (canAttack(owner)) ownerFree = after;
        }
        const name = `${fighterName(grabber)} at ${percent}% mash ${mash} pummel ${pummel}`;
        assertEquals(victimFree !== undefined && ownerFree !== undefined && victimFree < ownerFree, true, name);
      }
    }
  }
});

test("a grabber regrabbing on its first free frame cannot catch a released victim that rolls away on its first [k3 measure #550]", () => {
  for (const grabber of SELECTABLE_CHARACTERS) {
    for (const percent of [0.0, 100.0]) {
      const { d, owner, victim, frame } = grabbedAndReleased(grabber, percent, false, false);
      let rolled = false;
      for (let after = 1; after <= 40; after++) {
        if (canAttack(owner) && owner.attack.style === undefined) queueAttack(d.inputs.commands[0], { style: AttackStyle.grab, facing: 0, frame: frame + after, mayCharge: false });
        const roll: boolean = !rolled && (canAttack(victim) || victim.shield.raised);
        rolled = rolled || roll;
        copyControls(d.inputs.inputs[0], controls());
        copyControls(d.inputs.inputs[1], controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0, groundDodgePressed: roll, groundDodgeDirection: 1 }));
        stepMatch(d.game, d.world, d.inputs, frame + after);
        assertEquals(victim.grab.owner, undefined, `${fighterName(grabber)} at ${percent}% frame ${after}`);
      }
      assertTrue(rolled);
    }
  }
});

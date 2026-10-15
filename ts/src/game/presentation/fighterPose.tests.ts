import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { createFrameControls } from "../match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import { createPacingAndPresentation } from "../match/pacingAndPresentation";
import { Phase, createMatchState } from "../lobby/lobbyState";
import { stateChecksum } from "../replay/canonical";
import { firstPoseDifference, firstStateDifference } from "../replay/difference";
import { ReplayHistory } from "../replay/history";
import { type ReplayState, captureReplaySnapshot, copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { AttackStyle, CandleState, Character, DownState, GrabAction, SpecialAction } from "../sim/codes";
import { copyFighterState } from "../../generated/state/fighterState";
import { dropCandle } from "../sim/heroes/koboldCandle";
import { KOBOLD_BARE_CLIPS, KOBOLD_CLIPS } from "../sim/heroes/koboldClips";
import { beginFighterAttack } from "../sim/attacks";
import type { HeroPose } from "../sim/heroes/hero";
import { DOWN_ROLL_FRAMES, TECH_IN_PLACE_FRAMES, TECH_ROLL_FRAMES } from "../sim/down";
import { beginDownState } from "../sim/transitions";
import { HERO_ROSTER, SELECTABLE_CHARACTERS, heroDefinition } from "../sim/heroes/registry";
import { DREADLORD_SPECIALS } from "../sim/heroes/dreadlordSpecials";
import { HERO_REFERENCE_HEIGHT } from "../sim/heroMoves";
import { createReferenceContactFighter } from "../sim/referenceRig";
import { duelPair, stepDuel } from "../sim/testDuel";
import { DREADLORD_POUNCE_CLIPS } from "./dreadlordPounceClipInfo";
import { contactDamageClip } from "./damagePose";
import { createFighter } from "../sim/fighter";
import { f32 } from "wisp/src/sim/f32";
import { characterClips, clipFor, grabActionPoses } from "./fighterClips";
import { attackStartupFrames, grabActionDuration, grabContactFrame } from "../sim/moves";
import { fighterAt, neutralControls } from "../sim/roster";
import { controls, soloWorld, testWorld } from "../sim/testWorld";
import * as dh from "./demonHunterAssetInfo";
import { FRAME_SECONDS, advanceFighterPose, copyFighterPoseInto, createFighterPose, firstFighterPoseDifference } from "./fighterPose";
import { DRAWN_STRIDES } from "./drawnStrideInfo";
import { groundLocomotionClip } from "./fighterLocomotion";
import { IllidanLocomotion, TRANSITION_FRAMES } from "./illidanMotion";

test("Kobold switches idle and ground cadence with candle ownership on the same frame [k2 property]", () => {
  for (const gait of ["idle", "walk", "dash", "run"] as const) for (const facing of [-1, 1]) {
    const f = createFighter(Character.kobold, 0.0, facing);
    const world = soloWorld(f), input = neutralControls(), pose = createFighterPose();
    input.direction = gait === "idle" ? 0 : facing;
    input.walking = gait === "walk";
    f.motion.vx = gait === "idle" ? 0.0 : f32(facing * (input.walking ? f.tuning.physics.walkSpeed : f.tuning.physics.runSpeed));
    f.ground.dashFrame = gait === "dash" ? 1 : 0;
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    assertEquals(pose.clipIndex, KOBOLD_CLIPS[gait].index);
    dropCandle(f);
    assertEquals(f.candle.state, CandleState.airborne);
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    assertEquals(pose.clipIndex, KOBOLD_BARE_CLIPS[gait].index);
    assertEquals(pose.clipTime, 0.0);
    if (gait !== "idle") {
      const speed = DRAWN_STRIDES[Character.kobold]?.[gait === "walk" ? "walk" : "run"].alternates?.[KOBOLD_BARE_CLIPS[gait].index];
      assertTrue(speed !== undefined);
      if (speed !== undefined) assertTrue(Math.abs(f32(speed * pose.rate) - f32(Math.abs(f.motion.vx) * 60.0)) < f32(0.01));
    }
    const savedFighter = createFighter(Character.kobold, 0.0, facing);
    const savedPose = createFighterPose(), expected = createFighterPose();
    copyFighterState(savedFighter, f, world.mask);
    copyFighterPoseInto(savedPose, pose, world);
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    assertGreaterThan(pose.clipTime, 0.0);
    copyFighterPoseInto(expected, pose, world);
    f.candle.state = CandleState.held;
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    assertEquals(pose.clipIndex, KOBOLD_CLIPS[gait].index);
    assertEquals(pose.clipTime, 0.0);
    copyFighterState(f, savedFighter, world.mask);
    copyFighterPoseInto(pose, savedPose, world);
    advanceFighterPose(pose, f, world, input, false, false, false, false);
    assertEquals(firstFighterPoseDifference(expected, pose, world, world), undefined);
    for (const state of [CandleState.resting, CandleState.lost]) {
      f.candle.state = state;
      advanceFighterPose(pose, f, world, input, false, false, false, false);
      assertEquals(pose.clipIndex, KOBOLD_BARE_CLIPS[gait].index);
    }
  }
});

test("every fighter walks and runs with foot cadence following ground speed [k3 measure #171]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    for (const walking of [true, false]) {
      for (const facing of [-1, 1]) {
        const f = createFighter(character, 0.0, facing);
        const input = neutralControls();
        input.direction = facing;
        input.walking = walking;
        f.motion.vx = f32(facing * (walking ? f.tuning.physics.walkSpeed : f.tuning.physics.runSpeed));
        const pose = createFighterPose();
        advanceFighterPose(pose, f, soloWorld(f), input, false, false, false, false);
        const motion = walking ? IllidanLocomotion.walk : IllidanLocomotion.run;
        const stride = DRAWN_STRIDES[character]?.[walking ? "walk" : "run"];
        assertEquals(stride !== undefined, true, `${character}: stride was not measured`);
        if (stride === undefined) continue;
        assertEquals(pose.clipIndex, groundLocomotionClip(character, motion)?.index);
        assertEquals(pose.clipIndex, stride.clip);
        assertEquals(Math.abs(f32(stride.speed * pose.rate) - f32(Math.abs(f.motion.vx) * 60.0)) < f32(0.01), true, `${character}: foot cadence does not follow travel`);
        const firstTime = pose.clipTime;
        advanceFighterPose(pose, f, soloWorld(f), input, false, false, false, false);
        assertGreaterThan(pose.clipTime, firstTime);
      }
    }
  }
});

test("replaying rows from a restored frame reproduces each pose's selection and clock [k1 scenario]", () => {
  for (const character of [Character.rifleman, Character.demonHunter]) {
    const game = createMatchState();
    game.phase = Phase.match;
    game.timeLimitMinutes = 0;
    const live: ReplayState = {
      world: testWorld(createFighter(character, -200.0, 1), createFighter(Character.rifleman, 200.0, -1)),
      match: game, controls: createFrameControls(), runtime: createPacingAndPresentation(),
    };
    const captured = createFrameControls();
    const row = createMatchFrameInput();
    const history = new ReplayHistory();
    const expected = createReplaySnapshot();
    const actual = createReplaySnapshot();
    assertTrue(history.beginEpoch(1, 1));
    for (let frame = 1; frame <= 24; frame++) {
      const input = captured.inputs[0];
      input.direction = frame < 12 ? 1 : -1;
      input.jumpPressed = frame === 4 || frame === 15;
      input.jumpHeld = frame < 10;
      assertTrue(captureFrame(row, frame, 3, captured, live.runtime));
      assertTrue(history.save(1, row, live));
      assertTrue(executeMatchFrame(row, game, live.world, live.controls, live.runtime, frame));
    }
    copyReplayState(expected, live);
    assertTrue(history.replay(1, 8, 24, live));
    copyReplayState(actual, live);
    assertEquals(firstStateDifference(expected, actual), undefined);
    assertEquals(firstPoseDifference(expected, actual), undefined);
    const gameplayChecksum = stateChecksum(actual);
    actual.runtime.poses[0].clipTime += 1.0;
    assertEquals(firstPoseDifference(expected, actual), "pose[0].clipTime");
    assertEquals(stateChecksum(actual), gameplayChecksum);
  }
});

test("contact reactions interrupt an attack, hold through airborne hitstun and recover after release [k3 measure #181]", () => {
  for (const character of SELECTABLE_CHARACTERS) for (const facing of [-1, 1]) {
    for (let height = 0; height < 3; height++) for (let strength = 0; strength < 3; strength++) {
      const f = createFighter(character, 0.0, facing);
      const world = soloWorld(f), input = neutralControls(), pose = createFighterPose();
      beginFighterAttack(world, 0, AttackStyle.forwardTilt, false);
      f.attack.frame = 3;
      advanceFighterPose(pose, f, world, input, false, false, true, false);
      const interrupted = pose.clipIndex;
      f.attack.style = undefined;
      f.visuals.hitHeight = height;
      f.visuals.hitStrength = strength;
      f.launch.hitstun = 40;
      f.launch.hitlag = 7;
      f.launch.sdiWasGrounded = true;
      f.down.state = DownState.tumble;
      advanceFighterPose(pose, f, world, input, false, false, false, true);
      assertEquals(pose.clipIndex, contactDamageClip(f).index);
      assertTrue(pose.clipIndex !== interrupted);
      assertEquals(pose.clipTime, 0.0);
      const serial = pose.selectionSerial;
      for (let held = 0; held < 7; held++) {
        advanceFighterPose(pose, f, world, input, false, false, false, false);
        assertEquals(pose.clipTime, 0.0);
        assertEquals(pose.selectionSerial, serial);
      }
      f.launch.hitlag = 0;
      f.motion.grounded = false;
      advanceFighterPose(pose, f, world, input, false, false, false, false);
      assertEquals(pose.clipIndex, contactDamageClip(f).index);
      assertEquals(pose.clipTime, 0.0);
      assertEquals(pose.rate, 0.0);
      for (let held = 0; held < 40; held++) {
        advanceFighterPose(pose, f, world, input, false, false, false, false);
        assertEquals(pose.clipIndex, contactDamageClip(f).index);
        assertEquals(pose.clipTime, 0.0);
      }
      assertEquals(f.launch.hitstun, 40);
      f.launch.hitstun = 0;
      advanceFighterPose(pose, f, world, input, false, false, false, false);
      assertTrue(pose.clipIndex !== contactDamageClip(f).index);
    }
  }
});

test("paired hero throws reach contact on the actual holder's frame across every roster pairing [k3 measure docs/design/animation-reference.md]", () => {
  for (const character of SELECTABLE_CHARACTERS) for (const hero of HERO_ROSTER) for (const facing of [-1, 1]) {
    const owner = createFighter(character, 0.0, facing);
    const victim = createFighter(hero.character, 50.0, -facing);
    const world = testWorld(owner, victim);
    owner.grab.target = 1;
    victim.grab.owner = 0;
    victim.grab.grabbedFrames = 120;
    for (const action of [GrabAction.pummel, GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown]) {
      owner.grab.action = action;
      owner.grab.serial++;
      const poses = grabActionPoses(action);
      assertTrue(poses !== undefined);
      if (poses === undefined) continue;
      const clip = clipFor(hero.character, poses.victim);
      const contact = f32(clip.contact ?? -1);
      assertTrue(contact > 0 && contact < clip.seconds);
      const pose = createFighterPose();
      owner.grab.frame = grabContactFrame(action, owner.tuning.moves) - 1;
      advanceFighterPose(pose, victim, world, neutralControls(), false, false, false, false);
      assertTrue(pose.clipTime < contact);
      owner.grab.frame++;
      advanceFighterPose(pose, victim, world, neutralControls(), false, false, false, false);
      assertEquals(pose.clipIndex, clip.index);
      assertEquals(pose.clipTime, contact);

      owner.launch.hitlag = 3;
      advanceFighterPose(pose, victim, world, neutralControls(), false, false, false, false);
      assertEquals(pose.rate, 0.0);
      assertEquals(pose.clipTime, contact);
      owner.launch.hitlag = 0;
      owner.grab.frame = grabActionDuration(action, owner.tuning.moves);
      advanceFighterPose(pose, victim, world, neutralControls(), false, false, false, false);
      assertTrue(Math.abs(pose.clipTime - clip.seconds) < f32(0.00001));
    }
  }
});

test("a hero holding a command grab plays its hold clip from grabFrame, Dreadlord unchanged [k3 measure docs/design/animation-reference.md]", () => {
  const clips = heroDefinition(Character.dreadlord)!.presentation.commandGrab!;
  const grab = DREADLORD_SPECIALS.side.ground.commandGrab!;
  for (const gap of [HERO_REFERENCE_HEIGHT, 6.0 * HERO_REFERENCE_HEIGHT]) {
    const owner = createFighter(Character.dreadlord, -gap * 0.5, 1);
    owner.mana.points = 100;
    const { world } = duelPair(owner, createReferenceContactFighter(gap * 0.5, -1));
    const pose = createFighterPose();
    const side = controls({ specialPressed: true, specialX: 1, direction: 1 });
    const running = (): boolean => owner.special.action !== SpecialAction.none;
    let held = 0;
    for (let frame = 1; frame <= 70; frame++) {
      stepDuel(world, frame === 1 ? side : controls(), controls());
      advanceFighterPose(pose, owner, world, neutralControls(), false, false, false, false);
      if (!running()) break;
      const caught = owner.special.grabFrame;
      const biting = caught > 0 && owner.special.frame < caught + 16;
      const recovering = !biting && (caught > 0 || owner.special.frame > 17);
      const clip = biting ? clips.hold : recovering ? clips.recovery : clips.travel;
      const first = biting ? caught : recovering ? caught > 0 ? caught + 16 : 18 : 1;
      if (biting) held++;
      assertEquals(pose.clipIndex, clip.index, `gap ${gap} frame ${owner.special.frame}`);
      assertEquals(pose.clipTime, f32(Math.max(0, owner.special.frame - first) * FRAME_SECONDS), `gap ${gap} frame ${owner.special.frame}`);
    }
    assertEquals(held, gap === HERO_REFERENCE_HEIGHT ? grab.holdFrames : 0);
  }
  assertEquals(clips.travel, DREADLORD_POUNCE_CLIPS.travel);
  assertEquals(clips.hold, DREADLORD_POUNCE_CLIPS.bite);
  assertEquals(clips.recovery, DREADLORD_POUNCE_CLIPS.recovery);
});

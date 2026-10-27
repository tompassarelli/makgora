import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../input/actions";
import { adaptInput } from "../match/inputAdapter";
import { inputRow } from "../input/inputRow";
import { Phase } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { createReplaySnapshot } from "../replay/snapshot";
import { copyFighterState } from "../../generated/state/fighterState";
import { Character, SpecialAction } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { fighterAt } from "../sim/roster";
import { FOLLOW_UP_FORM } from "../sim/specials/schema";
import { PEON_CLIPS } from "../fighters/peon/clips";
import { GOLD_SACK_CHARGE, GOLD_SACK_FIRST_ACTIVE } from "../fighters/peon/specials";
import { advanceFighterPose, createFighterPose } from "./fighterPose";
import { GOLD_SACK_STRIKE_SECONDS, GOLD_SACK_WINDUP_SECONDS, goldSackGlowAlpha } from "./peonPose";

const HELD_TICKS = 110;
const FIRE_TICK = 130;
const BONK = PEON_CLIPS.neutralSpecial.index;
const FULL_FIRST_ACTIVE = GOLD_SACK_FIRST_ACTIVE[GOLD_SACK_CHARGE.stages] ?? 0;

interface Frame { readonly tick: number; readonly action: SpecialAction; readonly swinging: boolean; readonly special: number; readonly charge: number; readonly clip: number | undefined; readonly time: number; readonly rate: number; readonly glow: number }

function heldGoldSack(): readonly Frame[] {
  const state = createReplaySnapshot();
  const peon = fighterAt(state.world, 0);
  copyFighterState(peon, createFighter(Character.peon, 0.0, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.peon, 600.0, -1), 3);
  state.match.phase = Phase.match;
  state.match.matchSeed = 1;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const pose = createFighterPose();
  const special = maskOf(Action.special);
  const frames: Frame[] = [];
  for (let tick = 1; tick <= FIRE_TICK + 40; tick++) {
    const held = tick <= HELD_TICKS || (tick >= FIRE_TICK && tick < FIRE_TICK + 8);
    const row = inputRow(held ? { held: special, pressed: tick === 1 || tick === FIRE_TICK ? special : 0 } : {});
    if (row === undefined) throw new Error("Gold Sack input row");
    adaptInput(row, peon, tick, state.controls.inputs[0], state.controls.commands[0]);
    stepMatch(state.match, state.world, state.controls, tick);
    advanceFighterPose(pose, peon, state.world, state.controls.inputs[0], false, false, false, false);
    frames.push({
      tick, action: peon.special.action, swinging: peon.special.form >= FOLLOW_UP_FORM, special: peon.special.frame, charge: peon.special.charge,
      clip: pose.clipIndex, time: pose.clipTime, rate: pose.rate, glow: goldSackGlowAlpha(peon),
    });
  }
  return frames;
}

test("Holding Gold Sack winds the bonk clip steadily back to a held full pose that flashes gold, and the stored sack's bonk swings on from it to strike on its first active frame [k1 scenario]", () => {
  const frames = heldGoldSack();
  const charging = frames.filter((frame) => frame.action === SpecialAction.heroNeutral && !frame.swinging);
  const swing = frames.filter((frame) => frame.action === SpecialAction.heroNeutral && frame.swinging);
  assertTrue(charging.length > GOLD_SACK_CHARGE.full);
  for (let index = 0; index < charging.length; index++) {
    const frame = charging[index];
    if (frame === undefined) continue;
    assertEquals(frame.clip, BONK, `tick ${frame.tick}: the charge plays the bonk clip`);
    assertEquals(frame.rate, 0.0, `tick ${frame.tick}: the charge pose is scrubbed, not free-running`);
    const before = charging[index - 1];
    if (before !== undefined && frame.charge > before.charge) assertTrue(frame.time > before.time);
    if (before !== undefined) assertTrue(frame.time >= before.time);
    assertEquals(frame.glow > 0, frame.charge >= GOLD_SACK_CHARGE.full, `tick ${frame.tick}: gold flash only at full charge`);
    if (frame.charge >= GOLD_SACK_CHARGE.full) assertEquals(frame.time, GOLD_SACK_WINDUP_SECONDS, `tick ${frame.tick}: the full pose is held`);
  }
  assertTrue(swing.length > FULL_FIRST_ACTIVE && swing[0]?.tick === FIRE_TICK);
  for (let index = 0; index < swing.length; index++) {
    const frame = swing[index];
    if (frame === undefined) continue;
    assertEquals(frame.clip, BONK, `tick ${frame.tick}: the bonk plays the bonk clip`);
    assertEquals(frame.charge, 0, `tick ${frame.tick}: the bonk spends the sack`);
    const before = swing[index - 1];
    if (before !== undefined) assertTrue(frame.time > before.time);
  }
  assertEquals(swing[0]?.time, GOLD_SACK_WINDUP_SECONDS, "the stored sack's bonk starts from the full windup pose");
  const strike = swing.find((frame) => frame.special === FULL_FIRST_ACTIVE);
  assertEquals(strike?.time, GOLD_SACK_STRIKE_SECONDS, "the overhead bonk lands on its first active frame");
  assertTrue((strike?.glow ?? 0) > 0);
  assertTrue(swing.some((frame) => frame.time >= f32(0.7)));
});

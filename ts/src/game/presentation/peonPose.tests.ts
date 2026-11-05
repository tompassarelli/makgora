import { assertEquals, test } from "wisp/src/runtime/testing";
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
import { GOLD_SACK_BONK_CLIPS, GOLD_SACK_CHARGE_CLIP } from "../fighters/peon/goldSackClips";
import { advanceFighterPose, createFighterPose } from "./fighterPose";
import { goldSackGlowAlpha } from "./peonPose";
import { rules } from "../../generated/fighter-art/peon";

const HELD_TICKS = 110;
const RELEASE_TICK = HELD_TICKS + 1;

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
  for (let tick = 1; tick <= RELEASE_TICK + 60; tick++) {
    const held = tick <= HELD_TICKS;
    const row = inputRow(held ? { held: special, pressed: tick === 1 ? special : 0 } : {});
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

test("Every clip Gold Sack plays, the stuffing and each stage's bonk, is kept on the timeline body the game draws [k1 scenario]", () => {
  const played = new Set(heldGoldSack().filter((frame) => frame.action === SpecialAction.heroNeutral).map((frame) => frame.clip));
  for (const clip of [GOLD_SACK_CHARGE_CLIP, ...GOLD_SACK_BONK_CLIPS]) played.add(clip.index);
  for (const clip of played) assertEquals(clip !== undefined && rules.flashClips.includes(clip), true, `clip ${clip} is missing from Peon's drawn timeline`);
});

import { assertEquals, assertGreaterThan, assertLessThan, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../input/actions";
import { adaptInput } from "../match/inputAdapter";
import { inputRow, type InputRow } from "../input/inputRow";
import { Phase } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { createReplaySnapshot } from "../replay/snapshot";
import { copyFighterState } from "../../generated/state/fighterState";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { fighterAt } from "../sim/roster";
import { FROST_SHELL_FADE_FRAMES, frostShellScale } from "./frostShell";

type Press = "frostArmor" | "walk" | "jump" | "none";

function row(press: Press): InputRow {
  const built = inputRow(press === "frostArmor" ? { held: maskOf(Action.moveDown, Action.special), pressed: maskOf(Action.special), axisZ: -127, specialZ: -1 }
    : press === "walk" ? { held: maskOf(Action.moveRight), axisX: 127 }
      : press === "jump" ? { held: maskOf(Action.jump), pressed: maskOf(Action.jump) } : {});
  if (built === undefined) throw new Error(`${press} input row`);
  return built;
}

interface Watch { readonly scales: number[]; readonly armor: number[]; readonly copied: number[] }

/** Plays Lich's Frost Armor, then `after` for each later tick, and reads the shell's scale and armor frames after every tick, also from a copy of the fighter state taken that tick. */
function lichShell(ticks: number, after: (tick: number) => Press): Watch {
  const state = createReplaySnapshot();
  const lich = fighterAt(state.world, 0);
  copyFighterState(lich, createFighter(Character.lich, 0.0, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.lich, 900.0, -1), 3);
  state.match.phase = Phase.match;
  state.match.matchSeed = 130;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const copy = createFighter(Character.lich, 0.0, 1);
  const watch: Watch = { scales: [], armor: [], copied: [] };
  for (let tick = 1; tick <= ticks; tick++) {
    adaptInput(row(tick === 1 ? "frostArmor" : after(tick)), lich, tick, state.controls.inputs[0], state.controls.commands[0]);
    stepMatch(state.match, state.world, state.controls, tick);
    copyFighterState(copy, lich, 3);
    watch.scales.push(frostShellScale(lich, 1.0));
    watch.copied.push(frostShellScale(copy, 1.0));
    watch.armor.push(lich.status.armorFrames);
  }
  return watch;
}

test("Lich's Frost Armor shell holds 240 frames after the cast and its cue is alive on each of them, through a walk and a jump, and gone the frame after it spends; a copy of the state reads the same, as a rollback re-simulation does [k1 scenario]", () => {
  const watch = lichShell(320, (tick) => (tick >= 60 && tick < 90 ? "walk" : tick === 120 ? "jump" : "none"));
  const held = watch.armor.map((frames, index) => (frames > 0 ? index : -1)).filter((index) => index >= 0);
  const first = held[0] ?? -1;
  const last = held[held.length - 1] ?? -1;
  assertLessThan(first, 30);
  assertEquals(held.length, last - first + 1, "the shell state holds on consecutive ticks");
  assertEquals(held.length, 240, "the shell state holds for its 240 frames");
  for (let index = first; index <= last; index++) assertGreaterThan(watch.scales[index] ?? 0.0, 0.0);
  assertEquals(watch.scales[last + 1], 0.0, "the cue is gone the frame after");
  assertEquals(watch.scales[first - 1], 0.0, "the cue is not there before the shell is up");
  assertEquals(watch.scales.slice(first, FROST_SHELL_FADE_FRAMES).every((scale) => scale === 1.0), true, "full scale before the last second");
  assertEquals(watch.copied.join(","), watch.scales.join(","), "the cue is a function of the fighter state alone");
});

test("Lich's Dark Ritual ends the Frost Armor cue on the frame it shatters the shell [k1 scenario]", () => {
  const watch = lichShell(160, (tick) => (tick === 100 ? "frostArmor" : "none"));
  const last = watch.armor.map((frames, index) => (frames > 0 ? index : -1)).filter((index) => index >= 0).pop() ?? -1;
  assertGreaterThan(last, 100);
  assertLessThan(last, 112);
  for (let index = 60; index <= last; index++) assertGreaterThan(watch.scales[index] ?? 0.0, 0.0);
  for (let index = last + 1; index < watch.scales.length; index++) assertEquals(watch.scales[index], 0.0);
});

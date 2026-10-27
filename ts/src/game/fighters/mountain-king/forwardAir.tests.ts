import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { createReplaySnapshot } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { AttackStyle, Character } from "../../sim/codes";
import { createFighter, type Fighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { fighterAt } from "../../sim/roster";

const WATCH_FRAMES = 30;
const AIR_HEIGHT = 300.0;

function lift(fighter: Fighter, height: number): void {
  fighter.motion.z = height;
  fighter.motion.vz = 0.0;
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  setWorldMotionValue(fighter.motion.meleeVelocityZ, fighter.motion.vz);
}

interface Contact {
  readonly frame: number;
  readonly damage: number;
}

function forwardAirContacts(foe: Character, foeAhead: number, foeBelow: number, percent: number): Contact[] {
  const state = createReplaySnapshot();
  const muradin = fighterAt(state.world, 0);
  const victim = fighterAt(state.world, 1);
  copyFighterState(muradin, createFighter(Character.mountainKing, 0.0, 1), 3);
  copyFighterState(victim, createFighter(foe, foeAhead, -1), 3);
  lift(muradin, AIR_HEIGHT);
  lift(victim, f32(AIR_HEIGHT - foeBelow));
  victim.status.damage = percent;
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 610;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const contacts: Contact[] = [];
  let seen = percent;
  for (let tick = 1; tick <= WATCH_FRAMES; tick++) {
    const row = inputRow({ held: tick === 1 ? maskOf(Action.cRight) : 0, pressed: tick === 1 ? maskOf(Action.cRight) : 0 });
    if (row === undefined) throw new Error("forward air input row");
    adaptInput(row, muradin, tick, state.controls.inputs[0], state.controls.commands[0]);
    stepMatch(state.match, state.world, state.controls, tick);
    if (tick === 1) assertEquals(muradin.attack.style, AttackStyle.forwardAir, "Muradin starts forward air");
    if (victim.status.damage > seen) {
      contacts.push({ frame: tick, damage: f32(victim.status.damage - seen) });
      seen = victim.status.damage;
    }
  }
  return contacts;
}

test("Muradin's forward air links its light first hammer into the spiking second at 0, 40 and 80 percent, against a light and a heavy foe level with him or below him [k1 scenario]", () => {
  const misses: string[] = [];
  for (const foe of [Character.rifleman, Character.mountainKing]) {
    for (const [ahead, below] of [[60.0, 0.0], [70.0, 30.0], [50.0, 50.0]] as const) {
      for (const percent of [0.0, 40.0, 80.0]) {
        const contacts = forwardAirContacts(foe, ahead, below, percent);
        const landed = contacts.map(c => `${c.damage.toFixed(1)}@${c.frame}`).join(" ");
        if (contacts.length !== 2 || contacts[0]!.damage !== 3.0 || contacts[1]!.damage !== f32(17.291038513183594)) misses.push(`foe ${foe} ahead ${ahead} below ${below} at ${percent}%: ${contacts.length === 0 ? "no hit" : landed}`);
      }
    }
  }
  assertEquals(misses.join("\n"), "");
});

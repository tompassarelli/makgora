import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action } from "../input/actions";
import { fighter, frame, scene } from "../match/padScene";
import { PLAYABLE_CHARACTERS, fighterName } from "../roster/kits";
import { AttackPhase, AttackStyle, Character } from "./codes";
import { attackPhase } from "./conditions";
import { attackStartupFrames } from "./moves";

const AERIALS = [
  { name: "neutral air", style: AttackStyle.neutralAir },
  { name: "forward air", style: AttackStyle.forwardAir },
  { name: "back air", style: AttackStyle.backAir },
  { name: "up air", style: AttackStyle.upAir },
  { name: "down air", style: AttackStyle.downAir },
] as const;
const FOE_DISTANCE = 1500.0;
const FRAME_LIMIT = 120;

function aerialAction(style: AttackStyle, facing: number): Action {
  if (style === AttackStyle.forwardAir) return facing > 0 ? Action.smashRight : Action.smashLeft;
  if (style === AttackStyle.backAir) return facing > 0 ? Action.smashLeft : Action.smashRight;
  if (style === AttackStyle.upAir) return Action.smashUp;
  if (style === AttackStyle.downAir) return Action.smashDown;
  return Action.attack;
}

interface ShortHop {
  readonly airborneFrames: number;
  readonly firstActiveFrame: number;
  readonly hitsAirborne: boolean;
  readonly started: boolean;
}

/** Taps jump for one frame, presses the aerial on the takeoff frame, and steps until the fighter lands. */
function shortHopAerial(character: Character, style: AttackStyle, facing: number): ShortHop {
  const s = scene(0, [{ character, x: 0.0, facing }, { character: Character.warden, x: -facing * FOE_DISTANCE, facing: -facing }]);
  const user = fighter(s);
  const firstActiveFrame = attackStartupFrames(style, user.tuning.moves) + 1;
  frame(s, [Action.jump]);
  let pressed = false;
  let started = false;
  let airborneFrames = 0;
  let hitsAirborne = false;
  for (let tick = 2; tick <= FRAME_LIMIT; tick++) {
    const takeoff: boolean = !pressed && (!user.motion.grounded || user.jump.squat === 1);
    pressed ||= takeoff;
    frame(s, takeoff ? [aerialAction(style, facing)] : []);
    if (takeoff) started = user.attack.style === style;
    if (!pressed) continue;
    if (user.motion.grounded) break;
    airborneFrames++;
    hitsAirborne ||= user.attack.style === style && attackPhase(user) === AttackPhase.active;
  }
  return { airborneFrames, firstActiveFrame, hitsAirborne, started };
}

test("Every fighter short hops each of the five aerials, pressed on the takeoff frame, into its first active frame before landing, facing either way [k1 scenario]", () => {
  const failures: string[] = [];
  for (const character of PLAYABLE_CHARACTERS) {
    for (const aerial of AERIALS) {
      for (const facing of [1, -1]) {
        const hop = shortHopAerial(character, aerial.style, facing);
        if (hop.started && hop.hitsAirborne) continue;
        const what = hop.started ? `first active frame ${hop.firstActiveFrame}` : "the press did not start the aerial";
        failures.push(`${fighterName(character)} ${aerial.name} facing ${facing > 0 ? "right" : "left"}: short hop airborne ${hop.airborneFrames} frames, ${what}`);
      }
    }
  }
  assertEquals(failures.join("\n"), "");
});

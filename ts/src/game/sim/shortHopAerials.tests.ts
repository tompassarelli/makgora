import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action } from "../input/actions";
import { fighter, frame, scene } from "../match/padScene";
import { PLAYABLE_CHARACTERS, fighterName } from "../roster/kits";
import { AttackPhase, AttackStyle, Character } from "./codes";
import { attackPhase } from "./conditions";
import { attackStartupFrames } from "./moves";
import { createFighter } from "./fighter";
import { fighterHurtParts } from "./hurtboxes";
import { idiv } from "wisp/src/sim/intMath";

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

const DOWN_AIR_PRESS_FRAMES = 4;
const DOWN_AIR_DEPARTURES: ReadonlySet<Character> = new Set([Character.pitLord, Character.lichKing]);

function standingHeight(character: Character): number {
  return fighterHurtParts(createFighter(character, 0.0, 1)).reduce((top, part) => Math.max(top, part.z1 + part.radius, part.z2 + part.radius), 0.0);
}

function averageHeightFighter(): Character {
  const byHeight = [...PLAYABLE_CHARACTERS].sort((a, b) => standingHeight(a) !== standingHeight(b) ? standingHeight(a) - standingHeight(b) : a - b);
  return byHeight[idiv(byHeight.length, 2)]!;
}

function shortHopDownAirHits(character: Character, foe: Character, facing: number, delay: number): boolean {
  const s = scene(0, [{ character, x: 0.0, facing }, { character: foe, x: facing * 1.0, facing: -facing }]);
  const user = fighter(s), target = fighter(s, 1);
  frame(s, [Action.jump]);
  let airborne = -1;
  for (let tick = 2; tick <= FRAME_LIMIT; tick++) {
    if (airborne >= 0 || !user.motion.grounded || user.jump.squat === 1) airborne++;
    frame(s, airborne === delay ? [Action.smashDown] : []);
    if (airborne > 0 && user.motion.grounded) return false;
    if (airborne >= delay && user.attack.style === AttackStyle.downAir && target.launch.hitlag > 0) return true;
  }
  return false;
}

test("Every fighter's short hop down air, pressed on the takeoff frame or any of the next three frames, hits a standing opponent of average height under it before landing, facing either way [k1 scenario]", () => {
  const foe = averageHeightFighter();
  const failures: string[] = [];
  for (const character of PLAYABLE_CHARACTERS) {
    for (const facing of [1, -1]) {
      const misses: number[] = [];
      for (let delay = 0; delay < DOWN_AIR_PRESS_FRAMES; delay++) if (!shortHopDownAirHits(character, foe, facing, delay)) misses.push(delay);
      const side = `${fighterName(character)} down air facing ${facing > 0 ? "right" : "left"}`;
      if (misses.length > 0 && !DOWN_AIR_DEPARTURES.has(character)) failures.push(`${side}: pressed ${misses.join(", ")} frames after takeoff, landed before hitting a standing ${fighterName(foe)}`);
      if (misses.length === 0 && DOWN_AIR_DEPARTURES.has(character)) failures.push(`${side}: hits from every press now, so it leaves DOWN_AIR_DEPARTURES`);
    }
  }
  assertEquals(failures.join("\n"), "");
});

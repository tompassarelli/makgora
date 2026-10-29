import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action } from "../input/actions";
import { fighter, frame, scene } from "../match/padScene";
import { PLAYABLE_CHARACTERS, fighterName } from "../roster/kits";
import { Character } from "./codes";
import { AUTHORED_PHYSICS, authoredPhysics, melee, type FighterPhysics } from "./tuning";

const FRAME_LIMIT = 200;

const VERTICAL = ["gravity", "terminalSpeed", "fastFallSpeed", "fullJumpSpeed", "shortJumpSpeed", "aerialJumpSpeed"] as const;

function withoutVertical(physics: FighterPhysics): object {
  const rest: { [key: string]: number } = { ...physics };
  for (const key of VERTICAL) delete rest[key];
  return rest;
}

function verticalOf(physics: FighterPhysics): number[] {
  return VERTICAL.map((key) => physics[key]);
}

test("Lich falls at gravity 0.19, terminal 2.4 and fast fall 3.0 Melee units, jumps at the reference speeds scaled by sqrt(0.19 / 0.23), and keeps every other physics value [k3 measure docs/design/roster.md]", () => {
  const lich = authoredPhysics(Character.lich);
  const reference = AUTHORED_PHYSICS.reference;
  const scale = Math.sqrt(f32(0.19) / f32(0.23));
  assertEquals(lich.gravity, melee(0.18999999761581421));
  assertEquals(lich.terminalSpeed, melee(2.4000000953674316));
  assertEquals(lich.fastFallSpeed, melee(3.0));
  const TOLERANCE = f32(0.0001);
  assertEquals(Math.abs(lich.fullJumpSpeed / reference.fullJumpSpeed - scale) < TOLERANCE, true);
  assertEquals(Math.abs(lich.shortJumpSpeed / reference.shortJumpSpeed - scale) < TOLERANCE, true);
  assertEquals(Math.abs(lich.aerialJumpSpeed / reference.aerialJumpSpeed - scale) < TOLERANCE, true);
  assertEquals(Math.round(lich.fullJumpSpeed / melee(1.0) * 100), 334);
  assertEquals(Math.round(lich.shortJumpSpeed / melee(1.0) * 100), 191);
  assertEquals(Math.round(lich.aerialJumpSpeed / melee(1.0) * 100), 401);
  const kept = withoutVertical(lich) as { [key: string]: number };
  const before = withoutVertical(reference) as { [key: string]: number };
  for (const key of ["airAcceleration", "airFriction", "airCap", "jumpSquatFrames", "jumpMomentum", "jumpHorizontalSpeed", "jumpHorizontalCap", "aerialJumpHorizontalSpeed", "shieldBreakSpeed"]) assertEquals(kept[key], before[key]);
});

test("No other fighter has changed vertical physics: heroes without their own record keep the reference values, and Kaelthas, Cairne, Pit Lord, Rifleman and Illidan keep theirs [k3 measure docs/design/roster.md]", () => {
  const reference = verticalOf(AUTHORED_PHYSICS.reference);
  const own: Character[] = [Character.lich, Character.kaelthas, Character.cairne, Character.pitLord, Character.rifleman, Character.demonHunter];
  const failures: string[] = [];
  for (const character of PLAYABLE_CHARACTERS) {
    if (own.includes(character)) continue;
    if (verticalOf(authoredPhysics(character)).join() !== reference.join()) failures.push(`${fighterName(character)} no longer takes the reference vertical physics`);
  }
  assertEquals(failures.join("\n"), "");
  assertEquals(verticalOf(authoredPhysics(Character.kaelthas)).map((v) => Math.round(v / melee(1.0) * 1000)).join(), "85,1550,2200,2300,1350,2500");
  assertEquals(verticalOf(authoredPhysics(Character.cairne)).map((v) => Math.round(v / melee(1.0) * 1000)).join(), "180,2800,3400,3260,2100,3910");
  assertEquals(verticalOf(authoredPhysics(Character.pitLord)).join(), verticalOf(authoredPhysics(Character.cairne)).join());
});

interface Jump {
  readonly apex: number;
  readonly airtime: number;
}

function fullJump(character: Character): Jump {
  const s = scene(0, [{ character, x: 0.0, facing: 1 }, { character: Character.warden, x: -1500.0, facing: -1 }]);
  const user = fighter(s);
  const ground = user.motion.z;
  let apex = 0.0;
  let airborneFrames = 0;
  let left = false;
  let previous = 0.0;
  let last = 0.0;
  for (let tick = 0; tick < FRAME_LIMIT; tick++) {
    frame(s, tick < 6 ? [Action.jump] : []);
    if (!user.motion.grounded) left = true;
    if (left && user.motion.grounded) break;
    if (left) {
      airborneFrames++;
      previous = last;
      last = user.motion.z - ground;
      apex = Math.max(apex, last);
    }
  }
  return { apex, airtime: airborneFrames + last / (previous - last) };
}

test("Lich's full jump peaks within 3% of the reference jump and hangs 8-12% longer before landing, the landing frame interpolated [k3 measure docs/design/roster.md]", () => {
  const before = fullJump(Character.warden);
  const after = fullJump(Character.lich);
  assertEquals(before.airtime > 0 && after.airtime > 0, true);
  const apexRatio = after.apex / before.apex;
  const airtimeRatio = after.airtime / before.airtime;
  assertEquals(Math.abs(apexRatio - 1.0) <= f32(0.03), true);
  assertEquals(airtimeRatio >= f32(1.08) && airtimeRatio <= f32(1.12), true);
});

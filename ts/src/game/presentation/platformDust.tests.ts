import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { setWorldMotionValue } from "../sim/motion";
import type { Controls, Roster } from "../sim/roster";
import { surfaceLeft, surfacePass, surfaceRight, surfaceZ } from "../sim/stage";
import { controls } from "../sim/testWorld";
import { duelPair, stepDuel } from "../sim/testDuel";
import { captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "./impactEvents";
import { IMPACT_DUST, IMPACT_PLATFORM_BURST, IMPACT_PLATFORM_LIP, IMPACTS_PER_KIND, type ImpactState, advanceImpacts, createImpactState, emitImpacts } from "./impactState";
import { PlatformCatch } from "./platformDust";

const STAGE = 1;
const PLATFORM = 1;
const NEUTRAL = controls();
const DOWN = controls({ verticalDirection: -1 });
const WAVELAND = controls({ airDodgePressed: true, shield: true, shieldPressed: true, dodgeX: 1, dodgeZ: -1, verticalDirection: -1, direction: 1 });

interface Run { readonly world: Roster; readonly f: Fighter; readonly impacts: ImpactState }

interface Caught { readonly kind: PlatformCatch; readonly frame: number; readonly burst: number; readonly lip: number; readonly dust: number; readonly size: number; readonly trail: number }

function run(x: number, z: number, vz: number): Run {
  const { world, owner: f } = duelPair(createFighter(Character.rifleman, 0.0, 1), createFighter(Character.rifleman, -900.0, -1), 0, STAGE);
  f.motion.x = x;
  f.motion.z = z;
  f.motion.vx = 0.0;
  f.motion.vz = vz;
  f.motion.grounded = false;
  f.motion.surface = undefined;
  setWorldMotionValue(f.motion.meleeZ, z);
  setWorldMotionValue(f.motion.meleeVelocityZ, vz);
  return { world, f, impacts: createImpactState() };
}

const occupied = (state: ImpactState, kind: number): number => {
  let count = 0;
  for (let slot = 0; slot < IMPACTS_PER_KIND; slot++) if (((state.occupied[kind] ?? 0) & (1 << slot)) !== 0) count++;
  return count;
};

function watch(r: Run, inputs: (frame: number) => Readonly<Controls>): Caught {
  const events = createImpactEvents();
  let caught: Caught | undefined;
  let trail = 0;
  for (let frame = 0; frame < 90; frame++) {
    captureImpactEventsBefore(events, r.f);
    stepDuel(r.world, inputs(frame), NEUTRAL, STAGE);
    finishImpactEventsAfter(events, r.f, r.world, STAGE, 0);
    const dustBefore = occupied(r.impacts, IMPACT_DUST);
    advanceImpacts(r.impacts);
    emitImpacts(r.impacts, events, frame, 0);
    if (caught !== undefined && occupied(r.impacts, IMPACT_DUST) > dustBefore) trail++;
    if (caught === undefined && events.ordinaryLanding) {
      caught = { kind: events.platform.kind, frame, burst: occupied(r.impacts, IMPACT_PLATFORM_BURST), lip: occupied(r.impacts, IMPACT_PLATFORM_LIP),
        dust: occupied(r.impacts, IMPACT_DUST), size: r.impacts.strength[IMPACT_PLATFORM_BURST * IMPACTS_PER_KIND] ?? 0.0, trail: 0 };
    }
    if (caught !== undefined && frame > caught.frame + 8) break;
  }
  assertTrue(caught !== undefined);
  return { ...caught!, trail };
}

const centre = (): number => f32((surfaceLeft(STAGE, PLATFORM, 0) + surfaceRight(STAGE, PLATFORM, 0)) / 2);
const top = (): number => surfaceZ(STAGE, PLATFORM, 0);

test("A platform landing, a rise-and-stand mount and a waveland onto a platform each raise the platform burst and lip line instead of the landing puff, the burst grows with landing speed, and a main-stage landing keeps the puff [k1 scenario]", () => {
  assertTrue(surfacePass(STAGE, PLATFORM));
  const soft = watch(run(centre(), f32(top() + 12.0), 0.0), () => NEUTRAL);
  const high = watch(run(centre(), f32(top() + 160.0), 0.0), () => NEUTRAL);
  const falling = run(centre(), f32(top() + 160.0), 0.0);
  falling.f.motion.fastFalling = true;
  falling.f.motion.vz = f32(-falling.f.tuning.physics.fastFallSpeed);
  setWorldMotionValue(falling.f.motion.meleeVelocityZ, falling.f.motion.vz);
  const fastFall = watch(falling, () => NEUTRAL);
  const mount = watch(run(centre(), f32(top() - 40.0), 6.0), () => DOWN);
  const waveland = watch(run(f32(centre() - 40.0), f32(top() + 30.0), 0.0), (frame) => frame === 0 ? WAVELAND : NEUTRAL);
  const stage = watch(run(0.0, 40.0, 0.0), () => NEUTRAL);
  for (const caught of [soft, high, fastFall, waveland]) assertEquals(caught.kind, PlatformCatch.landing);
  assertEquals(mount.kind, PlatformCatch.mount);
  for (const caught of [soft, high, fastFall, mount, waveland]) {
    assertEquals(caught.burst, 2);
    assertEquals(caught.lip, 1);
  }
  for (const caught of [soft, high, fastFall, mount]) assertEquals(caught.dust, 0);
  assertTrue(waveland.dust <= 1 && waveland.trail > 0);
  assertEquals(stage.kind, PlatformCatch.none);
  assertEquals(stage.burst + stage.lip, 0);
  assertEquals(stage.dust, 2);
  assertTrue(soft.size < high.size && high.size < fastFall.size);
  assertTrue(fastFall.size > f32(soft.size * f32(1.6)));
});

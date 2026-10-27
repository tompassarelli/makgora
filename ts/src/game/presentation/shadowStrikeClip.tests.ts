import { assertEquals, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { WARDEN_SPECIALS } from "../fighters/warden/specials";
import { Character, SpecialAction } from "../sim/codes";
import { SpecialForm, specialForm } from "../sim/specials/schema";
import { specialClip } from "./fighterClips";
import { FRAME_SECONDS } from "./fighterPose";
import { HERO_STRIKE_MOMENTS } from "./heroStrikeMomentInfo";
import { SPECIAL_KEY } from "./heroStrikeMomentKeys";

test("Maiev's Shadow Strike clip, played evenly across the move, reaches its measured throw pose within half a tick of the frame the dagger spawns, standing and in the air [k3 measure docs/design/maiev.md]", () => {
  const moment = HERO_STRIKE_MOMENTS[Character.warden]?.[SPECIAL_KEY];
  assertTrue(moment !== undefined);
  for (const [form, grounded] of [[SpecialForm.ground, true], [SpecialForm.air, false]] as const) {
    const move = specialForm(WARDEN_SPECIALS.neutral, form);
    const clip = specialClip(Character.warden, SpecialAction.heroNeutral, grounded, false);
    assertEquals(clip.index, moment!.clip);
    const spawn = move.projectiles?.[0]?.spawnFrame ?? 0;
    const rate = f32(clip.seconds / f32(move.endFrame * FRAME_SECONDS));
    assertNear(f32(spawn * f32(rate * FRAME_SECONDS)), moment!.seconds, f32(f32(rate * FRAME_SECONDS) * 0.5));
  }
});

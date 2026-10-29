import { assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { BUTCHER_SPECIALS, HOOK_FLIGHT_FRAMES } from "../fighters/butcher/specials";
import { HOOK_HAND, HOOK_LINK_COUNT, hookChainLength, hookLinkCount } from "./hookChain";

test("the chain has links enough to reach a full-hold hook at the end of its flight, thrown straight or aimed [k2 property]", () => {
  const throws = BUTCHER_SPECIALS.neutral.ground.followUps ?? [];
  const full = throws.find(followUp => followUp.chargeStage === HOOK_FLIGHT_FRAMES.length - 1)?.special.projectiles?.[0];
  if (full === undefined) throw new Error("Meat Hook has no full-hold throw");
  const aims = [[full.velocityX, full.velocityZ], [full.upVelocityX ?? 0.0, full.upVelocityZ ?? 0.0], [full.downVelocity?.velocityX ?? 0.0, full.downVelocity?.velocityZ ?? 0.0]] as const;
  for (const [velocityX, velocityZ] of aims) {
    const span = { fromX: HOOK_HAND.x, fromZ: HOOK_HAND.z, toX: f32(full.offsetX + f32(velocityX * full.life)), toZ: f32(full.offsetZ + f32(velocityZ * full.life)) };
    assertTrue(hookLinkCount(hookChainLength(span)) <= HOOK_LINK_COUNT);
  }
});

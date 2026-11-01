import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { partnerLook } from "../roster/costumes";
import { PARTNER_COSTUME } from "../presentation/model/costume";
import { Character, DuoRole } from "../sim/codes";
import { liveBodies } from "./liveCard";

test("A duo's player card draws both bodies, the lead on the left and the partner on the right at the partner's match scale on one floor, and a single fighter fills the card alone [k1 scenario]", () => {
  const scale = partnerLook(Character.murloc, DuoRole.partner)?.scale ?? 0.0;
  const [lead, partner, extra] = liveBodies(Character.murloc, 1);
  assertEquals(lead?.costume, 1);
  assertEquals(lead?.left, 0.0);
  assertEquals(lead?.width, 0.5);
  assertEquals(lead?.height, 1.0);
  assertEquals(partner?.costume, PARTNER_COSTUME);
  assertEquals(partner?.height, scale);
  assertEquals(partner?.width, f32(0.5 * scale));
  assertEquals(f32(f32(partner?.left ?? 0.0) + f32(f32(partner?.width ?? 0.0) / 2)), f32(0.75));
  assertEquals(extra, undefined);
  const alone = liveBodies(Character.demonHunter, 0);
  assertEquals(alone.length, 1);
  assertEquals(alone[0]?.width, 1.0);
  assertEquals(alone[0]?.height, 1.0);
});

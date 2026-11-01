import { f32 } from "wisp/src/sim/f32";
import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { DISCORD_INVITE, GITHUB_PAGE, communityBody, discordInviteLine } from "./community";
import { InfoPanelState } from "./infoPanelState";
import { COMMUNITY_BOX, CREDITS_BOX, boxContains } from "./selectionLayout";

test("The Community panel text holds the GitHub page and Discord invite read from the shared source, and Close or Escape closes it [k2 property]", () => {
  const body = communityBody();
  assertTrue(body.includes(GITHUB_PAGE));
  assertTrue(body.includes(DISCORD_INVITE));
  assertEquals(GITHUB_PAGE, "github.com/tompassarelli/smashcraft");
  assertEquals(DISCORD_INVITE, "discord.gg/JQGZs2UJR");
  assertTrue(body.includes("find games, report bugs and contribute"));
  assertTrue(discordInviteLine().includes(`https://${DISCORD_INVITE}`));
  const panel = new InfoPanelState();
  assertFalse(panel.close());
  panel.open();
  assertTrue(panel.close());
  assertFalse(panel.isOpen);
});

test("The Community button sits directly right of Credits at its size and on its row, and hits only its own box [k2 property]", () => {
  assertTrue(COMMUNITY_BOX.x >= CREDITS_BOX.x + CREDITS_BOX.width);
  assertTrue(COMMUNITY_BOX.x - (CREDITS_BOX.x + CREDITS_BOX.width) <= f32(0.011));
  assertEquals(COMMUNITY_BOX.y, CREDITS_BOX.y);
  assertEquals(COMMUNITY_BOX.width, CREDITS_BOX.width);
  assertEquals(COMMUNITY_BOX.height, CREDITS_BOX.height);
  assertTrue(f32(COMMUNITY_BOX.x + COMMUNITY_BOX.width) <= f32(0.8));
  const x = COMMUNITY_BOX.x + COMMUNITY_BOX.width / 2, y = COMMUNITY_BOX.y - COMMUNITY_BOX.height / 2;
  assertTrue(boxContains(COMMUNITY_BOX, x, y));
  assertFalse(boxContains(CREDITS_BOX, x, y));
});

import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { DISCORD_INVITE, GITHUB_PAGE, communityBody, discordInviteLine } from "./community";
import { InfoPanelState } from "./infoPanelState";

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


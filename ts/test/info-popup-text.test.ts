import { expect, test } from "bun:test";
import { install, startBuild } from "../src/platform/main";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { NATIVE_TEXT_BASE } from "../src/game/ui/hudLayout";
import { creditsLayout } from "../src/game/ui/creditsMenu";
import { communityLayout } from "../src/game/ui/communityMenu";
import { shell } from "../src/host/loop/state";
import { views } from "../src/host/loop/ui";
import { passStartControls } from "../scripts/wisp/startControls";
import { MAKGORA_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(MAKGORA_HEADLESS);

test("each Credits and Community body row draws at the font size its lines were wrapped for and spans the wrap width, since Classic sizes a plain text frame by its scale alone [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, [0, 1]);
  clients.start();
  passStartControls(clients);
  const selection = () => views(shell()).selections[0];
  const popups = [
    { open: () => selection().credits.open(), close: () => selection().credits.close(), name: "MeleeCreditsMenu", layout: creditsLayout("") },
    { open: () => selection().community.open(), close: () => selection().community.close(), name: "MeleeCommunityMenu", layout: communityLayout() },
  ];
  for (const popup of popups) {
    clients.client(0).run(popup.open);
    clients.frames(2);
    const rows = clients.client(0).frames.snapshot({ visibleOnly: true }).filter(frame => frame.name.startsWith(popup.name) && frame.name.includes("Row") && frame.text !== "");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.scale * NATIVE_TEXT_BASE).toBeCloseTo(popup.layout.size, 6);
      const [left, , right] = row.rectangle;
      expect(right - left).toBeCloseTo(popup.layout.width, 5);
    }
    clients.client(0).run(popup.close);
    clients.frames(2);
  }
  expect(clients.client(0).errors).toEqual([]);
});

import { expect, test } from "bun:test";
import { loadMapEntry } from "wisp/scripts/wisp/headless";
import type { RenderScene } from "wisp/scripts/wisp/headlessRender";
import { selectScenes } from "../scripts/selectStrip";
import { SMASHCRAFT_JOURNEYS } from "../scripts/wisp/journeys";

const shown = (scene: RenderScene | undefined, name: string) => scene?.ui.find((frame) => frame.name === name)?.visible === true;
const left = (scene: RenderScene | undefined, name: string) => scene?.ui.find((frame) => frame.name === name)?.rectangle[0] ?? Number.NaN;

test("a returning player's pointer over the roster carries the P1 chip in its pinching hand, once the Controls screen is closed [k1 scenario]", async () => {
  const entry = await loadMapEntry(SMASHCRAFT_JOURNEYS.entry);
  const journey = { frames: 40, events: [{ frame: 20, player: 0, key: 0x1b, meta: 0 }, { frame: 30, player: 0, mouse: { x: 432, y: 184 } }, { frame: 34, player: 0, mouse: { x: 568, y: 184 } }] };
  const [rest, first, moved] = selectScenes(entry, journey, [28, 32, 36], { width: 1280, height: 720 });
  expect(shown(rest, "MeleeHand0")).toBe(false);
  expect(shown(rest, "MeleeTutorialMenu0")).toBe(false);
  expect(shown(rest, "MeleeSettingsRoot0")).toBe(false);
  expect(shown(rest, "MeleeChip0_0")).toBe(true);
  expect(shown(first, "MeleeHand0")).toBe(true);
  expect(shown(moved, "MeleeHand0")).toBe(true);
  expect(left(moved, "MeleeChip0_0") - left(first, "MeleeChip0_0")).toBeCloseTo(136 * 0.6 / 720, 3);
});

import { expect, test } from "bun:test";
import { painShots, playerBuildEntry, victimCrop } from "../scripts/painStrip";
import { Character } from "../src/game/sim/codes";

test("each of the nine pain commands shows the struck fighter in its own contact clip, read from the simulation, on the first and held frames, drawn once by the map's own timeline body with no pose dissolve, and framed by the crop [k1 scenario]", () => {
  const screen = { width: 1280, height: 720 };
  const shots = painShots(playerBuildEntry(), [Character.dreadlord], screen, "classic");
  expect(shots.map((shot) => shot.category)).toEqual(["low-small", "low-medium", "low-large", "middle-small", "middle-medium", "middle-large", "high-small", "high-medium", "high-large"]);
  expect(new Set(shots.map((shot) => shot.expectedClip)).size).toBe(9);
  for (const shot of shots) {
    for (const scene of [shot.first, shot.held]) {
      const victim = scene?.units.find((unit) => unit.owner === 0);
      expect(victim).toBeDefined();
      if (scene === undefined || victim === undefined) continue;
      expect(scene.effects.filter((effect) => /^war3mapImported\\DreadlordTimelineBody/i.test(effect.model) && effect.alpha > 0 && Math.abs(effect.x - victim.x) < 250 && Math.abs(effect.z - victim.z) < 400).length).toBe(1);
      const crop = victimCrop(scene, screen);
      expect(crop.width).toBeGreaterThan(0);
      expect(crop.width).toBeLessThan(screen.width);
    }
    expect((shot.held?.frame ?? 0) - (shot.first?.frame ?? 0)).toBeGreaterThan(4);
  }
}, 120_000);

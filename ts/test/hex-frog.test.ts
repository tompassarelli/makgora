import { expect, test } from "bun:test";
import { Character, HeroStatusKind } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { HEX_FROG_MODEL, SpecialEffects } from "../src/game/render/specialEffects";

import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

test("a hexed fighter shows as Warcraft's frog where it stands, and the frog goes when the hex ends [k1 scenario]", () => {
  const client = headless.clients({ start: () => {}, install: () => {} }, [0]).client(0);
  client.run(() => {
    const effects = new SpecialEffects({ x: 0, y: 0, z: 0 });
    const victim = createFighter(Character.rifleman, 240.0, 1);
    const frogs = () => client.effectPoses({ visibleOnly: true }).filter(pose => pose.model === HEX_FROG_MODEL && pose.z > -500 && pose.scale > 0 && pose.alpha > 0);
    effects.presentConfirmedAnimated(1, victim, 0);
    expect(frogs()).toHaveLength(0);
    victim.status.condition = HeroStatusKind.hex;
    victim.status.conditionFrames = 50;
    effects.presentConfirmedAnimated(2, victim, 0);
    const shown = frogs();
    expect(shown).toHaveLength(1);
    expect(shown[0]!.x).toBeCloseTo(240.0, 3);
    victim.status.condition = HeroStatusKind.none;
    victim.status.conditionFrames = 0;
    effects.presentConfirmedAnimated(3, victim, 0);
    expect(frogs()).toHaveLength(0);
    effects.destroy();
  });
  expect(client.errors).toEqual([]);
});

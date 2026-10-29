import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { CUE_MODEL_RECORD, recordedFacts } from "../scripts/wisp/cueModels";
import { modelFactsKey, type TrackFacts } from "../scripts/wisp/effectVisibility";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { FLOOR_HEIGHT, HIDDEN_EFFECT_DEPTH, PLAYABLE_BOUNDS } from "../src/game/presentation/arenaCamera";
import { allProjectileModels, RIBBON_PARK_SEQUENCES } from "../src/game/presentation/projectileArt";
import { ProjectilePresentation } from "../src/game/render/projectilePresentation";
import { Character } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { projectileActive, updateProjectiles } from "../src/game/sim/projectiles";
import { createRoster, neutralControls, type Controls } from "../src/game/sim/roster";
import { advanceSpecials, startFighterSpecial } from "../src/game/sim/specials";
import { advanceHeroStatus } from "../src/game/sim/specials/engine";
import { advanceFighter } from "../src/game/sim/step";
import { beginDamageContacts, finishDamageContacts } from "../src/game/sim/contacts";
import { resolveAttacks } from "../src/game/sim/attacks";


const stopsAtEnd = (track: TrackFacts, start: number, end: number, looping: boolean): boolean => {
  if (typeof track === "number") return track === 0;
  if (track === null || track.global) return false;
  const inside = track.keys.filter(([frame]) => frame >= start && frame <= end);
  if (inside.length === 0) return false;
  if (!looping) return inside[inside.length - 1]?.[1] === 0;
  const before = [...track.keys].reverse().find(([frame]) => frame <= start);
  return (before?.[1] ?? 1) === 0 && inside.every(([, value]) => value === 0);
};

test("the ribbon park table covers exactly the projectile models whose recorded Classic facts carry a ribbon emitter, each parked in a sequence that ends with every ribbon stopped, or null where none does [k2 property]", () => {
  const recorded = recordedFacts(readFileSync(join(import.meta.dir, "../..", CUE_MODEL_RECORD), "utf8"));
  if ("problem" in recorded) throw new Error(recorded.problem);
  const ribboned = allProjectileModels().filter((model) => (recorded.facts.get(modelFactsKey(model))?.ribbons.length ?? 0) > 0);
  expect(Object.keys(RIBBON_PARK_SEQUENCES).sort()).toEqual([...ribboned].sort());
  for (const model of ribboned) {
    const facts = recorded.facts.get(modelFactsKey(model));
    const stopped = (facts?.sequences ?? []).filter((sequence) => (facts?.ribbons ?? []).every((ribbon) => [ribbon.visibility, ribbon.emission].some((track) => stopsAtEnd(track, sequence.start, sequence.end, sequence.looping)))).map((sequence) => sequence.name);
    const parked = RIBBON_PARK_SEQUENCES[model];
    if (parked === null) expect(stopped).toEqual([]);
    else expect(stopped).toContain(parked);
  }
});

function shoot(input: Readonly<Controls>, world: ReturnType<typeof createRoster>): void {
  const fighter = world.fighters[0];
  if (fighter === undefined) throw new Error("the world has its fighter");
  advanceFighter(world, 0, 0, input, 0.0);
  beginDamageContacts();
  startFighterSpecial(fighter, 0, 0, input, world);
  resolveAttacks(world);
  advanceSpecials(world, 0, 0);
  updateProjectiles(world);
  finishDamageContacts(world);
  advanceHeroStatus(fighter);
}

test("every parked ribbon projectile effect waits in its model's park sequence after each frame, so a launch never moves a live ribbon, on the ground and in the air [k1 scenario]", () => {
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  try {
    const clients = runtime.clients({ install() {}, start() {} }, [0]);
    const client = clients.client(0);
    clients.start();
    const origin = { x: 0.0, y: PLAYABLE_BOUNDS.centreY, z: FLOOR_HEIGHT };
    const parkedZ = origin.z - FLOOR_HEIGHT - HIDDEN_EFFECT_DEPTH;
    const models = new Map<unknown, string>();
    const lastZ = new Map<unknown, number>();
    const lastAnimation = new Map<unknown, string>();
    let launches = 0, checked = 0;
    const wrongly: string[] = [];
    client.run(() => {
      const natives = globalThis as unknown as Record<string, (...args: unknown[]) => unknown>;
      const add = natives.AddSpecialEffect, position = natives.BlzSetSpecialEffectPosition, animate = natives.BlzSetSpecialEffectAnimation;
      if (add === undefined || position === undefined || animate === undefined) throw new Error("missing effect natives");
      natives.AddSpecialEffect = (model, x, y) => {
        const handle = add(model, x, y);
        models.set(handle, model as string);
        return handle;
      };
      natives.BlzSetSpecialEffectPosition = (handle, x, y, z) => {
        if ((z as number) > parkedZ && (lastZ.get(handle) ?? 0.0) <= parkedZ && models.get(handle) !== undefined && RIBBON_PARK_SEQUENCES[models.get(handle) ?? ""] !== undefined) launches++;
        lastZ.set(handle, z as number);
        return position(handle, x, y, z);
      };
      natives.BlzSetSpecialEffectAnimation = (handle, name) => {
        lastAnimation.set(handle, String(name));
        return animate(handle, name);
      };
      const presentation = new ProjectilePresentation(Character.tyrande, origin);
      const audit = () => {
        for (const [handle, model] of models) {
          const parkSequence = RIBBON_PARK_SEQUENCES[model];
          if (typeof parkSequence !== "string" || (lastZ.get(handle) ?? 0.0) > parkedZ) continue;
          checked++;
          if (lastAnimation.get(handle)?.toLowerCase() !== parkSequence.toLowerCase()) wrongly.push(`${model} waits in ${lastAnimation.get(handle) ?? "its first sequence"}`);
        }
      };
      audit();
      for (const air of [false, true]) {
        const fighter = createFighter(Character.tyrande, 0.0, 1);
        const world = createRoster(1, [fighter]);
        for (let frame = 0; frame < 3; frame++) shoot(neutralControls(), world);
        for (let round = 0; round < 3; round++) {
          if (air) { fighter.motion.grounded = false; fighter.motion.z = 300.0; }
          shoot({ ...neutralControls(), specialPressed: true }, world);
          for (let frame = 0; frame < 90; frame++) {
            presentation.present(fighter, true, false);
            audit();
            shoot(neutralControls(), world);
          }
          expect(fighter.projectiles.some((_, index) => projectileActive(fighter, index))).toBe(false);
        }
      }
    });
    expect(launches).toBeGreaterThan(0);
    expect(checked).toBeGreaterThan(0);
    expect(wrongly).toEqual([]);
  } finally {
    runtime.restore();
  }
});
